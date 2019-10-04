/*global navigator*/
import SandboxBase from '../base';
import ShadowUI from '../shadow-ui';
import nativeMethods from '../native-methods';
import { processScript } from '../../../processing/script';
import styleProcessor from '../../../processing/style';
import * as destLocation from '../../utils/destination-location';
import { cleanUpHtml, processHtml } from '../../utils/html';
import {
    parseUrl,
    getProxyUrl,
    parseProxyUrl,
    convertToProxyUrl,
    stringifyResourceType,
    resolveUrlAsDest
} from '../../utils/url';
import { isFirefox, isIE, isAndroid, isMSEdge, version as browserVersion } from '../../utils/browser';
import {
    isCrossDomainWindows,
    isImgElement,
    isBlob,
    isWebSocket,
    isWindow,
    isPerformanceNavigationTiming,
    isTextEditableElementAndEditingAllowed,
    isShadowUIElement,
    isScriptElement,
    isStyleElement,
    findDocument,
    isBodyElement,
    isHtmlElement
} from '../../utils/dom';
import { isPrimitiveType } from '../../utils/types';
import INTERNAL_ATTRS from '../../../processing/dom/internal-attributes';
import INTERNAL_PROPS from '../../../processing/dom/internal-properties';
import constructorIsCalledWithoutNewKeyword from '../../utils/constructor-is-called-without-new-keyword';
import INSTRUCTION from '../../../processing/script/instruction';
// @ts-ignore
import Promise from 'pinkie';
import getMimeType from '../../utils/get-mime-type';
import { overrideDescriptor } from '../../utils/property-overriding';
import { emptyActionAttrFallbacksToTheLocation } from '../../utils/feature-detection';
import { HASH_RE, isValidUrl } from '../../../utils/url';
import UploadSandbox from '../upload';
import { getAnchorProperty, setAnchorProperty } from '../code-instrumentation/properties/anchor';
import { XLINK_NAMESPACE } from '../../../processing/dom/namespaces';
import urlResolver from '../../utils/url-resolver';
import { remove as removeProcessingHeader } from '../../../processing/script/header';
import DOMMutationTracker from './live-node-list/dom-mutation-tracker';
import { getAttributes } from './attributes';
import replaceProxiedUrlsInStack from '../../utils/replace-proxied-urls-in-stack';
import NodeSandbox from './index';
import EventSandbox from '../event';
import NodeMutation from './mutation';
import MessageSandbox from '../event/message';
import Listeners from '../event/listeners';
import ElementEditingWatcher from '../event/element-editing-watcher';

const nativeFunctionToString = nativeMethods.Function.toString();

const HTTP_PROTOCOL_RE = /^http/i;

const ALLOWED_SERVICE_WORKER_PROTOCOLS  = ['https:', 'wss:', 'file:'];
const ALLOWED_SERVICE_WORKER_HOST_NAMES = ['localhost', '127.0.0.1'];
const JAVASCRIPT_MIME_TYPES             = ['text/javascript', 'application/javascript', 'application/x-javascript'];

// NOTE: SVGAnimatedString prototype does not have a way to access the appropriate svg element.
// This is why we use this property to store svg element for which animVal and baseVal properties were set.
// It allows us to change the href-hammerhead-stored-value when it needs.
const CONTEXT_SVG_IMAGE_ELEMENT = 'hammerhead|context-svg-image-element';

const SANDBOX_DOM_TOKEN_LIST           = 'hammerhead|sandbox-dom-token-list';
const SANDBOX_DOM_TOKEN_LIST_OWNER     = 'hammerhead|sandbox-dom-token-list-owner';
const SANDBOX_DOM_TOKEN_LIST_UPDATE_FN = 'hammerhead|sandbox-dom-token-list-update';

const IS_PROXY_OBJECT_INTERNAL_PROP_NAME  = 'hammerhead|is-proxy-object|internal-prop-name';
const IS_PROXY_OBJECT_INTERNAL_PROP_VALUE = 'hammerhead|is-proxy-object|internal-prop-value';

const NO_STACK_TRACE_AVAILABLE_MESSAGE = 'No stack trace available';

const TRACKED_EVENTS = ['error', 'unhandledrejection', 'hashchange'];

export default class WindowSandbox extends SandboxBase {
    nodeSandbox: NodeSandbox;
    messageSandbox: MessageSandbox;
    listenersSandbox: Listeners;
    elementEditingWatcher: ElementEditingWatcher;
    uploadSandbox: UploadSandbox;
    shadowUI: ShadowUI;
    nodeMutation: NodeMutation;

    UNCAUGHT_JS_ERROR_EVENT: string = 'hammerhead|event|uncaught-js-error';
    UNHANDLED_REJECTION_EVENT: string = 'hammerhead|event|unhandled-rejection';
    HASH_CHANGE_EVENT: string = 'hammerhead|event|hashchange-event';

    SANDBOX_DOM_TOKEN_LIST_UPDATE_FN: any;

    constructor (nodeSandbox: NodeSandbox, eventSandbox: EventSandbox, uploadSandbox: UploadSandbox, nodeMutation: NodeMutation) {
        super();

        this.nodeSandbox           = nodeSandbox;
        this.messageSandbox        = eventSandbox.message;
        this.listenersSandbox      = eventSandbox.listeners;
        this.elementEditingWatcher = eventSandbox.elementEditingWatcher;
        this.uploadSandbox         = uploadSandbox;
        this.shadowUI              = nodeSandbox.shadowUI;
        this.nodeMutation          = nodeMutation;

        this.SANDBOX_DOM_TOKEN_LIST_UPDATE_FN = SANDBOX_DOM_TOKEN_LIST_UPDATE_FN;
    }

