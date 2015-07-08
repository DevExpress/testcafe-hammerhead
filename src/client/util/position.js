import * as Browser from './browser';
import * as DOM from './dom';
import * as Style from './style';
import NativeMethods from '../sandboxes/native-methods';

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
    var mapContainer = DOM.getMapContainer(el);

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
    var select = DOM.getSelectParent(el);

    if (select) {
        var selectRectangle      = getElementRectangle(select);
        var selectBorders        = Style.getBordersWidth(select);
        var selectRightScrollbar = Style.getInnerWidth(select) === select.clientWidth ? 0 : DOM.getScrollbarSize();
        var optionHeight         = Style.getOptionHeight(select);
        var optionRealIndex      = DOM.getChildVisibleIndex(select, el);
        var optionVisibleIndex   = Math.max(optionRealIndex - Style.getScrollTop(select) / optionHeight, 0);

        return {
            height: optionHeight,
            left:   selectRectangle.left + selectBorders.left,
            top:    selectRectangle.top + selectBorders.top + Style.getElementPadding(select).top +
                    optionVisibleIndex * optionHeight,

            width: selectRectangle.width - (selectBorders.left + selectBorders.right) - selectRightScrollbar
        };
    }

    return getElementRectangle(el);
}

function getSvgElementRelativeRectangle (el) {
    var isSvgTextElement   = DOM.matches(el, 'tspan') || DOM.matches(el, 'tref') ||
                             el.tagName && el.tagName.toLowerCase() === 'textpath';
    var boundingClientRect = el.getBoundingClientRect();
    var elementRect        = {
        height: !isSvgTextElement ? boundingClientRect.height : el.offsetHeight,
        left:   boundingClientRect.left + (document.body.scrollLeft || document.documentElement.scrollLeft),
        top:    boundingClientRect.top + (document.body.scrollTop || document.documentElement.scrollTop),
        width:  !isSvgTextElement ? boundingClientRect.width : el.offsetWidth
    };

    if (isSvgTextElement) {
        var offsetParent       = Style.getOffsetParent(el);
        var elOffset           = Style.getOffset(el);
        var offsetParentOffset = Style.getOffset(offsetParent);
        var offsetParentIsBody = DOM.matches(offsetParent, 'body');

        return {
            height: elementRect.height || boundingClientRect.height,
            left:   offsetParentIsBody ? el.offsetLeft || elOffset.left : offsetParentOffset.left + el.offsetLeft,
            top:    offsetParentIsBody ? el.offsetTop || elOffset.top : offsetParentOffset.top + el.offsetTop,
            width:  elementRect.width || boundingClientRect.width
        };
    }


    if (Browser.isMozilla || Browser.isIE)
        return elementRect;

    var strokeWidth = NativeMethods.getAttribute.call(el, 'stroke-width') || Style.get(el, 'stroke-width');

    //NOTE: we think that 'stroke-width' attribute can only be set in pixels
    strokeWidth = strokeWidth ? +strokeWidth.replace(/px|em|ex|pt|pc|cm|mm|in/, '') : 1;

    if (strokeWidth && +strokeWidth % 2 !== 0)
        strokeWidth = +strokeWidth + 1;

    if ((DOM.matches(el, 'line') || DOM.matches(el, 'polyline') || DOM.matches(el, 'polygon') ||
         DOM.matches(el, 'path')) &&
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
        if (DOM.matches(el, 'polygon')) {
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

    if (DOM.isMapElement(el))
        rectangle = getMapElementRectangle(el);
    else if (Style.isVisibleChild(el))
        rectangle = getSelectChildRectangle(el);
    else {
        var elementOffset     = getOffsetPosition(el);
        var relativeRectangle = DOM.isSvgElement(el) ? getSvgElementRelativeRectangle(el) : el.getBoundingClientRect();

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
    if (DOM.isMapElement(el)) {
        var rectangle = getMapElementRectangle(el);

        return {
            left: rectangle.left,
            top:  rectangle.top
        };
    }

    var doc               = DOM.findDocument(el);
    var isInIFrame        = DOM.isElementInIframe(el, doc);
    var currentIFrame     = isInIFrame ? DOM.getIFrameByElement(doc) : null;
    var offsetPosition    = doc === el ? Style.getOffset(doc.documentElement) : Style.getOffset(el);
    var relativeRectangle = null;

    // NOTE: jquery .offset() function doesn't take body's border into account (except IE7)
    // http://bugs.jquery.com/ticket/7948

    //NOTE: Sometimes in IE method getElementFromPoint returns cross-domain iframe's documentElement, but we can't get his body
    var borders = doc.body ? Style.getBordersWidth(doc.body) : {
        left: 0,
        top:  0
    };

    if (!isInIFrame || !currentIFrame) {
        var isSvg = DOM.isSvgElement(el);

        relativeRectangle = isSvg ? getSvgElementRelativeRectangle(el) : null;

        return {
            left: Math.round(isSvg ? relativeRectangle.left + borders.left : offsetPosition.left + borders.left),
            top:  Math.round(isSvg ? relativeRectangle.top + borders.top : offsetPosition.top + borders.top)
        };
    }

    var iframeBorders = Style.getBordersWidth(currentIFrame);

    borders.left += iframeBorders.left;
    borders.top += iframeBorders.top;

    var iframeOffset   = getOffsetPosition(currentIFrame);
    var iframePadding  = Style.getElementPadding(currentIFrame);
    var clientPosition = null;

    if (DOM.isSvgElement(el)) {
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
            },
            doc);
    }

    return {
        left: Math.round(iframeOffset.left + clientPosition.x + iframePadding.left),
        top:  Math.round(iframeOffset.top + clientPosition.y + iframePadding.top)
    };
}

export function offsetToClientCoords (coords, currentDocument) {
    var doc = currentDocument || document;

    return {
        x: coords.x - Style.getScrollLeft(doc),
        y: coords.y - Style.getScrollTop(doc)
    };
}
