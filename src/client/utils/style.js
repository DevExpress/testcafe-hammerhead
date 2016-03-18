import * as domUtils from './dom';
import * as browserUtils from './browser';
import nativeMethods from '../sandbox/native-methods';
import { isObject, isUndefined } from '../../utils/types';

// NOTE: For Chrome.
const MIN_SELECT_SIZE_VALUE = 4;

function getIntValue (value) {
    value = value || '';

    var parsedValue = parseInt(value.replace('px', ''), 10);

    return isNaN(parsedValue) ? 0 : parsedValue;
}

export function isStyle (instance) {
    if (instance instanceof nativeMethods.styleClass)
        return true;

    if (instance && isObject(instance) && !isUndefined(instance.border)) {
        instance = instance.toString();

        return instance === '[object CSSStyleDeclaration]' || instance === '[object CSS2Properties]' ||
               instance === '[object MSStyleCSSProperties]';
    }

    return false;
}

export function get (el, property, doc) {
    el = el.documentElement || el;

    var computedStyle = getComputedStyle(el, doc);

    return computedStyle && computedStyle[property];
}

export function set (el, property, value) {
    el                 = el.documentElement || el;
    el.style[property] = value;
}

export function getBordersWidth (el) {
    return {
        bottom: getIntValue(get(el, 'borderBottomWidth')),
        left:   getIntValue(get(el, 'borderLeftWidth')),
        right:  getIntValue(get(el, 'borderRightWidth')),
        top:    getIntValue(get(el, 'borderTopWidth'))
    };
}

export function getComputedStyle (el, doc) {
    doc = doc || document;

    return doc.defaultView.getComputedStyle(el, null);
}

export function getElementMargin (el) {
    return {
        bottom: getIntValue(get(el, 'marginBottom')),
        left:   getIntValue(get(el, 'marginLeft')),
        right:  getIntValue(get(el, 'marginRight')),
        top:    getIntValue(get(el, 'marginTop'))
    };
}

export function getElementPadding (el) {
    return {
        bottom: getIntValue(get(el, 'paddingBottom')),
        left:   getIntValue(get(el, 'paddingLeft')),
        right:  getIntValue(get(el, 'paddingRight')),
        top:    getIntValue(get(el, 'paddingTop'))
    };
}

export function getElementScroll (el) {
    var isHtmlElement = domUtils.isHtmlElement(el);
    var currentWindow = window;

    if (isHtmlElement && domUtils.isElementInIframe(el)) {
        var currentIframe = domUtils.getIframeByElement(el);

        if (currentIframe)
            currentWindow = currentIframe.contentWindow;
    }

    var targetEl = isHtmlElement ? currentWindow : el;

    return {
        left: getScrollLeft(targetEl),
        top:  getScrollTop(targetEl)
    };
}

export function getWidth (el) {
    if (!el)
        return null;

    if (domUtils.isWindow(el))
        return el.document.documentElement.clientWidth;

    if (domUtils.isDocumentNode(el)) {
        var doc        = el.documentElement;
        var clientProp = 'clientWidth';
        var scrollProp = 'scrollWidth';
        var offsetProp = 'offsetWidth';

        if (doc[clientProp] >= doc[scrollProp])
            return doc[clientProp];

        return Math.max(
            el.body[scrollProp], doc[scrollProp],
            el.body[offsetProp], doc[offsetProp]
        );
    }

    var value = el.offsetWidth;

    value -= getIntValue(get(el, 'paddingLeft'));
    value -= getIntValue(get(el, 'paddingRight'));
    value -= getIntValue(get(el, 'borderLeftWidth'));
    value -= getIntValue(get(el, 'borderRightWidth'));

    return value;
}

export function getHeight (el) {
    if (!el)
        return null;

    if (domUtils.isWindow(el))
        return el.document.documentElement.clientHeight;

    if (domUtils.isDocumentNode(el)) {
        var doc        = el.documentElement;
        var clientProp = 'clientHeight';
        var scrollProp = 'scrollHeight';
        var offsetProp = 'offsetHeight';

        if (doc[clientProp] >= doc[scrollProp])
            return doc[clientProp];

        return Math.max(
            el.body[scrollProp], doc[scrollProp],
            el.body[offsetProp], doc[offsetProp]
        );
    }

    var value = el.offsetHeight;

    value -= getIntValue(get(el, 'paddingTop'));
    value -= getIntValue(get(el, 'paddingBottom'));
    value -= getIntValue(get(el, 'borderTopWidth'));
    value -= getIntValue(get(el, 'borderBottomWidth'));

    return value;
}

export function getInnerWidth (el) {
    if (!el)
        return null;

    if (domUtils.isWindow(el))
        return el.document.documentElement.clientWidth;

    if (domUtils.isDocument(el))
        return el.documentElement.clientWidth;

    var value = el.offsetWidth;

    value -= getIntValue(get(el, 'borderLeftWidth'));
    value -= getIntValue(get(el, 'borderRightWidth'));

    return value;
}