    private static _prepareStack (msg: string, stack: string): string {
        // NOTE: Firefox does not include an error message in a stack trace (unlike other browsers)
        // It is possible to get a stack trace for unhandled Promise rejections only if Promise is rejected with the 'Error' instance value.
        // This is why we should convert the stack to a common format.
        if (!stack || stack.indexOf(msg) === -1) {
            stack = stack || `    ${NO_STACK_TRACE_AVAILABLE_MESSAGE}`;

            return `${msg}:\n${stack}`;
        }

        return stack;
    }

    private static _isProcessableBlob (parts: Array<any>): boolean {
        let hasStringItem = false;

        for (const item of parts) {
            if (!hasStringItem && typeof item === 'string') {
                hasStringItem = true;

                continue;
            }

            if (typeof item !== 'string' && typeof item !== 'number' && typeof item !== 'boolean')
                return false;
        }

        return hasStringItem;
    }

    _raiseUncaughtJsErrorEvent (type: string, event: any, window: Window) {
        if (isCrossDomainWindows(window, window.top))
            return;

        const sendToTopWindow = window !== window.top;
        const pageUrl         = destLocation.get();
        let msg               = null;
        let stack             = null;

        if (type === this.UNHANDLED_REJECTION_EVENT) {
            msg   = WindowSandbox._formatUnhandledRejectionReason(event.reason);
            stack = event.reason && event.reason.stack;
        }
        else if (type === this.UNCAUGHT_JS_ERROR_EVENT) {
            msg   = event.error ? event.error.message : event.message;
            stack = event.error && event.error.stack;
        }

        stack = WindowSandbox._prepareStack(msg, stack);
        stack = replaceProxiedUrlsInStack(stack);

        if (sendToTopWindow) {
            this.emit(type, { msg, pageUrl, stack, inIframe: true });
            this.messageSandbox.sendServiceMsg({ msg, pageUrl, stack, cmd: type }, window.top);
        }
        else
            this.emit(type, { msg, pageUrl, stack });
    }

    _reattachHandler (window: Window, eventName: string) {
        nativeMethods.windowRemoveEventListener.call(window, eventName, this);
        nativeMethods.windowAddEventListener.call(window, eventName, this);
    }

    static _formatUnhandledRejectionReason (reason: any) {
        if (!isPrimitiveType(reason)) {
            const reasonStr = nativeMethods.objectToString.call(reason);

            if (reasonStr === '[object Error]')
                return reason.message;

            return reasonStr;
        }

        return String(reason);
    }

    static _getUrlAttr (el: HTMLElement, attr: string) {
        const attrValue       = nativeMethods.getAttribute.call(el, attr);
        const currentDocument = el.ownerDocument || document;

        if (attrValue === '' || attrValue === null && attr === 'action' && emptyActionAttrFallbacksToTheLocation)
            return urlResolver.resolve('', currentDocument);

        else if (attrValue === null)
            return '';

        else if (HASH_RE.test(attrValue))
            return urlResolver.resolve(attrValue, currentDocument);

        else if (!isValidUrl(attrValue))
            return urlResolver.resolve(attrValue, currentDocument);

        return resolveUrlAsDest(attrValue);
    }

    static _removeProcessingInstructions (text: string): string {
        if (text) {
            text = removeProcessingHeader(text);

            return styleProcessor.cleanUp(text, parseProxyUrl);
        }

        return text;
    }

    static _processTextPropValue (el: HTMLElement, text: string): string {
        const processedText = text !== null && text !== void 0 ? String(text) : text;

        if (processedText) {
            if (isScriptElement(el))
                return processScript(processedText, true, false, convertToProxyUrl);
            else if (isStyleElement(el))
                return styleProcessor.process(processedText, getProxyUrl, true);
        }

        return processedText;
    }

    _overrideUrlAttrDescriptors (attr, elementConstructors) {
        const windowSandbox = this;

        for (const constructor of elementConstructors) {
            overrideDescriptor(constructor.prototype, attr, {
                getter: function () {
                    return WindowSandbox._getUrlAttr(this, attr);
                },
                setter: function (value) {
                    windowSandbox.nodeSandbox.element.setAttributeCore(this, [attr, value]);
                }
            });
        }
    }

    _overrideAttrDescriptors (attr, elementConstructors) {
        const windowSandbox = this;

        for (const constructor of elementConstructors) {
            overrideDescriptor(constructor.prototype, attr, {
                getter: function () {
                    return windowSandbox.nodeSandbox.element.getAttributeCore(this, [attr]) || '';
                },
                setter: function (value) {
                    windowSandbox.nodeSandbox.element.setAttributeCore(this, [attr, value]);
                }
            });
        }
    }

    _overrideUrlPropDescriptor (prop, nativePropGetter, nativePropSetter) {
        // @ts-ignore
        overrideDescriptor(window.HTMLAnchorElement.prototype, prop, {
            getter: function () {
                return getAnchorProperty(this, nativePropGetter);
            },
            setter: function (value) {
                setAnchorProperty(this, nativePropSetter, value);
            }
        });
    }

    _overrideEventPropDescriptor (window, eventName, nativePropSetter) {
        const eventPropsOwner = nativeMethods.isEventPropsLocatedInProto ? window.Window.prototype : window;

        overrideDescriptor(eventPropsOwner, 'on' + eventName, {
            getter: null,
            setter: handler => {
                nativePropSetter.call(window, handler);

                this.listenersSandbox.emit(this.listenersSandbox.EVENT_LISTENER_ATTACHED_EVENT, {
                    el:        window,
                    listener:  handler,
                    eventType: eventName
                });
            }
        });
    }

    _createOverriddenDOMTokenListMethod (nativeMethod) {
        const windowSandbox = this;

        return function () {
            const executionResult = nativeMethod.apply(this, arguments);
            const tokenListOwner  = this[SANDBOX_DOM_TOKEN_LIST_OWNER];

            if (tokenListOwner)
                // eslint-disable-next-line no-restricted-properties
                windowSandbox.nodeSandbox.element.setAttributeCore(tokenListOwner, ['sandbox', this.toString()]);

            return executionResult;
        };
    }

