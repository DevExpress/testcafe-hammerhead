/*global history, navigator*/
import SandboxBase from '../base';
import ShadowUI from '../shadow-ui';
import CodeInstrumentation from '../code-instrumentation';
import nativeMethods from '../native-methods';
import { processScript } from '../../../processing/script';
import styleProcessor from '../../../processing/style';
import * as destLocation from '../../utils/destination-location';
import { processHtml } from '../../utils/html';
import { isSubDomain, parseUrl, getProxyUrl, convertToProxyUrl, stringifyResourceType } from '../../utils/url';
import { isFirefox, isIE9, isIE } from '../../utils/browser';
import { isCrossDomainWindows, isImgElement, isBlob } from '../../utils/dom';
import INTERNAL_ATTRS from '../../../processing/dom/internal-attributes';
import constructorIsCalledWithoutNewKeyword from '../../utils/constructor-is-called-without-new-keyword';

const nativeFunctionToString = nativeMethods.Function.toString();

export default class WindowSandbox extends SandboxBase {
    constructor (nodeSandbox, messageSandbox) {
        super();

        this.nodeSandbox    = nodeSandbox;
        this.messageSandbox = messageSandbox;

        this.UNCAUGHT_JS_ERROR_EVENT   = 'hammerhead|event|uncaught-js-error';
        this.UNHANDLED_REJECTION_EVENT = 'hammerhead|event|unhandled-rejection';
        this.FORCE_PROXY_SRC_FOR_IMAGE = 'hammerhead|image|force-proxy-src-flag';
    }

    _raiseUncaughtJsErrorEvent (type, msg, window, pageUrl) {
        if (!isCrossDomainWindows(window, window.top)) {
            const sendToTopWindow = window !== window.top;

            if (!pageUrl)
                pageUrl = destLocation.get();

            if (sendToTopWindow) {
                this.emit(type, { msg, pageUrl, inIframe: true });
                this.messageSandbox.sendServiceMsg({ msg, pageUrl, cmd: type }, window.top);
            }
            else
                this.emit(type, { msg, pageUrl });
        }
    }

