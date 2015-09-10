/*eslint-disable no-native-reassign */
import SandboxBase from './base';
import NativeMethods from './native-methods';
import UrlUtil from '../utils/url';
import * as JSON from '../json';
import { isIE9 } from '../utils/browser';
import { isCrossDomainWindows } from '../utils/dom';
import { addInternalEventListener, setEventListenerWrapper } from './event/listeners';
/*eslint-enable no-native-reassign */

export default class MessageSandbox extends SandboxBase {
    constructor (sandbox) {
        super(sandbox);

        this.messageType = {
            SERVICE: '5Gtrb',
            USER:    'qWip2'
        };

        this.PING_DELAY              = 200;
        this.PING_IFRAME_TIMEOUT     = 7000;
        this.PING_IFRAME_MIN_TIMEOUT = 100;
        this.SERVICE_MSG_RECEIVED    = 'received';
        this.RECEIVE_MSG_FN          = 'tc_rmf_375fb9e7';

        this.pingCallback = null;
        this.pingCmd      = null;

        //NOTE: the window.top property may be changed after an iFrame is removed from DOM in IE, so we save it on script initializing
        this.topWindow = null;
        this.window    = null;

        this.storedOnMessageHandler = null;
    }

    _onMessage (e) {
        var data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;

        if (data.type === this.messageType.SERVICE && e.source) {
            if (this.pingCmd && data.message.cmd === this.pingCmd && data.message.isPingResponse) {
                this.pingCallback();
                this.pingCallback = null;
                this.pingCmd      = null;
            }
            else
                this._emit(this.SERVICE_MSG_RECEIVED, { message: data.message, source: e.source });
        }
    }

    _onWindowMessage (e, originListener) {
        var resultEvt = {};

        /* jshint ignore:start */
        for (var key in e)
            resultEvt[key] = typeof e[key] === 'function' ? e[key].bind(e) : e[key];
        /* jshint ignore:end */

        var data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;

        if (data.type !== this.messageType.SERVICE) {
            var originUrl = UrlUtil.OriginLocation.get();

            if (data.targetUrl === '*' || UrlUtil.sameOriginCheck(originUrl, data.targetUrl)) {
                resultEvt.origin = data.originUrl;

                // IE9 can send only string values
                var needToStringify = typeof data.message !== 'string' && (isIE9 || data.isStringMessage);

                resultEvt.data = needToStringify ? JSON.stringify(data.message) : data.message;

                return originListener.call(this.window, resultEvt);
            }
        }
    }

    _wrapMessage (type, message, targetUrl) {
        var parsedOrigin = UrlUtil.OriginLocation.getParsed();
        var originUrl    = UrlUtil.formatUrl({
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

        // IE9 can send only string values
        return isIE9 ? JSON.stringify(result) : result;
    }

    //NOTE: in IE after an iFrame is removed from DOM the window.top property is equal to window.self
    _isIFrameRemoved () {
        return this.window.top === this.window.self && this.window !== this.topWindow;
    }

    attach (window) {
        super.attach(window);
        //NOTE: the window.top property may be changed after an iFrame is removed from DOM in IE, so we save it on script initializing
        this.topWindow = window.top;

        var onMessageHandler        = this._onMessage.bind(this);
        var onWindowMessageHandler  = this._onWindowMessage.bind(this);

        addInternalEventListener(window, ['message'], onMessageHandler);
        setEventListenerWrapper(window, ['message'], onWindowMessageHandler);
        window[this.RECEIVE_MSG_FN] = isIFrameWithoutSrc || this.topWindow === window.self ? onMessageHandler : null;
    }

    setPingIFrameTimeout (value) {
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
            args[1] = UrlUtil.getCrossDomainProxyUrl();
        else if (!UrlUtil.isSupportedProtocol(contentWindow.location))
            args[1] = '*';
        else {
            args[1] = UrlUtil.formatUrl({
                protocol: this.window.location.protocol,
                host:     this.window.location.host
            });
        }

        args[0] = this._wrapMessage(this.messageType.USER, args[0], targetUrl);

        if (isIFrameWithoutSrc) {
            /*eslint-disable camelcase */
            this.window.tc_cw_375fb9e7 = contentWindow;
            this.window.tc_a_375fb9e7  = args;
            /*eslint-disable camelcase */

            return this.window.eval('this.window.tc_cw_375fb9e7.postMessage(this.window.tc_a_375fb9e7[0], this.window.tc_a_375fb9e7[1]); delete this.window.tc_cw_375fb9e7; delete this.window.tc_a_375fb9e7');
        }

        return contentWindow.postMessage(args[0], args[1]);
    }

    sendServiceMsg (msg, targetWindow) {
        var message = this._wrapMessage(this.messageType.SERVICE, msg);

        //NOTE: for iframes without src
        if (!this._isIFrameRemoved() && (isIFrameWithoutSrc || !isCrossDomainWindows(targetWindow, this.window) &&
                                                               targetWindow[this.RECEIVE_MSG_FN])) {
            //NOTE: postMessage delay imitation
            NativeMethods.setTimeout.call(this.topWindow, () =>
                    targetWindow[this.RECEIVE_MSG_FN]({
                        data:   JSON.parse(JSON.stringify(message)), // Cloning message to prevent this modification
                        source: this.window
                    })
                , 10);

            return null;
        }

        return targetWindow.postMessage(message, '*');
    }

    pingIFrame (targetIFrame, pingMessageCommand, callback, shortWaiting) {
        var pingInterval = null;
        var pingTimeout  = null;
        var targetWindow = null;

        var sendPingRequest = () => {
            if (targetIFrame.contentWindow) {
                targetWindow = targetIFrame.contentWindow;

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
            this.pingInterval = null;
            this.pingTimeout  = null;
        };

        this.pingTimeout = NativeMethods.setTimeout.call(this.window, () => {
            cleanTimeouts();
            callback(true);
        }, shortWaiting ? this.PING_IFRAME_MIN_TIMEOUT : this.PING_IFRAME_TIMEOUT);

        if (typeof callback === 'function') {
            this.pingCallback = () => {
                cleanTimeouts();
                callback();
            };

            this.pingCmd = pingMessageCommand;

            sendPingRequest();
            pingInterval = NativeMethods.setInterval.call(this.window, sendPingRequest, this.PING_DELAY);
        }
    }
}
