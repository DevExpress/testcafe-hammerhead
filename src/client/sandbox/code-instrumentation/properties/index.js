import INTERNAL_PROPS from '../../../../processing/dom/internal-properties';
import SHADOW_UI_CLASSNAME from '../../../../shadow-ui/class-name';
import LocationAccessorsInstrumentation from '../location';
import LocationWrapper from '../location/wrapper';
import SandboxBase from '../../base';
import UploadSandbox from '../../upload';
import ShadowUI from '../../shadow-ui';
import * as originLocation from '../../../utils/origin-location';
import * as domUtils from '../../../utils/dom';
import * as typeUtils from '../../../utils/types';
import * as urlUtils from '../../../utils/url';
import { isStyle } from '../../../utils/style';
import { cleanUpHtml, processHtml } from '../../../utils/html';
import { getAnchorProperty, setAnchorProperty } from './anchor';
import { getAttributesProperty } from './attributes';
import { URL_ATTR_TAGS, TARGET_ATTR_TAGS } from '../../../dom-processor';
import { process as processStyle, cleanUp as cleanUpStyle } from '../../../../processing/style';
import { process as processScript, cleanUpHeader as cleanUpScriptHeader } from '../../../../processing/script';
import { GET_PROPERTY_METH_NAME, SET_PROPERTY_METH_NAME } from '../../../../processing/js';
import { setTimeout as nativeSetTimeout } from '../../native-methods';

const ORIGINAL_WINDOW_ON_ERROR_HANDLER_KEY = 'hammerhead|original-window-on-error-handler-key';

export default class PropertyAccessorsInstrumentation extends SandboxBase {
    constructor (nodeMutation, eventSandbox, cookieSandbox, uploadSandbox, shadowUI) {
        super();

        this.nodeMutation          = nodeMutation;
        this.messageSandbox        = eventSandbox.message;
        this.cookieSandbox         = cookieSandbox;
        this.uploadSandbox         = uploadSandbox;
        this.elementEditingWatcher = eventSandbox.elementEditingWatcher;
        this.unloadSandbox         = eventSandbox.unload;
        this.shadowUI              = shadowUI;
    }

    // NOTE: Isolate throw statements into a separate function because the
    // JS engine doesn't optimize such functions.
    static _error (msg) {
        throw new Error(msg);
    }

