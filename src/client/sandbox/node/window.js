/*global history, navigator*/
import SandboxBase from '../base';
import ShadowUI from '../shadow-ui';
import CodeInstrumentation from '../code-instrumentation';
import nativeMethods from '../native-methods';
import { processScript } from '../../../processing/script';
import styleProcessor from '../../../processing/style';
import * as destLocation from '../../utils/destination-location';
import { processHtml } from '../../utils/html';
import { isSubDomain, parseUrl, getProxyUrl, convertToProxyUrl } from '../../utils/url';
import { isFirefox } from '../../utils/browser';
import { isCrossDomainWindows, isImgElement, isBlob } from '../../utils/dom';
import INTERNAL_ATTRS from '../../../processing/dom/internal-attributes';

// NOTE: We should avoid using native object prototype methods,
// since they can be overriden by the client code. (GH-245)
var arraySlice = Array.prototype.slice;

const nativeFunctionToString = nativeMethods.Function.toString();

export default class WindowSandbox extends SandboxBase {
    constructor (nodeSandbox, messageSandbox) {
        super();

        this.nodeSandbox    = nodeSandbox;
        this.messageSandbox = messageSandbox;

        this.UNCAUGHT_JS_ERROR_EVENT = 'hammerhead|event|uncaught-js-error';
    }

    _raiseUncaughtJsErrorEvent (msg, window, pageUrl) {
        if (!isCrossDomainWindows(window, window.top)) {
            var sendToTopWindow = window !== window.top;

            if (!pageUrl)
                pageUrl = destLocation.get();

            if (sendToTopWindow) {
                this.emit(this.UNCAUGHT_JS_ERROR_EVENT, {
                    msg,
                    pageUrl,

                    inIframe: true
                });

                this.messageSandbox.sendServiceMsg({
                    msg,
                    pageUrl,

                    cmd: this.UNCAUGHT_JS_ERROR_EVENT
                }, window.top);
            }
            else {
                this.emit(this.UNCAUGHT_JS_ERROR_EVENT, {
                    msg,
                    pageUrl
                });
            }
        }
    }

