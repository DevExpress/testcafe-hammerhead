import nativeMethods from '../sandbox/native-methods';
import * as domUtils from './dom';
import * as styleUtils from './style';
import { isFirefox, isIE } from './browser';

function getAreaElementRectangle (el, mapContainer) {
    var shape  = el.getAttribute('shape');
    var coords = el.getAttribute('coords');
    var i      = 0;

    if (shape === 'default')
        return getElementRectangle(mapContainer);

    if (!shape || !coords)
        return null;

    coords = coords.split(',');

    if (!coords.length)
        return null;

    for (i = 0; i < coords.length; i++) {
        coords[i] = parseInt(coords[i], 10);

        if (typeof coords[i] !== 'number')
            return null;
    }

    var rectangle = null;

    switch (shape) {
        case 'rect':
            if (coords.length === 4) {
                rectangle = {
                    height: coords[3] - coords[1],
                    left:   coords[0],
                    top:    coords[1],
                    width:  coords[2] - coords[0]
                };

            }
            break;

        case 'circle':
            if (coords.length === 3) {
                rectangle = {
                    height: coords[2] * 2,
                    left:   coords[0] - coords[2],
                    top:    coords[1] - coords[2],
                    width:  coords[2] * 2
                };
            }

            break;

        case 'poly':
            if (coords.length >= 6 && coords.length % 2 === 0) {
                rectangle      = {};
                rectangle.left = rectangle.right = coords[0];
                rectangle.top = rectangle.bottom = coords[1];

                for (i = 2; i < coords.length; i += 2) {
                    rectangle.left  = coords[i] < rectangle.left ? coords[i] : rectangle.left;
                    rectangle.right = coords[i] > rectangle.right ? coords[i] : rectangle.right;
                }

                for (i = 3; i < coords.length; i += 2) {
                    rectangle.top    = coords[i] < rectangle.top ? coords[i] : rectangle.top;
                    rectangle.bottom = coords[i] > rectangle.bottom ? coords[i] : rectangle.bottom;
                }

                rectangle.height = rectangle.bottom - rectangle.top;
                rectangle.width  = rectangle.right - rectangle.left;
            }

            break;
    }

    if (rectangle) {
        var containerOffset = getOffsetPosition(mapContainer);

        rectangle.left += containerOffset.left;
        rectangle.top += containerOffset.top;
    }

    return rectangle;
}

function getMapElementRectangle (el) {
    var mapContainer = domUtils.getMapContainer(el);

    if (mapContainer) {
        if (/^map$/i.test(el.tagName))
            return getElementRectangle(mapContainer);
        else if (/^area$/i.test(el.tagName)) {
            var areaElementRectangle = getAreaElementRectangle(el, mapContainer);

            if (areaElementRectangle)
                return areaElementRectangle;
        }
    }

    return {
        height: 0,
        left:   0,
        top:    0,
        width:  0
    };
}

function getSelectChildRectangle (el) {
    var select = domUtils.getSelectParent(el);

    if (select) {
        var selectRectangle      = getElementRectangle(select);
        var selectBorders        = styleUtils.getBordersWidth(select);
        var selectRightScrollbar = styleUtils.getInnerWidth(select) === select.clientWidth ? 0 : domUtils.getScrollbarSize();
        var optionHeight         = styleUtils.getOptionHeight(select);
        var optionRealIndex      = domUtils.getChildVisibleIndex(select, el);
        var optionVisibleIndex   = Math.max(optionRealIndex - styleUtils.getScrollTop(select) / optionHeight, 0);

        return {
            height: optionHeight,
            left:   selectRectangle.left + selectBorders.left,
            top:    selectRectangle.top + selectBorders.top + styleUtils.getElementPadding(select).top +
                    optionVisibleIndex * optionHeight,

            width: selectRectangle.width - (selectBorders.left + selectBorders.right) - selectRightScrollbar
        };
    }

    return getElementRectangle(el);
}