    static _isSecureOrigin (url: string): boolean {
        // NOTE: https://www.chromium.org/Home/chromium-security/prefer-secure-origins-for-powerful-new-features
        const parsedUrl = parseUrl(resolveUrlAsDest(url));

        /*eslint-disable no-restricted-properties*/
        return ALLOWED_SERVICE_WORKER_PROTOCOLS.indexOf(parsedUrl.protocol) === -1 &&
               ALLOWED_SERVICE_WORKER_HOST_NAMES.indexOf(parsedUrl.hostname) === -1;
        /*eslint-enable no-restricted-properties*/
    }

    static isProxyObject (obj: any): boolean {
        try {
            return obj[IS_PROXY_OBJECT_INTERNAL_PROP_NAME] === IS_PROXY_OBJECT_INTERNAL_PROP_VALUE;
        }
        catch (e) {
            return false;
        }
    }

    handleEvent (event) {
        if (event.defaultPrevented)
            return;

        if (event.type === 'unhandledrejection')
            this._raiseUncaughtJsErrorEvent(this.UNHANDLED_REJECTION_EVENT, event, this.window);
        else if (event.type === 'error') {
            if (event.message.indexOf('NS_ERROR_NOT_INITIALIZED') !== -1)
                event.preventDefault();
            else
                this._raiseUncaughtJsErrorEvent(this.UNCAUGHT_JS_ERROR_EVENT, event, window);
        }
        else if (event.type === 'hashchange')
            this.emit(this.HASH_CHANGE_EVENT);
    }

