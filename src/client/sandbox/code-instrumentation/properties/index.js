import INTERNAL_PROPS from '../../../../processing/dom/internal-properties';
import { SAME_ORIGIN_CHECK_FAILED_STATUS_CODE } from '../../../../request-pipeline/xhr/same-origin-policy';
import LocationAccessorsInstrumentation from '../location';
import LocationWrapper from '../location/wrapper';
import SandboxBase from '../../base';
import UploadSandbox from '../../upload';
import ShadowUI from '../../shadow-ui';
import XhrSandbox from '../../xhr';
import ElementSandbox from '../../node/element';
import DomProcessor from '../../../../processing/dom/index';
import * as destLocation from '../../../utils/destination-location';
import * as domUtils from '../../../utils/dom';
import * as typeUtils from '../../../utils/types';
import * as urlUtils from '../../../utils/url';
import { HASH_RE } from '../../../../utils/url';
import { isStyle, isStyleSheet } from '../../../utils/style';
import { cleanUpHtml, processHtml } from '../../../utils/html';
import { getAnchorProperty, setAnchorProperty } from './anchor';
import { getAttributesProperty } from './attributes';
import domProcessor from '../../../dom-processor';
import styleProcessor from '../../../../processing/style';
import { processScript } from '../../../../processing/script';
import { remove as removeProcessingHeader } from '../../../../processing/script/header';
import INSTRUCTION from '../../../../processing/script/instruction';
import { shouldInstrumentProperty } from '../../../../processing/script/instrumented';
import nativeMethods from '../../native-methods';
import { emptyActionAttrFallbacksToTheLocation, hasUnhandledRejectionEvent } from '../../../utils/feature-detection';
import DOMMutationTracker from '../../node/live-node-list/dom-mutation-tracker';

function checkElementTextProperties (el) {
    const result         = {};
    const textProperties = ['innerHTML', 'outerHTML', 'innerText', 'textContent'];

    for (const textProperty of textProperties)
        result[textProperty] = el[textProperty] !== void 0;

    return result;
}

const SVG_ELEMENT_TEXT_PROPERTIES  = checkElementTextProperties(nativeMethods.createElementNS.call(document, 'http://www.w3.org/2000/svg', 'svg'));
const HTML_ELEMENT_TEXT_PROPERTIES = checkElementTextProperties(nativeMethods.createElement.call(document, 'div'));

export default class PropertyAccessorsInstrumentation extends SandboxBase {
    constructor (nodeMutation, eventSandbox, cookieSandbox, uploadSandbox, shadowUI, storageSandbox) {
        super();

        this.nodeMutation          = nodeMutation;
        this.messageSandbox        = eventSandbox.message;
        this.cookieSandbox         = cookieSandbox;
        this.uploadSandbox         = uploadSandbox;
        this.elementEditingWatcher = eventSandbox.elementEditingWatcher;
        this.unloadSandbox         = eventSandbox.unload;
        this.listenersSandbox      = eventSandbox.listeners;
        this.shadowUI              = shadowUI;
        this.storageSandbox        = storageSandbox;
    }

    // NOTE: Isolate throw statements into a separate function because the
    // JS engine doesn't optimize such functions.
    static _error (msg) {
        throw new Error(msg);
    }

    static _getUrlAttr (el, attr) {
        const attrValue = nativeMethods.getAttribute.call(el, attr);

        if (attrValue === '' || attrValue === null && attr === 'action' && emptyActionAttrFallbacksToTheLocation)
            return destLocation.get();

        else if (attrValue === null)
            return '';

        else if (HASH_RE.test(attrValue))
            return destLocation.withHash(attrValue);

        return urlUtils.resolveUrlAsDest(attrValue);
    }

    static _getShadowUICollectionLength (collection) {
        let shadowUIElementCount = 0;

        for (const item of collection) {
            if (domUtils.isShadowUIElement(item))
                shadowUIElementCount++;
        }

        if (shadowUIElementCount)
            ShadowUI.checkElementsPosition(collection);

        return collection.length - shadowUIElementCount;
    }

