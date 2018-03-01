import Promise from 'pinkie';
import SandboxBase from '../base';
import nativeMethods from '../native-methods';
import * as destLocation from '../../utils/destination-location';
import { formatUrl, getCrossDomainProxyUrl, isSupportedProtocol } from '../../utils/url';
import { parse as parseJSON, stringify as stringifyJSON } from '../../json';
import { isCrossDomainWindows, getTopSameDomainWindow, isWindow, isMessageEvent } from '../../utils/dom';
import { callEventListener } from '../../utils/event';
import fastApply from '../../utils/fast-apply';
import { overrideDescriptor } from '../../utils/property-overriding';

const MESSAGE_TYPE = {
    service: 'hammerhead|service-msg',
    user:    'hammerhead|user-msg'
};

export default class MessageSandbox extends SandboxBase {
    constructor (listeners, unloadSandbox) {
        super();

        this.PING_DELAY                 = 200;
        this.PING_IFRAME_TIMEOUT        = 7000;
        this.PING_IFRAME_MIN_TIMEOUT    = 100;
        this.SERVICE_MSG_RECEIVED_EVENT = 'hammerhead|event|service-msg-received';
        this.RECEIVE_MSG_FN             = 'hammerhead|receive-msg-function';

        this.pingCallback = null;
        this.pingCmd      = null;

        // NOTE: The window.top property may be changed after an iframe is removed from DOM in IE, so we save it.
        this.topWindow = null;
        this.window    = null;

        this.listeners     = listeners;
        this.unloadSandbox = unloadSandbox;

        this.storedOnMessageHandler = null;
        this.isWindowUnloaded       = false;

        this.iframeInternalMsgQueue = [];
    }

    static _getMessageData (e) {
        const rawData = nativeMethods.messageEventDataGetter && isMessageEvent(e)
            ? nativeMethods.messageEventDataGetter.call(e)
            : e.data;

        return typeof rawData === 'string' ? parseJSON(rawData) : rawData;
    }

    _onMessage (e) {
        const data = MessageSandbox._getMessageData(e);

        if (data.type === MESSAGE_TYPE.service && e.source) {
            if (this.pingCmd && data.message.cmd === this.pingCmd && data.message.isPingResponse) {
                this.pingCallback();
                this.pingCallback = null;
                this.pingCmd      = null;
            }
            else
                this.emit(this.SERVICE_MSG_RECEIVED_EVENT, { message: data.message, source: e.source });
        }
    }

    _onWindowMessage (e, originListener) {
        const data = MessageSandbox._getMessageData(e);

        if (data.type !== MESSAGE_TYPE.service) {
            const originUrl = destLocation.get();

            if (data.targetUrl === '*' || destLocation.sameOriginCheck(originUrl, data.targetUrl))
                return callEventListener(this.window, originListener, e);
        }

        return null;
    }

    static _wrapMessage (type, message, targetUrl) {
        const parsedDest = destLocation.getParsed();
        const originUrl  = formatUrl({
            /*eslint-disable no-restricted-properties*/
            protocol: parsedDest.protocol,
            host:     parsedDest.host
            /*eslint-enable no-restricted-properties*/
        });

        return { message, originUrl, targetUrl, type };
    }

    _removeInternalMsgFromQueue (sendFunc) {
        for (let index = 0, length = this.iframeInternalMsgQueue.length; index < length; index++) {
            if (this.iframeInternalMsgQueue[index].sendFunc === sendFunc) {
                this.iframeInternalMsgQueue.splice(index, 1);

                return true;
            }
        }

        return false;
    }