    static _getUrlAttr (el, attr) {
        var attrValue = el.getAttribute(attr);

        if (attrValue === null)
            return '';

        else if (attrValue === '')
            return originLocation.get();

        else if (/^#/.test(attrValue))
            return originLocation.withHash(attrValue);


        return urlUtils.resolveUrlAsOrigin(attrValue);
    }

    _createPropertyAccessors (window, document) {
        var storedDomain = '';

        return {
            action: {
                condition: el => {
                    if (domUtils.isDomElement(el))
                        return URL_ATTR_TAGS['action'].indexOf(el.tagName.toLowerCase()) !== -1;

                    return false;
                },

                get: el => PropertyAccessorsInstrumentation._getUrlAttr(el, 'action'),
                set: (el, value) => el.setAttribute('action', value)
            },

            activeElement: {
                condition: el => domUtils.isDocument(el),

                get: el => {
                    if (domUtils.isShadowUIElement(el.activeElement))
                        return this.shadowUI.getLastActiveElement() || el.body;

                    return el.activeElement;
                },

                set: () => void 0
            },

            attributes: {
                condition: el => {
                    var attributesType = window.NamedNodeMap || window.MozNamedAttrMap;

                    return attributesType && el.attributes instanceof attributesType;
                },

                get: el => getAttributesProperty(el),
                set: (el, value) => value
            },

            autocomplete: {
                condition: el => domUtils.isInputElement(el),
                get:       input => input.getAttribute('autocomplete') || '',
                set:       (input, value) => input.setAttribute('autocomplete', value)
            },

            cookie: {
                condition: doc => domUtils.isDocument(doc),
                get:       () => this.cookieSandbox.getCookie(),
                set:       (doc, cookie) => this.cookieSandbox.setCookie(doc, cookie)
            },

            data: {
                condition: el => {
                    if (domUtils.isDomElement(el))
                        return URL_ATTR_TAGS['data'].indexOf(el.tagName.toLowerCase()) !== -1;

                    return false;
                },

                get: el => PropertyAccessorsInstrumentation._getUrlAttr(el, 'data'),
                set: (el, value) => el.setAttribute('data', value)
            },

            domain: {
                condition: doc => domUtils.isDocument(doc),
                get:       () => storedDomain ? storedDomain : LocationAccessorsInstrumentation.getLocationWrapper(window).hostname,
                set:       (doc, domain) => storedDomain = domain
            },

            files: {
                condition: el => domUtils.isFileInput(el),
                get:       el => UploadSandbox.getFiles(el),
                set:       (el, value) => value
            },

            firstChild: {
                condition: el => ShadowUI.isShadowContainer(el),
                get:       el => this.shadowUI.getFirstChild(el),
                set:       () => void 0
            },

            firstElementChild: {
                condition: el => ShadowUI.isShadowContainer(el),
                get:       el => this.shadowUI.getFirstElementChild(el),
                set:       () => void 0
            },

            host: {
                condition: el => domUtils.isAnchor(el),
                get:       el => getAnchorProperty(el, 'host'),
                set:       (el, port) => setAnchorProperty(el, 'host', port)
            },

            hostname: {
                condition: el => domUtils.isAnchor(el),
                get:       el => getAnchorProperty(el, 'hostname'),
                set:       (el, port) => setAnchorProperty(el, 'hostname', port)
            },

            href: {
                condition: el => {
                    if (domUtils.isDomElement(el))
                        return URL_ATTR_TAGS['href'].indexOf(el.tagName.toLowerCase()) !== -1;

                    return LocationAccessorsInstrumentation.isLocationWrapper(el);
                },

                get: el => LocationAccessorsInstrumentation.isLocationWrapper(el) ? el.href : PropertyAccessorsInstrumentation._getUrlAttr(el, 'href'),
                set: (el, value) => LocationAccessorsInstrumentation.isLocationWrapper(el) ?
                                    el.href = originLocation.resolveUrl(value, document) : el.setAttribute('href', value)
            },

            innerHTML: {
                condition: el => el.nodeType === 1 && 'innerHTML' in el,
                get:       el => cleanUpHtml(el.innerHTML, el.tagName),

                set: (el, value) => {
                    if (el.tagName && el.tagName.toLowerCase() === 'style')
                        value = processStyle('' + value, urlUtils.getProxyUrl, true);
                    else if (value !== null)
                        value = processHtml('' + value, el.tagName);

                    el.innerHTML = value;

                    var parentDocument = domUtils.findDocument(el);
                    var parentWindow   = parentDocument ? parentDocument.defaultView : null;

                    // NOTE: For the iframe with an empty src.
                    if (parentWindow && parentWindow !== window &&
                        parentWindow[INTERNAL_PROPS.overrideDomMethodName])
                        parentWindow[INTERNAL_PROPS.overrideDomMethodName](el, parentDocument);
                    else if (window[INTERNAL_PROPS.overrideDomMethodName])
                        window[INTERNAL_PROPS.overrideDomMethodName](el);


                    // NOTE: Fix for B239138 - unroll.me 'Cannot read property 'document' of null' error raised
                    // during recording. There was an issue when the document.body was replaced, so we need to
                    // reattach UI to a new body manually.
                    var containerTagName = el.tagName && el.tagName.toLowerCase();

                    // NOTE: This check is required because jQuery calls the set innerHTML method for an element
                    // in an unavailable window.
                    if (window.self) {
                        // NOTE: Use timeout, so that changes take effect.
                        if (containerTagName === 'html' || containerTagName === 'body')
                            nativeSetTimeout.call(window, () => this.nodeMutation.onBodyContentChanged(el), 0);
                    }

                    return value;
                }
            },

            innerText: {
                condition: el => typeof el.tagName === 'string' && el.tagName.toLowerCase() === 'script' &&
                                 typeof el.innerText === 'string',

                get: el => typeof el.innerText === 'string' ? cleanUpScriptHeader(el.innerText) : el.innerText,

                set: function (el, script) {
                    el.innerText = script ? processScript(script) : script;

                    return script;
                }
            },

            onerror: {
                condition: owner => domUtils.isWindow(owner),
                get:       owner => owner[ORIGINAL_WINDOW_ON_ERROR_HANDLER_KEY] || null,

                set: (owner, handler) => {
                    if (typeof handler === 'function')
                        owner[ORIGINAL_WINDOW_ON_ERROR_HANDLER_KEY] = handler;

                    return handler;
                }
            },

            lastChild: {
                condition: el => ShadowUI.isShadowContainer(el),
                get:       el => this.shadowUI.getLastChild(el),
                set:       () => void 0
            },

            lastElementChild: {
                condition: el => ShadowUI.isShadowContainer(el),
                get:       el => this.shadowUI.getLastElementChild(el),
                set:       () => void 0
            },

            length: {
                condition: collection => ShadowUI.isShadowContainerCollection(collection),

                get: collection => {
                    var elementCount = 0;

                    for (var i = 0; i < collection.length; i++) {
                        if (collection[i].className &&
                            collection[i].className.indexOf(SHADOW_UI_CLASSNAME.postfix) !== -1)
                            elementCount++;
                    }

                    if (elementCount !== 0)
                        ShadowUI.checkElementsPosition(collection);

                    return collection.length - elementCount;
                },

                set: () => void 0
            },

            location: {
                condition: owner => domUtils.isDocument(owner) || domUtils.isWindow(owner),

                get: owner => {
                    var locationWrapper = LocationAccessorsInstrumentation.getLocationWrapper(owner);

                    if (locationWrapper)
                        return locationWrapper;

                    var window = domUtils.isWindow(owner) ? owner : owner.defaultView;

                    return new LocationWrapper(window);
                },

                set: (owner, location) => {
                    if (typeof location === 'string') {
                        if (window.self !== window.top)
                            location = originLocation.resolveUrl(location, window.top.document);

                        var resourceType = owner !== window.top ? urlUtils.IFRAME : null;

                        owner.location = urlUtils.getProxyUrl(location, null, null, null, resourceType);

                        return location;
                    }

                    return owner.location;
                }
            },

            manifest: {
                condition: el => {
                    if (domUtils.isDomElement(el))
                        return URL_ATTR_TAGS['manifest'].indexOf(el.tagName.toLowerCase()) !== -1;

                    return false;
                },

                get: el => PropertyAccessorsInstrumentation._getUrlAttr(el, 'manifest'),
                set: (el, value) => el.setAttribute('manifest', value)
            },

            origin: {
                condition: el => domUtils.isAnchor(el),
                get:       el => typeof el.origin !== 'undefined' ? getAnchorProperty(el, 'origin') : el.origin,
                set:       (el, origin) => el.origin = origin
            },

            pathname: {
                condition: el => domUtils.isAnchor(el),
                get:       el => getAnchorProperty(el, 'pathname'),
                set:       (el, pathname) => setAnchorProperty(el, 'pathname', pathname)
            },

            port: {
                condition: el => domUtils.isAnchor(el),
                get:       el => getAnchorProperty(el, 'port'),
                set:       (el, port) => setAnchorProperty(el, 'port', port)
            },

            protocol: {
                condition: el => domUtils.isAnchor(el),
                get:       el => getAnchorProperty(el, 'protocol'),
                set:       (el, port) => setAnchorProperty(el, 'protocol', port)
            },

            referrer: {
                condition: doc => domUtils.isDocument(doc),

                get: doc => {
                    var proxyUrl = urlUtils.parseProxyUrl(doc.referrer);

                    return proxyUrl ? proxyUrl.originUrl : '';
                },

                set: (doc, value) => {
                    doc.referrer = urlUtils.getProxyUrl(value);

                    return value;
                }
            },

            sandbox: {
                condition: el => domUtils.isIframe(el),
                get:       el => el.getAttribute('sandbox'),
                set:       (el, value) => el.setAttribute('sandbox', value)
            },

            search: {
                condition: el => domUtils.isAnchor(el),
                get:       el => getAnchorProperty(el, 'search'),
                set:       (el, search) => setAnchorProperty(el, 'search', search)
            },

            src: {
                condition: el => {
                    if (domUtils.isDomElement(el))
                        return URL_ATTR_TAGS['src'].indexOf(el.tagName.toLowerCase()) !== -1;

                    return false;
                },

                get: el => PropertyAccessorsInstrumentation._getUrlAttr(el, 'src'),
                set: (el, value) => el.setAttribute('src', value)
            },

            target: {
                condition: el => domUtils.isDomElement(el) && TARGET_ATTR_TAGS[el.tagName.toLowerCase()],
                get:       el => el.target,

                set: (el, value) => {
                    if (value !== '_blank')
                        el.target = value;

                    return el.target;
                }
            },

            text: {
                // NOTE: Check for tagName being a string, because it may be a function in an Angular app (T175340).
                condition: el => typeof el.tagName === 'string' && el.tagName.toLowerCase() === 'script',
                get:       el => typeof el.text === 'string' ? cleanUpScriptHeader(el.text) : el.text,

                set: (el, script) => {
                    el.text = script ? processScript(script) : script;

                    return script;
                }
            },

            textContent: {
                // NOTE: Check for tagName being a string, because it may be a function in an Angular app (T175340).
                condition: el => typeof el.tagName === 'string' && el.tagName.toLowerCase() === 'script',
                get:       el => typeof el.textContent === 'string' ?
                                 cleanUpScriptHeader(el.textContent) : el.textContent,

                set: (el, script) => {
                    el.textContent = script ? processScript(script) : script;

                    return script;
                }
            },

            URL: {
                condition: doc => domUtils.isDocument(doc),
                get:       doc => LocationAccessorsInstrumentation.getLocationWrapper(doc).href,
                set:       () => void 0
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

            // Event
            onbeforeunload: {
                condition: window => domUtils.isWindow(window),
                get:       () => this.unloadSandbox.getOnBeforeUnload(),
                set:       (window, handler) => this.unloadSandbox.setOnBeforeUnload(window, handler)
            },

            onmessage: {
                condition: window => domUtils.isWindow(window),
                get:       () => this.messageSandbox.getOnMessage(),
                set:       (window, handler) => this.messageSandbox.setOnMessage(window, handler)
            },

            which: {
                condition: ev => typeof ev[INTERNAL_PROPS.whichPropertyWrapper] !== 'undefined' ||
                                 ev.originalEvent &&
                                 typeof ev.originalEvent[INTERNAL_PROPS.whichPropertyWrapper] !== 'undefined',

                get: ev => ev.originalEvent ? ev.originalEvent[INTERNAL_PROPS.whichPropertyWrapper] :
                           ev[INTERNAL_PROPS.whichPropertyWrapper],

                set: () => void 0
            },

            // Style
            background: {
                condition: style => isStyle(style),
                get:       style => cleanUpStyle(style.background, urlUtils.parseProxyUrl, urlUtils.formatUrl),

                set: (style, value) => {
                    if (typeof value === 'string')
                        style.background = processStyle(value, urlUtils.getProxyUrl);

                    return style.background;
                }
            },

            backgroundImage: {
                condition: style => isStyle(style),
                get:       style => cleanUpStyle(style.backgroundImage, urlUtils.parseProxyUrl, urlUtils.formatUrl),

                set: (style, value) => {
                    if (typeof value === 'string')
                        style.backgroundImage = processStyle(value, urlUtils.getProxyUrl);

                    return style.backgroundImage;
                }
            },

            borderImage: {
                condition: style => isStyle(style),
                get:       style => cleanUpStyle(style.borderImage, urlUtils.parseProxyUrl, urlUtils.formatUrl),

                set: (style, value) => {
                    if (typeof value === 'string')
                        style.borderImage = processStyle(value, urlUtils.getProxyUrl);

                    return style.borderImage;
                }
            },

            cssText: {
                condition: style => isStyle(style),
                get:       style => cleanUpStyle(style.cssText, urlUtils.parseProxyUrl, urlUtils.formatUrl),

                set: (style, value) => {
                    if (typeof value === 'string')
                        style.cssText = processStyle(value, urlUtils.getProxyUrl);

                    return style.cssText;
                }
            },

            cursor: {
                condition: style => isStyle(style),
                get:       style => cleanUpStyle(style.cursor, urlUtils.parseProxyUrl, urlUtils.formatUrl),

                set: (style, value) => {
                    if (typeof value === 'string')
                        style.cursor = processStyle(value, urlUtils.getProxyUrl);

                    return style.cursor;
                }
            },

            listStyle: {
                condition: style => isStyle(style),
                get:       style => cleanUpStyle(style.listStyle, urlUtils.parseProxyUrl, urlUtils.formatUrl),

                set: (style, value) => {
                    if (typeof value === 'string')
                        style.listStyle = processStyle(value, urlUtils.getProxyUrl);

                    return style.listStyle;
                }
            },

            listStyleImage: {
                condition: style => isStyle(style),
                get:       style => cleanUpStyle(style.listStyleImage, urlUtils.parseProxyUrl, urlUtils.formatUrl),

                set: (style, value) => {
                    if (typeof value === 'string')
                        style.listStyleImage = processStyle(value, urlUtils.getProxyUrl);

                    return style.listStyleImage;
                }
            }
        };
    }

    static getOriginalErrorHandler (window) {
        return window[ORIGINAL_WINDOW_ON_ERROR_HANDLER_KEY];
    }

    attach (window) {
        super.attach(window);

        var propertyAccessors = this._createPropertyAccessors(window, window.document);

        window[GET_PROPERTY_METH_NAME] = (owner, propName) => {
            if (typeUtils.isNullOrUndefined(owner)) {
                PropertyAccessorsInstrumentation._error('Cannot read property \'' + propName + '\' of ' +
                                                        typeUtils.inaccessibleTypeToStr(owner));
            }

            if (typeof propName !== 'string' || !propertyAccessors.hasOwnProperty(propName))
                return owner[propName];

            return propertyAccessors[propName].condition(owner) ? propertyAccessors[propName].get(owner) : owner[propName];
        };

        window[SET_PROPERTY_METH_NAME] = (owner, propName, value) => {
            if (typeUtils.isNullOrUndefined(owner)) {
                PropertyAccessorsInstrumentation._error('Cannot set property \'' + propName + '\' of ' +
                                                        typeUtils.inaccessibleTypeToStr(owner));
            }

            var returnValue = null;

            if (typeof propName !== 'string' || !propertyAccessors.hasOwnProperty(propName)) {
                returnValue = owner[propName] = value;

                return returnValue;
            }

            if (propertyAccessors[propName].condition(owner))
                return propertyAccessors[propName].set(owner, value);

            returnValue = owner[propName] = value;

            return returnValue;
        };

        return propertyAccessors;
    }
}