    static _setTextProp (el, propName, text) {
        const processedText = text !== null && text !== void 0 ? String(text) : text;

        DOMMutationTracker.onChildrenAddedOrRemoved(el);

        if (processedText) {
            if (domUtils.isScriptElement(el))
                el[propName] = processScript(processedText, true);
            else if (domUtils.isStyleElement(el))
                el[propName] = styleProcessor.process(processedText, urlUtils.getProxyUrl, true);
            else
                el[propName] = processedText;
        }
        else
            el[propName] = processedText;

        return text;
    }

    static removeProcessingInstructions (text) {
        if (text) {
            text = removeProcessingHeader(text);

            return styleProcessor.cleanUp(text, urlUtils.parseProxyUrl);
        }

        return text;
    }

    static _elementHasTextProperty (el, prop) {
        if (typeof el[prop] !== 'string')
            return false;

        if (domUtils.isSVGElement(el))
            return SVG_ELEMENT_TEXT_PROPERTIES[prop];

        return HTML_ELEMENT_TEXT_PROPERTIES[prop];
    }

    static _createForStyleProperty (property) {
        return {
            condition: isStyle,

            get: style => styleProcessor.cleanUp(style[property], urlUtils.parseProxyUrl),

            set: (style, value) => {
                if (typeof value === 'string')
                    style[property] = styleProcessor.process(value, urlUtils.getProxyUrl);
                else
                    style[property] = value;

                return value;
            }
        };
    }

