/*global history, navigator*/
import { isMozilla } from '../../util/browser';
import { isCrossDomainWindows } from '../../util/dom';
import { ORIGINAL_WINDOW_ON_ERROR_HANDLER_KEY } from '../dom-accessor-wrappers';
import * as MessageSandbox from '../message';
import NativeMethods from '../native-methods';
import ScriptProcessor from '../../../processing/script';
import { EventEmitter } from '../../util/service';
import { isShadowUIMutation } from '../shadow-ui';
import UrlUtil from '../../util/url';

// Const
export const UNCAUGHT_JS_ERROR = 'uncaughtJSError';

var eventEmitter = new EventEmitter();

export var on  = eventEmitter.on.bind(eventEmitter);
export var off = eventEmitter.off.bind(eventEmitter);

function raiseUncaughtJsErrorEvent (msg, window, pageUrl) {
    if (isCrossDomainWindows(window, window.top))
        return;

    var sendToTopWindow = window !== window.top;

    if (!pageUrl)
        pageUrl = UrlUtil.OriginLocation.get();

    if (sendToTopWindow) {
        eventEmitter.emit(UNCAUGHT_JS_ERROR, {
            msg:      msg,
            pageUrl:  pageUrl,
            inIFrame: true
        });

        MessageSandbox.sendServiceMsg({
            cmd:     UNCAUGHT_JS_ERROR,
            pageUrl: pageUrl,
            msg:     msg
        }, window.top);
    }
    else {
        eventEmitter.emit(UNCAUGHT_JS_ERROR, {
            msg:     msg,
            pageUrl: pageUrl
        });
    }
}

export function init () {
    MessageSandbox.on(MessageSandbox.SERVICE_MSG_RECEIVED, function (e) {
        var message = e.message;

        if (message.cmd === UNCAUGHT_JS_ERROR)
            raiseUncaughtJsErrorEvent(message.msg, window, message.pageUrl);
    });
}

export function override (window, overrideNewElement) {
    window.CanvasRenderingContext2D.prototype.drawImage = function () {
        var args = Array.prototype.slice.call(arguments, 0);
        var img  = args.shift();
        var src  = img.src;

        if (UrlUtil.sameOriginCheck(location.toString(), src)) {
            img     = NativeMethods.createElement.call(window.document, 'img');
            img.src = UrlUtil.getProxyUrl(src);
        }

        args.unshift(img);

        return NativeMethods.canvasContextDrawImage.apply(this, args);
    };

    // Override uncaught error handling
    window.onerror = function (msg, url, line, col, errObj) {
        // FireFox raises NS_ERROR_NOT_INITIALIZED exception after widnow has been removed from the dom
        if (msg.indexOf('NS_ERROR_NOT_INITIALIZED') !== -1)
            return true;

        var originalOnErrorHandler = window[ORIGINAL_WINDOW_ON_ERROR_HANDLER_KEY];

        var caught = originalOnErrorHandler &&
                     originalOnErrorHandler.call(window, msg, url, line, col, errObj) === true;

        if (caught)
            return true;

        raiseUncaughtJsErrorEvent(msg, window);

        return false;
    };

    window.open = function () {
        var newArgs = [];

        newArgs.push(UrlUtil.getProxyUrl(arguments[0]));
        newArgs.push('_self');

        if (arguments.length > 2)
            newArgs.push(arguments[2]);
        if (arguments.length > 3)
            newArgs.push(arguments[3]);

        return NativeMethods.windowOpen.apply(window, newArgs);
    };

    window.Worker = function (scriptURL) {
        scriptURL = UrlUtil.getProxyUrl(scriptURL);

        return new NativeMethods.Worker(scriptURL);
    };

    if (window.Blob) {
        window.Blob = function (parts, opts) {
            var type = opts && opts.type && opts.type.toString().toLowerCase();

            if (type === 'text/javascript' || type === 'application/javascript' ||
                type === 'application/x-javascript') {
                parts = [ScriptProcessor.process(parts.join(''))];
            }

            return new NativeMethods.Blob(parts, opts);
        };
    }

    window.EventSource = function (url) {
        url = UrlUtil.getProxyUrl(url);

        return new NativeMethods.EventSource(url);
    };

    if (window.MutationObserver) {
        window.MutationObserver = function (callback) {
            var wrapper = function (mutations) {
                var result = [];

                for (var i = 0; i < mutations.length; i++) {
                    if (!isShadowUIMutation(mutations[i]))
                        result.push(mutations[i]);
                }

                if (result.length)
                    callback(result);
            };

            return new NativeMethods.MutationObserver(wrapper);
        };
    }

    if (window.navigator && window.navigator.serviceWorker) {
        window.navigator.serviceWorker.register = function (url) {
            url = UrlUtil.getProxyUrl(url);

            return NativeMethods.registerServiceWorker.call(window.navigator.serviceWorker, url);
        };
    }

    window.Image = function () {
        var image = null;

        if (!arguments.length)
            image = new NativeMethods.Image();
        else if (arguments.length === 1)
            image = new NativeMethods.Image(arguments[0]);
        else
            image = new NativeMethods.Image(arguments[0], arguments[1]);

        overrideNewElement(image);

        return image;
    };

    if (typeof window.history.pushState === 'function' && typeof window.history.replaceState === 'function') {
        window.history.pushState = function (data, title, url) {
            var args = [data, title];

            if (arguments.length > 2)
                args.push(url ? UrlUtil.getProxyUrl(url) : url);

            return NativeMethods.historyPushState.apply(history, args);
        };

        window.history.replaceState = function (data, title, url) {
            var args = [data, title];

            if (arguments.length > 2)
                args.push(url ? UrlUtil.getProxyUrl(url) : url);

            return NativeMethods.historyReplaceState.apply(history, args);
        };
    }

    if (window.navigator.registerProtocolHandler) {
        window.navigator.registerProtocolHandler = function () {
            var args           = Array.prototype.slice.call(arguments);
            var urlIndex       = 1;
            var originHostname = UrlUtil.OriginLocation.getParsed().hostname;
            var isOriginUrl    = isMozilla ? UrlUtil.isSubDomain(originHostname, UrlUtil.parseUrl(args[urlIndex]).hostname) :
                                 UrlUtil.sameOriginCheck(UrlUtil.OriginLocation.get(), args[urlIndex]);

            if (isOriginUrl)
                args[urlIndex] = UrlUtil.getProxyUrl(args[urlIndex]);

            return NativeMethods.registerProtocolHandler.apply(navigator, args);
        };
    }
}

