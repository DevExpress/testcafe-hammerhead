/*global history, navigator*/
import SandboxBase from '../base';
import NativeMethods from '../native-methods';
import ScriptProcessor from '../../../processing/script';
import UrlUtil from '../../utils/url';
import { isMozilla } from '../../utils/browser';
import { isCrossDomainWindows, isImgElement } from '../../utils/dom';

export default class WindowSandbox extends SandboxBase {
    constructor (sandbox) {
        super(sandbox);

        this.UNCAUGHT_JS_ERROR = 'uncaughtJSError';
    }

    _raiseUncaughtJsErrorEvent (msg, window, pageUrl) {
        if (!isCrossDomainWindows(window, window.top)) {
            var sendToTopWindow = window !== window.top;

            if (!pageUrl)
                pageUrl = UrlUtil.OriginLocation.get();

            if (sendToTopWindow) {
                this._emit(this.UNCAUGHT_JS_ERROR, {
                    msg:      msg,
                    pageUrl:  pageUrl,
                    inIFrame: true
                });

                this.sandbox.message.sendServiceMsg({
                    cmd:     this.UNCAUGHT_JS_ERROR,
                    pageUrl: pageUrl,
                    msg:     msg
                }, window.top);
            }
            else {
                this._emit(this.UNCAUGHT_JS_ERROR, {
                    msg:     msg,
                    pageUrl: pageUrl
                });
            }
        }
    }

    attach (window) {
        super.attach(window);

        var messageSandbox      = this.sandbox.message;
        var nodeSandbox         = this.sandbox.node;
        var codeInstrumentation = this.sandbox.codeInstrumentation;
        var shadowUI            = this.sandbox.shadowUI;

        messageSandbox.on(messageSandbox.SERVICE_MSG_RECEIVED, e => {
            var message = e.message;

            if (message.cmd === this.UNCAUGHT_JS_ERROR)
                this._raiseUncaughtJsErrorEvent(message.msg, window, message.pageUrl);
        });

        window.CanvasRenderingContext2D.prototype.drawImage = function () {
            var image = arguments[0];

            if (isImgElement(image)) {
                var changedArgs = Array.prototype.slice.call(arguments, 0);
                var src         = image.src;

                if (UrlUtil.sameOriginCheck(location.toString(), src)) {
                    changedArgs[0]     = NativeMethods.createElement.call(window.document, 'img');
                    changedArgs[0].src = UrlUtil.getProxyUrl(src);
                }
            }

            return NativeMethods.canvasContextDrawImage.apply(this, changedArgs || arguments);
        };

        // Override uncaught error handling
        window.onerror = (msg, url, line, col, errObj) => {
            // FireFox raises NS_ERROR_NOT_INITIALIZED exception after widnow has been removed from the dom
            if (msg.indexOf('NS_ERROR_NOT_INITIALIZED') !== -1)
                return true;

            var originalOnErrorHandler = codeInstrumentation.getOriginalErrorHandler(window);
            var caught                 = originalOnErrorHandler &&
                                         originalOnErrorHandler.call(window, msg, url, line, col, errObj) === true;

            if (caught)
                return true;

            this._raiseUncaughtJsErrorEvent(msg, window);

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

        window.Worker = scriptURL => {
            scriptURL = UrlUtil.getProxyUrl(scriptURL);

            return new NativeMethods.Worker(scriptURL);
        };

        if (window.Blob) {
            window.Blob = function (parts, opts) {
                // NOTE: IE11 throws an error when the second parameter of the Blob function is undefined (GH-44)
                // If the overridden function is called with one parameter,
                // then we need to call the original function with one parameter as well.
                switch (arguments.length) {
                    case 0:
                        return new NativeMethods.Blob();
                    case 1:
                        return new NativeMethods.Blob(parts);
                    default:
                        var type = opts && opts.type && opts.type.toString().toLowerCase();

                        if (type === 'text/javascript' || type === 'application/javascript' ||
                            type === 'application/x-javascript')
                            parts = [ScriptProcessor.process(parts.join(''))];

                        return new NativeMethods.Blob(parts, opts);
                }
            };
        }

        window.EventSource = url => new NativeMethods.EventSource(UrlUtil.getProxyUrl(url));

        if (window.MutationObserver) {
            window.MutationObserver = callback => {
                var wrapper = mutations => {
                    var result = [];

                    for (var i = 0; i < mutations.length; i++) {
                        if (!shadowUI.isShadowUIMutation(mutations[i]))
                            result.push(mutations[i]);
                    }

                    if (result.length)
                        callback(result);
                };

                return new NativeMethods.MutationObserver(wrapper);
            };
        }

        if (window.navigator && window.navigator.serviceWorker) {
            window.navigator.serviceWorker.register = url => {
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

            nodeSandbox.overrideDomMethods(image);

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
}