    attach (window) {
        super.attach(window);
        // NOTE: The window.top property may be changed after an iframe is removed from DOM in IE, so we save it.
        this.topWindow        = window.top;
        this.isWindowUnloaded = false;

        this.unloadSandbox.on(this.unloadSandbox.UNLOAD_EVENT, () => {
            this.isWindowUnloaded = true;

            while (this.iframeInternalMsgQueue.length) {
                const msgInfo = this.iframeInternalMsgQueue[0];

                nativeMethods.clearTimeout.call(this.window, msgInfo.timeoutId);
                msgInfo.sendFunc();
            }
        });

        const onMessageHandler       = (...args) => fastApply(this, '_onMessage', args);
        const onWindowMessageHandler = (...args) => fastApply(this, '_onWindowMessage', args);

        this.listeners.addInternalEventListener(window, ['message'], onMessageHandler);
        this.listeners.setEventListenerWrapper(window, ['message'], onWindowMessageHandler);

        // NOTE: In Google Chrome, iframes whose src contains html code raise the 'load' event twice.
        // So, we need to define code instrumentation functions as 'configurable' so that they can be redefined.
        nativeMethods.objectDefineProperty.call(window.Object, window, this.RECEIVE_MSG_FN, {
            value:        onMessageHandler,
            configurable: true
        });

        if (nativeMethods.messageEventDataGetter) {
            overrideDescriptor(window.MessageEvent.prototype, 'data', {
                getter: function () {
                    const target = this.target;
                    const data   = nativeMethods.messageEventDataGetter.call(this);

                    if (data && data.type !== MESSAGE_TYPE.service && isWindow(target))
                        return data.message;

                    return data;
                }
            });
        }
    }

    setOnMessage (window, value) {
        if (typeof value === 'function') {
            this.storedOnMessageHandler = value;
            window.onmessage            = e => this._onWindowMessage(e, value);
        }
        else {
            this.storedOnMessageHandler = null;
            window.onmessage            = null;
        }
    }

    getOnMessage () {
        return this.storedOnMessageHandler;
    }

    postMessage (contentWindow, args) {
        const targetUrl = args[1];

        if (isCrossDomainWindows(this.window, contentWindow))
            args[1] = getCrossDomainProxyUrl();
        else if (!isSupportedProtocol(contentWindow.location.toString()) ||
                 !isSupportedProtocol(this.window.location.toString()))
            args[1] = '*';
        else {
            args[1] = formatUrl({
                /*eslint-disable no-restricted-properties*/
                protocol: this.window.location.protocol,
                host:     this.window.location.host
                /*eslint-enable no-restricted-properties*/
            });
        }

        args[0] = MessageSandbox._wrapMessage(MESSAGE_TYPE.user, args[0], targetUrl);

        if (isIframeWithoutSrc) {
            /*eslint-disable camelcase */
            this.window.tc_cw_375fb9e7 = contentWindow;
            this.window.tc_a_375fb9e7  = args;
            /*eslint-disable camelcase */

            return this.window.eval('this.window.tc_cw_375fb9e7.postMessage(this.window.tc_a_375fb9e7[0], this.window.tc_a_375fb9e7[1]); delete this.window.tc_cw_375fb9e7; delete this.window.tc_a_375fb9e7');
        }

        return contentWindow.postMessage(args[0], args[1]);
    }

    sendServiceMsg (msg, targetWindow) {
        const message         = MessageSandbox._wrapMessage(MESSAGE_TYPE.service, msg);
        const canSendDirectly = () => !isCrossDomainWindows(targetWindow, this.window) &&
                                      targetWindow[this.RECEIVE_MSG_FN];

        if (canSendDirectly()) {
            const sendFunc = force => {
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
                            source: this.window
                        });
                    }
                    /*eslint-disable no-empty */
                    catch (e) {
                    }
                    /*eslint-enable no-empty */
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

        return targetWindow.postMessage(message, '*');
    }

    pingIframe (targetIframe, pingMessageCommand, shortWaiting) {
        return new Promise((resolve, reject) => {
            let pingInterval = null;
            let pingTimeout  = null;
            let targetWindow = null;

            const sendPingRequest = () => {
                if (targetIframe.contentWindow) {
                    targetWindow = targetIframe.contentWindow;

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
