import * as domUtils from './dom';
import * as browserUtils from './browser';
import * as featureDetection from './feature-detection';
import nativeMethods from '../sandbox/native-methods';
import { ScrollState } from '../../typings/client';

// NOTE: For Chrome.
const MIN_SELECT_SIZE_VALUE = 4;

function getParsedValue (value, parseFn) {
    value = value || '';

    const parsedValue = parseFn(value.replace('px', ''), 10);

    return isNaN(parsedValue) ? 0 : parsedValue;
}

function getIntValue (value) {
    return getParsedValue(value, parseInt);
}

function getFloatValue (value) {
    return getParsedValue(value, parseFloat);
}

export function get (el, property: string, doc?: Document, win?: Window) {
    el = el.documentElement || el;

    const computedStyle = getComputedStyle(el, doc, win);

    return computedStyle && computedStyle[property];
}

export function set (el, property, value) {
    el                 = el.documentElement || el;
    el.style[property] = value;
}

export function getBordersWidthInternal (el, parseFn) {
    return {
        bottom: parseFn(get(el, 'borderBottomWidth')),
        left:   parseFn(get(el, 'borderLeftWidth')),
        right:  parseFn(get(el, 'borderRightWidth')),
        top:    parseFn(get(el, 'borderTopWidth')),
    };
}

export function getBordersWidth (el) {
    return getBordersWidthInternal(el, getIntValue);
}

export function getBordersWidthFloat (el) {
    return getBordersWidthInternal(el, getFloatValue);
}

export function getComputedStyle (el, doc, win) {
    // NOTE: In Firefox, after calling the 'document.write' function for nested iframes with html src value
    // document.defaultView equals 'null'. But 'window.document' equals 'document'.
    // This is why, we are forced to calculate the targetWindow instead of use document.defaultView.
    doc = doc || document;
    win = win || window;

    const targetWin = doc.defaultView || win;

    return targetWin.getComputedStyle(el, null);
}

export function getElementMargin (el) {
    return {
        bottom: getIntValue(get(el, 'marginBottom')),
        left:   getIntValue(get(el, 'marginLeft')),
        right:  getIntValue(get(el, 'marginRight')),
        top:    getIntValue(get(el, 'marginTop')),
    };
}

export function getElementPaddingInternal (el, parseFn) {
    return {
        bottom: parseFn(get(el, 'paddingBottom')),
        left:   parseFn(get(el, 'paddingLeft')),
        right:  parseFn(get(el, 'paddingRight')),
        top:    parseFn(get(el, 'paddingTop')),
    };
}
export function getElementPadding (el) {
    return getElementPaddingInternal(el, getIntValue);
}

export function getElementPaddingFloat (el) {
    return getElementPaddingInternal(el, getFloatValue);
}

export function getElementScroll (el: any): ScrollState {
    const isHtmlElement = domUtils.isHtmlElement(el);
    let currentWindow   = window;

    if (isHtmlElement && domUtils.isElementInIframe(el)) {
        const currentIframe = domUtils.getIframeByElement(el);

        if (currentIframe)
            currentWindow = nativeMethods.contentWindowGetter.call(currentIframe);
    }

    const targetEl = isHtmlElement ? currentWindow : el;

    return {
        left: getScrollLeft(targetEl),
        top:  getScrollTop(targetEl),
    };
}

export function getWidth (el) {
    if (!el)
        return null;

    if (domUtils.isWindow(el))
        return el.document.documentElement.clientWidth;

    if (domUtils.isDocument(el)) {
        const doc        = el.documentElement;
        const clientProp = 'clientWidth';
        const scrollProp = 'scrollWidth';
        const offsetProp = 'offsetWidth';

        if (doc[clientProp] >= doc[scrollProp])
            return doc[clientProp];

        return Math.max(
            el.body[scrollProp], doc[scrollProp],
            el.body[offsetProp], doc[offsetProp]
        );
    }

    let value = el.offsetWidth;

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

    if (domUtils.isDocument(el)) {
        const doc        = el.documentElement;
        const clientProp = 'clientHeight';
        const scrollProp = 'scrollHeight';
        const offsetProp = 'offsetHeight';

        if (doc[clientProp] >= doc[scrollProp])
            return doc[clientProp];

        return Math.max(
            el.body[scrollProp], doc[scrollProp],
            el.body[offsetProp], doc[offsetProp]
        );
    }

    let value = el.offsetHeight;

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

    let value = el.offsetWidth;

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

    let value = el.offsetHeight;

    value -= getIntValue(get(el, 'borderTopWidth'));
    value -= getIntValue(get(el, 'borderBottomWidth'));

    return value;
}

