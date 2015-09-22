/*global history, navigator*/
import SandboxBase from '../base';
import ShadowUI from '../shadow-ui';
import CodeInstrumentation from '../code-instrumentation';
import nativeMethods from '../native-methods';
import scriptProcessor from '../../../processing/script';
import urlUtils from '../../utils/url';
import { isMozilla } from '../../utils/browser';
import { isCrossDomainWindows, isImgElement } from '../../utils/dom';

export default class WindowSandbox extends SandboxBase {
    constructor (sandbox) {
        super(sandbox);

        this.UNCAUGHT_JS_ERROR_EVENT = 'hammerhead|event|uncaught-js-error';
    }

    _raiseUncaughtJsErrorEvent (msg, window, pageUrl) {
        if (!isCrossDomainWindows(window, window.top)) {
            var sendToTopWindow = window !== window.top;

            if (!pageUrl)
                pageUrl = urlUtils.OriginLocation.get();

            if (sendToTopWindow) {
                this._emit(this.UNCAUGHT_JS_ERROR_EVENT, {
                    msg:      msg,
                    pageUrl:  pageUrl,
                    inIFrame: true
                });

                this.sandbox.message.sendServiceMsg({
                    cmd:     this.UNCAUGHT_JS_ERROR_EVENT,
                    pageUrl: pageUrl,
                    msg:     msg
                }, window.top);
            }
            else {
                this._emit(this.UNCAUGHT_JS_ERROR_EVENT, {
                    msg:     msg,
                    pageUrl: pageUrl
                });
            }
        }
    }

    attach (window) {
        super.attach(window);

        var messageSandbox = this.sandbox.message;
        var nodeSandbox    = this.sandbox.node;

        messageSandbox.on(messageSandbox.SERVICE_MSG_RECEIVED_EVENT, e => {
            var message = e.message;

            if (message.cmd === this.UNCAUGHT_JS_ERROR_EVENT)
                this._raiseUncaughtJsErrorEvent(message.msg, window, message.pageUrl);
        });

        window.CanvasRenderingContext2D.prototype.drawImage = function () {
            var image = arguments[0];

            if (isImgElement(image)) {
                var changedArgs = Array.prototype.slice.call(arguments, 0);
                var src         = image.src;

                if (urlUtils.sameOriginCheck(location.toString(), src)) {
                    changedArgs[0]     = nativeMethods.createElement.call(window.document, 'img');
                    changedArgs[0].src = urlUtils.getProxyUrl(src);
                }
            }

            return nativeMethods.canvasContextDrawImage.apply(this, changedArgs || arguments);
        };

        // Override uncaught error handling
        window.onerror = (msg, url, line, col, errObj) => {
            // FireFox raises NS_ERROR_NOT_INITIALIZED exception after widnow has been removed from the dom
            if (msg.indexOf('NS_ERROR_NOT_INITIALIZED') !== -1)
                return true;

            var originalOnErrorHandler = CodeInstrumentation.getOriginalErrorHandler(window);
            var caught                 = originalOnErrorHandler &&
                                         originalOnErrorHandler.call(window, msg, url, line, col, errObj) === true;

            if (caught)
                return true;

            this._raiseUncaughtJsErrorEvent(msg, window);

            return false;
        };

        window.open = function () {
            var newArgs = [];

            newArgs.push(urlUtils.getProxyUrl(arguments[0]));
            newArgs.push('_self');

            if (arguments.length > 2)
                newArgs.push(arguments[2]);
            if (arguments.length > 3)
                newArgs.push(arguments[3]);

            return nativeMethods.windowOpen.apply(window, newArgs);
        };

        window.Worker = scriptURL => {
            scriptURL = urlUtils.getProxyUrl(scriptURL);

            return new nativeMethods.Worker(scriptURL);
        };

        if (window.Blob) {
            window.Blob = function (parts, opts) {
                // NOTE: IE11 throws an error when the second parameter of the Blob function is undefined (GH-44)
                // If the overridden function is called with one parameter,
                // then we need to call the original function with one parameter as well.
                switch (arguments.length) {
                    case 0:
                        return new nativeMethods.Blob();
                    case 1:
                        return new nativeMethods.Blob(parts);
                    default:
                        var type = opts && opts.type && opts.type.toString().toLowerCase();

                        if (type === 'text/javascript' || type === 'application/javascript' ||
                            type === 'application/x-javascript')
                            parts = [scriptProcessor.process(parts.join(''))];

                        return new nativeMethods.Blob(parts, opts);
                }
            };
        }

        window.EventSource = url => new nativeMethods.EventSource(urlUtils.getProxyUrl(url));

        if (window.MutationObserver) {
            window.MutationObserver = callback => {
                var wrapper = mutations => {
                    var result = [];

                    for (var i = 0; i < mutations.length; i++) {
                        if (!ShadowUI.isShadowUIMutation(mutations[i]))
                            result.push(mutations[i]);
                    }

                    if (result.length)
                        callback(result);
                };

                return new nativeMethods.MutationObserver(wrapper);
            };
        }

        if (window.navigator && window.navigator.serviceWorker) {
            window.navigator.serviceWorker.register = url => {
                url = urlUtils.getProxyUrl(url);

                return nativeMethods.registerServiceWorker.call(window.navigator.serviceWorker, url);
            };
        }

        window.Image = function () {
            var image = null;

            if (!arguments.length)
                image = new nativeMethods.Image();
            else if (arguments.length === 1)
                image = new nativeMethods.Image(arguments[0]);
            else
                image = new nativeMethods.Image(arguments[0], arguments[1]);

            nodeSandbox.overrideDomMethods(image);

            return image;
        };

        if (typeof window.history.pushState === 'function' && typeof window.history.replaceState === 'function') {
            window.history.pushState = function (data, title, url) {
                var args = [data, title];

                if (arguments.length > 2)
                    args.push(url ? urlUtils.getProxyUrl(url) : url);

                return nativeMethods.historyPushState.apply(history, args);
            };

            window.history.replaceState = function (data, title, url) {
                var args = [data, title];

                if (arguments.length > 2)
                    args.push(url ? urlUtils.getProxyUrl(url) : url);

                return nativeMethods.historyReplaceState.apply(history, args);
            };
        }

        if (window.navigator.registerProtocolHandler) {
            window.navigator.registerProtocolHandler = function () {
                var args           = Array.prototype.slice.call(arguments);
                var urlIndex       = 1;
                var originHostname = urlUtils.OriginLocation.getParsed().hostname;
                var isOriginUrl    = isMozilla ? urlUtils.isSubDomain(originHostname, urlUtils.parseUrl(args[urlIndex]).hostname) :
                                     urlUtils.sameOriginCheck(urlUtils.OriginLocation.get(), args[urlIndex]);

                if (isOriginUrl)
                    args[urlIndex] = urlUtils.getProxyUrl(args[urlIndex]);

                return nativeMethods.registerProtocolHandler.apply(navigator, args);
            };
        }
    }
}