    attach (window) {
        super.attach(window);

        var messageSandbox = this.messageSandbox;
        var nodeSandbox    = this.nodeSandbox;

        messageSandbox.on(messageSandbox.SERVICE_MSG_RECEIVED_EVENT, e => {
            var message = e.message;

            if (message.cmd === this.UNCAUGHT_JS_ERROR_EVENT)
                this._raiseUncaughtJsErrorEvent(message.msg, window, message.pageUrl);
        });

        window.CanvasRenderingContext2D.prototype.drawImage = function () {
            var image = arguments[0];

            if (isImgElement(image)) {
                var changedArgs = arraySlice.call(arguments);
                var src         = image.src;

                if (destLocation.sameOriginCheck(location.toString(), src)) {
                    changedArgs[0]     = nativeMethods.createElement.call(window.document, 'img');
                    changedArgs[0].src = getProxyUrl(src);
                }
            }

            return nativeMethods.canvasContextDrawImage.apply(this, changedArgs || arguments);
        };

        // NOTE: Override uncaught error handling.
        window.onerror = (msg, url, line, col, errObj) => {
            // NOTE: Firefox raises the NS_ERROR_NOT_INITIALIZED exception after the window is removed from the dom.
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
            var target  = arguments[1] ? nodeSandbox.element.getTarget(null, arguments[1]) : '_self';

            newArgs.push(getProxyUrl(arguments[0]));
            newArgs.push(target);

            if (arguments.length > 2)
                newArgs.push(arguments[2]);
            if (arguments.length > 3)
                newArgs.push(arguments[3]);

            return nativeMethods.windowOpen.apply(window, newArgs);
        };

        if (window.FontFace) {
            window.FontFace           = (family, source, descriptors) => {
                source = styleProcessor.process(source, convertToProxyUrl);

                return new nativeMethods.FontFace(family, source, descriptors);
            };
            window.FontFace.prototype = nativeMethods.FontFace.prototype;
        }

        if (window.Worker) {
            window.Worker           = scriptURL => {
                if (typeof scriptURL === 'string')
                    scriptURL = getProxyUrl(scriptURL);

                return new nativeMethods.Worker(scriptURL);
            };
            window.Worker.prototype = nativeMethods.Worker.prototype;
        }

        if (window.Blob) {
            window.Blob           = function (parts, opts) {
                if (arguments.length === 0)
                    return new nativeMethods.Blob();

                var type = opts && opts.type && opts.type.toString().toLowerCase();

                // NOTE: If we cannot identify the content type of data, we're trying to process it as a script.
                // Unfortunately, we do not have the ability to exactly identify a script. That's why we make such
                // an assumption. We cannot solve this problem at the Worker level either, because the operation of
                // creating a new Blob instance is asynchronous. (GH-231)
                if (!type || type === 'text/javascript' || type === 'application/javascript' ||
                    type === 'application/x-javascript')
                    parts = [processScript(parts.join(''), true)];

                // NOTE: IE11 throws an error when the second parameter of the Blob function is undefined (GH-44)
                // If the overridden function is called with one parameter, we need to call the original function
                // with one parameter as well.
                return arguments.length === 1 ? new nativeMethods.Blob(parts) : new nativeMethods.Blob(parts, opts);
            };
            window.Blob.prototype = nativeMethods.Blob.prototype;
        }

        if (window.EventSource) {
            window.EventSource           = url => new nativeMethods.EventSource(getProxyUrl(url));
            window.EventSource.prototype = nativeMethods.EventSource.prototype;
        }

        if (window.MutationObserver) {
            window.MutationObserver           = callback => {
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
            window.MutationObserver.prototype = nativeMethods.MutationObserver.prototype;
        }

        if (nativeMethods.registerServiceWorker) {
            window.navigator.serviceWorker.register = (...args) => {
                if (typeof args[0] === 'string')
                    args[0] = getProxyUrl(args[0]);

                if (args[1] && typeof args[1].scope === 'string')
                    args[1].scope = getProxyUrl(args[1].scope);

                return nativeMethods.registerServiceWorker.apply(window.navigator.serviceWorker, args);
            };
        }

        if (window.Range.prototype.createContextualFragment) {
            window.Range.prototype.createContextualFragment = function () {
                if (typeof arguments[0] === 'string')
                    arguments[0] = processHtml(arguments[0]);

                var fragment = nativeMethods.createContextualFragment.apply(this, arguments);

                nodeSandbox.processNodes(fragment);

                return fragment;
            };
        }

        window.Image           = function () {
            var image = null;

            if (!arguments.length)
                image = new nativeMethods.Image();
            else if (arguments.length === 1)
                image = new nativeMethods.Image(arguments[0]);
            else
                image = new nativeMethods.Image(arguments[0], arguments[1]);

            nodeSandbox.processNodes(image);

            return image;
        };
        window.Image.prototype = nativeMethods.Image.prototype;

        var FunctionWrapper = function (...args) {
            var functionBodyArgIndex = args.length - 1;

            if (typeof args[functionBodyArgIndex] === 'string')
                args[functionBodyArgIndex] = processScript(args[functionBodyArgIndex], false);

            return nativeMethods.Function.apply(this, args);
        };

        window.Function                       = FunctionWrapper;
        window.Function.prototype             = nativeMethods.Function.prototype;
        window.Function.prototype.constructor = FunctionWrapper;

        // NOTE: We need to create function which returns string without calling toString every time
        // because if the Function.prototype.toString is overridden it can be the cause of recursion
        window.Function.toString = function () {
            return this === FunctionWrapper ? nativeFunctionToString : nativeMethods.functionToString.call(this);
        };

        if (typeof window.history.pushState === 'function' && typeof window.history.replaceState === 'function') {
            window.history.pushState = function () {
                if (typeof arguments[2] === 'string')
                    arguments[2] = getProxyUrl(arguments[2]);

                return nativeMethods.historyPushState.apply(history, arguments);
            };

            window.history.replaceState = function () {
                if (typeof arguments[2] === 'string')
                    arguments[2] = getProxyUrl(arguments[2]);

                return nativeMethods.historyReplaceState.apply(history, arguments);
            };
        }

        if (window.navigator.sendBeacon) {
            window.navigator.sendBeacon = function () {
                if (arguments.length && typeof arguments[0] === 'string')
                    arguments[0] = getProxyUrl(arguments[0]);

                return nativeMethods.sendBeacon.apply(this, arguments);
            };
        }

        if (window.navigator.registerProtocolHandler) {
            window.navigator.registerProtocolHandler = function () {
                var args     = arraySlice.call(arguments);
                var urlIndex = 1;

                if (typeof args[urlIndex] === 'string') {
                    var destHostname = destLocation.getParsed().hostname;
                    var isDestUrl    = '';

                    if (isFirefox) {
                        var parsedUrl = parseUrl(args[urlIndex]);

                        isDestUrl = parsedUrl.hostname && isSubDomain(destHostname, parsedUrl.hostname);
                    }
                    else
                        isDestUrl = destLocation.sameOriginCheck(destLocation.get(), args[urlIndex]);

                    if (isDestUrl)
                        args[urlIndex] = getProxyUrl(args[urlIndex]);
                }

                return nativeMethods.registerProtocolHandler.apply(navigator, args);
            };
        }

        if (window.FormData) {
            window.FormData.prototype.append = function (name, value) {
                // NOTE: We should not send our hidden input's value along with the file info,
                // because our input may have incorrect value if the input with the file has been removed from DOM.
                if (name === INTERNAL_ATTRS.uploadInfoHiddenInputName)
                    return;

                // NOTE: If we append our file wrapper to FormData, we will lose the file name.
                // This happens because the file wrapper is an instance of Blob
                // and a browser thinks that Blob does not contain the "name" property.
                if (arguments.length === 2 && isBlob(value) && 'name' in value)
                    nativeMethods.formDataAppend.call(this, name, value, value.name);
                else
                    nativeMethods.formDataAppend.apply(this, arguments);
            };
        }

        // NOTE: stab for ie9 and ie10 (GH-801)
        if (window.XDomainRequest)
            window.XDomainRequest = window.XMLHttpRequest;
    }
}