    _createPropertyAccessors (window, document) {
        let storedDomain = '';

        return {
            action: {
                condition: el => domUtils.isDomElement(el) && domProcessor.isUrlAttr(el, 'action'),

                get: el => {
                    if (domUtils.isDomElement(el.action))
                        return el.action;

                    return PropertyAccessorsInstrumentation._getUrlAttr(el, 'action');
                },
                set: (el, value) => {
                    el.setAttribute('action', value);

                    return value;
                }
            },

            activeElement: {
                condition: domUtils.isDocument,

                get: el => {
                    if (el.activeElement && domUtils.isShadowUIElement(el.activeElement))
                        return this.shadowUI.getLastActiveElement() || el.body;

                    return el.activeElement;
                },

                set: () => void 0
            },

            attributes: {
                condition: el => {
                    return el.attributes instanceof window.NamedNodeMap;
                },

                get: el => getAttributesProperty(el),
                set: (el, value) => value
            },

            autocomplete: {
                condition: domUtils.isInputElement,
                get:       input => input.getAttribute('autocomplete') || '',
                set:       (input, value) => {
                    input.setAttribute('autocomplete', value);

                    return value;
                }
            },

            childElementCount: {
                condition: ShadowUI.isShadowContainer,
                get:       el => PropertyAccessorsInstrumentation._getShadowUICollectionLength(el.children),
                set:       () => void 0
            },

            cookie: {
                condition: domUtils.isDocument,
                get:       () => this.cookieSandbox.getCookie(),
                set:       (doc, cookie) => this.cookieSandbox.setCookie(doc, String(cookie), true)
            },

            data: {
                condition: el => domUtils.isDomElement(el) && domProcessor.isUrlAttr(el, 'data'),

                get: el => PropertyAccessorsInstrumentation._getUrlAttr(el, 'data'),
                set: (el, value) => {
                    el.setAttribute('data', value);

                    return value;
                }
            },

            documentURI: {
                condition: doc => doc.documentURI && domUtils.isDocument(doc),
                get:       doc => urlUtils.parseProxyUrl(doc.documentURI).destUrl,
                set:       val => val
            },

            domain: {
                condition: domUtils.isDocument,
                get:       () => storedDomain ? storedDomain : LocationAccessorsInstrumentation.getLocationWrapper(window).hostname,
                set:       (doc, domain) => {
                    storedDomain = domain;

                    return domain;
                }
            },

            files: {
                condition: domUtils.isFileInput,
                get:       el => UploadSandbox.getFiles(el),
                set:       (el, value) => value
            },

            firstChild: {
                condition: ShadowUI.isShadowContainer,
                get:       el => this.shadowUI.getFirstChild(el),
                set:       () => void 0
            },

            firstElementChild: {
                condition: ShadowUI.isShadowContainer,
                get:       el => this.shadowUI.getFirstElementChild(el),
                set:       () => void 0
            },

            formAction: {
                condition: el => domUtils.isDomElement(el) && domProcessor.isUrlAttr(el, 'formaction'),

                get: el => PropertyAccessorsInstrumentation._getUrlAttr(el, 'formaction'),
                set: (el, value) => {
                    el.setAttribute('formaction', value);

                    return value;
                }
            },

            host: {
                condition: domUtils.isAnchorElement,
                get:       el => getAnchorProperty(el, 'host'),
                set:       (el, port) => setAnchorProperty(el, 'host', port)
            },

            hostname: {
                condition: domUtils.isAnchorElement,
                get:       el => getAnchorProperty(el, 'hostname'),
                set:       (el, port) => setAnchorProperty(el, 'hostname', port)
            },

            href: {
                condition: el => {
                    if (LocationAccessorsInstrumentation.isLocationWrapper(el))
                        return true;
                    if (domUtils.isDomElement(el))
                        return domProcessor.isUrlAttr(el, 'href');
                    else if (isStyleSheet(el))
                        return true;

                    return false;
                },

                get: el => {
                    if (LocationAccessorsInstrumentation.isLocationWrapper(el))
                        return el.href;
                    else if (isStyleSheet(el)) {
                        const parsedUrl = urlUtils.parseProxyUrl(el.href);

                        return parsedUrl ? parsedUrl.destUrl : el.href;
                    }

                    return PropertyAccessorsInstrumentation._getUrlAttr(el, 'href');
                },

                set: (el, value) => {
                    if (LocationAccessorsInstrumentation.isLocationWrapper(el))
                        el.href = destLocation.resolveUrl(value, document);
                    else if (!isStyleSheet(el))
                        el.setAttribute('href', value);

                    return value;
                }
            },

            innerHTML: {
                condition: el => domUtils.isElementNode(el) &&
                                 PropertyAccessorsInstrumentation._elementHasTextProperty(el, 'innerHTML'),

                get: el => {
                    if (domUtils.isScriptElement(el))
                        return removeProcessingHeader(el.innerHTML);
                    else if (domUtils.isStyleElement(el))
                        return styleProcessor.cleanUp(el.innerHTML, urlUtils.parseProxyUrl);

                    return cleanUpHtml(el.innerHTML, el.tagName);
                },

                set: (el, value) => {
                    const isStyleEl  = domUtils.isStyleElement(el);
                    const isScriptEl = domUtils.isScriptElement(el);

                    let processedValue = value !== null && value !== void 0 ? String(value) : value;

                    if (processedValue) {
                        if (isStyleEl)
                            processedValue = styleProcessor.process(processedValue, urlUtils.getProxyUrl, true);
                        else if (isScriptEl)
                            processedValue = processScript(processedValue, true);
                        else
                            processedValue = processHtml(processedValue, el.tagName);
                    }

                    DOMMutationTracker.onChildrenAddedOrRemoved(el);

                    el.innerHTML = processedValue;

                    DOMMutationTracker.onChildrenAddedOrRemoved(el);

                    if (this.document.body === el) {
                        const shadowUIRoot = this.shadowUI.getRoot();

                        this.shadowUI.markShadowUIContainers(this.document.head, el);
                        ShadowUI.markElementAndChildrenAsShadow(shadowUIRoot);
                    }

                    else if (domUtils.isShadowUIElement(el))
                        ShadowUI.markElementAndChildrenAsShadow(el);

                    if (isStyleEl || isScriptEl)
                        return value;

                    const parentDocument = domUtils.findDocument(el);
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
                        if (domUtils.isHtmlElement(el) || domUtils.isBodyElement(el))
                            nativeMethods.setTimeout.call(window, () => this.nodeMutation.onBodyContentChanged(el), 0);
                    }

                    return value;
                }
            },

            innerText: {
                // NOTE: http://caniuse.com/#search=Node.innerText
                condition: el => domUtils.isElementNode(el) &&
                                 PropertyAccessorsInstrumentation._elementHasTextProperty(el, 'innerText'),

                get: el => PropertyAccessorsInstrumentation.removeProcessingInstructions(el.innerText),

                set: (el, text) => PropertyAccessorsInstrumentation._setTextProp(el, 'innerText', text)
            },

            nextElementSibling: {
                condition: node => node.nextElementSibling && domUtils.isDomElement(node.nextElementSibling),
                get:       node => domUtils.isShadowUIElement(node.nextElementSibling) ? null : node.nextElementSibling,
                set:       () => void 0
            },

            nextSibling: {
                condition: node => node.nextSibling && domUtils.isDomElement(node.nextSibling),
                get:       node => domUtils.isShadowUIElement(node.nextSibling) ? null : node.nextSibling,
                set:       () => void 0
            },

            outerHTML: {
                condition: el => domUtils.isElementNode(el) &&
                                 PropertyAccessorsInstrumentation._elementHasTextProperty(el, 'outerHTML'),

                get: el => cleanUpHtml(el.outerHTML, el.parentNode && el.parentNode.tagName),

                set: (el, value) => {
                    const parentEl = el.parentNode;

                    DOMMutationTracker.onElementAddedOrRemoved(el);

                    if (parentEl && value !== null && value !== void 0) {
                        const parentDocument = domUtils.findDocument(parentEl);
                        const parentWindow   = parentDocument ? parentDocument.defaultView : null;

                        el.outerHTML = processHtml('' + value, parentEl.tagName);

                        DOMMutationTracker.onChildrenAddedOrRemoved(parentEl);

                        // NOTE: For the iframe with an empty src.
                        if (parentWindow && parentWindow !== window &&
                            parentWindow[INTERNAL_PROPS.processDomMethodName])
                            parentWindow[INTERNAL_PROPS.processDomMethodName](parentEl, parentDocument);
                        else if (window[INTERNAL_PROPS.processDomMethodName])
                            window[INTERNAL_PROPS.processDomMethodName](parentEl);

                        // NOTE: This check is required for an element in an unavailable window.
                        // NOTE: Use timeout, so that changes take effect.
                        if (window.self && domUtils.isBodyElement(el))
                            nativeMethods.setTimeout.call(window, () => this.shadowUI.onBodyElementMutation(), 0);

                        return value;
                    }

                    el.outerHTML = value;

                    return value;
                }
            },

            onerror: {
                condition: domUtils.isWindow,
                get:       owner => owner.onerror,

                set: (owner, handler) => {
                    owner.onerror = handler;

                    this.listenersSandbox.emit(this.listenersSandbox.EVENT_LISTENER_ATTACHED_EVENT, {
                        el:        owner,
                        listener:  handler,
                        eventType: 'error'
                    });

                    return handler;
                }
            },

            onunhandledrejection: {
                condition: owner => hasUnhandledRejectionEvent && domUtils.isWindow(owner),
                get:       owner => owner.onunhandledrejection,

                set: (owner, handler) => {
                    owner.onunhandledrejection = handler;

                    this.listenersSandbox.emit(this.listenersSandbox.EVENT_LISTENER_ATTACHED_EVENT, {
                        el:        owner,
                        listener:  handler,
                        eventType: 'unhandledrejection'
                    });

                    return handler;
                }
            },

            lastChild: {
                condition: ShadowUI.isShadowContainer,
                get:       el => this.shadowUI.getLastChild(el),
                set:       () => void 0
            },

            lastElementChild: {
                condition: ShadowUI.isShadowContainer,
                get:       el => this.shadowUI.getLastElementChild(el),
                set:       () => void 0
            },

            length: {
                condition: ShadowUI.isShadowContainerCollection,
                get:       PropertyAccessorsInstrumentation._getShadowUICollectionLength,

                set: () => void 0
            },

            localStorage: {
                condition: domUtils.isWindow,
                get:       () => this.storageSandbox.localStorage,
                set:       () => void 0
            },

            location: {
                condition: owner => domUtils.isDocument(owner) || domUtils.isWindow(owner),

                get: owner => {
                    const locationWrapper = LocationAccessorsInstrumentation.getLocationWrapper(owner);

                    if (locationWrapper)
                        return locationWrapper;

                    const wnd = domUtils.isWindow(owner) ? owner : owner.defaultView;

                    return new LocationWrapper(wnd);
                },

                set: (owner, location) => {
                    if (typeof location === 'string') {
                        const ownerWindow     = domUtils.isWindow(owner) ? owner : owner.defaultView;
                        const locationWrapper = LocationAccessorsInstrumentation.getLocationWrapper(ownerWindow);

                        if (locationWrapper)
                            locationWrapper.href = location;
                        else
                            owner.location = location;

                        return location;
                    }

                    return owner.location;
                }
            },

            manifest: {
                condition: el => domUtils.isDomElement(el) && domProcessor.isUrlAttr(el, 'manifest'),

                get: el => PropertyAccessorsInstrumentation._getUrlAttr(el, 'manifest'),
                set: (el, value) => {
                    el.setAttribute('manifest', value);

                    return value;
                }
            },

            // NOTE: Cookie can be set up for the page by using the request initiated by img.
            // For example: img.src = '<url that responds with the Set-Cookie header>'
            // If img has the 'load' event handler, we redirect the request through proxy.
            // For details, see https://github.com/DevExpress/testcafe-hammerhead/issues/651
            onload: {
                condition: el => domUtils.isDomElement(el) && domUtils.isImgElement(el),

                get: el => el.onload,
                set: (el, handler) => {
                    if (typeof handler === 'function') {
                        ElementSandbox.setHasLoadHandlerFlag(el);

                        if (el.src)
                            el.src = urlUtils.getProxyUrl(el.src);
                    }
                    else
                        ElementSandbox.removeHasLoadHandlerFlag(el);

                    el.onload = handler;

                    return el.onload;
                }
            },

            origin: {
                condition: domUtils.isAnchorElement,
                get:       el => el.origin !== void 0 ? getAnchorProperty(el, 'origin') : el.origin,
                set:       (el, origin) => {
                    el.origin = origin;

                    return origin;
                }
            },

            pathname: {
                condition: domUtils.isAnchorElement,
                get:       el => getAnchorProperty(el, 'pathname'),
                set:       (el, pathname) => setAnchorProperty(el, 'pathname', pathname)
            },

            port: {
                condition: domUtils.isAnchorElement,
                get:       el => getAnchorProperty(el, 'port'),
                set:       (el, port) => setAnchorProperty(el, 'port', port)
            },

            protocol: {
                condition: domUtils.isAnchorElement,
                get:       el => getAnchorProperty(el, 'protocol'),
                set:       (el, port) => setAnchorProperty(el, 'protocol', port)
            },

            referrer: {
                condition: domUtils.isDocument,

                get: doc => {
                    const proxyUrl = urlUtils.parseProxyUrl(doc.referrer);

                    return proxyUrl ? proxyUrl.destUrl : '';
                },

                set: (doc, value) => {
                    doc.referrer = urlUtils.getProxyUrl(value);

                    return value;
                }
            },

            sandbox: {
                condition: domUtils.isIframeElement,
                get:       el => el.getAttribute('sandbox'),
                set:       (el, value) => {
                    el.setAttribute('sandbox', value);

                    return value;
                }
            },

            search: {
                condition: domUtils.isAnchorElement,
                get:       el => getAnchorProperty(el, 'search'),
                set:       (el, search) => setAnchorProperty(el, 'search', search)
            },

            sessionStorage: {
                condition: domUtils.isWindow,
                get:       () => this.storageSandbox.sessionStorage,
                set:       () => void 0
            },

            src: {
                condition: el => domUtils.isDomElement(el) && domProcessor.isUrlAttr(el, 'src'),

                get: el => PropertyAccessorsInstrumentation._getUrlAttr(el, 'src'),
                set: (el, value) => {
                    el.setAttribute('src', value);

                    return value;
                }
            },

            target: {
                condition: el => domUtils.isDomElement(el) && DomProcessor.isTagWithTargetAttr(domUtils.getTagName(el)),
                get:       el => el.target,
                set:       (el, value) => {
                    el.setAttribute('target', value);

                    return value;
                }
            },

            text: {
                // NOTE: only these elements have text property and their text may contain script or style tags
                condition: el => domUtils.isScriptElement(el) || domUtils.isAnchorElement(el),

                get: el => PropertyAccessorsInstrumentation.removeProcessingInstructions(el.text),

                set: (el, text) => PropertyAccessorsInstrumentation._setTextProp(el, 'text', text)
            },

            textContent: {
                condition: el => domUtils.isElementNode(el) &&
                                 PropertyAccessorsInstrumentation._elementHasTextProperty(el, 'textContent'),

                get: el => PropertyAccessorsInstrumentation.removeProcessingInstructions(el.textContent),

                set: (el, text) => PropertyAccessorsInstrumentation._setTextProp(el, 'textContent', text)
            },

            URL: {
                condition: domUtils.isDocument,
                get:       doc => LocationAccessorsInstrumentation.getLocationWrapper(doc).href,
                set:       () => void 0
            },

            baseURI: {
                condition: domUtils.isDocument,

                get: doc => {
                    if (doc.baseURI) {
                        const parsedURI = urlUtils.parseProxyUrl(doc.baseURI);

                        if (parsedURI)
                            return parsedURI.destUrl;
                    }

                    return doc.baseURI;
                },
                set: (doc, url) => {
                    const result = doc.baseURI = url;

                    return result;
                }
            },

            value: {
                condition: el => domUtils.isDomElement(el) && (domUtils.isFileInput(el) ||
                                                               domUtils.isTextEditableElementAndEditingAllowed(el) &&
                                                               !domUtils.isShadowUIElement(el)),

                get: el => {
                    if (domUtils.isFileInput(el))
                        return UploadSandbox.getUploadElementValue(el);

                    return el.value;
                },

                set: (el, value) => {
                    if (domUtils.isFileInput(el))
                        return this.uploadSandbox.setUploadElementValue(el, value);

                    el.value = value;

                    this.elementEditingWatcher.restartWatchingElementEditing(el);

                    return value;
                }
            },

            scripts: {
                condition: domUtils.isDocument,
                get:       doc => this.shadowUI._filterNodeList(doc.scripts),
                set:       (doc, value) => {
                    doc.scripts = value;

                    return value;
                }
            },

            status: {
                condition: XhrSandbox.isOpenedXhr,
                // NOTE: The browser returns a 0 status code if the same-origin policy check is failed. Node.js v5.11 or higher
                // (https://github.com/nodejs/node/blob/v5.11.0/CHANGELOG.md, https://github.com/nodejs/node/pull/6291/files)
                // does not allow returning a response with this code. So, we use a valid unused 222 status code and change
                // it to 0 on the client side.
                get:       xhr => xhr.status === SAME_ORIGIN_CHECK_FAILED_STATUS_CODE ? 0 : xhr.status,
                set:       (xhr, value) => {
                    xhr.status = value;

                    return value;
                }
            },

            // Event
            onbeforeunload: {
                condition: domUtils.isWindow,
                get:       () => this.unloadSandbox.getOnBeforeUnload(),
                set:       (wnd, handler) => this.unloadSandbox.setOnBeforeUnload(wnd, handler)
            },

            onpagehide: {
                condition: domUtils.isWindow,
                get:       () => this.unloadSandbox.getOnBeforeUnload(),
                set:       (wnd, handler) => this.unloadSandbox.setOnBeforeUnload(wnd, handler)
            },

            onmessage: {
                condition: domUtils.isWindow,
                get:       () => this.messageSandbox.getOnMessage(),
                set:       (wnd, handler) => this.messageSandbox.setOnMessage(wnd, handler)
            },

            which: {
                condition: ev => ev[INTERNAL_PROPS.whichPropertyWrapper] !== void 0 ||
                                 ev.originalEvent &&
                                 ev.originalEvent[INTERNAL_PROPS.whichPropertyWrapper] !== void 0,

                get: ev => ev.originalEvent ? ev.originalEvent[INTERNAL_PROPS.whichPropertyWrapper] :
                           ev[INTERNAL_PROPS.whichPropertyWrapper],

                set: () => void 0
            },

            // Style
            background:            PropertyAccessorsInstrumentation._createForStyleProperty('background'),
            backgroundImage:       PropertyAccessorsInstrumentation._createForStyleProperty('backgroundImage'),
            'background-image':    PropertyAccessorsInstrumentation._createForStyleProperty('background-image'),
            borderImage:           PropertyAccessorsInstrumentation._createForStyleProperty('borderImage'),
            'border-image':        PropertyAccessorsInstrumentation._createForStyleProperty('border-image'),
            'borderImageSource':   PropertyAccessorsInstrumentation._createForStyleProperty('borderImageSource'),
            'border-image-source': PropertyAccessorsInstrumentation._createForStyleProperty('border-image-source'),
            listStyle:             PropertyAccessorsInstrumentation._createForStyleProperty('listStyle'),
            'list-style':          PropertyAccessorsInstrumentation._createForStyleProperty('list-style'),
            listStyleImage:        PropertyAccessorsInstrumentation._createForStyleProperty('listStyleImage'),
            'list-style-image':    PropertyAccessorsInstrumentation._createForStyleProperty('list-style-image'),
            cssText:               PropertyAccessorsInstrumentation._createForStyleProperty('cssText'),
            cursor:                PropertyAccessorsInstrumentation._createForStyleProperty('cursor'),

            styleSheets: {
                condition: domUtils.isDocument,
                get:       doc => this.shadowUI._filterStyleSheetList(doc.styleSheets),
                set:       (doc, value) => {
                    doc.styleSheets = value;

                    return value;
                }
            },

            // xhr
            responseURL: {
                condition: domUtils.isXMLHttpRequest,
                get:       xhr => xhr.responseURL ? urlUtils.parseProxyUrl(xhr.responseURL).destUrl : xhr.responseURL,
                set:       (xhr, url) => {
                    xhr.responseURL = url;

                    return url;
                }
            }
        };
    }

    static _getSetPropertyInstructionByOwner (owner, window) {
        try {
            return owner && owner[INTERNAL_PROPS.processedContext] &&
                   owner[INTERNAL_PROPS.processedContext] !== window &&
                   owner[INTERNAL_PROPS.processedContext][INSTRUCTION.setProperty];
        }
        catch (e) {
            return null;
        }
    }

    attach (window) {
        super.attach(window);

        const accessors = this._createPropertyAccessors(window, window.document);

        // NOTE: In Google Chrome, iframes whose src contains html code raise the 'load' event twice.
        // So, we need to define code instrumentation functions as 'configurable' so that they can be redefined.
        nativeMethods.objectDefineProperty.call(window.Object, window, INSTRUCTION.getProperty, {
            value: (owner, propName) => {
                if (typeUtils.isNullOrUndefined(owner))
                    PropertyAccessorsInstrumentation._error(`Cannot read property '${propName}' of ${typeUtils.inaccessibleTypeToStr(owner)}`);

                if (typeof propName === 'string' && shouldInstrumentProperty(propName) &&
                    accessors[propName].condition(owner))
                    return accessors[propName].get(owner);

                return owner[propName];
            },

            configurable: true
        });

        nativeMethods.objectDefineProperty.call(window.Object, window, INSTRUCTION.setProperty, {
            value: (owner, propName, value) => {
                if (typeUtils.isNullOrUndefined(owner))
                    PropertyAccessorsInstrumentation._error(`Cannot set property '${propName}' of ${typeUtils.inaccessibleTypeToStr(owner)}`);

                const ownerSetPropertyInstruction = PropertyAccessorsInstrumentation._getSetPropertyInstructionByOwner(owner, window);

                if (ownerSetPropertyInstruction)
                    return ownerSetPropertyInstruction(owner, propName, value);

                if (typeof propName === 'string' && shouldInstrumentProperty(propName) &&
                    accessors[propName].condition(owner))
                    return accessors[propName].set(owner, value);

                /* eslint-disable no-return-assign */
                return owner[propName] = value;
                /* eslint-enable no-return-assign */
            },

            configurable: true
        });

        return accessors;
    }
}
