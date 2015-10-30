/*eslint-disable no-native-reassign */
import SandboxBase from '../base';
import nativeMethods from '../native-methods';
import * as originLocation from '../../utils/origin-location';
import { formatUrl, getCrossDomainProxyUrl, isSupportedProtocol } from '../../utils/url';
import { parse as parseJSON, stringify as stringifyJSON } from '../../json';
import { isIE9 } from '../../utils/browser';
import { isCrossDomainWindows } from '../../utils/dom';
import { isObjectEventListener } from '../../utils/event';
import { Promise } from 'es6-promise';

/*eslint-enable no-native-reassign */

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

        this.iframeInternalMsgQueue = [];
    }

    _onMessage (e) {
        var data = typeof e.data === 'string' ? parseJSON(e.data) : e.data;

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
        var resultEvt = {};

        /* jshint ignore:start */
        for (var key in e)
            resultEvt[key] = typeof e[key] === 'function' ? e[key].bind(e) : e[key];
        /* jshint ignore:end */

        var data = typeof e.data === 'string' ? parseJSON(e.data) : e.data;

        if (data.type !== MESSAGE_TYPE.service) {
            var originUrl = originLocation.get();

            if (data.targetUrl === '*' || originLocation.sameOriginCheck(originUrl, data.targetUrl)) {
                resultEvt.origin = data.originUrl;

                // NOTE: IE9 can send only string values.
                var needToStringify = typeof data.message !== 'string' && (isIE9 || data.isStringMessage);

                resultEvt.data = needToStringify ? stringifyJSON(data.message) : data.message;

                if (isObjectEventListener(originListener))
                    return originListener.handleEvent.call(originListener, resultEvt);

                return originListener.call(this.window, resultEvt);
            }
        }
    }

    static _wrapMessage (type, message, targetUrl) {
        var parsedOrigin = originLocation.getParsed();
        var originUrl    = formatUrl({
            protocol: parsedOrigin.protocol,
            host:     parsedOrigin.host
        });

        var result = {
            isStringMessage: typeof message === 'string',
            message:         message,
            originUrl:       originUrl,
            targetUrl:       targetUrl,
            type:            type
        };

        // NOTE: IE9 can send only string values.
        return isIE9 ? stringifyJSON(result) : result;
    }

    // NOTE: In IE, after an iframe is removed from DOM, the window.top property is equal to window.self.
    _isIframeRemoved () {
        return this.window.top === this.window.self && this.window !== this.topWindow;
    }

    _removeInternalMsgFromQueue (sendFunc) {
        for (var index = 0, length = this.iframeInternalMsgQueue.length; index < length; index++) {
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
        this.topWindow = window.top;

        this.unloadSandbox.on(this.unloadSandbox.UNLOAD_EVENT, () => {
            while (this.iframeInternalMsgQueue.length) {
                var msgInfo = this.iframeInternalMsgQueue[0];

                this.window.clearTimeout(msgInfo.timeoutId);
                msgInfo.sendFunc();
            }
        });

        var onMessageHandler        = this._onMessage.bind(this);
        var onWindowMessageHandler  = this._onWindowMessage.bind(this);

        this.listeners.addInternalEventListener(window, ['message'], onMessageHandler);
        this.listeners.setEventListenerWrapper(window, ['message'], onWindowMessageHandler);
        window[this.RECEIVE_MSG_FN] = isIframeWithoutSrc || this.topWindow === window.self ? onMessageHandler : null;
    }

    setPingIframeTimeout (value) {
        this.PING_IFRAME_TIMEOUT = value;
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
        var targetUrl = args[1];

        if (isCrossDomainWindows(this.window, contentWindow))
            args[1] = getCrossDomainProxyUrl();
        else if (!isSupportedProtocol(contentWindow.location))
            args[1] = '*';
        else {
            args[1] = formatUrl({
                protocol: this.window.location.protocol,
                host:     this.window.location.host
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
        var message = MessageSandbox._wrapMessage(MESSAGE_TYPE.service, msg);

        // NOTE: For iframes without src.
        if (!this._isIframeRemoved() && (isIframeWithoutSrc || !isCrossDomainWindows(targetWindow, this.window) &&
                                                               targetWindow[this.RECEIVE_MSG_FN])) {
            var sendFunc  = () => {
                // NOTE: In IE, this function is called on the timeout despite the fact that the timer has been cleared
                // in the unload event handler, so we check whether the function is in the queue
                if (this._removeInternalMsgFromQueue(sendFunc)) {
                    targetWindow[this.RECEIVE_MSG_FN]({
                        // NOTE: Cloning a message to prevent this modification.
                        data:   parseJSON(stringifyJSON(message)),
                        source: this.window
                    });
                }
            };

            // NOTE: Imitation of a delay for the postMessage method.
            var timeoutId = nativeMethods.setTimeout.call(this.topWindow, sendFunc, 10);

            this.iframeInternalMsgQueue.push({ timeoutId, sendFunc });

            return null;
        }

        return targetWindow.postMessage(message, '*');
    }

    pingIframe (targetIframe, pingMessageCommand, shortWaiting) {
        return new Promise(resolve => {
            var pingInterval = null;
            var pingTimeout  = null;
            var targetWindow = null;

            var sendPingRequest = () => {
                if (targetIframe.contentWindow) {
                    targetWindow = targetIframe.contentWindow;

                    this.sendServiceMsg({
                        cmd:           this.pingCmd,
                        isPingRequest: true
                    }, targetWindow);
                }
            };

            var cleanTimeouts = () => {
                this.window.clearInterval(pingInterval);
                this.window.clearTimeout(pingTimeout);

                this.pingCallback = null;
                this.pingCmd      = null;
                pingInterval      = null;
                pingTimeout       = null;
            };

            pingTimeout = nativeMethods.setTimeout.call(this.window, () => {
                cleanTimeouts();
                resolve(true);
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
