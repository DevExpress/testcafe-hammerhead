import * as CookieSandbox from './cookie';
import * as DOM from '../util/dom';
import * as Html from '../util/html';
import * as ElementEditingWatcher from './event/element-editing-watcher';
import JSProcessor from '../../processing/js/index';
import * as MessageSandbox from './message';
import NativeMethods from './native-methods';
import DomProcessor from '../dom-processor/dom-processor';
import StyleProcessor from '../../processing/style';
import ScriptProcessor from '../../processing/script';
import * as Service from '../util/service';
import * as ShadowUI from './shadow-ui';
import Const from '../../const';
import * as UploadSandbox from './upload/upload';
import * as Unload from './event/unload';
import UrlUtil from '../util/url';

export const LOCATION_WRAPPER = 'location_1b082a6cec';

const IS_LOCATION_WRAPPER = 'is_location_1b082a6cec';

export const BODY_CONTENT_CHANGED                 = 'bodyContentChanged';
export const ORIGINAL_WINDOW_ON_ERROR_HANDLER_KEY = 'onerror_23ad9304921s';
export const WINDOW_ON_ERROR_SET                  = 'windowOnErrorSet';

var anchor      = document.createElement('A');
var emptyAnchor = document.createElement('A');

var eventEmitter = new Service.EventEmitter();

export var on = eventEmitter.on.bind(eventEmitter);

function onBodyContentChanged (el) {
    eventEmitter.emit(BODY_CONTENT_CHANGED, el);
}

function isAnchor (el) {
    return DOM.isDomElement(el) && el.tagName.toLowerCase() === 'a';
}

function isStyleInstance (instance) {
    if (instance instanceof NativeMethods.styleClass)
        return true;

    if (instance && typeof instance === 'object' && typeof instance.border !== 'undefined') {
        instance = instance.toString();

        return instance === '[object CSSStyleDeclaration]' || instance === '[object CSS2Properties]' ||
               instance === '[object MSStyleCSSProperties]';
    }

    return false;
}

function isLocationInstance (instance) {
    if (instance instanceof NativeMethods.locationClass)
        return true;

    return instance && typeof instance === 'object' && typeof instance.href !== 'undefined' &&
           typeof instance.assign !== 'undefined';
}

function getAnchorProperty (el, prop) {
    if (el.href) {
        var parsedProxyUrl = UrlUtil.parseProxyUrl(el.href);

        anchor.href = parsedProxyUrl ? parsedProxyUrl.originUrl : el.href;

        return anchor[prop];
    }

    return emptyAnchor[prop];
}

function setAnchorProperty (el, prop, value) {
    if (el.href) {
        anchor.href  = UrlUtil.parseProxyUrl(el.href).originUrl;
        anchor[prop] = value;
        el.setAttribute('href', anchor.href);

        return anchor[prop];
    }

    return '';
}

function removeOurWriteMethArgs (args) {
    if (args.length) {
        var lastArg = args[args.length - 1];

        if (lastArg === JSProcessor.DOCUMENT_WRITE_BEGIN_PARAM ||
            lastArg === JSProcessor.DOCUMENT_WRITE_END_PARAM) {
            var result = Array.prototype.slice.call(args);

            result.pop();

            return result;
        }
    }

    return args;
}

function createLocWrapper (window) {
    var locationProps = ['port', 'host', 'hostname', 'pathname', 'protocol'];
    var result        = {};
    var resourceType  = window !== window.top ? UrlUtil.IFRAME : null;

    var getHref = function () {
        return window.location.href === 'about:blank' ?
               'about:blank' :
               UrlUtil.OriginLocation.get();
    };

    Object.defineProperty(result, 'href', Service.createPropertyDesc({
        get: function () {
            return getHref();
        },
        set: function (href) {
            window.location.href = UrlUtil.getProxyUrl(href, null, null, null, null, resourceType);

            return href;
        }
    }));

    Object.defineProperty(result, 'search', Service.createPropertyDesc({
        get: function () {
            return window.location.search;
        },
        set: function (search) {
            window.location = UrlUtil.changeOriginUrlPart(window.location.toString(), 'search', search, resourceType);

            return search;
        }
    }));

    Object.defineProperty(result, 'origin', Service.createPropertyDesc({
        get: function () {
            var parsedOriginLocation = UrlUtil.OriginLocation.getParsed();

            return parsedOriginLocation.protocol + '//' + parsedOriginLocation.host;
        },
        set: function (origin) {
            return origin;
        }
    }));

    Object.defineProperty(result, 'hash', Service.createPropertyDesc({
        get: function () {
            return window.location.hash;
        },
        set: function (hash) {
            window.location.hash = hash;

            return hash;
        }
    }));

    var overrideLocationProp = function (prop) {
        Object.defineProperty(result, prop, Service.createPropertyDesc({
            get: function () {
                return UrlUtil.OriginLocation.getParsed()[prop];
            },
            set: function (value) {
                window.location = UrlUtil.changeOriginUrlPart(window.location.toString(), prop, value, resourceType);

                return value;
            }
        }));
    };

    locationProps.forEach(function (value) {
        overrideLocationProp(value);
    });

    result.assign = function (url) {
        return window.location.assign(UrlUtil.getProxyUrl(url, null, null, null, null, resourceType));
    };

    result.reload = function (forceget) {
        return window.location.reload(forceget);
    };

    result.replace = function (url) {
        return window.location.replace(UrlUtil.getProxyUrl(url, null, null, null, null, resourceType));
    };

    result.toString = function () {
        return getHref();
    };

    result[IS_LOCATION_WRAPPER] = true;

    return result;
}