    attach (window) {
        super.attach(window);

        const messageSandbox = this.messageSandbox;
        const nodeSandbox    = this.nodeSandbox;
        const windowSandbox  = this;

        messageSandbox.on(messageSandbox.SERVICE_MSG_RECEIVED_EVENT, e => {
            const message = e.message;

            if (message.cmd === this.UNCAUGHT_JS_ERROR_EVENT || message.cmd === this.UNHANDLED_REJECTION_EVENT)
                this._raiseUncaughtJsErrorEvent(message.cmd, message.msg, window, message.pageUrl);
        });

        window.CanvasRenderingContext2D.prototype.drawImage = function (...args) {
            const image = args[0];

            if (isImgElement(image) && !image[windowSandbox.FORCE_PROXY_SRC_FOR_IMAGE]) {
                const src = image.src;

                if (destLocation.sameOriginCheck(location.toString(), src)) {
                    args[0]     = nativeMethods.createElement.call(window.document, 'img');
                    args[0].src = getProxyUrl(src);
                }
            }

            return nativeMethods.canvasContextDrawImage.apply(this, args);
        };

        // NOTE: Override uncaught error handling.
        window.onerror = (msg, url, line, col, errObj) => {
            // NOTE: Firefox raises the NS_ERROR_NOT_INITIALIZED exception after the window is removed from the dom.
            if (msg.indexOf('NS_ERROR_NOT_INITIALIZED') !== -1)
                return true;

            const originalOnErrorHandler = CodeInstrumentation.getOriginalErrorHandler(window);
            const caught                 = originalOnErrorHandler &&
                                           originalOnErrorHandler.call(window, msg, url, line, col, errObj) === true;

            if (caught)
                return true;

            this._raiseUncaughtJsErrorEvent(this.UNCAUGHT_JS_ERROR_EVENT, msg, window);

            return false;
        };

        window.onunhandledrejection = event => {
            const originalOnUnhandledRejectionHandler = CodeInstrumentation.getOriginalUnhandledRejectionHandler(window);

            let result = void 0;

            if (originalOnUnhandledRejectionHandler)
                result = originalOnUnhandledRejectionHandler.call(window, event);

            this._raiseUncaughtJsErrorEvent(this.UNHANDLED_REJECTION_EVENT, event.reason, window);

            return result;
        };

        window.open = function () {
            const newArgs = [];
            const target  = arguments[1] ? nodeSandbox.element.getTarget(null, arguments[1]) : '_self';

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
            window.Worker           = function (scriptURL, options) {
                if (constructorIsCalledWithoutNewKeyword(this, window.Worker))
                    nativeMethods.Worker.apply(this, arguments);

                if (arguments.length === 0)
                    return new nativeMethods.Worker();

                if (typeof scriptURL === 'string')
                    scriptURL = getProxyUrl(scriptURL, { resourceType: stringifyResourceType({ isScript: true }) });

                return arguments.length ===
                       1 ? new nativeMethods.Worker(scriptURL) : new nativeMethods.Worker(scriptURL, options);
            };
            window.Worker.prototype = nativeMethods.Worker.prototype;
        }

        if (window.Blob) {
            window.Blob           = function (parts, opts) {
                if (arguments.length === 0)
                    return new nativeMethods.Blob();

                const type = opts && opts.type && opts.type.toString().toLowerCase();

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
            window.EventSource            = function (url, opts) {
                if (arguments.length) {
                    const proxyUrl = getProxyUrl(url, { resourceType: stringifyResourceType({ isEventSource: true }) });

                    if (arguments.length === 1)
                        return new nativeMethods.EventSource(proxyUrl);

                    return new nativeMethods.EventSource(proxyUrl, opts);
                }

                return new nativeMethods.EventSource();
            };
            window.EventSource.prototype  = nativeMethods.EventSource.prototype;
            window.EventSource.CONNECTING = nativeMethods.EventSource.CONNECTING;
            window.EventSource.OPEN       = nativeMethods.EventSource.OPEN;
            window.EventSource.CLOSED     = nativeMethods.EventSource.CLOSED;
        }

        if (window.MutationObserver) {
            window.MutationObserver = callback => {
                const wrapper = function (mutations) {
                    const result = [];

                    for (let i = 0; i < mutations.length; i++) {
                        if (!ShadowUI.isShadowUIMutation(mutations[i]))
                            result.push(mutations[i]);
                    }

                    if (result.length)
                        callback.call(this, result);
                };

                return new nativeMethods.MutationObserver(wrapper);
            };

            window.MutationObserver.prototype = nativeMethods.MutationObserver.prototype;
        }

        if (nativeMethods.registerServiceWorker) {
            window.navigator.serviceWorker.register = (...args) => {
                if (typeof args[0] === 'string')
                    args[0] = getProxyUrl(args[0], { resourceType: stringifyResourceType({ isScript: true }) });

                if (args[1] && typeof args[1].scope === 'string')
                    args[1].scope = getProxyUrl(args[1].scope, { resourceType: stringifyResourceType({ isScript: true }) });

                return nativeMethods.registerServiceWorker.apply(window.navigator.serviceWorker, args);
            };
        }

        if (window.Range.prototype.createContextualFragment) {
            window.Range.prototype.createContextualFragment = function () {
                if (typeof arguments[0] === 'string')
                    arguments[0] = processHtml(arguments[0]);

                const fragment = nativeMethods.createContextualFragment.apply(this, arguments);

                nodeSandbox.processNodes(fragment);

                return fragment;
            };
        }

        window.Image           = function () {
            let image = null;

            if (!arguments.length)
                image = new nativeMethods.Image();
            else if (arguments.length === 1)
                image = new nativeMethods.Image(arguments[0]);
            else
                image = new nativeMethods.Image(arguments[0], arguments[1]);

            image[windowSandbox.FORCE_PROXY_SRC_FOR_IMAGE] = true;

            nodeSandbox.processNodes(image);

            return image;
        };
        window.Image.prototype = nativeMethods.Image.prototype;

        const FunctionWrapper = function (...args) {
            const functionBodyArgIndex = args.length - 1;

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
            const createWrapperForHistoryStateManipulationFn = function (nativeFn) {
                return function (...args) {
                    const url = args[2];

                    if (args.length > 2 && (url !== null && (isIE || url !== void 0)))
                        args[2] = getProxyUrl(String(url));

                    return nativeFn.apply(this, args);
                };
            };

            window.history.pushState    = createWrapperForHistoryStateManipulationFn(nativeMethods.historyPushState);
            window.history.replaceState = createWrapperForHistoryStateManipulationFn(nativeMethods.historyReplaceState);
        }

        if (window.navigator.sendBeacon) {
            window.navigator.sendBeacon = function () {
                if (typeof arguments[0] === 'string')
                    arguments[0] = getProxyUrl(arguments[0]);

                return nativeMethods.sendBeacon.apply(this, arguments);
            };
        }

        if (window.navigator.registerProtocolHandler) {
            window.navigator.registerProtocolHandler = function (...args) {
                const urlIndex = 1;

                if (typeof args[urlIndex] === 'string') {
                    const destHostname = destLocation.getParsed().hostname;
                    let isDestUrl      = '';

                    if (isFirefox) {
                        const parsedUrl = parseUrl(args[urlIndex]);

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

        // NOTE: DOMParser supports an HTML parsing for IE10 and later
        if (window.DOMParser && !isIE9) {
            window.DOMParser.prototype.parseFromString = function (...args) {
                if (args.length > 1 && typeof args[0] === 'string' && args[1] === 'text/html')
                    args[0] = processHtml(args[0]);

                return nativeMethods.DOMParserParseFromString.apply(this, args);
            };
        }

        // NOTE: stab for ie9 and ie10 (GH-801)
        if (window.XDomainRequest)
            window.XDomainRequest = window.XMLHttpRequest;
    }
}