export function getOptionHeight (select) {
    const realSizeValue      = getSelectElementSize(select);
    const selectPadding      = getElementPadding(select);
    const selectScrollHeight = select.scrollHeight - (selectPadding.top + selectPadding.bottom);
    const childrenCount      = domUtils.getSelectVisibleChildren(select).length;

    if (realSizeValue === 1)
        return getHeight(select);

    return Math.round(selectScrollHeight / Math.max(childrenCount, realSizeValue));
}

export function getSelectElementSize (select) {
    // NOTE: iOS and Android ignore 'size' and 'multiple' attributes,
    // all select elements behave like a select with size=1.
    if (browserUtils.isSafari && featureDetection.hasTouchEvents || browserUtils.isAndroid)
        return 1;

    const sizeAttr     = nativeMethods.getAttribute.call(select, 'size');
    const multipleAttr = nativeMethods.hasAttribute.call(select, 'multiple');
    let size           = !sizeAttr ? 1 : parseInt(sizeAttr, 10);

    if (multipleAttr && (!sizeAttr || size < 1))
        size = MIN_SELECT_SIZE_VALUE;

    return size;
}

export function isVisibleChild (el) {
    const select  = domUtils.getSelectParent(el);
    const tagName = domUtils.getTagName(el);

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
        const win       = domUtils.findDocument(el).defaultView;
        const scrollTop = getScrollTop(el);

        nativeMethods.scrollTo.call(win, value, scrollTop);
    }
    else
        el.scrollLeft = value;
}

export function setScrollTop (el, value) {
    if (!el)
        return;

    if (domUtils.isWindow(el) || domUtils.isDocument(el)) {
        const win        = domUtils.findDocument(el).defaultView;
        const scrollLeft = getScrollLeft(el);

        nativeMethods.scrollTo.call(win, scrollLeft, value);
    }
    else
        el.scrollTop = value;
}

export function getOffsetParent (el) {
    if (el) {
        let offsetParent = el.offsetParent || document.body;

        while (offsetParent && (!/^(?:body|html)$/i.test(offsetParent.nodeName) &&
               get(offsetParent, 'position') === 'static'))
            offsetParent = offsetParent.offsetParent;

        return offsetParent;
    }

    return void 0;
}

export function getOffset (el) {
    if (!el || domUtils.isWindow(el) || domUtils.isDocument(el))
        return null;

    let clientRect = el.getBoundingClientRect();

    // NOTE: A detached node or documentElement.
    const doc        = el.ownerDocument;
    const docElement = doc.documentElement;

    if (!docElement.contains(el) || el === docElement) {
        return {
            top:  clientRect.top,
            left: clientRect.left,
        };
    }

    const win        = doc.defaultView;
    const clientTop  = docElement.clientTop || doc.body.clientTop || 0;
    const clientLeft = docElement.clientLeft || doc.body.clientLeft || 0;
    const scrollTop  = win.pageYOffset || docElement.scrollTop || doc.body.scrollTop;
    const scrollLeft = win.pageXOffset || docElement.scrollLeft || doc.body.scrollLeft;

    clientRect = el.getBoundingClientRect();

    return {
        top:  clientRect.top + scrollTop - clientTop,
        left: clientRect.left + scrollLeft - clientLeft,
    };
}

export function isElementVisible (el, doc) {
    if (!domUtils.isElementInDocument(el, doc))
        return false;

    while (el) {
        if (get(el, 'display', doc) === 'none' || get(el, 'visibility', doc) === 'hidden')
            return false;

        el = domUtils.getParentExceptShadowRoot(el);
    }

    return true;
}

export function isElementInInvisibleIframe (el) {
    const frameElement = domUtils.getIframeByElement(el);

    return frameElement && !isElementVisible(frameElement, domUtils.findDocument(frameElement));
}
