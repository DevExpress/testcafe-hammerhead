import Const from '../../../../const';
import UrlUtil from '../../../utils/url';
import EventEmitter from '../../../utils/event-emitter';
import locationAccessorsInstrumentation from '../location';
import LocationWrapper from '../location/wrapper';
import * as DOM from '../../../utils/dom';
import * as Types from '../../../utils/types';
import * as ShadowUI from '../../shadow-ui';
import * as UploadSandbox from '../../upload/upload';
import { cleanUpHtml, processHtml } from '../../../utils/html';
import { getOnBeforeUnload, setOnBeforeUnload } from '../../event/unload';
import { getCookie, setCookie } from '../../cookie';
import { getOnMessage, setOnMessage } from '../../message';
import { getAnchorProperty, setAnchorProperty } from './anchor';
import { getAttributesProperty } from './attributes';
import { URL_ATTR_TAGS, TARGET_ATTR_TAGS } from '../../../dom-processor/dom-processor';
import { process as processStyle, cleanUp as cleanUpStyle } from '../../../../processing/style';
import { process as processScript } from '../../../../processing/script';
import { GET_PROPERTY_METH_NAME, SET_PROPERTY_METH_NAME } from '../../../../processing/js';
import { setTimeout as nativeSetTimeout } from '../../native-methods';

class PropertyAccessorsInstrumentation {
    constructor () {
        this.ORIGINAL_WINDOW_ON_ERROR_HANDLER_KEY = 'onerror_23ad9304921s';
        this.BODY_CONTENT_CHANGED                 = 'bodyContentChanged';
        this.eventEmitter                         = new EventEmitter();
    }

    //NOTE: isolate throw statement into separate function because JS engines doesn't optimize such functions.
    _error (msg) {
        throw new Error(msg);
    }

