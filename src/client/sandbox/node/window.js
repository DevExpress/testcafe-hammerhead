/*global history, navigator*/
import SandboxBase from '../base';
import ShadowUI from '../shadow-ui';
import nativeMethods from '../native-methods';
import { processScript } from '../../../processing/script';
import styleProcessor from '../../../processing/style';
import * as destLocation from '../../utils/destination-location';
import { processHtml } from '../../utils/html';
import {
    isSubDomain,
    parseUrl,
    getProxyUrl,
    parseProxyUrl,
    convertToProxyUrl,
    stringifyResourceType,
    resolveUrlAsDest
} from '../../utils/url';
import { isFirefox, isIE } from '../../utils/browser';
import { isCrossDomainWindows, isImgElement, isBlob, isWebSocket } from '../../utils/dom';
import { isPrimitiveType } from '../../utils/types';
import INTERNAL_ATTRS from '../../../processing/dom/internal-attributes';
import constructorIsCalledWithoutNewKeyword from '../../utils/constructor-is-called-without-new-keyword';
import INSTRUCTION from '../../../processing/script/instruction';
import FunctionWrapper from './function-wrapper';
import Promise from 'pinkie';

const nativeFunctionToString = nativeMethods.Function.toString();

// NOTE: We should avoid using native object prototype methods,
// since they can be overriden by the client code. (GH-245)
const arrayConcat = Array.prototype.concat;

const HTTP_PROTOCOL_RE = /^http/i;

const ALLOWED_SERVICE_WORKER_PROTOCOLS  = ['https:', 'wss:', 'file:'];
const ALLOWED_SERVICE_WORKER_HOST_NAMES = ['localhost', '127.0.0.1'];

export default class WindowSandbox extends SandboxBase {
    constructor (nodeSandbox, messageSandbox, listenersSandbox) {
        super();

        this.nodeSandbox      = nodeSandbox;
        this.messageSandbox   = messageSandbox;
        this.listenersSandbox = listenersSandbox;

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

    _reattachHandler (window, eventName) {
        nativeMethods.windowRemoveEventListener.call(window, eventName, this);
        nativeMethods.windowAddEventListener.call(window, eventName, this);
    }

    static _formatUnhandledRejectionReason (reason) {
        if (!isPrimitiveType(reason)) {
            const reasonStr = nativeMethods.objectToString.call(reason);

            if (reasonStr === '[object Error]')
                return reason.message;

            return reasonStr;
        }

        return String(reason);
    }

    static _wrapCSSGetPropertyValueIfNecessary (constructor, nativeGetPropertyValueFn) {
        if (nativeGetPropertyValueFn) {
            constructor.prototype.getPropertyValue = function (...args) {
                const value = nativeGetPropertyValueFn.apply(this, args);

                return styleProcessor.cleanUp(value, parseProxyUrl);
            };
        }
    }

    static _wrapCSSSetPropertyIfNecessary (constructor, nativeSetPropertyFn) {
        if (nativeSetPropertyFn) {
            constructor.prototype.setProperty = function (...args) {
                const value = args[1];

                if (typeof value === 'string')
                    args[1] = styleProcessor.process(value, getProxyUrl);

                return nativeSetPropertyFn.apply(this, args);
            };
        }
    }

    static _wrapCSSRemovePropertyIfNecessary (constructor, nativeRemovePropertyFn) {
        if (nativeRemovePropertyFn) {
            constructor.prototype.removeProperty = function (...args) {
                const oldValue = nativeRemovePropertyFn.apply(this, args);

                return styleProcessor.cleanUp(oldValue, parseProxyUrl);
            };
        }
    }

    static _isSecureOrigin (url) {
        // NOTE: https://www.chromium.org/Home/chromium-security/prefer-secure-origins-for-powerful-new-features
        const parsedUrl = parseUrl(resolveUrlAsDest(url));

        return ALLOWED_SERVICE_WORKER_PROTOCOLS.indexOf(parsedUrl.protocol) === -1 &&
               ALLOWED_SERVICE_WORKER_HOST_NAMES.indexOf(parsedUrl.hostname) === -1;
    }

    handleEvent (event) {
        if (event.defaultPrevented)
            return;

        if (event.type === 'unhandledrejection') {
            const reason = WindowSandbox._formatUnhandledRejectionReason(event.reason);

            this._raiseUncaughtJsErrorEvent(this.UNHANDLED_REJECTION_EVENT, reason, this.window);
        }
        else if (event.type === 'error') {
            if (event.message.indexOf('NS_ERROR_NOT_INITIALIZED') !== -1)
                event.preventDefault();
            else
                this._raiseUncaughtJsErrorEvent(this.UNCAUGHT_JS_ERROR_EVENT, event.message, window);
        }
    }

    attach (window) {
        super.attach(window);

        const messageSandbox = this.messageSandbox;
        const nodeSandbox    = this.nodeSandbox;
        const windowSandbox  = this;

        this._reattachHandler(window, 'unhandledrejection');
        this._reattachHandler(window, 'error');
        this.listenersSandbox.initElementListening(window, ['error', 'unhandledrejection']);
        this.listenersSandbox.on(this.listenersSandbox.EVENT_LISTENER_ATTACHED_EVENT, e => {
            if (e.el !== window)
                return;

            if (e.eventType === 'unhandledrejection')
                this._reattachHandler(window, 'unhandledrejection');
            else if (e.eventType === 'error')
                this._reattachHandler(window, 'error');
        });

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

        if (nativeMethods.objectAssign) {
            window.Object.assign = function (target, ...sources) {
                let args = [];

                args.push(target);

                const targetType = typeof target;

                if (target && (targetType === 'object' || targetType === 'function') && sources.length) {
                    for (const source of sources) {
                        const sourceType = typeof source;

                        if (!source || sourceType !== 'object' && sourceType !== 'function') {
                            nativeMethods.objectAssign.call(this, target, source);
                            continue;
                        }

                        const sourceKeys = nativeMethods.objectKeys.call(window.Object, source);

                        for (const key of sourceKeys)
                            window[INSTRUCTION.setProperty](target, key, source[key]);
                    }
                }
                else
                    args = arrayConcat.call(args, sources);

                return nativeMethods.objectAssign.apply(this, args);
            };
        }

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

                return arguments.length === 1
                    ? new nativeMethods.Worker(scriptURL)
                    : new nativeMethods.Worker(scriptURL, options);
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

                    for (const mutation of mutations) {
                        if (!ShadowUI.isShadowUIMutation(mutation))
                            result.push(mutation);
                    }

                    if (result.length)
                        callback.call(this, result, this);
                };

                return new nativeMethods.MutationObserver(wrapper);
            };