function getSvgElementRelativeRectangle (el) {
    var isSvgTextElement   = domUtils.matches(el, 'tspan') || domUtils.matches(el, 'tref') ||
                             el.tagName && el.tagName.toLowerCase() === 'textpath';
    var boundingClientRect = el.getBoundingClientRect();
    var elementRect        = {
        height: !isSvgTextElement ? boundingClientRect.height : el.offsetHeight,
        left:   boundingClientRect.left + (document.body.scrollLeft || document.documentElement.scrollLeft),
        top:    boundingClientRect.top + (document.body.scrollTop || document.documentElement.scrollTop),
        width:  !isSvgTextElement ? boundingClientRect.width : el.offsetWidth
    };

    if (isSvgTextElement) {
        var offsetParent       = styleUtils.getOffsetParent(el);
        var elOffset           = styleUtils.getOffset(el);
        var offsetParentOffset = styleUtils.getOffset(offsetParent);
        var offsetParentIsBody = domUtils.matches(offsetParent, 'body');

        return {
            height: elementRect.height || boundingClientRect.height,
            left:   offsetParentIsBody ? el.offsetLeft || elOffset.left : offsetParentOffset.left + el.offsetLeft,
            top:    offsetParentIsBody ? el.offsetTop || elOffset.top : offsetParentOffset.top + el.offsetTop,
            width:  elementRect.width || boundingClientRect.width
        };
    }


    if (isFirefox || isIE)
        return elementRect;

    var strokeWidth = nativeMethods.getAttribute.call(el, 'stroke-width') || styleUtils.get(el, 'stroke-width');

    // NOTE: We assume that the 'stroke-width' attribute can only be set in pixels.
    strokeWidth = strokeWidth ? +strokeWidth.replace(/px|em|ex|pt|pc|cm|mm|in/, '') : 1;

    if (strokeWidth && +strokeWidth % 2 !== 0)
        strokeWidth = +strokeWidth + 1;

    if ((domUtils.matches(el, 'line') || domUtils.matches(el, 'polyline') || domUtils.matches(el, 'polygon') ||
         domUtils.matches(el, 'path')) &&
        (!elementRect.width || !elementRect.height)) {
        if (!elementRect.width && elementRect.height) {
            elementRect.left -= strokeWidth / 2;
            elementRect.width = strokeWidth;
        }
        else if (elementRect.width && !elementRect.height) {
            elementRect.height = strokeWidth;
            elementRect.top -= strokeWidth / 2;
        }
    }
    else {
        if (domUtils.matches(el, 'polygon')) {
            elementRect.height += 2 * strokeWidth;
            elementRect.left -= strokeWidth;
            elementRect.top -= strokeWidth;
            elementRect.width += 2 * strokeWidth;
        }

        elementRect.height += strokeWidth;
        elementRect.left -= strokeWidth / 2;
        elementRect.top -= strokeWidth / 2;
        elementRect.width += strokeWidth;
    }

    return elementRect;
}

export function getElementRectangle (el) {
    var rectangle = {};

    if (domUtils.isMapElement(el))
        rectangle = getMapElementRectangle(el);
    else if (styleUtils.isVisibleChild(el))
        rectangle = getSelectChildRectangle(el);
    else {
        var elementOffset     = getOffsetPosition(el);
        var relativeRectangle = domUtils.isSVGElementOrChild(el) ? getSvgElementRelativeRectangle(el) : el.getBoundingClientRect();

        rectangle = {
            height: relativeRectangle.height,
            left:   elementOffset.left,
            top:    elementOffset.top,
            width:  relativeRectangle.width
        };
    }

    rectangle.height = Math.round(rectangle.height);
    rectangle.left   = Math.round(rectangle.left);
    rectangle.top    = Math.round(rectangle.top);
    rectangle.width  = Math.round(rectangle.width);

    return rectangle;
}

export function getOffsetPosition (el) {
    if (domUtils.isMapElement(el)) {
        var rectangle = getMapElementRectangle(el);

        return {
            left: rectangle.left,
            top:  rectangle.top
        };
    }

    var doc               = domUtils.findDocument(el);
    var isInIframe        = domUtils.isElementInIframe(el, doc);
    var currentIframe     = isInIframe ? domUtils.getIframeByElement(doc) : null;
    var offsetPosition    = doc === el ? styleUtils.getOffset(doc.documentElement) : styleUtils.getOffset(el);
    var relativeRectangle = null;

    // NOTE: The jquery .offset() function doesn't take the body's border into account (except IE7)
    // http://bugs.jquery.com/ticket/7948.

    // NOTE: Sometimes, in IE, the getElementFromPoint method returns a cross-domain iframe's documentElement,
    // but there’s no way to access its body.
    var borders = doc.body ? styleUtils.getBordersWidth(doc.body) : {
        left: 0,
        top:  0
    };

    if (!isInIframe || !currentIframe) {
        var isSvg = domUtils.isSVGElementOrChild(el);

        relativeRectangle = isSvg ? getSvgElementRelativeRectangle(el) : null;

        return {
            left: Math.round(isSvg ? relativeRectangle.left + borders.left : offsetPosition.left + borders.left),
            top:  Math.round(isSvg ? relativeRectangle.top + borders.top : offsetPosition.top + borders.top)
        };
    }

    var iframeBorders = styleUtils.getBordersWidth(currentIframe);

    borders.left += iframeBorders.left;
    borders.top += iframeBorders.top;

    var iframeOffset   = getOffsetPosition(currentIframe);
    var iframePadding  = styleUtils.getElementPadding(currentIframe);
    var clientPosition = null;

    if (domUtils.isSVGElementOrChild(el)) {
        relativeRectangle = getSvgElementRelativeRectangle(el);

        clientPosition = {
            x: relativeRectangle.left - (document.body.scrollLeft || document.documentElement.scrollLeft) +
               borders.left,
            y: relativeRectangle.top - (document.body.scrollTop || document.documentElement.scrollTop) + borders.top
        };
    }
    else {
        clientPosition = offsetToClientCoords({
            x: offsetPosition.left + borders.left,
            y: offsetPosition.top + borders.top
        }, doc);
    }

    return {
        left: Math.round(iframeOffset.left + clientPosition.x + iframePadding.left),
        top:  Math.round(iframeOffset.top + clientPosition.y + iframePadding.top)
    };
}

export function offsetToClientCoords (coords, currentDocument) {
    var doc = currentDocument || document;

    return {
        x: coords.x - styleUtils.getScrollLeft(doc),
        y: coords.y - styleUtils.getScrollTop(doc)
    };
}
