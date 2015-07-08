/*eslint-disable no-native-reassign */
import * as Browser from '../util/browser';
import * as DOM from '../util/dom';
import * as JSON from '../json';
import * as Listeners from './event/listeners';
import NativeMethods from './native-methods';
import * as Service from '../util/service';
import UrlUtil from '../util/url';
/*eslint-enable no-native-reassign */

const messageType = {
    SERVICE: '5Gtrb',
    USER:    'qWip2'
};

const PING_DELAY = 200;

//NOTE: published for test purposes only
export var PING_IFRAME_TIMEOUT       = 7000;
export const PING_IFRAME_MIN_TIMEOUT = 100;
export const SERVICE_MSG_RECEIVED    = 'received';
export function setPingIFrameTimeout (value) {
    PING_IFRAME_TIMEOUT = value;
}

const RECEIVE_MSG_FN = 'tc_rmf_375fb9e7';

var eventEmitter = new Service.EventEmitter();
var pingCallback = null;
var pingCmd      = null;

//NOTE: the window.top property may be changed after an iFrame is removed from DOM in IE, so we save it on script initializing
var topWindow = window.top;

export var on  = eventEmitter.on.bind(eventEmitter);
export var off = eventEmitter.off.bind(eventEmitter);

export function init (window) {
    function onMessage (e) {
        var data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;

        if (data.type === messageType.SERVICE && e.source) {
            /*eslint-disable indent */
            if (pingCmd && data.message.cmd === pingCmd && data.message.isPingResponse) {
                pingCallback();
                pingCallback = null;
                pingCmd      = null;
            }
            else
                eventEmitter.emit(SERVICE_MSG_RECEIVED, { message: data.message, source: e.source });
            /*eslint-enable indent */
        }
    }

    Listeners.addInternalEventListener(window, ['message'], onMessage);

    window[RECEIVE_MSG_FN] = isIFrameWithoutSrc || topWindow === window.self ? onMessage : null;

    Listeners.setEventListenerWrapper(window, ['message'], onWindowMessage);
}

function onWindowMessage (e, originListener) {
    var resultEvt = {};

    /* jshint ignore:start */
    for (var key in e)
        resultEvt[key] = typeof e[key] === 'function' ? e[key].bind(e) : e[key];
    /* jshint ignore:end */

    var data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;

    if (data.type !== messageType.SERVICE) {
        var originUrl = UrlUtil.OriginLocation.get();

        if (data.targetUrl === '*' || UrlUtil.sameOriginCheck(originUrl, data.targetUrl)) {
            resultEvt.origin = data.originUrl;

            // IE9 can send only string values
            if (typeof data.message !== 'string' && (Browser.isIE9 || data.isStringMessage))
                resultEvt.data = JSON.stringify(data.message);
            else
                resultEvt.data = data.message;

            return originListener.call(window, resultEvt);
        }
    }
}

export function setOnMessage (window, value) {
    if (typeof value === 'function') {
        this.storedOnMessageHandler = value;

        window.onmessage = function (e) {
            return onWindowMessage(e, value);
        };
    }
    else {
        this.storedOnMessageHandler = null;
        window.onmessage            = null;
    }
}

export function getOnMessage () {
    return this.storedOnMessageHandler;
}

export function postMessage (contentWindow, args) {
    var targetUrl = args[1];

    if (DOM.isCrossDomainWindows(window, contentWindow))
        args[1] = UrlUtil.getCrossDomainProxyUrl();
    else if (!UrlUtil.isSupportedProtocol(contentWindow.location))
        args[1] = '*';
    else {
        args[1] = UrlUtil.formatUrl({
            protocol: window.location.protocol,
            host:     window.location.host
        });
    }

    args[0] = wrapMessage(messageType.USER, args[0], targetUrl);

    if (isIFrameWithoutSrc) {
        /*eslint-disable camelcase */
        window.tc_cw_375fb9e7 = contentWindow;
        window.tc_a_375fb9e7  = args;
        /*eslint-disable camelcase */

        return window.eval('window.tc_cw_375fb9e7.postMessage(window.tc_a_375fb9e7[0], window.tc_a_375fb9e7[1]); delete window.tc_cw_375fb9e7; delete window.tc_a_375fb9e7');
    }

    return contentWindow.postMessage(args[0], args[1]);
}

//NOTE: in IE after an iFrame is removed from DOM the window.top property is equal to window.self
function isIFrameRemoved () {
    return window.top === window.self && window !== topWindow;
}

export function sendServiceMsg (msg, targetWindow) {
    var message = wrapMessage(messageType.SERVICE, msg);

    //NOTE: for iframes without src
    if (!isIFrameRemoved() && (isIFrameWithoutSrc || !DOM.isCrossDomainWindows(targetWindow, window) &&
                                                     targetWindow[RECEIVE_MSG_FN])) {
        //NOTE: postMessage delay imitation
        NativeMethods.setTimeout.call(topWindow, function () {
            targetWindow[RECEIVE_MSG_FN]({
                data:   JSON.parse(JSON.stringify(message)), // Cloning message to prevent this modification
                source: window
            });
        }, 10);

        return null;
    }

    return targetWindow.postMessage(message, '*');
}

export function pingIFrame (targetIFrame, pingMessageCommand, callback, shortWaiting) {
    var pingInterval = null;
    var pingTimeout  = null;
    var targetWindow = null;

    function sendPingRequest () {
        if (targetIFrame.contentWindow) {
            targetWindow = targetIFrame.contentWindow;

            sendServiceMsg({
                cmd:           pingCmd,
                isPingRequest: true
            }, targetWindow);
        }
    }

    function cleanTimeouts () {
        window.clearInterval(pingInterval);
        window.clearTimeout(pingTimeout);

        pingCallback = null;
        pingCmd      = null;
        pingInterval = null;
        pingTimeout  = null;
    }

    pingTimeout = NativeMethods.setTimeout.call(window, function () {
        cleanTimeouts();
        callback(true);
    }, shortWaiting ? PING_IFRAME_MIN_TIMEOUT : PING_IFRAME_TIMEOUT);

    if (typeof callback === 'function') {
        pingCallback = function () {
            cleanTimeouts();
            callback();
        };

        pingCmd      = pingMessageCommand;

        sendPingRequest();
        pingInterval = NativeMethods.setInterval.call(window, sendPingRequest, PING_DELAY);
    }
}

function wrapMessage (type, message, targetUrl) {
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
    return Browser.isIE9 ? JSON.stringify(result) : result;
}