export function init (window, document) {
    var locationWrapper = createLocWrapper(window);
    var storedDomain    = '';

    window[LOCATION_WRAPPER]   = locationWrapper;
    document[LOCATION_WRAPPER] = locationWrapper;

    function getUrlAttr (el, attr) {
        var attrValue = el.getAttribute(attr);

        if (attrValue === null)
            return '';

        else if (attrValue === '')
            return UrlUtil.OriginLocation.get();

        else if (/^#/.test(attrValue))
            return UrlUtil.OriginLocation.withHash(attrValue);


        return UrlUtil.resolveUrlAsOrigin(attrValue);
    }

    var elementMethWrappers = {
        postMessage: {
            condition: function (window) {
                return DOM.isWindowInstance(window);
            },

            method: function (contentWindow, args) {
                return MessageSandbox.postMessage(contentWindow, args);
            }
        },

        write: {
            condition: function (document) {
                return !DOM.isDocumentInstance(document);
            },

            method: function (document, args) {
                return document.write.apply(document, removeOurWriteMethArgs(args));
            }
        },

        writeln: {
            condition: function (document) {
                return !DOM.isDocumentInstance(document);
            },

            method: function (document, args) {
                return document.writeln.apply(document, removeOurWriteMethArgs(args));
            }
        }
    };

    var elementPropertyAccessors = {
        action: {
            condition: function (el) {
                if (DOM.isDomElement(el)) {
                    var tagName = el.tagName.toLowerCase();

                    return DomProcessor.URL_ATTR_TAGS['action'].indexOf(tagName) !== -1;
                }

                return false;
            },

            get: function (el) {
                return getUrlAttr(el, 'action');
            },

            set: function (el, value) {
                return el.setAttribute('action', value);
            }
        },

        activeElement: {
            condition: function (el) {
                return DOM.isDocumentInstance(el);
            },

            get: function (el) {
                if (DOM.isShadowUIElement(el.activeElement))
                    return ShadowUI.getLastActiveElement() || el.body;

                return el.activeElement;
            },

            set: function () {
            }
        },

        attributes: {
            condition: function (el) {
                var attributesType = window.NamedNodeMap || window.MozNamedAttrMap;

                return attributesType && el.attributes instanceof attributesType;
            },

            get: function (el) {
                return getAttributesProperty(el);
            },

            set: function (el, value) {
                return value;
            }
        },

        autocomplete: {
            condition: function (el) {
                return DOM.isInputElement(el);
            },

            get: function (input) {
                return input.getAttribute('autocomplete') || '';
            },

            set: function (input, value) {
                return input.setAttribute('autocomplete', value);
            }
        },

        cookie: {
            condition: function (doc) {
                return DOM.isDocumentInstance(doc);
            },

            get: function () {
                return CookieSandbox.getCookie();
            },

            set: function (doc, cookie) {
                return CookieSandbox.setCookie(doc, cookie);
            }
        },

        data: {
            condition: function (el) {
                if (DOM.isDomElement(el)) {
                    var tagName = el.tagName.toLowerCase();

                    return DomProcessor.URL_ATTR_TAGS['data'].indexOf(tagName) !== -1;
                }

                return false;
            },

            get: function (el) {
                return getUrlAttr(el, 'data');
            },

            set: function (el, value) {
                return el.setAttribute('data', value);
            }
        },

        domain: {
            condition: function (doc) {
                return DOM.isDocumentInstance(doc);
            },

            get: function () {
                return storedDomain ? storedDomain : locationWrapper.hostname;
            },

            set: function (doc, domain) {
                storedDomain = domain;

                return domain;
            }
        },

        files: {
            condition: function (el) {
                return DOM.isFileInput(el);
            },

            get: function (el) {
                return UploadSandbox.getFiles(el);
            },

            set: function (el, value) {
                return value;
            }
        },

        firstChild: {
            condition: function (el) {
                return ShadowUI.isShadowContainer(el);
            },

            get: function (el) {
                return ShadowUI.getFirstChild(el);
            },

            set: function () {
            }
        },

        firstElementChild: {
            condition: function (el) {
                return ShadowUI.isShadowContainer(el);
            },

            get: function (el) {
                return ShadowUI.getFirstElementChild(el);
            },

            set: function () {
            }
        },

        host: {
            condition: function (el) {
                return isAnchor(el);
            },

            get: function (el) {
                return getAnchorProperty(el, 'host');
            },

            set: function (el, port) {
                return setAnchorProperty(el, 'host', port);
            }
        },

        hostname: {
            condition: function (el) {
                return isAnchor(el);
            },

            get: function (el) {
                return getAnchorProperty(el, 'hostname');
            },

            set: function (el, port) {
                return setAnchorProperty(el, 'hostname', port);
            }
        },

        href: {
            condition: function (el) {
                if (DOM.isDomElement(el)) {
                    var tagName = el.tagName.toLowerCase();

                    return DomProcessor.URL_ATTR_TAGS['href'].indexOf(tagName) !== -1;
                }

                if (el[IS_LOCATION_WRAPPER])
                    return true;

                return false;
            },

            get: function (el) {
                return el[IS_LOCATION_WRAPPER] ? el.href : getUrlAttr(el, 'href');
            },

            set: function (el, value) {
                return el[IS_LOCATION_WRAPPER] ? el.href = UrlUtil.resolveUrl(value, document) : el.setAttribute('href', value);
            }
        },

        innerHTML: {
            condition: function (el) {
                return el.nodeType === 1 && 'innerHTML' in el;
            },

            get: function (el) {
                return Html.cleanUpHtml(el.innerHTML, el.tagName);
            },

            set: function (el, value) {
                if (el.tagName && el.tagName.toLowerCase() === 'style')
                    value = StyleProcessor.process('' + value, UrlUtil.getProxyUrl, true);
                else if (value !== null)
                    value = Html.processHtml('' + value, el.tagName);

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
                    if (containerTagName === 'html' || containerTagName === 'body') {
                        NativeMethods.setTimeout.call(window, function () {
                            onBodyContentChanged(el);
                        }, 0);
                    }
                }

                return value;
            }
        },

        onerror: {
            condition: function (owner) {
                return DOM.isWindowInstance(owner);
            },

            get: function (owner) {
                return owner[ORIGINAL_WINDOW_ON_ERROR_HANDLER_KEY] || null;
            },

            set: function (owner, handler) {
                if (typeof handler === 'function')
                    owner[ORIGINAL_WINDOW_ON_ERROR_HANDLER_KEY] = handler;

                return handler;
            }
        },

        lastChild: {
            condition: function (el) {
                return ShadowUI.isShadowContainer(el);
            },

            get: function (el) {
                return ShadowUI.getLastChild(el);
            },

            set: function () {
            }
        },

        lastElementChild: {
            condition: function (el) {
                return ShadowUI.isShadowContainer(el);
            },

            get: function (el) {
                return ShadowUI.getLastElementChild(el);
            },

            set: function () {
            }
        },

        length: {
            condition: function (collection) {
                return ShadowUI.isShadowContainerCollection(collection);
            },

            get: function (collection) {
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

            set: function () {
            }
        },

        location: {
            condition: function (owner) {
                return DOM.isDocumentInstance(owner) || DOM.isWindowInstance(owner);
            },

            get: function (owner) {
                if (owner[LOCATION_WRAPPER])
                    return owner[LOCATION_WRAPPER];

                var window = DOM.isWindowInstance(owner) ? owner : owner.defaultView;

                return createLocWrapper(window);
            },

            set: function (owner, location) {
                if (typeof location === 'string') {
                    if (window.self !== window.top)
                        location = UrlUtil.resolveUrl(location, window.top.document);

                    var resourceType = owner !== window.top ? UrlUtil.IFRAME : null;

                    owner.location = UrlUtil.getProxyUrl(location, null, null, null, null, resourceType);

                    return location;
                }

                return owner.location;
            }
        },

        manifest: {
            condition: function (el) {
                if (DOM.isDomElement(el)) {
                    var tagName = el.tagName.toLowerCase();

                    return DomProcessor.URL_ATTR_TAGS['manifest'].indexOf(tagName) !== -1;
                }

                return false;
            },

            get: function (el) {
                return getUrlAttr(el, 'manifest');
            },

            set: function (el, value) {
                return el.setAttribute('manifest', value);
            }
        },

        origin: {
            condition: function (el) {
                return isAnchor(el);
            },

            get: function (el) {
                return typeof el.origin !== 'undefined' ? getAnchorProperty(el, 'origin') : el.origin;
            },

            set: function (el, origin) {
                el.origin = origin;

                return el.origin;
            }
        },

        pathname: {
            condition: function (el) {
                return isAnchor(el);
            },

            get: function (el) {
                return getAnchorProperty(el, 'pathname');
            },

            set: function (el, pathname) {
                return setAnchorProperty(el, 'pathname', pathname);
            }
        },

        port: {
            condition: function (el) {
                return isAnchor(el);
            },

            get: function (el) {
                return getAnchorProperty(el, 'port');
            },

            set: function (el, port) {
                return setAnchorProperty(el, 'port', port);
            }
        },

        protocol: {
            condition: function (el) {
                return isAnchor(el);
            },

            get: function (el) {
                return getAnchorProperty(el, 'protocol');
            },

            set: function (el, port) {
                return setAnchorProperty(el, 'protocol', port);
            }
        },

        referrer: {
            condition: function (doc) {
                return DOM.isDocumentInstance(doc);
            },

            get: function (doc) {
                var proxyUrl = UrlUtil.parseProxyUrl(doc.referrer);
                var result   = proxyUrl ? proxyUrl.originResourceInfo.originUrl : '';

                return result;
            },

            set: function (doc, value) {
                doc.referrer = UrlUtil.getProxyUrl(value);

                return value;
            }
        },

        sandbox: {
            condition: function (el) {
                return DOM.isIframe(el);
            },

            get: function (el) {
                return el.getAttribute('sandbox');
            },

            set: function (el, value) {
                return el.setAttribute('sandbox', value);
            }
        },

        search: {
            condition: function (el) {
                return isAnchor(el);
            },

            get: function (el) {
                return getAnchorProperty(el, 'search');
            },

            set: function (el, search) {
                return setAnchorProperty(el, 'search', search);
            }
        },

        src: {
            condition: function (el) {
                if (DOM.isDomElement(el)) {
                    var tagName = el.tagName.toLowerCase();

                    return DomProcessor.URL_ATTR_TAGS['src'].indexOf(tagName) !== -1;
                }

                return false;
            },

            get: function (el) {
                return getUrlAttr(el, 'src');
            },

            set: function (el, value) {
                return el.setAttribute('src', value);
            }
        },

        target: {
            condition: function (el) {
                return DOM.isDomElement(el) && DomProcessor.TARGET_ATTR_TAGS[el.tagName.toLowerCase()];
            },

            get: function (el) {
                return el.target;
            },

            set: function (el, value) {
                if (value !== '_blank')
                    el.target = value;

                return el.target;
            }
        },

        text: {
            condition: function (el) {
                //NOTE: check for tagName being a string. Because is some cases in Angular app it
                //may be function.
                //See: T175340: TD_14_2 - Uncaught JS error on angular getting started site
                return typeof el.tagName === 'string' && el.tagName.toLowerCase() === 'script';
            },

            get: function (el) {
                return el.text;
            },

            set: function (el, script) {
                el.text = script ? ScriptProcessor.process(script) : script;

                return script;
            }
        },

        textContent: {
            condition: function (el) {
                //NOTE: check for tagName being a string. Because is some cases in Angular app it
                //may be function.
                //See: T175340: TD_14_2 - Uncaught JS error on angular getting started site
                return typeof el.tagName === 'string' && el.tagName.toLowerCase() === 'script';
            },

            get: function (el) {
                return el.textContent;
            },

            set: function (el, script) {
                el.textContent = script ? ScriptProcessor.process(script) : script;

                return script;
            }
        },

        URL: {
            condition: function (doc) {
                return DOM.isDocumentInstance(doc);
            },

            get: function () {
                return locationWrapper.href;
            },

            set: function () {
            }
        },

        value: {
            condition: function (el) {
                return DOM.isDomElement(el) && (DOM.isFileInput(el) ||
                                                DOM.isTextEditableElementAndEditingAllowed(el) &&
                                                !DOM.isShadowUIElement(el));
            },

            get: function (el) {
                if (DOM.isFileInput(el))
                    return UploadSandbox.getUploadElementValue(el);

                return el.value;
            },

            set: function (el, value) {
                if (DOM.isFileInput(el))
                    return UploadSandbox.setUploadElementValue(el, value);

                el.value = value;

                ElementEditingWatcher.restartWatchingElementEditing(el);

                return value;
            }
        },

        // Event
        onbeforeunload: {
            condition: function (window) {
                return DOM.isWindowInstance(window);
            },

            get: function () {
                return Unload.getOnBeforeUnload();
            },

            set: function (window, handler) {
                return Unload.setOnBeforeUnload(window, handler);
            }
        },

        onmessage: {
            condition: function (window) {
                return DOM.isWindowInstance(window);
            },

            get: function () {
                return MessageSandbox.getOnMessage();
            },

            set: function (window, handler) {
                return MessageSandbox.setOnMessage(window, handler);
            }
        },

        which: {
            condition: function (ev) {
                return typeof ev[Const.EVENT_SANDBOX_WHICH_PROPERTY_WRAPPER] !== 'undefined' ||
                       ev.originalEvent &&
                       typeof ev.originalEvent[Const.EVENT_SANDBOX_WHICH_PROPERTY_WRAPPER] !== 'undefined';
            },

            get: function (ev) {
                return ev.originalEvent ? ev.originalEvent[Const.EVENT_SANDBOX_WHICH_PROPERTY_WRAPPER] :
                       ev[Const.EVENT_SANDBOX_WHICH_PROPERTY_WRAPPER];
            },

            set: function () {
            }
        },

        // Style
        background: {
            condition: function (style) {
                return isStyleInstance(style);
            },

            get: function (style) {
                return StyleProcessor.cleanUp(style.background, UrlUtil.parseProxyUrl, UrlUtil.formatUrl);
            },

            set: function (style, value) {
                if (typeof value === 'string')
                    style.background = StyleProcessor.process(value, UrlUtil.getProxyUrl);

                return style.background;
            }
        },

        backgroundImage: {
            condition: function (style) {
                return isStyleInstance(style);
            },

            get: function (style) {
                return StyleProcessor.cleanUp(style.backgroundImage, UrlUtil.parseProxyUrl, UrlUtil.formatUrl);
            },

            set: function (style, value) {
                if (typeof value === 'string')
                    style.backgroundImage = StyleProcessor.process(value, UrlUtil.getProxyUrl);

                return style.backgroundImage;
            }
        },

        borderImage: {
            condition: function (style) {
                return isStyleInstance(style);
            },

            get: function (style) {
                return StyleProcessor.cleanUp(style.borderImage, UrlUtil.parseProxyUrl, UrlUtil.formatUrl);
            },

            set: function (style, value) {
                if (typeof value === 'string')
                    style.borderImage = StyleProcessor.process(value, UrlUtil.getProxyUrl);

                return style.borderImage;
            }
        },

        cssText: {
            condition: function (style) {
                return isStyleInstance(style);
            },

            get: function (style) {
                return StyleProcessor.cleanUp(style.cssText, UrlUtil.parseProxyUrl, UrlUtil.formatUrl);
            },

            set: function (style, value) {
                if (typeof value === 'string')
                    style.cssText = StyleProcessor.process(value, UrlUtil.getProxyUrl);

                return style.cssText;
            }
        },

        cursor: {
            condition: function (style) {
                return isStyleInstance(style);
            },

            get: function (style) {
                return StyleProcessor.cleanUp(style.cursor, UrlUtil.parseProxyUrl, UrlUtil.formatUrl);
            },

            set: function (style, value) {
                if (typeof value === 'string')
                    style.cursor = StyleProcessor.process(value, UrlUtil.getProxyUrl);

                return style.cursor;
            }
        },

        listStyle: {
            condition: function (style) {
                return isStyleInstance(style);
            },

            get: function (style) {
                return StyleProcessor.cleanUp(style.listStyle, UrlUtil.parseProxyUrl, UrlUtil.formatUrl);
            },

            set: function (style, value) {
                if (typeof value === 'string')
                    style.listStyle = StyleProcessor.process(value, UrlUtil.getProxyUrl);

                return style.listStyle;
            }
        },

        listStyleImage: {
            condition: function (style) {
                return isStyleInstance(style);
            },

            get: function (style) {
                return StyleProcessor.cleanUp(style.listStyleImage, UrlUtil.parseProxyUrl, UrlUtil.formatUrl);
            },

            set: function (style, value) {
                if (typeof value === 'string')
                    style.listStyleImage = StyleProcessor.process(value, UrlUtil.getProxyUrl);

                return style.listStyleImage;
            }
        }
    };

    module.exports.elementPropertyAccessors = elementPropertyAccessors;

    //NOTE: isolate throw statement into separate function because JS engines doesn't optimize such functions.
    function error (msg) {
        throw new Error(msg);
    }

    function isNullOrUndefined (obj) {
        return !obj && (obj === null || typeof obj === 'undefined');
    }

    function inaccessibleTypeToStr (obj) {
        return obj === null ? 'null' : 'undefined';
    }

    //Proxy methods
    function callMethod (owner, methName, args) {
        if (isNullOrUndefined(owner))
            error('Cannot call method \'' + methName + '\' of ' + inaccessibleTypeToStr(owner));

        if (typeof owner[methName] !== 'function')
            error('\'' + methName + '\' is not a function');

        if (typeof methName !== 'string' || !elementMethWrappers.hasOwnProperty(methName))
            return owner[methName].apply(owner, args);

        return elementMethWrappers[methName].condition(owner) ?
               elementMethWrappers[methName].method(owner, args) : owner[methName].apply(owner, args);
    }

    function getLocation (location) {
        return isLocationInstance(location) ? locationWrapper : location;
    }

    function getProperty (owner, propName) {
        if (isNullOrUndefined(owner))
            error('Cannot read property \'' + propName + '\' of ' + inaccessibleTypeToStr(owner));

        if (typeof propName !== 'string' || !elementPropertyAccessors.hasOwnProperty(propName))
            return owner[propName];

        return elementPropertyAccessors[propName].condition(owner) ?
               elementPropertyAccessors[propName].get(owner) : owner[propName];
    }

    function processScript (script) {
        return typeof script !== 'string' ? script : JSProcessor.process(script);
    }

    function setLocation (location, value) {
        if (isLocationInstance(location)) {
            location = value;

            return location;
        }

        return null;
    }

    function setProperty (owner, propName, value) {
        if (isNullOrUndefined(owner))
            error('Cannot set property \'' + propName + '\' of ' + inaccessibleTypeToStr(owner));

        var returnValue = null;

        if (typeof propName !== 'string' || !elementPropertyAccessors.hasOwnProperty(propName)) {
            returnValue = owner[propName] = value;

            return returnValue;
        }

        if (elementPropertyAccessors[propName].condition(owner))
            return elementPropertyAccessors[propName].set(owner, value);

        returnValue = owner[propName] = value;

        return returnValue;
    }

    window[JSProcessor.CALL_METHOD_METH_NAME]    = callMethod;
    window[JSProcessor.GET_LOCATION_METH_NAME]   = getLocation;
    window[JSProcessor.GET_PROPERTY_METH_NAME]   = getProperty;
    window[JSProcessor.PROCESS_SCRIPT_METH_NAME] = processScript;
    window[JSProcessor.SET_LOCATION_METH_NAME]   = setLocation;
    window[JSProcessor.SET_PROPERTY_METH_NAME]   = setProperty;
}

function AttributesWrapper (attributes) {
    var length = 0;

    for (var i = 0; i < attributes.length; i++) {
        var attr = attributes[i];

        if (!DOM.isHammerheadAttr(attr.name)) {
            var storedAttrName = attributes[DomProcessor.getStoredAttrName(attr.name)];

            if (storedAttrName) {
                attr       = attr.cloneNode();
                attr.value = storedAttrName.value;
                Object.defineProperty(this, attr.name, { value: attr });
            }

            Object.defineProperty(this, length, { value: attr });
            length++;
        }
    }

    Object.defineProperty(this, 'length', { value: length });

    this.item = function (index) {
        return this[index];
    };

    for (var funcName in attributes) {
        if (typeof this[funcName] === 'function' && funcName !== 'item')
            this[funcName] = attributes[funcName].bind(attributes);
    }
}

export function getAttributesProperty (el) {
    for (var i = 0; i < el.attributes.length; i++) {
        if (DOM.isHammerheadAttr(el.attributes[i].name)) {
            AttributesWrapper.prototype = el.attributes;

            return new AttributesWrapper(el.attributes);
        }
    }

    return el.attributes;
}