            window.MutationObserver.prototype = nativeMethods.MutationObserver.prototype;
        }

        if (nativeMethods.registerServiceWorker) {
            window.navigator.serviceWorker.register = (...args) => {
                const url = args[0];

                if (typeof url === 'string') {
                    if (WindowSandbox._isSecureOrigin(url))
                        return Promise.reject(new DOMException('Only secure origins are allowed.', 'SecurityError'));

                    args[0] = getProxyUrl(url, { resourceType: stringifyResourceType({ isScript: true }) });
                }

                if (args[1] && typeof args[1].scope === 'string') {
                    args[1].scope = getProxyUrl(args[1].scope, {
                        resourceType: stringifyResourceType({ isScript: true })
                    });
                }

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

        if (window.WebSocket) {
            window.WebSocket = function (url, protocols) {
                if (arguments.length === 0)
                    return new nativeMethods.WebSocket();

                const proxyUrl  = getProxyUrl(url, { resourceType: stringifyResourceType({ isWebSocket: true }) });
                const parsedUrl = parseUrl(url);
                const origin    = parsedUrl.protocol + '//' + parsedUrl.host;
                let webSocket   = null;

                if (arguments.length === 1)
                    webSocket = new nativeMethods.WebSocket(proxyUrl);
                else if (arguments.length === 2)
                    webSocket = new nativeMethods.WebSocket(proxyUrl, protocols);
                else
                    webSocket = new nativeMethods.WebSocket(proxyUrl, protocols, arguments[2]);

                // NOTE: We need to use deprecated methods instead of the defineProperty method
                // in the following browsers:
                // * Android 5.1 because prototype does not contain the url property
                // and the defineProperty does not redefine descriptor of the WebSocket instance
                // * Safari less than 10 versions because the configurable property of descriptor is false
                // Try to drop this after moving to higher versions of browsers
                if (!nativeMethods.webSocketUrlGetter) {
                    webSocket.__defineGetter__('url', () => url);
                    webSocket.__defineSetter__('url', value => value);
                }

                if (!nativeMethods.messageEventOriginGetter) {
                    webSocket.addEventListener('message', e => {
                        e.__defineGetter__('origin', () => origin);
                        e.__defineSetter__('origin', value => value);
                    });
                }

                return webSocket;
            };

            window.WebSocket.prototype  = nativeMethods.WebSocket.prototype;
            window.WebSocket.CONNECTING = nativeMethods.WebSocket.CONNECTING;
            window.WebSocket.OPEN       = nativeMethods.WebSocket.OPEN;
            window.WebSocket.CLOSING    = nativeMethods.WebSocket.CLOSING;
            window.WebSocket.CLOSED     = nativeMethods.WebSocket.CLOSED;

            if (nativeMethods.webSocketUrlGetter) {
                const urlPropDescriptor = nativeMethods.objectGetOwnPropertyDescriptor
                    .call(window.Object, window.WebSocket.prototype, 'url');

                urlPropDescriptor.get = function () {
                    const url       = nativeMethods.webSocketUrlGetter.call(this);
                    const parsedUrl = parseProxyUrl(url);

                    if (parsedUrl && parsedUrl.destUrl)
                        return parsedUrl.destUrl.replace(HTTP_PROTOCOL_RE, 'ws');

                    return url;
                };

                nativeMethods.objectDefineProperty
                    .call(window.Object, window.WebSocket.prototype, 'url', urlPropDescriptor);
            }
        }

        if (nativeMethods.messageEventOriginGetter) {
            const originPropDescriptor = nativeMethods.objectGetOwnPropertyDescriptor
                .call(window.Object, window.MessageEvent.prototype, 'origin');

            originPropDescriptor.get = function () {
                const target = this.target;
                const origin = nativeMethods.messageEventOriginGetter.call(this);

                if (isWebSocket(target)) {
                    const parsedUrl = parseUrl(target.url);

                    if (parsedUrl)
                        return parsedUrl.protocol + '//' + parsedUrl.host;
                }

                return origin;
            };

            nativeMethods.objectDefineProperty
                .call(window.Object, window.MessageEvent.prototype, 'origin', originPropDescriptor);
        }

        if (window.DOMParser) {
            window.DOMParser.prototype.parseFromString = function (...args) {
                if (args.length > 1 && typeof args[0] === 'string' && args[1] === 'text/html')
                    args[0] = processHtml(args[0]);

                return nativeMethods.DOMParserParseFromString.apply(this, args);
            };
        }

        // NOTE: stab for ie9 and ie10 (GH-801)
        if (window.XDomainRequest)
            window.XDomainRequest = window.XMLHttpRequest;

        WindowSandbox._wrapCSSGetPropertyValueIfNecessary(window.CSSStyleDeclaration,
            nativeMethods.CSSStyleDeclarationGetPropertyValue);
        WindowSandbox._wrapCSSGetPropertyValueIfNecessary(window.MSStyleCSSProperties,
            nativeMethods.MSStyleCSSPropertiesGetPropertyValue);
        WindowSandbox._wrapCSSGetPropertyValueIfNecessary(window.CSS2Property,
            nativeMethods.CSS2PropertyGetPropertyValue);

        WindowSandbox._wrapCSSSetPropertyIfNecessary(window.CSSStyleDeclaration,
            nativeMethods.CSSStyleDeclarationSetProperty);
        WindowSandbox._wrapCSSSetPropertyIfNecessary(window.MSStyleCSSProperties,
            nativeMethods.MSStyleCSSPropertiesSetProperty);
        WindowSandbox._wrapCSSSetPropertyIfNecessary(window.CSS2Property,
            nativeMethods.CSS2PropertySetProperty);

        WindowSandbox._wrapCSSRemovePropertyIfNecessary(window.CSSStyleDeclaration,
            nativeMethods.CSSStyleDeclarationRemoveProperty);
        WindowSandbox._wrapCSSRemovePropertyIfNecessary(window.MSStyleCSSProperties,
            nativeMethods.MSStyleCSSPropertiesRemoveProperty);
        WindowSandbox._wrapCSSRemovePropertyIfNecessary(window.CSS2Property,
            nativeMethods.CSS2PropertyRemoveProperty);
    }

    dispose () {
        window.Function                       = nativeMethods.Function;
        window.Function.prototype             = nativeMethods.Function.prototype;
        window.Function.prototype.constructor = nativeMethods.Function.constructor;
    }
}
