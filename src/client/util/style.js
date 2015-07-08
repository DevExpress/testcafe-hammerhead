import * as Browser from './browser';
import * as DOM from './dom';

//NOTE: for Chrome
var MIN_SELECT_SIZE_VALUE = 4;

function getIntValue (value) {
    value = value || '';

    var parsedValue = parseInt(value.replace('px', ''), 10);

    return isNaN(parsedValue) ? 0 : parsedValue;
}

export function get (el, property) {
    el = el.documentElement || el;

    var computedStyle = getComputedStyle(el);

    return computedStyle[property];
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
    var isHtmlElement = /html/i.test(el.tagName);
    var currentWindow = window;

    if (isHtmlElement && DOM.isElementInIframe(el)) {
        var currentIFrame = DOM.getIFrameByElement(el);

        if (currentIFrame)
            currentWindow = currentIFrame.contentWindow;
    }

    var targetEl = isHtmlElement ? currentWindow : el;

    return {
        left: getScrollLeft(targetEl),
        top:  getScrollTop(targetEl)
    };
}

export function getHeight (el) {
    if (!el)
        return null;

    if (el.nodeType === 9) {
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

    if (DOM.isWindowInstance(el))
        return el.document.documentElement.clientWidth;

    if (DOM.isDocumentInstance(el))
        return el.documentElement.clientWidth;

    var value = el.offsetWidth;

    value -= getIntValue(get(el, 'borderLeftWidth'));
    value -= getIntValue(get(el, 'borderRightWidth'));

    return value;
}

export function getOptionHeight (select) {
    var realSizeValue      = getSelectElementSize(select);
    var selectPadding      = getElementPadding(select);
    var selectScrollHeight = select.scrollHeight - (selectPadding.top + selectPadding.bottom);
    var childrenCount      = DOM.getSelectVisibleChildren(select).length;

    if (realSizeValue === 1)
        return getHeight(select);

    return Browser.isIE && realSizeValue > childrenCount ?
           Math.round(selectScrollHeight / childrenCount) :
           Math.round(selectScrollHeight / Math.max(childrenCount, realSizeValue));
}

export function getSelectElementSize (select) {
    var sizeAttr     = select.getAttribute('size');
    var multipleAttr = select.getAttribute('multiple');
    var size         = !sizeAttr ? 1 : parseInt(sizeAttr, 10);

    if (multipleAttr && (!sizeAttr || size < 1))
        size = MIN_SELECT_SIZE_VALUE;

    return size;
}

export function isVisibleChild (el) {
    var select  = DOM.getSelectParent(el);
    var tagName = el.tagName.toLowerCase();

    return select && select.tagName.toLowerCase() === 'select' && getSelectElementSize(select) > 1 &&
           (tagName === 'option' || tagName === 'optgroup') &&
           //NOTE: Mozilla does not display group without label and with empty label
           (!Browser.isMozilla || el.label);
}

export function getScrollLeft (el) {
    if (!el)
        return null;

    if (DOM.isWindowInstance(el))
        return el.pageXOffset;

    if (DOM.isDocumentInstance(el))
        return el.defaultView.pageXOffset;

    return el.scrollLeft;
}

export function getScrollTop (el) {
    if (!el)
        return null;

    if (DOM.isWindowInstance(el))
        return el.pageYOffset;

    if (DOM.isDocumentInstance(el))
        return el.defaultView.pageYOffset;

    return el.scrollTop;
}

export function setScrollLeft (el, value) {
    if (el) {
        var win       = DOM.findDocument(el).defaultView;
        var scrollTop = getScrollTop(el);

        win.scrollTo(value, scrollTop);
    }
}

export function setScrollTop (el, value) {
    if (el) {
        var win        = DOM.findDocument(el).defaultView;
        var scrollLeft = getScrollLeft(el);

        win.scrollTo(scrollLeft, value);
    }
}

export function getOffsetParent (el) {
    if (el) {
        var offsetParent = el.offsetParent || document.body;

        while (offsetParent && (!/^(?:body|html)$/i.test(offsetParent.nodeName) &&
               get(offsetParent, 'position') === 'static')) {
            offsetParent = offsetParent.offsetParent;
        }

        return offsetParent;
    }
}

export function getOffset (el) {
    if (!el || DOM.isWindowInstance(el) || DOM.isDocumentInstance(el))
        return null;

    var clientRect = el.getBoundingClientRect();

    //Detached node or documentElement
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