    _getUrlAttr (el, attr) {
        var attrValue = el.getAttribute(attr);

        if (attrValue === null)
            return '';

        else if (attrValue === '')
            return UrlUtil.OriginLocation.get();

        else if (/^#/.test(attrValue))
            return UrlUtil.OriginLocation.withHash(attrValue);


        return UrlUtil.resolveUrlAsOrigin(attrValue);
    }

    _createPropertyAccessors (window, document) {
        var storedDomain = '';

        return {
            action: {
                condition: el => {
                    if (DOM.isDomElement(el))
                        return URL_ATTR_TAGS['action'].indexOf(el.tagName.toLowerCase()) !== -1;

                    return false;
                },

                get: el => this._getUrlAttr(el, 'action'),
                set: (el, value) => el.setAttribute('action', value)
            },

            activeElement: {
                condition: el => Types.isDocument(el),

                get: el => {
                    if (DOM.isShadowUIElement(el.activeElement))
                        return ShadowUI.getLastActiveElement() || el.body;

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
                condition: el => DOM.isInputElement(el),
                get:       input => input.getAttribute('autocomplete') || '',
                set:       (input, value) => input.setAttribute('autocomplete', value)
            },

            cookie: {
                condition: doc => Types.isDocument(doc),
                get:       () => getCookie(),
                set:       (doc, cookie) => setCookie(doc, cookie)
            },

            data: {
                condition: el => {
                    if (DOM.isDomElement(el))
                        return URL_ATTR_TAGS['data'].indexOf(el.tagName.toLowerCase()) !== -1;

                    return false;
                },

                get: el => this._getUrlAttr(el, 'data'),
                set: (el, value) => el.setAttribute('data', value)
            },

            domain: {
                condition: doc => Types.isDocument(doc),
                get:       () => storedDomain ? storedDomain : locationAccessorsInstrumentation.getLocationWrapper(window).hostname,
                set:       (doc, domain) => storedDomain = domain
            },

            files: {
                condition: el => DOM.isFileInput(el),
                get:       el => UploadSandbox.getFiles(el),
                set:       (el, value) => value
            },

            firstChild: {
                condition: el => ShadowUI.isShadowContainer(el),
                get:       el => ShadowUI.getFirstChild(el),
                set:       () => void 0
            },

            firstElementChild: {
                condition: el => ShadowUI.isShadowContainer(el),
                get:       el => ShadowUI.getFirstElementChild(el),
                set:       () => void 0
            },

            host: {
                condition: el => DOM.isAnchor(el),
                get:       el => getAnchorProperty(el, 'host'),
                set:       (el, port) => setAnchorProperty(el, 'host', port)
            },

            hostname: {
                condition: el => DOM.isAnchor(el),
                get:       el => getAnchorProperty(el, 'hostname'),
                set:       (el, port) => setAnchorProperty(el, 'hostname', port)
            },

            href: {
                condition: (el) => {
                    if (DOM.isDomElement(el))
                        return URL_ATTR_TAGS['href'].indexOf(el.tagName.toLowerCase()) !== -1;

                    return locationAccessorsInstrumentation.isLocationWrapper(el);
                },

                get: el => locationAccessorsInstrumentation.isLocationWrapper(el) ? el.href : this._getUrlAttr(el, 'href'),
                set: (el, value) => locationAccessorsInstrumentation.isLocationWrapper(el) ?
                                    el.href = UrlUtil.resolveUrl(value, document) : el.setAttribute('href', value)
            },

            innerHTML: {
                condition: el => el.nodeType === 1 && 'innerHTML' in el,
                get:       el => cleanUpHtml(el.innerHTML, el.tagName),

                set: (el, value) => {
                    if (el.tagName && el.tagName.toLowerCase() === 'style')
                        value = processStyle('' + value, UrlUtil.getProxyUrl, true);
                    else if (value !== null)
                        value = processHtml('' + value, el.tagName);

                    el.innerHTML = value;

                    var parentDocument = DOM.findDocument(el);
                    var parentWindow   = parentDocument ? parentDocument.defaultView : null;

                    //NOTE: for iframe with empty src
                    if (parentWindow && parentWindow !== window &&
                        parentWindow[Const.DOM_SANDBOX_OVERRIDE_DOM_METHOD_NAME])
                        parentWindow[Const.DOM_SANDBOX_OVERRIDE_DOM_METHOD_NAME](el, parentDocument);
                    else if (window[Const.DOM_SANDBOX_OVERRIDE_DOM_METHOD_NAME])
                        window[Const.DOM_SANDBOX_OVERRIDE_DOM_METHOD_NAME](el);


                    //NOTE: fix for B239138 - unroll.me 'Cannot read property 'document' of null' error raised during recording
                    //There were an issue then document.body was replaced, so we need to reattach UI to new body manually
                    //See also: ui/ui.js
                    var containerTagName = el.tagName && el.tagName.toLowerCase();

                    //NOTE: this check is required because jQuery calls the set innerHTML method for an element in an unavailable window
                    if (window.self) {
                        //NOTE: use timeout, so changes take effect
                        if (containerTagName === 'html' || containerTagName === 'body')
                            nativeSetTimeout.call(window, () => this.eventEmitter.emit(this.BODY_CONTENT_CHANGED, el), 0);
                    }

                    return value;
                }
            },

            onerror: {
                condition: owner => Types.isWindow(owner),
                get:       owner => owner[this.ORIGINAL_WINDOW_ON_ERROR_HANDLER_KEY] || null,

                set: (owner, handler) => {
                    if (typeof handler === 'function')
                        owner[this.ORIGINAL_WINDOW_ON_ERROR_HANDLER_KEY] = handler;

                    return handler;
                }
            },

            lastChild: {
                condition: el => ShadowUI.isShadowContainer(el),
                get:       el => ShadowUI.getLastChild(el),
                set:       () => void 0
            },

            lastElementChild: {
                condition: el => ShadowUI.isShadowContainer(el),
                get:       el => ShadowUI.getLastElementChild(el),
                set:       () => void 0
            },

            length: {
                condition: collection => ShadowUI.isShadowContainerCollection(collection),

                get: collection => {
                    var elementCount = 0;

                    for (var i = 0; i < collection.length; i++) {
                        if (collection[i].className &&
                            collection[i].className.indexOf(Const.SHADOW_UI_CLASSNAME_POSTFIX) !== -1)
                            elementCount++;
                    }

                    if (elementCount !== 0)
                        ShadowUI.checkElementsPosition(collection);

                    return collection.length - elementCount;
                },

                set: () => void 0
            },

            location: {
                condition: owner => Types.isDocument(owner) || Types.isWindow(owner),

                get: owner => {
                    var locationWrapper = locationAccessorsInstrumentation.getLocationWrapper(owner);

                    if (locationWrapper)
                        return locationWrapper;

                    var window = Types.isWindow(owner) ? owner : owner.defaultView;

                    return new LocationWrapper(window);
                },

                set: (owner, location) => {
                    if (typeof location === 'string') {
                        if (window.self !== window.top)
                            location = UrlUtil.resolveUrl(location, window.top.document);

                        var resourceType = owner !== window.top ? UrlUtil.IFRAME : null;

                        owner.location = UrlUtil.getProxyUrl(location, null, null, null, resourceType);

                        return location;
                    }

                    return owner.location;
                }
            },

            manifest: {
                condition: el => {
                    if (DOM.isDomElement(el))
                        return URL_ATTR_TAGS['manifest'].indexOf(el.tagName.toLowerCase()) !== -1;

                    return false;
                },

                get: el => this._getUrlAttr(el, 'manifest'),
                set: (el, value) => el.setAttribute('manifest', value)
            },

            origin: {
                condition: el => DOM.isAnchor(el),
                get:       el => typeof el.origin !== 'undefined' ? getAnchorProperty(el, 'origin') : el.origin,
                set:       (el, origin) => el.origin = origin
            },

            pathname: {
                condition: el => DOM.isAnchor(el),
                get:       el => getAnchorProperty(el, 'pathname'),
                set:       (el, pathname) => setAnchorProperty(el, 'pathname', pathname)
            },

            port: {
                condition: el => DOM.isAnchor(el),
                get:       el => getAnchorProperty(el, 'port'),
                set:       (el, port) => setAnchorProperty(el, 'port', port)
            },

            protocol: {
                condition: el => DOM.isAnchor(el),
                get:       el => getAnchorProperty(el, 'protocol'),
                set:       (el, port) => setAnchorProperty(el, 'protocol', port)
            },

            referrer: {
                condition: doc => Types.isDocument(doc),

                get: doc => {
                    var proxyUrl = UrlUtil.parseProxyUrl(doc.referrer);

                    return proxyUrl ? proxyUrl.originResourceInfo.originUrl : '';
                },

                set: (doc, value) => {
                    doc.referrer = UrlUtil.getProxyUrl(value);

                    return value;
                }
            },

            sandbox: {
                condition: el => DOM.isIframe(el),
                get:       el => el.getAttribute('sandbox'),
                set:       (el, value) => el.setAttribute('sandbox', value)
            },

            search: {
                condition: el => DOM.isAnchor(el),
                get:       el => getAnchorProperty(el, 'search'),
                set:       (el, search) => setAnchorProperty(el, 'search', search)
            },

            src: {
                condition: el => {
                    if (DOM.isDomElement(el))
                        return URL_ATTR_TAGS['src'].indexOf(el.tagName.toLowerCase()) !== -1;

                    return false;
                },

                get: el => this._getUrlAttr(el, 'src'),
                set: (el, value) => el.setAttribute('src', value)
            },

            target: {
                condition: el => DOM.isDomElement(el) && TARGET_ATTR_TAGS[el.tagName.toLowerCase()],
                get:       el => el.target,

                set: (el, value) => {
                    if (value !== '_blank')
                        el.target = value;

                    return el.target;
                }
            },

            text: {
                //NOTE: check for tagName being a string. Because is some cases in Angular app it
                //may be function.
                //See: T175340: TD_14_2 - Uncaught JS error on angular getting started site
                condition: el => typeof el.tagName === 'string' && el.tagName.toLowerCase() === 'script',
                get:       el => el.text,

                set: (el, script) => {
                    el.text = script ? processScript(script) : script;

                    return script;
                }
            },

            textContent: {
                //NOTE: check for tagName being a string. Because is some cases in Angular app it
                //may be function.
                //See: T175340: TD_14_2 - Uncaught JS error on angular getting started site
                condition: el => typeof el.tagName === 'string' && el.tagName.toLowerCase() === 'script',
                get:       el => el.textContent,

                set: (el, script) => {
                    el.textContent = script ? processScript(script) : script;

                    return script;
                }
            },

            URL: {
                condition: doc => Types.isDocument(doc),
                get:       () => locationWrapper.href,
                set:       () => void 0
            },

            value: {
                condition: el => DOM.isDomElement(el) && (DOM.isFileInput(el) ||
                                                          DOM.isTextEditableElementAndEditingAllowed(el) &&
                                                          !DOM.isShadowUIElement(el)),

                get: el => {
                    if (DOM.isFileInput(el))
                        return UploadSandbox.getUploadElementValue(el);

                    return el.value;
                },

                set: (el, value) => {
                    if (DOM.isFileInput(el))
                        return UploadSandbox.setUploadElementValue(el, value);

                    el.value = value;

                    ElementEditingWatcher.restartWatchingElementEditing(el);

                    return value;
                }
            },

            // Event
            onbeforeunload: {
                condition: window => Types.isWindow(window),
                get:       () => getOnBeforeUnload(),
                set:       (window, handler) => setOnBeforeUnload(window, handler)
            },

            onmessage: {
                condition: window => Types.isWindow(window),
                get:       () => getOnMessage(),
                set:       (window, handler) => setOnMessage(window, handler)
            },

            which: {
                condition: ev => typeof ev[Const.EVENT_SANDBOX_WHICH_PROPERTY_WRAPPER] !== 'undefined' ||
                                 ev.originalEvent &&
                                 typeof ev.originalEvent[Const.EVENT_SANDBOX_WHICH_PROPERTY_WRAPPER] !== 'undefined',

                get: ev => ev.originalEvent ? ev.originalEvent[Const.EVENT_SANDBOX_WHICH_PROPERTY_WRAPPER] :
                           ev[Const.EVENT_SANDBOX_WHICH_PROPERTY_WRAPPER],

                set: () => void 0
            },

            // Style
            background: {
                condition: style => Types.isStyle(style),
                get:       style => cleanUpStyle(style.background, UrlUtil.parseProxyUrl, UrlUtil.formatUrl),

                set: (style, value) => {
                    if (typeof value === 'string')
                        style.background = processStyle(value, UrlUtil.getProxyUrl);

                    return style.background;
                }
            },

            backgroundImage: {
                condition: style => Types.isStyle(style),
                get:       style => cleanUpStyle(style.backgroundImage, UrlUtil.parseProxyUrl, UrlUtil.formatUrl),

                set: (style, value) => {
                    if (typeof value === 'string')
                        style.backgroundImage = processStyle(value, UrlUtil.getProxyUrl);

                    return style.backgroundImage;
                }
            },

            borderImage: {
                condition: style => Types.isStyle(style),
                get:       style => cleanUpStyle(style.borderImage, UrlUtil.parseProxyUrl, UrlUtil.formatUrl),

                set: (style, value) => {
                    if (typeof value === 'string')
                        style.borderImage = processStyle(value, UrlUtil.getProxyUrl);

                    return style.borderImage;
                }
            },

            cssText: {
                condition: style => Types.isStyle(style),
                get:       style => cleanUpStyle(style.cssText, UrlUtil.parseProxyUrl, UrlUtil.formatUrl),

                set: (style, value) => {
                    if (typeof value === 'string')
                        style.cssText = processStyle(value, UrlUtil.getProxyUrl);

                    return style.cssText;
                }
            },

            cursor: {
                condition: style => Types.isStyle(style),
                get:       style => cleanUpStyle(style.cursor, UrlUtil.parseProxyUrl, UrlUtil.formatUrl),

                set: (style, value) => {
                    if (typeof value === 'string')
                        style.cursor = processStyle(value, UrlUtil.getProxyUrl);

                    return style.cursor;
                }
            },

            listStyle: {
                condition: style => Types.isStyle(style),
                get:       style => cleanUpStyle(style.listStyle, UrlUtil.parseProxyUrl, UrlUtil.formatUrl),

                set: (style, value) => {
                    if (typeof value === 'string')
                        style.listStyle = processStyle(value, UrlUtil.getProxyUrl);

                    return style.listStyle;
                }
            },

            listStyleImage: {
                condition: style => Types.isStyle(style),
                get:       style => cleanUpStyle(style.listStyleImage, UrlUtil.parseProxyUrl, UrlUtil.formatUrl),

                set: (style, value) => {
                    if (typeof value === 'string')
                        style.listStyleImage = processStyle(value, UrlUtil.getProxyUrl);

                    return style.listStyleImage;
                }
            }
        };
    }

    getOriginalErrorHandler (window) {
        return window[this.ORIGINAL_WINDOW_ON_ERROR_HANDLER_KEY];
    }

    on (event, handler) {
        return this.eventEmitter.on(event, handler);
    }

    initWindow (window, document) {
        var propertyAccessors = this._createPropertyAccessors(window, document);

        window[GET_PROPERTY_METH_NAME] = (owner, propName) => {
            if (Types.isNullOrUndefined(owner))
                this._error('Cannot read property \'' + propName + '\' of ' + Types.inaccessibleTypeToStr(owner));

            if (typeof propName !== 'string' || !propertyAccessors.hasOwnProperty(propName))
                return owner[propName];

            return propertyAccessors[propName].condition(owner) ? propertyAccessors[propName].get(owner) : owner[propName];
        };

        window[SET_PROPERTY_METH_NAME] = (owner, propName, value) => {
            if (Types.isNullOrUndefined(owner))
                this._error('Cannot set property \'' + propName + '\' of ' + Types.inaccessibleTypeToStr(owner));

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

export default new PropertyAccessorsInstrumentation();
