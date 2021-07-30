import Promise from 'pinkie';
import SandboxBase from '../base';
import nativeMethods from '../native-methods';
import * as destLocation from '../../utils/destination-location';
import { formatUrl } from '../../utils/url';
import { isCrossDomainWindows, getTopSameDomainWindow, isWindow, isMessageEvent } from '../../utils/dom';
import { callEventListener } from '../../utils/event';
import fastApply from '../../utils/fast-apply';
import { overrideDescriptor } from '../../utils/overriding';
import { parse as parseJSON, stringify as stringifyJSON } from '../../../utils/json';
import Listeners from './listeners';
import UnloadSandbox from './unload';

enum MessageType {
    Service = 'hammerhead|service-msg',
    User    = 'hammerhead|user-msg'
}

export default class MessageSandbox extends SandboxBase {
    readonly PING_DELAY = 200;
    readonly PING_IFRAME_TIMEOUT = 7000;
    readonly PING_IFRAME_MIN_TIMEOUT = 100;
    readonly SERVICE_MSG_RECEIVED_EVENT = 'hammerhead|event|service-msg-received';
    readonly RECEIVE_MSG_FN = 'hammerhead|receive-msg-function';

    topWindow: Window & typeof globalThis | null;
    window: Window & typeof globalThis | null;

    pingCallback: any;
    pingCmd: any;

    storedOnMessageHandler: (this: WindowEventHandlers, ev: MessageEvent) => any;
    isWindowUnloaded: boolean;

    iframeInternalMsgQueue: any[];

    constructor (private readonly _listeners: Listeners,
        private readonly _unloadSandbox: UnloadSandbox) {
        super();

        // NOTE: The window.top property may be changed after an iframe is removed from DOM in IE, so we save it.
        this.topWindow = null;
        this.window    = null;

        this.storedOnMessageHandler = null;
        this.isWindowUnloaded       = false;

        this.iframeInternalMsgQueue = [];
    }

    private static _getMessageData (e) {
        const rawData = isMessageEvent(e) ? nativeMethods.messageEventDataGetter.call(e) : e.data;

        return typeof rawData === 'string' ? parseJSON(rawData) : rawData;
    }

    // NOTE: some window may be unavailable for the sending message, for example, if it was removed.
    // In some browsers, window.postMessage is equal null, but other throw exception by property access.
    private static  _isWindowAvailable (window: Window): boolean {
        try {
            return !!window.postMessage;
        } catch (e) {
            return false;
        }
    }

    // @ts-ignore
    private _onMessage (e: MessageEvent): void {
        const data = MessageSandbox._getMessageData(e);

        if (data.type === MessageType.Service && e.source) {
            if (this.pingCmd && data.message.cmd === this.pingCmd && data.message.isPingResponse) {
                this.pingCallback();
                this.pingCallback = null;
                this.pingCmd      = null;
            }
            else
                this.emit(this.SERVICE_MSG_RECEIVED_EVENT, { message: data.message, source: e.source, ports: e.ports });
        }
    }

    private _onWindowMessage (e: MessageEvent, originListener): void {
        const data = MessageSandbox._getMessageData(e);

        if (data.type !== MessageType.Service) {
            const originUrl = destLocation.get();

            if (data.targetUrl === '*' || destLocation.sameOriginCheck(originUrl, data.targetUrl))
                return callEventListener(this.window, originListener, e);
        }

        return null;
    }

    private static _wrapMessage (type: MessageType, message, targetUrl?: string) {
        const parsedDest = destLocation.getParsed();
        const originUrl  = formatUrl({
            /*eslint-disable no-restricted-properties*/
            protocol: parsedDest.protocol,
            host:     parsedDest.host
            /*eslint-enable no-restricted-properties*/
        });

        return { message, originUrl, targetUrl, type };
    }

    private _removeInternalMsgFromQueue (sendFunc: Function): boolean {
        for (let index = 0, length = this.iframeInternalMsgQueue.length; index < length; index++) {
            if (this.iframeInternalMsgQueue[index].sendFunc === sendFunc) {
                this.iframeInternalMsgQueue.splice(index, 1);

                return true;
            }
        }

        return false;
    }

