/*global history, navigator*/
import SandboxBase from '../base';
import ShadowUI from '../shadow-ui';
import nativeMethods from '../native-methods';
import { processScript } from '../../../processing/script';
import styleProcessor from '../../../processing/style';
import * as destLocation from '../../utils/destination-location';
import { cleanUpHtml, processHtml } from '../../utils/html';
import {
    isSubDomain,
    parseUrl,
    getProxyUrl,
    parseProxyUrl,
    convertToProxyUrl,
    stringifyResourceType,
    resolveUrlAsDest
} from '../../utils/url';
import { isFirefox, isIE, isAndroid } from '../../utils/browser';
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

const nativeFunctionToString = nativeMethods.Function.toString();

// NOTE: We should avoid using native object prototype methods,
// since they can be overriden by the client code. (GH-245)
const arrayConcat = Array.prototype.concat;

const HTTP_PROTOCOL_RE = /^http/i;

const ALLOWED_SERVICE_WORKER_PROTOCOLS  = ['https:', 'wss:', 'file:'];
const ALLOWED_SERVICE_WORKER_HOST_NAMES = ['localhost', '127.0.0.1'];
const JAVASCRIPT_MIME_TYPES             = ['text/javascript', 'application/javascript', 'application/x-javascript'];

// NOTE: SVGAnimatedString prototype does not have a way to access the appropriate svg element.
// This is why we use this property to store svg element for which animVal and baseVal properties were set.
// It allows us to change the href-hammerhead-stored-value when it needs.
const CONTEXT_SVG_IMAGE_ELEMENT = 'hammerhead|context-svg-image-element';