export function getInnerHeight (el) {
    if (!el)
        return null;

    if (domUtils.isWindow(el))
        return el.document.documentElement.clientHeight;

    if (domUtils.isDocument(el))
        return el.documentElement.clientHeight;

    var value = el.offsetHeight;

    value -= getIntValue(get(el, 'borderTopWidth'));
    value -= getIntValue(get(el, 'borderBottomWidth'));

    return value;
}

export function getOptionHeight (select) {
    var realSizeValue      = getSelectElementSize(select);
    var selectPadding      = getElementPadding(select);
    var selectScrollHeight = select.scrollHeight - (selectPadding.top + selectPadding.bottom);
    var childrenCount      = domUtils.getSelectVisibleChildren(select).length;

    if (realSizeValue === 1)
        return getHeight(select);

    return browserUtils.isIE && realSizeValue > childrenCount ?
           Math.round(selectScrollHeight / childrenCount) :
           Math.round(selectScrollHeight / Math.max(childrenCount, realSizeValue));
}

export function getSelectElementSize (select) {
    // NOTE: iOS and Android ignore 'size' and 'multiple' attributes,
    // all select elements behave like a select with size=1.
    if (browserUtils.isSafari && browserUtils.hasTouchEvents || browserUtils.isAndroid)
        return 1;

    var sizeAttr     = nativeMethods.getAttribute.call(select, 'size');
    var multipleAttr = nativeMethods.getAttribute.call(select, 'multiple');
    var size         = !sizeAttr ? 1 : parseInt(sizeAttr, 10);

    if (multipleAttr && (!sizeAttr || size < 1))
        size = MIN_SELECT_SIZE_VALUE;

    return size;
}

export function isVisibleChild (el) {
    var select  = domUtils.getSelectParent(el);
    var tagName = domUtils.getTagName(el);

    return domUtils.isSelectElement(select) && getSelectElementSize(select) > 1 &&
           (tagName === 'option' || tagName === 'optgroup') &&
           // NOTE: Firefox does not display groups without a label or with an empty label.
           (!browserUtils.isFirefox || el.label);
}

export function getScrollLeft (el) {
    if (!el)
        return null;

    if (domUtils.isWindow(el))
        return el.pageXOffset;

    if (domUtils.isDocument(el))
        return el.defaultView.pageXOffset;

    return el.scrollLeft;
}

export function getScrollTop (el) {
    if (!el)
        return null;

    if (domUtils.isWindow(el))
        return el.pageYOffset;

    if (domUtils.isDocument(el))
        return el.defaultView.pageYOffset;

    return el.scrollTop;
}

export function setScrollLeft (el, value) {
    if (!el)
        return;

    if (domUtils.isWindow(el) || domUtils.isDocument(el)) {
        var win       = domUtils.findDocument(el).defaultView;
        var scrollTop = getScrollTop(el);

        win.scrollTo(value, scrollTop);
    }
    else
        el.scrollLeft = value;
}

export function setScrollTop (el, value) {
    if (!el)
        return;

    if (domUtils.isWindow(el) || domUtils.isDocument(el)) {
        var win        = domUtils.findDocument(el).defaultView;
        var scrollLeft = getScrollLeft(el);

        win.scrollTo(scrollLeft, value);
    }
    else
        el.scrollTop = value;
}

export function getOffsetParent (el) {
    if (el) {
        var offsetParent = el.offsetParent || document.body;

        while (offsetParent && (!/^(?:body|html)$/i.test(offsetParent.nodeName) &&
               get(offsetParent, 'position') === 'static'))
            offsetParent = offsetParent.offsetParent;

        return offsetParent;
    }
}

export function getOffset (el) {
    if (!el || domUtils.isWindow(el) || domUtils.isDocument(el))
        return null;

    var clientRect = el.getBoundingClientRect();

    // NOTE: A detached node or documentElement.
    var doc        = el.ownerDocument;
    var docElement = doc.documentElement;

    if (!docElement.contains(el) || el === docElement) {
        return {
            top:  clientRect.top,
            left: clientRect.left
        };
    }

    var win        = doc.defaultView;
    var clientTop  = docElement.clientTop || doc.body.clientTop || 0;
    var clientLeft = docElement.clientLeft || doc.body.clientLeft || 0;
    var scrollTop  = win.pageYOffset || docElement.scrollTop || doc.body.scrollTop;
    var scrollLeft = win.pageXOffset || docElement.scrollLeft || doc.body.scrollLeft;

    clientRect = el.getBoundingClientRect();

    return {
        top:  clientRect.top + scrollTop - clientTop,
        left: clientRect.left + scrollLeft - clientLeft
    };
}

export function isElementVisible (el, doc) {
    if (!domUtils.isElementInDocument(el, doc))
        return false;

    while (el) {
        if (get(el, 'display', doc) === 'none' || get(el, 'visibility', doc) === 'hidden')
            return false;

        el = el.parentNode;
    }

    return true;
}

export function isElementInInvisibleIframe (el) {
    var frameElement = domUtils.getIframeByElement(el);

    return frameElement && !isElementVisible(frameElement, domUtils.findDocument(frameElement));
}