    attach (window: Window & typeof globalThis): void {
        super.attach(window);
        // NOTE: The window.top property may be changed after an iframe is removed from DOM in IE, so we save it.
        this.topWindow        = window.top as Window & typeof globalThis;
        this.isWindowUnloaded = false;

        this._unloadSandbox.on(this._unloadSandbox.UNLOAD_EVENT, () => {
            this.isWindowUnloaded = true;

            while (this.iframeInternalMsgQueue.length) {
                const msgInfo = this.iframeInternalMsgQueue[0];

                nativeMethods.clearTimeout.call(this.window, msgInfo.timeoutId);
                msgInfo.sendFunc();
            }
        });

        const onMessageHandler       = (...args) => fastApply(this, '_onMessage', args);
        const onWindowMessageHandler = (...args) => fastApply(this, '_onWindowMessage', args);

        this._listeners.addInternalEventBeforeListener(window, ['message'], onMessageHandler);
        this._listeners.setEventListenerWrapper(window, ['message'], onWindowMessageHandler);

        // NOTE: In Google Chrome, iframes whose src contains html code raise the 'load' event twice.
        // So, we need to define code instrumentation functions as 'configurable' so that they can be redefined.
        nativeMethods.objectDefineProperty(window, this.RECEIVE_MSG_FN, {
            value:        onMessageHandler,
            configurable: true
        });

        // @ts-ignore
        overrideDescriptor(window.MessageEvent.prototype, 'data', {
            getter: function (this: MessageEvent) {
                const target = nativeMethods.eventTargetGetter.call(this);
                const data   = nativeMethods.messageEventDataGetter.call(this);

                if (data && data.type !== MessageType.Service && isWindow(target))
                    return data.message;

                return data;
            }
        });

        // @ts-ignore
        const eventPropsOwner = nativeMethods.isEventPropsLocatedInProto ? window.Window.prototype : window;

        overrideDescriptor(eventPropsOwner, 'onmessage', {
            getter: () => this.storedOnMessageHandler,
            setter: handler => {
                this.storedOnMessageHandler = typeof handler === 'function' ? handler : null;

                nativeMethods.winOnMessageSetter.call(window, this.storedOnMessageHandler
                    ? e => this._onWindowMessage(e, handler)
                    : null);
            }
        });
    }

    postMessage (contentWindow: Window, args) {
        const targetUrl = args[1] || destLocation.getOriginHeader();

        // NOTE: Here, we pass all messages as "no preference" ("*").
        // We do an origin check in "_onWindowMessage" to access the target origin.
        args[1] = '*';
        args[0] = MessageSandbox._wrapMessage(MessageType.User, args[0], targetUrl);


        return fastApply(contentWindow, 'postMessage', args);
    }

    sendServiceMsg (msg, targetWindow: Window, ports?: Transferable[]) {
        const message         = MessageSandbox._wrapMessage(MessageType.Service, msg);
        const canSendDirectly = !isCrossDomainWindows(targetWindow, this.window) && !!targetWindow[this.RECEIVE_MSG_FN];

        if (!canSendDirectly)
            return MessageSandbox._isWindowAvailable(targetWindow) && targetWindow.postMessage(message, '*', ports);

        const sendFunc = (force: boolean) => {
            // NOTE: In IE, this function is called on the timeout despite the fact that the timer has been cleared
            // in the unload event handler, so we check whether the function is in the queue
            if (force || this._removeInternalMsgFromQueue(sendFunc)) {
                // NOTE: The 'sendFunc' function may be called on timeout, so we must call 'canSendDirectly' again,
                // because the iframe could become cross-domain in the meantime. Unfortunately, Chrome hangs when
                // trying to call the 'isCrossDomainWindows' function, so we have to wrap it in 'try/catch'.
                try {
                    targetWindow[this.RECEIVE_MSG_FN]({
                        // NOTE: Cloning a message to prevent this modification.
                        data:   parseJSON(stringifyJSON(message)),
                        source: this.window,
                        ports
                    });
                }
                // eslint-disable-next-line no-empty
                catch (e) {
                }
            }
        };

        if (!this.isWindowUnloaded) {
            // NOTE: Imitation of a delay for the postMessage method.
            // We use the same-domain top window
            // so that the function called by setTimeout is executed after removing the iframe
            const topSameDomainWindow = getTopSameDomainWindow(this.window);
            const timeoutId           = nativeMethods.setTimeout.call(topSameDomainWindow, sendFunc, 10);

            this.iframeInternalMsgQueue.push({ timeoutId, sendFunc });
        }
        else
            sendFunc(true);

        return null;
    }

    // NOTE: This code is used only in legacy API.
    pingIframe (targetIframe, pingMessageCommand, shortWaiting: boolean) {
        return new Promise((resolve, reject) => {
            let pingInterval = null;
            let pingTimeout  = null;
            let targetWindow = null;

            const sendPingRequest = () => {
                targetWindow = nativeMethods.contentWindowGetter.call(targetIframe);

                if (targetWindow) {
                    this.sendServiceMsg({
                        cmd:           this.pingCmd,
                        isPingRequest: true
                    }, targetWindow);
                }
            };

            const cleanTimeouts = () => {
                nativeMethods.clearInterval.call(this.window, pingInterval);
                nativeMethods.clearTimeout.call(this.window, pingTimeout);

                this.pingCallback = null;
                this.pingCmd      = null;
                pingInterval      = null;
                pingTimeout       = null;
            };

            pingTimeout = nativeMethods.setTimeout.call(this.window, () => {
                cleanTimeouts();
                reject();
            }, shortWaiting ? this.PING_IFRAME_MIN_TIMEOUT : this.PING_IFRAME_TIMEOUT);

            this.pingCallback = () => {
                cleanTimeouts();
                resolve();
            };

            this.pingCmd = pingMessageCommand;

            sendPingRequest();
            pingInterval = nativeMethods.setInterval.call(this.window, sendPingRequest, this.PING_DELAY);
        });
    }
}