export default class WindowSandbox extends SandboxBase {
    constructor (nodeSandbox, eventSandbox, uploadSandbox, nodeMutation) {
        super();

        this.nodeSandbox           = nodeSandbox;
        this.messageSandbox        = eventSandbox.message;
        this.listenersSandbox      = eventSandbox.listeners;
        this.elementEditingWatcher = eventSandbox.elementEditingWatcher;
        this.uploadSandbox         = uploadSandbox;
        this.shadowUI              = nodeSandbox.shadowUI;
        this.nodeMutation          = nodeMutation;

        this.UNCAUGHT_JS_ERROR_EVENT   = 'hammerhead|event|uncaught-js-error';
        this.UNHANDLED_REJECTION_EVENT = 'hammerhead|event|unhandled-rejection';
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

    static _getUrlAttr (el, attr) {
        const attrValue = nativeMethods.getAttribute.call(el, attr);

        if (attrValue === '' || attrValue === null && attr === 'action' && emptyActionAttrFallbacksToTheLocation)
            return destLocation.get();

        else if (attrValue === null)
            return '';

        else if (HASH_RE.test(attrValue))
            return destLocation.withHash(attrValue);

        else if (!isValidUrl(attrValue))
            return urlResolver.resolve(attrValue, document);

        return resolveUrlAsDest(attrValue);
    }

    static _removeProcessingInstructions (text) {
        if (text) {
            text = removeProcessingHeader(text);

            return styleProcessor.cleanUp(text, parseProxyUrl);
        }

        return text;
    }

    static _processTextPropValue (el, text) {
        const processedText = text !== null && text !== void 0 ? String(text) : text;

        if (processedText) {
            if (isScriptElement(el))
                return processScript(processedText, true);
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
        overrideDescriptor(window.HTMLAnchorElement.prototype, prop, {
            getter: function () {
                return getAnchorProperty(this, nativePropGetter);
            },
            setter: function (value) {
                setAnchorProperty(this, nativePropSetter, value);
            }
        });
    }

    _overrideErrEventPropDescriptor (window, eventName, nativePropSetter) {
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

    static _isSecureOrigin (url) {
        // NOTE: https://www.chromium.org/Home/chromium-security/prefer-secure-origins-for-powerful-new-features
        const parsedUrl = parseUrl(resolveUrlAsDest(url));

        /*eslint-disable no-restricted-properties*/
        return ALLOWED_SERVICE_WORKER_PROTOCOLS.indexOf(parsedUrl.protocol) === -1 &&
               ALLOWED_SERVICE_WORKER_HOST_NAMES.indexOf(parsedUrl.hostname) === -1;
        /*eslint-enable no-restricted-properties*/
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
        this._overrideErrEventPropDescriptor(window, 'error', nativeMethods.winOnErrorSetter);

        if (nativeMethods.winOnUnhandledRejectionSetter)
            this._overrideErrEventPropDescriptor(window, 'unhandledrejection', nativeMethods.winOnUnhandledRejectionSetter);

        messageSandbox.on(messageSandbox.SERVICE_MSG_RECEIVED_EVENT, e => {
            const message = e.message;

            if (message.cmd === this.UNCAUGHT_JS_ERROR_EVENT || message.cmd === this.UNHANDLED_REJECTION_EVENT)
                this._raiseUncaughtJsErrorEvent(message.cmd, message.msg, window, message.pageUrl);
        });

        window.CanvasRenderingContext2D.prototype.drawImage = function (...args) {
            let image = args[0];

            if (isImgElement(image) && !image[INTERNAL_PROPS.forceProxySrcForImage]) {
                const src = nativeMethods.imageSrcGetter.call(image);

                if (destLocation.sameOriginCheck(location.toString(), src)) {
                    image = nativeMethods.createElement.call(window.document, 'img');

                    nativeMethods.imageSrcSetter.call(image, getProxyUrl(src));

                    args[0] = image;

                    if (!image.complete)
                        image.onload = () => nativeMethods.canvasContextDrawImage.apply(this, args);
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
            window.Blob           = function (array, opts) {
                if (arguments.length === 0)
                    return new nativeMethods.Blob();

                const type = opts && opts.type && opts.type.toString().toLowerCase() || getMimeType(array);

                // NOTE: If we cannot identify the content type of data, we're trying to process it as a script.
                // Unfortunately, we do not have the ability to exactly identify a script. That's why we make such
                // an assumption. We cannot solve this problem at the Worker level either, because the operation of
                // creating a new Blob instance is asynchronous. (GH-231)
                if (!type || JAVASCRIPT_MIME_TYPES.indexOf(type) !== -1)
                    array = [processScript(array.join(''), true)];

                // NOTE: IE11 throws an error when the second parameter of the Blob function is undefined (GH-44)
                // If the overridden function is called with one parameter, we need to call the original function
                // with one parameter as well.
                return arguments.length === 1 ? new nativeMethods.Blob(array) : new nativeMethods.Blob(array, opts);
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
                    if (WindowSandbox._isSecureOrigin(url)) {
                        // NOTE: We cannot create an instance of the DOMException in the Android 6.0 browser.
                        // The 'TypeError: Illegal constructor' error is raised if we try to call the constructor.
                        return Promise.reject(isAndroid
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

            image[INTERNAL_PROPS.forceProxySrcForImage] = true;

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
                    /*eslint-disable no-restricted-properties*/
                    const destHostname = destLocation.getParsed().hostname;
                    /*eslint-enable no-restricted-properties*/

                    let isDestUrl = '';

                    if (isFirefox) {
                        const parsedUrl = parseUrl(args[urlIndex]);

                        /*eslint-disable no-restricted-properties*/
                        isDestUrl = parsedUrl.hostname && isSubDomain(destHostname, parsedUrl.hostname);
                        /*eslint-enable no-restricted-properties*/
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
        }

        overrideDescriptor(window.MessageEvent.prototype, 'origin', {
            getter: function () {
                const target = this.target;
                const origin = nativeMethods.messageEventOriginGetter.call(this);

                if (isWebSocket(target)) {
                    const parsedUrl = parseUrl(target.url);

                    /*eslint-disable no-restricted-properties*/
                    if (parsedUrl)
                        return parsedUrl.protocol + '//' + parsedUrl.host;
                    /*eslint-enable no-restricted-properties*/
                }
                else if (isWindow(target)) {
                    const data = nativeMethods.messageEventDataGetter
                        ? nativeMethods.messageEventDataGetter.call(this)
                        : this.data;

                    if (data)
                        return data.originUrl;
                }

                return origin;
            }
        });

        overrideDescriptor(window.HTMLCollection.prototype, 'length', {
            getter: function () {
                const length = nativeMethods.htmlCollectionLengthGetter.call(this);

                if (ShadowUI.isShadowContainerCollection(this))
                    return ShadowUI.getShadowUICollectionLength(this, length);

                return length;
            }
        });

        overrideDescriptor(window.NodeList.prototype, 'length', {
            getter: function () {
                const length = nativeMethods.nodeListLengthGetter.call(this);

                if (ShadowUI.isShadowContainerCollection(this))
                    return ShadowUI.getShadowUICollectionLength(this, length);

                return length;
            }
        });

        overrideDescriptor(window.Element.prototype, 'childElementCount', {
            getter: function () {
                if (ShadowUI.isShadowContainer(this)) {
                    const childrenLength = nativeMethods.htmlCollectionLengthGetter.call(this.children);

                    return ShadowUI.getShadowUICollectionLength(this.children, childrenLength);
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

        const windowSandbox = this;

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

        this._overrideAttrDescriptors('autocomplete', [window.HTMLInputElement]);

        this._overrideAttrDescriptors('integrity', [
            window.HTMLScriptElement,
            window.HTMLLinkElement
        ])

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
                if (args.length > 1 && typeof args[0] === 'string' && args[1] === 'text/html')
                    args[0] = processHtml(args[0]);

                return nativeMethods.DOMParserParseFromString.apply(this, args);
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

        overrideDescriptor(window.Element.prototype, 'nextElementSibling', {
            getter: function () {
                return windowSandbox.shadowUI.getNextElementSibling(this);
            }
        });

        overrideDescriptor(window[nativeMethods.elementHTMLPropOwnerName].prototype, 'innerHTML', {
            getter: function () {
                const innerHTML = nativeMethods.elementInnerHTMLGetter.call(this);

                if (isScriptElement(this))
                    return removeProcessingHeader(innerHTML);
                else if (isStyleElement(this))
                    return styleProcessor.cleanUp(innerHTML, parseProxyUrl);

                return cleanUpHtml(innerHTML, this.tagName);
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
                        processedValue = processScript(processedValue, true);
                    else
                        processedValue = processHtml(processedValue, { parentTag: el.tagName });
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

                return cleanUpHtml(outerHTML, this.parentNode && this.parentNode.tagName);
            },
            setter: function (value) {
                const parentEl = this.parentNode;

                DOMMutationTracker.onElementChanged(this);

                if (parentEl && value !== null && value !== void 0) {
                    const parentDocument = findDocument(parentEl);
                    const parentWindow   = parentDocument ? parentDocument.defaultView : null;

                    nativeMethods.elementOuterHTMLSetter.call(this, processHtml(String(value), { parentTag: parentEl.tagName }));

                    DOMMutationTracker.onChildrenChanged(parentEl);

                    // NOTE: For the iframe with an empty src.
                    if (parentWindow && parentWindow !== window &&
                        parentWindow[INTERNAL_PROPS.processDomMethodName])
                        parentWindow[INTERNAL_PROPS.processDomMethodName](parentEl, parentDocument);
                    else if (window[INTERNAL_PROPS.processDomMethodName])
                        window[INTERNAL_PROPS.processDomMethodName](parentEl);

                    // NOTE: This check is required for an element in an unavailable window.
                    // NOTE: Use timeout, so that changes take effect.
                    if (window.self && isBodyElement(this))
                        nativeMethods.setTimeout.call(window, () => this.shadowUI.onBodyElementMutation(), 0);
                }
                else
                    nativeMethods.elementOuterHTMLSetter.call(this, value);
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
                const processedValue = value ? processScript(String(value), true) : value;

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
    }
}