    attach (window) {
        super.attach(window);

        const messageSandbox = this.messageSandbox;
        const nodeSandbox    = this.nodeSandbox;
        const windowSandbox  = this;

        nativeMethods.arrayForEach.call(TRACKED_EVENTS, (event: string) => {
            this._reattachHandler(window, event);
        });

        this.listenersSandbox.initElementListening(window, TRACKED_EVENTS);
        this.listenersSandbox.on(this.listenersSandbox.EVENT_LISTENER_ATTACHED_EVENT, e => {
            if (e.el !== window)
                return;

            if (TRACKED_EVENTS.indexOf(e.eventType) !== -1)
                this._reattachHandler(window, e.eventType);
        });
        this._overrideEventPropDescriptor(window, 'error', nativeMethods.winOnErrorSetter);
        this._overrideEventPropDescriptor(window, 'hashchange', nativeMethods.winOnHashChangeSetter);

        if (nativeMethods.winOnUnhandledRejectionSetter)
            this._overrideEventPropDescriptor(window, 'unhandledrejection', nativeMethods.winOnUnhandledRejectionSetter);

        messageSandbox.on(messageSandbox.SERVICE_MSG_RECEIVED_EVENT, e => {
            const { msg, pageUrl, stack, cmd } = e.message;

            if (cmd === this.UNCAUGHT_JS_ERROR_EVENT || cmd === this.UNHANDLED_REJECTION_EVENT)
                windowSandbox.emit(cmd, { msg, pageUrl, stack });
        });

        window.CanvasRenderingContext2D.prototype.drawImage = function (...args) {
            let image = args[0];

            if (isImgElement(image) && !image[INTERNAL_PROPS.forceProxySrcForImage]) {
                const src = nativeMethods.imageSrcGetter.call(image);

                if (destLocation.sameOriginCheck(location.toString(), src)) {
                    image = nativeMethods.createElement.call(window.document, 'img');

                    nativeMethods.imageSrcSetter.call(image, getProxyUrl(src));

                    args[0] = image;

                    if (!image.complete) {
                        nativeMethods.addEventListener.call(image, 'load',
                            () => nativeMethods.canvasContextDrawImage.apply(this, args));
                    }
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
                    args = nativeMethods.arrayConcat.call(args, sources);

                return nativeMethods.objectAssign.apply(this, args);
            };
        }

        window.open = function (...args) {
            args[0] = getProxyUrl(args[0]);
            args[1] = args[1] ? nodeSandbox.element.getCorrectedTarget(String(args[1])) : '_self';

            return nativeMethods.windowOpen.apply(window, args);
        };

        if (window.FontFace) {
            window.FontFace           = (family, source, descriptors) => {
                source = styleProcessor.process(source, convertToProxyUrl);

                return new nativeMethods.FontFace(family, source, descriptors);
            };
            window.FontFace.prototype = nativeMethods.FontFace.prototype;
            window.FontFace.toString  = () => nativeMethods.FontFace.toString();
        }

        if (window.Worker) {
            const WorkerWrapper = function (scriptURL, options) {
                const isCalledWithoutNewKeyword = constructorIsCalledWithoutNewKeyword(this, WorkerWrapper);

                if (arguments.length === 0)
                    return isCalledWithoutNewKeyword ? nativeMethods.Worker() : new nativeMethods.Worker();

                if (typeof scriptURL === 'string')
                    scriptURL = getProxyUrl(scriptURL, { resourceType: stringifyResourceType({ isScript: true }) });

                if (isCalledWithoutNewKeyword)
                    return nativeMethods.Worker.apply(this, arguments);

                return arguments.length === 1 ? new nativeMethods.Worker(scriptURL) : new nativeMethods.Worker(scriptURL, options);
            };

            window.Worker                       = WorkerWrapper;
            window.Worker.prototype             = nativeMethods.Worker.prototype;
            window.Worker.prototype.constructor = WorkerWrapper;
            window.Worker.toString              = () => nativeMethods.Worker.toString();
        }

        if (window.Blob) {
            window.Blob           = function (array, opts) {
                if (arguments.length === 0)
                    return new nativeMethods.Blob();

                const type = opts && opts.type && opts.type.toString().toLowerCase() || getMimeType(array);

                // NOTE: If we cannot identify the content type of data, we're trying to process it as a script
                // (in the case of the "Array<string | number | boolean>" blob parts array: GH-2115).
                // Unfortunately, we do not have the ability to exactly identify a script. That's why we make such
                // an assumption. We cannot solve this problem at the Worker level either, because the operation of
                // creating a new Blob instance is asynchronous. (GH-231)
                if ((!type || JAVASCRIPT_MIME_TYPES.indexOf(type) !== -1) && WindowSandbox._isProcessableBlob(array))
                    array = [processScript(array.join(''), true, false, convertToProxyUrl)];

                // NOTE: IE11 throws an error when the second parameter of the Blob function is undefined (GH-44)
                // If the overridden function is called with one parameter, we need to call the original function
                // with one parameter as well.
                return arguments.length === 1 ? new nativeMethods.Blob(array) : new nativeMethods.Blob(array, opts);
            };
            window.Blob.prototype = nativeMethods.Blob.prototype;
            window.Blob.toString  = () => nativeMethods.Blob.toString();
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
            window.EventSource.toString   = () => nativeMethods.EventSource.toString();
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
            window.MutationObserver.toString  = () => nativeMethods.MutationObserver.toString();

            if (window.WebKitMutationObserver)
                window.WebKitMutationObserver = window.MutationObserver;
        }

        if (window.Proxy) {
            window.Proxy = function (target, handler) {
                if (handler.get) {
                    const storedGet = handler.get;

                    handler.get = function (getterTarget, name, receiver) {
                        if (name === IS_PROXY_OBJECT_INTERNAL_PROP_NAME)
                            return IS_PROXY_OBJECT_INTERNAL_PROP_VALUE;

                        return storedGet.call(this, getterTarget, name, receiver);
                    };
                }

                return new nativeMethods.Proxy(target, handler);
            };
            window.Proxy.toString = () => nativeMethods.Proxy.toString();
            window.Proxy.revocable = nativeMethods.Proxy.revocable;
        }

        if (nativeMethods.registerServiceWorker) {
            window.navigator.serviceWorker.register = (...args) => {
                const url = args[0];

                if (typeof url === 'string') {
                    if (WindowSandbox._isSecureOrigin(url)) {
                        // NOTE: We cannot create an instance of the DOMException in the Android 6.0 and in the Edge 17 browsers.
                        // The 'TypeError: Illegal constructor' error is raised if we try to call the constructor.
                        return Promise.reject(isAndroid || isMSEdge && browserVersion >= 17
                            ? new Error('Only secure origins are allowed.')
                            : new DOMException('Only secure origins are allowed.', 'SecurityError'));
                    }

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

        if (nativeMethods.getRegistrationServiceWorker) {
            window.navigator.serviceWorker.getRegistration = (...args) => {
                const scopeUrl = args[0];

                if (typeof scopeUrl === 'string') {
                    args[0] = getProxyUrl(scopeUrl, {
                        resourceType: stringifyResourceType({ isScript: true })
                    });
                }

                return nativeMethods.getRegistrationServiceWorker.apply(window.navigator.serviceWorker, args);
            };
        }

        if (window.Range.prototype.createContextualFragment) {
            window.Range.prototype.createContextualFragment = function (...args) {
                const tagString = args[0];

                if (typeof tagString === 'string') {
                    args[0] = processHtml(tagString, {
                        processedContext: this.startContainer && this.startContainer[INTERNAL_PROPS.processedContext]
                    });
                }

                const fragment = nativeMethods.createContextualFragment.apply(this, args);

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

            image[INTERNAL_PROPS.forceProxySrcForImage] = true;

            nodeSandbox.processNodes(image);

            return image;
        };
        window.Image.prototype = nativeMethods.Image.prototype;
        window.Image.toString  = () => nativeMethods.Image.toString();

        const FunctionWrapper = function (...args) {
            const functionBodyArgIndex = args.length - 1;

            if (typeof args[functionBodyArgIndex] === 'string')
                args[functionBodyArgIndex] = processScript(args[functionBodyArgIndex], false, false, convertToProxyUrl);

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
                        args[2] = getProxyUrl(url);

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
                    // eslint-disable-next-line no-restricted-properties
                    const destHostname = destLocation.getParsed().hostname;
                    let isDestUrl: boolean = false;

                    if (isFirefox) {
                        const parsedUrl = parseUrl(args[urlIndex]);

                        // eslint-disable-next-line no-restricted-properties
                        isDestUrl = parsedUrl.hostname && destHostname === parsedUrl.hostname;
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
                if (arguments.length === 2 && isBlob(value) && 'name' in value) {
                    // @ts-ignore
                    nativeMethods.formDataAppend.call(this, name, value, value.name);
                }
                else
                    nativeMethods.formDataAppend.apply(this, arguments);
            };
        }

        if (window.WebSocket) {
            window.WebSocket = function (url, protocols) {
                if (arguments.length === 0)
                    return new nativeMethods.WebSocket();

                const proxyUrl = getProxyUrl(url, { resourceType: stringifyResourceType({ isWebSocket: true }) });

                if (arguments.length === 1)
                    return new nativeMethods.WebSocket(proxyUrl);
                else if (arguments.length === 2)
                    return new nativeMethods.WebSocket(proxyUrl, protocols);

                return new nativeMethods.WebSocket(proxyUrl, protocols, arguments[2]);
            };

            window.WebSocket.prototype  = nativeMethods.WebSocket.prototype;
            window.WebSocket.CONNECTING = nativeMethods.WebSocket.CONNECTING;
            window.WebSocket.OPEN       = nativeMethods.WebSocket.OPEN;
            window.WebSocket.CLOSING    = nativeMethods.WebSocket.CLOSING;
            window.WebSocket.CLOSED     = nativeMethods.WebSocket.CLOSED;

            if (nativeMethods.webSocketUrlGetter) {
                overrideDescriptor(window.WebSocket.prototype, 'url', {
                    getter: function () {
                        const url       = nativeMethods.webSocketUrlGetter.call(this);
                        const parsedUrl = parseProxyUrl(url);

                        if (parsedUrl && parsedUrl.destUrl)
                            return parsedUrl.destUrl.replace(HTTP_PROTOCOL_RE, 'ws');

                        return url;
                    }
                });
            }

            window.WebSocket.toString = () => nativeMethods.WebSocket.toString();
        }

        overrideDescriptor(window.MessageEvent.prototype, 'origin', {
            getter: function () {
                const target = this.target;
                const origin = nativeMethods.messageEventOriginGetter.call(this);

                if (isWebSocket(target)) {
                    const parsedUrl = parseUrl(target.url);

                    if (parsedUrl)
                        // eslint-disable-next-line no-restricted-properties
                        return parsedUrl.protocol + '//' + parsedUrl.host;
                }
                else if (isWindow(target)) {
                    const data = nativeMethods.messageEventDataGetter.call(this);

                    if (data)
                        return data.originUrl;
                }

                return origin;
            }
        });

        overrideDescriptor(window.HTMLCollection.prototype, 'length', {
            getter: function () {
                const length = nativeMethods.htmlCollectionLengthGetter.call(this);

                if (ShadowUI.isShadowContainerCollection(this, length))
                    return windowSandbox.shadowUI.getShadowUICollectionLength(this, length);

                return length;
            }
        });

        overrideDescriptor(window.NodeList.prototype, 'length', {
            getter: function () {
                const length = nativeMethods.nodeListLengthGetter.call(this);

                if (ShadowUI.isShadowContainerCollection(this))
                    return windowSandbox.shadowUI.getShadowUICollectionLength(this, length);

                return length;
            }
        });

        overrideDescriptor(window.Element.prototype, 'childElementCount', {
            getter: function () {
                if (ShadowUI.isShadowContainer(this)) {
                    const childrenLength = nativeMethods.htmlCollectionLengthGetter.call(this.children);

                    return windowSandbox.shadowUI.getShadowUICollectionLength(this.children, childrenLength);
                }

                return nativeMethods.elementChildElementCountGetter.call(this);
            }
        });

        if (nativeMethods.performanceEntryNameGetter) {
            overrideDescriptor(window.PerformanceEntry.prototype, 'name', {
                getter: function () {
                    const name = nativeMethods.performanceEntryNameGetter.call(this);

                    if (isPerformanceNavigationTiming(this)) {
                        const parsedProxyUrl = parseProxyUrl(name);

                        if (parsedProxyUrl)
                            return parsedProxyUrl.destUrl;
                    }

                    return name;
                }
            });
        }

        overrideDescriptor(window.HTMLInputElement.prototype, 'files', {
            getter: function () {
                if (this.type.toLowerCase() === 'file')
                    return UploadSandbox.getFiles(this);

                return nativeMethods.inputFilesGetter.call(this);
            }
        });

        overrideDescriptor(window.HTMLInputElement.prototype, 'value', {
            getter: function () {
                if (this.type.toLowerCase() === 'file')
                    return UploadSandbox.getUploadElementValue(this);

                return nativeMethods.inputValueGetter.call(this);
            },
            setter: function (value) {
                if (this.type.toLowerCase() !== 'file') {

                    nativeMethods.inputValueSetter.call(this, value);

                    const valueChanged = value !== nativeMethods.inputValueGetter.call(this);

                    if (valueChanged && !isShadowUIElement(this) && isTextEditableElementAndEditingAllowed(this))
                        windowSandbox.elementEditingWatcher.restartWatchingElementEditing(this);
                }
                else
                    windowSandbox.uploadSandbox.setUploadElementValue(this, value);
            }
        });

        overrideDescriptor(window.HTMLInputElement.prototype, 'required', {
            getter: function () {
                return windowSandbox.nodeSandbox.element.getAttributeCore(this, ['required']) !== null;
            },
            setter: function (value) {
                if (this.type.toLowerCase() !== 'file')
                    nativeMethods.inputRequiredSetter.call(this, value);
                else if (value)
                    windowSandbox.nodeSandbox.element.setAttributeCore(this, ['required', '']);
                else
                    windowSandbox.nodeSandbox.element.removeAttributeCore(this, ['required']);
            }
        });

        overrideDescriptor(window.HTMLTextAreaElement.prototype, 'value', {
            getter: null,
            setter: function (value) {
                nativeMethods.textAreaValueSetter.call(this, value);

                if (!isShadowUIElement(this) && isTextEditableElementAndEditingAllowed(this))
                    windowSandbox.elementEditingWatcher.restartWatchingElementEditing(this);
            }
        });

        this._overrideUrlAttrDescriptors('data', [window.HTMLObjectElement]);

        this._overrideUrlAttrDescriptors('src', [
            window.HTMLImageElement,
            window.HTMLScriptElement,
            window.HTMLEmbedElement,
            window.HTMLSourceElement,
            window.HTMLMediaElement,
            window.HTMLInputElement,
            window.HTMLFrameElement,
            window.HTMLIFrameElement
        ]);

        this._overrideUrlAttrDescriptors('action', [window.HTMLFormElement]);

        this._overrideUrlAttrDescriptors('formAction', [
            window.HTMLInputElement,
            window.HTMLButtonElement
        ]);

        this._overrideUrlAttrDescriptors('href', [
            window.HTMLAnchorElement,
            window.HTMLLinkElement,
            window.HTMLAreaElement,
            window.HTMLBaseElement
        ]);

        if (nativeMethods.htmlManifestGetter)
            this._overrideUrlAttrDescriptors('manifest', [window.HTMLHtmlElement]);

        this._overrideAttrDescriptors('target', [
            window.HTMLAnchorElement,
            window.HTMLFormElement,
            window.HTMLAreaElement,
            window.HTMLBaseElement
        ]);

        this._overrideAttrDescriptors('formTarget', [
            window.HTMLInputElement,
            window.HTMLButtonElement
        ]);

        this._overrideAttrDescriptors('autocomplete', [window.HTMLInputElement]);

        // NOTE: Some browsers (for example, Edge, Internet Explorer 11, Safari) don't support the 'integrity' property.
        if (nativeMethods.scriptIntegrityGetter && nativeMethods.linkIntegrityGetter) {
            this._overrideAttrDescriptors('integrity', [window.HTMLScriptElement]);
            this._overrideAttrDescriptors('integrity', [window.HTMLLinkElement]);
        }

        this._overrideAttrDescriptors('rel', [window.HTMLLinkElement]);

        overrideDescriptor(window.HTMLInputElement.prototype, 'type', {
            getter: null,
            setter: function (value) {
                windowSandbox.nodeSandbox.element.setAttributeCore(this, ['type', value]);
            }
        });

        overrideDescriptor(window.HTMLIFrameElement.prototype, 'sandbox', {
            getter: function () {
                let domTokenList = this[SANDBOX_DOM_TOKEN_LIST];

                if (!domTokenList) {
                    const span = nativeMethods.createElement.call(document, 'span');

                    domTokenList   = nativeMethods.elementClassListGetter.call(span);
                    span.className = windowSandbox.nodeSandbox.element.getAttributeCore(this, ['sandbox']) || '';

                    nativeMethods.objectDefineProperty(domTokenList, SANDBOX_DOM_TOKEN_LIST_OWNER, { value: this });
                    nativeMethods.objectDefineProperty(this, SANDBOX_DOM_TOKEN_LIST, { value: domTokenList });
                    nativeMethods.objectDefineProperty(this, SANDBOX_DOM_TOKEN_LIST_UPDATE_FN, {
                        value: function (value) {
                            span.className = value;
                        }
                    });
                }

                return domTokenList;
            },
            setter: function (value) {
                windowSandbox.nodeSandbox.element.setAttributeCore(this, ['sandbox', value]);

                if (this[SANDBOX_DOM_TOKEN_LIST_UPDATE_FN])
                    this[SANDBOX_DOM_TOKEN_LIST_UPDATE_FN](windowSandbox.nodeSandbox.element.getAttributeCore(this, ['sandbox']) || '');
            }
        });

        this._overrideUrlPropDescriptor('port', nativeMethods.anchorPortGetter, nativeMethods.anchorPortSetter);
        this._overrideUrlPropDescriptor('host', nativeMethods.anchorHostGetter, nativeMethods.anchorHostSetter);
        this._overrideUrlPropDescriptor('hostname', nativeMethods.anchorHostnameGetter, nativeMethods.anchorHostnameSetter);
        this._overrideUrlPropDescriptor('pathname', nativeMethods.anchorPathnameGetter, nativeMethods.anchorPathnameSetter);
        this._overrideUrlPropDescriptor('protocol', nativeMethods.anchorProtocolGetter, nativeMethods.anchorProtocolSetter);
        this._overrideUrlPropDescriptor('search', nativeMethods.anchorSearchGetter, nativeMethods.anchorSearchSetter);

        overrideDescriptor(window.SVGImageElement.prototype, 'href', {
            getter: function () {
                const imageHref = nativeMethods.svgImageHrefGetter.call(this);

                if (!imageHref[CONTEXT_SVG_IMAGE_ELEMENT]) {
                    nativeMethods.objectDefineProperty(imageHref, CONTEXT_SVG_IMAGE_ELEMENT, {
                        value:        this,
                        configurable: true
                    });
                }

                return imageHref;
            }
        });

        overrideDescriptor(window.SVGAnimatedString.prototype, 'baseVal', {
            getter: function () {
                let baseVal = nativeMethods.svgAnimStrBaseValGetter.call(this);

                if (this[CONTEXT_SVG_IMAGE_ELEMENT]) {
                    const parsedHref = parseProxyUrl(baseVal);

                    baseVal = parsedHref ? parsedHref.destUrl : baseVal;
                }

                return baseVal;
            },
            setter: function (value) {
                const contextSVGImageElement = this[CONTEXT_SVG_IMAGE_ELEMENT];

                if (contextSVGImageElement) {
                    const hasXlinkHrefAttr = nativeMethods.hasAttributeNS.call(contextSVGImageElement, XLINK_NAMESPACE, 'href');

                    windowSandbox.nodeSandbox.element.setAttributeCore(contextSVGImageElement, [hasXlinkHrefAttr ? 'xlink:href' : 'href', value]);
                    value = getProxyUrl(value);
                }

                nativeMethods.svgAnimStrBaseValSetter.call(this, value);
            }
        });

        overrideDescriptor(window.SVGAnimatedString.prototype, 'animVal', {
            getter: function () {
                const animVal = nativeMethods.svgAnimStrAnimValGetter.call(this);

                if (this[CONTEXT_SVG_IMAGE_ELEMENT]) {
                    const parsedAnimVal = parseProxyUrl(animVal);

                    return parsedAnimVal ? parsedAnimVal.destUrl : animVal;
                }

                return animVal;
            }
        });

        if (nativeMethods.anchorOriginGetter) {
            overrideDescriptor(window.HTMLAnchorElement.prototype, 'origin', {
                getter: function () {
                    return getAnchorProperty(this, nativeMethods.anchorOriginGetter);
                }
            });
        }

        overrideDescriptor(window.StyleSheet.prototype, 'href', {
            getter: function () {
                const href      = nativeMethods.styleSheetHrefGetter.call(this);
                const parsedUrl = parseProxyUrl(href);

                return parsedUrl ? parsedUrl.destUrl : href;
            }
        });

        if (nativeMethods.cssStyleSheetHrefGetter) {
            overrideDescriptor(window.CSSStyleSheet.prototype, 'href', {
                getter: function () {
                    const href      = nativeMethods.cssStyleSheetHrefGetter.call(this);
                    const parsedUrl = parseProxyUrl(href);

                    return parsedUrl ? parsedUrl.destUrl : href;
                }
            });
        }

        if (nativeMethods.nodeBaseURIGetter) {
            overrideDescriptor(window.Node.prototype, 'baseURI', {
                getter: function () {
                    const baseURI   = nativeMethods.nodeBaseURIGetter.call(this);
                    const parsedUrl = parseProxyUrl(baseURI);

                    return parsedUrl ? parsedUrl.destUrl : baseURI;
                }
            });
        }

        if (window.DOMParser) {
            window.DOMParser.prototype.parseFromString = function (...args) {
                const str  = args[0];
                const type = args[1];
                let processedHtml;

                if (args.length > 1 && typeof str === 'string' && type === 'text/html') {
                    processedHtml = processHtml(str);
                    args[0]       = processedHtml;
                }

                const document = nativeMethods.DOMParserParseFromString.apply(this, args);

                if (processedHtml)
                    ShadowUI.removeSelfRemovingScripts(document);

                return document;
            };
        }

        overrideDescriptor(window.Node.prototype, 'firstChild', {
            getter: function () {
                if (ShadowUI.isShadowContainer(this))
                    return windowSandbox.shadowUI.getFirstChild(this);

                return nativeMethods.nodeFirstChildGetter.call(this);
            }
        });

        overrideDescriptor(window.Element.prototype, 'firstElementChild', {
            getter: function () {
                if (ShadowUI.isShadowContainer(this))
                    return windowSandbox.shadowUI.getFirstElementChild(this);

                return nativeMethods.elementFirstElementChildGetter.call(this);
            }
        });

        overrideDescriptor(window.Node.prototype, 'lastChild', {
            getter: function () {
                if (ShadowUI.isShadowContainer(this))
                    return windowSandbox.shadowUI.getLastChild(this);

                return nativeMethods.nodeLastChildGetter.call(this);
            }
        });

        overrideDescriptor(window.Element.prototype, 'lastElementChild', {
            getter: function () {
                if (ShadowUI.isShadowContainer(this))
                    return windowSandbox.shadowUI.getLastElementChild(this);

                return nativeMethods.elementLastElementChildGetter.call(this);
            }
        });

        overrideDescriptor(window.Node.prototype, 'nextSibling', {
            getter: function () {
                return windowSandbox.shadowUI.getNextSibling(this);
            }
        });

        overrideDescriptor(window.Node.prototype, 'previousSibling', {
            getter: function () {
                return windowSandbox.shadowUI.getPrevSibling(this);
            }
        });

        overrideDescriptor(window.Element.prototype, 'nextElementSibling', {
            getter: function () {
                return windowSandbox.shadowUI.getNextElementSibling(this);
            }
        });

        overrideDescriptor(window.Element.prototype, 'previousElementSibling', {
            getter: function () {
                return windowSandbox.shadowUI.getPrevElementSibling(this);
            }
        });

        overrideDescriptor(window[nativeMethods.elementHTMLPropOwnerName].prototype, 'innerHTML', {
            getter: function () {
                const innerHTML = nativeMethods.elementInnerHTMLGetter.call(this);

                if (isScriptElement(this))
                    return removeProcessingHeader(innerHTML);
                else if (isStyleElement(this))
                    return styleProcessor.cleanUp(innerHTML, parseProxyUrl);

                return cleanUpHtml(innerHTML);
            },
            setter: function (value) {
                const el         = this;
                const isStyleEl  = isStyleElement(el);
                const isScriptEl = isScriptElement(el);

                let processedValue = value !== null && value !== void 0 ? String(value) : value;

                if (processedValue) {
                    if (isStyleEl)
                        processedValue = styleProcessor.process(processedValue, getProxyUrl, true);
                    else if (isScriptEl)
                        processedValue = processScript(processedValue, true, false, convertToProxyUrl);
                    else {
                        processedValue = processHtml(processedValue, {
                            parentTag:        el.tagName,
                            processedContext: el[INTERNAL_PROPS.processedContext]
                        });
                    }
                }

                if (!isStyleEl && !isScriptEl)
                    DOMMutationTracker.onChildrenChanged(el);

                nativeMethods.elementInnerHTMLSetter.call(el, processedValue);

                if (isStyleEl || isScriptEl)
                    return;

                DOMMutationTracker.onChildrenChanged(el);

                if (windowSandbox.document.body === el) {
                    const shadowUIRoot = windowSandbox.shadowUI.getRoot();

                    windowSandbox.shadowUI.markShadowUIContainers(windowSandbox.document.head, el);
                    ShadowUI.markElementAndChildrenAsShadow(shadowUIRoot);
                }

                else if (isShadowUIElement(el))
                    ShadowUI.markElementAndChildrenAsShadow(el);

                const parentDocument = findDocument(el);
                const parentWindow   = parentDocument ? parentDocument.defaultView : null;

                // NOTE: For the iframe with an empty src.
                if (parentWindow && parentWindow !== window &&
                    parentWindow[INTERNAL_PROPS.processDomMethodName])
                    parentWindow[INTERNAL_PROPS.processDomMethodName](el, parentDocument);
                else if (window[INTERNAL_PROPS.processDomMethodName])
                    window[INTERNAL_PROPS.processDomMethodName](el);

                // NOTE: Fix for B239138 - unroll.me 'Cannot read property 'document' of null' error raised
                // during recording. There was an issue when the document.body was replaced, so we need to
                // reattach UI to a new body manually.

                // NOTE: This check is required because jQuery calls the set innerHTML method for an element
                // in an unavailable window.
                if (window.self) {
                    // NOTE: Use timeout, so that changes take effect.
                    if (isHtmlElement(el) || isBodyElement(el))
                        nativeMethods.setTimeout.call(window, () => windowSandbox.nodeMutation.onBodyContentChanged(el), 0);
                }
            }
        });

        overrideDescriptor(window[nativeMethods.elementHTMLPropOwnerName].prototype, 'outerHTML', {
            getter: function () {
                const outerHTML = nativeMethods.elementOuterHTMLGetter.call(this);

                return cleanUpHtml(outerHTML);
            },
            setter: function (value) {
                const el       = this;
                const parentEl = nativeMethods.nodeParentNodeGetter.call(el);

                DOMMutationTracker.onElementChanged(el);

                if (parentEl && value !== null && value !== void 0) {
                    const parentDocument = findDocument(parentEl);
                    const parentWindow   = parentDocument ? parentDocument.defaultView : null;

                    nativeMethods.elementOuterHTMLSetter.call(el, processHtml(String(value), {
                        parentTag:        parentEl && parentEl.tagName,
                        processedContext: el[INTERNAL_PROPS.processedContext]
                    }));

                    DOMMutationTracker.onChildrenChanged(parentEl);

                    // NOTE: For the iframe with an empty src.
                    if (parentWindow && parentWindow !== window &&
                        parentWindow[INTERNAL_PROPS.processDomMethodName])
                        parentWindow[INTERNAL_PROPS.processDomMethodName](parentEl, parentDocument);
                    else if (window[INTERNAL_PROPS.processDomMethodName])
                        window[INTERNAL_PROPS.processDomMethodName](parentEl);

                    // NOTE: This check is required for an element in an unavailable window.
                    // NOTE: Use timeout, so that changes take effect.
                    if (window.self && isBodyElement(el))
                        nativeMethods.setTimeout.call(window, () => windowSandbox.shadowUI.onBodyElementMutation(), 0);
                }
                else
                    nativeMethods.elementOuterHTMLSetter.call(el, value);
            }
        });

        overrideDescriptor(window.HTMLElement.prototype, 'innerText', {
            getter: function () {
                const textContent = nativeMethods.htmlElementInnerTextGetter.call(this);

                return WindowSandbox._removeProcessingInstructions(textContent);
            },
            setter: function (value) {
                const processedValue = WindowSandbox._processTextPropValue(this, value);

                DOMMutationTracker.onChildrenChanged(this);

                nativeMethods.htmlElementInnerTextSetter.call(this, processedValue);
            }
        });

        overrideDescriptor(window.HTMLScriptElement.prototype, 'text', {
            getter: function () {
                const text = nativeMethods.scriptTextGetter.call(this);

                return removeProcessingHeader(text);
            },
            setter: function (value) {
                const processedValue = value ? processScript(String(value), true, false, convertToProxyUrl) : value;

                nativeMethods.scriptTextSetter.call(this, processedValue);
            }
        });

        overrideDescriptor(window.HTMLAnchorElement.prototype, 'text', {
            getter: function () {
                const textContent = nativeMethods.anchorTextGetter.call(this);

                return WindowSandbox._removeProcessingInstructions(textContent);
            },
            setter: function (value) {
                const processedValue = WindowSandbox._processTextPropValue(this, value);

                DOMMutationTracker.onChildrenChanged(this);

                nativeMethods.anchorTextSetter.call(this, processedValue);
            }
        });

        overrideDescriptor(window.Node.prototype, 'textContent', {
            getter: function () {
                const textContent = nativeMethods.nodeTextContentGetter.call(this);

                return WindowSandbox._removeProcessingInstructions(textContent);
            },
            setter: function (value) {
                const processedValue = WindowSandbox._processTextPropValue(this, value);

                DOMMutationTracker.onChildrenChanged(this);

                nativeMethods.nodeTextContentSetter.call(this, processedValue);
            }
        });

        overrideDescriptor(window[nativeMethods.elementAttributesPropOwnerName].prototype, 'attributes', {
            getter: function () {
                return getAttributes(this);
            }
        });

        window.DOMTokenList.prototype.add    = this._createOverriddenDOMTokenListMethod(nativeMethods.tokenListAdd);
        window.DOMTokenList.prototype.remove = this._createOverriddenDOMTokenListMethod(nativeMethods.tokenListRemove);
        window.DOMTokenList.prototype.toggle = this._createOverriddenDOMTokenListMethod(nativeMethods.tokenListToggle);

        if (nativeMethods.tokenListReplace)
            window.DOMTokenList.prototype.replace = this._createOverriddenDOMTokenListMethod(nativeMethods.tokenListReplace);

        if (nativeMethods.tokenListSupports) {
            window.DOMTokenList.prototype.supports = function () {
                if (this[SANDBOX_DOM_TOKEN_LIST_OWNER]) {
                    const nativeTokenList = nativeMethods.iframeSandboxGetter.call(this[SANDBOX_DOM_TOKEN_LIST_OWNER]);

                    return nativeMethods.tokenListSupports.apply(nativeTokenList, arguments);
                }

                return nativeMethods.tokenListSupports.apply(this, arguments);
            };
        }

        window.DOMImplementation.prototype.createHTMLDocument = function (...args) {
            const doc = nativeMethods.createHTMLDocument.apply(this, args);

            urlResolver.init(doc);

            return doc;
        };

        overrideDescriptor(window.MutationRecord.prototype, 'nextSibling', {
            getter: function () {
                const originNextSibling = nativeMethods.mutationRecordNextSiblingGetter.call(this);

                return windowSandbox.shadowUI.getNextSibling(originNextSibling);
            }
        });

        overrideDescriptor(window.MutationRecord.prototype, 'previousSibling', {
            getter: function () {
                const originPrevSibling = nativeMethods.mutationRecordPrevSiblingGetter.call(this);

                return windowSandbox.shadowUI.getPrevSibling(originPrevSibling);
            }
        });
    }
}
