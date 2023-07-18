import nativeMethods from '../sandbox/native-methods';
import * as domUtils from './dom';
import * as styleUtils from './style';
import { isFirefox } from './browser';
import { isFunction } from './types';

function getAreaElementRectangle (el, mapContainer) {
    const shape = nativeMethods.getAttribute.call(el, 'shape');
    let coords  = nativeMethods.getAttribute.call(el, 'coords');
    let i       = 0;

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

    let rectangle = null;

    switch (shape) {
        case 'rect':
            if (coords.length === 4) {
                rectangle = {
                    height: coords[3] - coords[1],
                    left:   coords[0],
                    top:    coords[1],
                    width:  coords[2] - coords[0],
                };

            }
            break;

        case 'circle':
            if (coords.length === 3) {
                rectangle = {
                    height: coords[2] * 2,
                    left:   coords[0] - coords[2],
                    top:    coords[1] - coords[2],
                    width:  coords[2] * 2,
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
        const containerOffset = getOffsetPosition(mapContainer);

        rectangle.left += containerOffset.left;
        rectangle.top += containerOffset.top;
    }

    return rectangle;
}

function getMapElementRectangle (el) {
    const mapContainer = domUtils.getMapContainer(el);

    if (mapContainer) {
        if (/^map$/i.test(el.tagName))
            return getElementRectangle(mapContainer);
        else if (/^area$/i.test(el.tagName)) {
            const areaElementRectangle = getAreaElementRectangle(el, mapContainer);

            if (areaElementRectangle)
                return areaElementRectangle;
        }
    }

    return {
        height: 0,
        left:   0,
        top:    0,
        width:  0,
    };
}

function getSelectChildRectangle (el) {
    const select = domUtils.getSelectParent(el);

    if (select) {
        const selectRectangle      = getElementRectangle(select);
        const selectBorders        = styleUtils.getBordersWidth(select);
        const selectRightScrollbar = styleUtils.getInnerWidth(select) ===
                                     select.clientWidth ? 0 : domUtils.getScrollbarSize();
        const optionHeight         = styleUtils.getOptionHeight(select);
        const optionRealIndex      = domUtils.getChildVisibleIndex(select, el);
        const optionVisibleIndex   = Math.max(optionRealIndex - styleUtils.getScrollTop(select) / optionHeight, 0);

        return {
            height: optionHeight,
            left:   selectRectangle.left + selectBorders.left,
            top:    selectRectangle.top + selectBorders.top + styleUtils.getElementPadding(select).top +
                    optionVisibleIndex * optionHeight,

            width: selectRectangle.width - (selectBorders.left + selectBorders.right) - selectRightScrollbar,
        };
    }

    return getElementRectangle(el);
}

function getSvgElementRelativeRectangle (el) {
    const isSvgTextElement   = domUtils.matches(el, 'tspan') || domUtils.matches(el, 'tref') ||
                               domUtils.getTagName(el) === 'textpath';
    const boundingClientRect = el.getBoundingClientRect();
    const elementRect        = {
        height: !isSvgTextElement ? boundingClientRect.height : el.offsetHeight,
        left:   boundingClientRect.left + (document.body.scrollLeft || document.documentElement.scrollLeft),
        top:    boundingClientRect.top + (document.body.scrollTop || document.documentElement.scrollTop),
        width:  !isSvgTextElement ? boundingClientRect.width : el.offsetWidth,
    };

    if (isSvgTextElement) {
        const offsetParent       = styleUtils.getOffsetParent(el);
        const elOffset           = styleUtils.getOffset(el);
        const offsetParentOffset = styleUtils.getOffset(offsetParent);
        const offsetParentIsBody = domUtils.matches(offsetParent, 'body');

        return {
            height: elementRect.height || boundingClientRect.height,
            left:   offsetParentIsBody ? el.offsetLeft || elOffset.left : offsetParentOffset.left + el.offsetLeft,
            top:    offsetParentIsBody ? el.offsetTop || elOffset.top : offsetParentOffset.top + el.offsetTop,
            width:  elementRect.width || boundingClientRect.width,
        };
    }


    if (isFirefox)
        return elementRect;

    let strokeWidth = nativeMethods.getAttribute.call(el, 'stroke-width') || styleUtils.get(el, 'stroke-width');

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
    let rectangle: any = {};

    if (domUtils.isMapElement(el))
        rectangle = getMapElementRectangle(el);
    else if (styleUtils.isVisibleChild(el))
        rectangle = getSelectChildRectangle(el);
    else {
        const elementOffset     = getOffsetPosition(el);
        const relativeRectangle = domUtils.isSVGElementOrChild(el) ? getSvgElementRelativeRectangle(el) : el.getBoundingClientRect();

        rectangle = {
            height: relativeRectangle.height,
            left:   elementOffset.left,
            top:    elementOffset.top,
            width:  relativeRectangle.width,
        };
    }

    rectangle.height = Math.round(rectangle.height);
    rectangle.left   = Math.round(rectangle.left);
    rectangle.top    = Math.round(rectangle.top);
    rectangle.width  = Math.round(rectangle.width);

    return rectangle;
}

export function shouldIgnoreEventInsideIframe (el, x, y) {
    if (domUtils.getTagName(el) !== 'iframe')
        return false;

    const rect    = getElementRectangle(el);
    const borders = styleUtils.getBordersWidth(el);
    const padding = styleUtils.getElementPadding(el);

    // NOTE: we detect element's 'content' position: left, right, top and bottom
    // which does not consider borders and paddings, so we need to
    // subtract it for right and bottom, and add for left and top

    const left   = rect.left + borders.left + padding.left;
    const top    = rect.top + borders.top + padding.top;
    const right  = rect.left + rect.width - borders.right - padding.right;
    const bottom = rect.top + rect.height - borders.bottom - padding.bottom;

    return x >= left && x <= right && y >= top && y <= bottom;
}

function calcOffsetPosition (el, borders, offsetPosition) {
    const isSvg = domUtils.isSVGElementOrChild(el);

    const relativeRectangle = isSvg ? getSvgElementRelativeRectangle(el) : null;

    return {
        left: isSvg ? relativeRectangle.left + borders.left : offsetPosition.left + borders.left,
        top:  isSvg ? relativeRectangle.top + borders.top : offsetPosition.top + borders.top,
    };
}

function calcOffsetPositionInIframe (el, borders, offsetPosition, doc, currentIframe) {
    const iframeBorders = styleUtils.getBordersWidth(currentIframe);

    borders.left += iframeBorders.left;
    borders.top += iframeBorders.top;

    const iframeOffset  = getOffsetPosition(currentIframe);
    const iframePadding = styleUtils.getElementPadding(currentIframe);
    let clientPosition  = null;

    if (domUtils.isSVGElementOrChild(el)) {
        const relativeRectangle = getSvgElementRelativeRectangle(el);

        clientPosition = {
            x: relativeRectangle.left - (document.body.scrollLeft || document.documentElement.scrollLeft) +
               borders.left,
            y: relativeRectangle.top - (document.body.scrollTop || document.documentElement.scrollTop) + borders.top,
        };
    }
    else {
        clientPosition = offsetToClientCoords({
            x: offsetPosition.left + borders.left,
            y: offsetPosition.top + borders.top,
        }, doc);
    }

    return {
        left: iframeOffset.left + clientPosition.x + iframePadding.left,
        top:  iframeOffset.top + clientPosition.y + iframePadding.top,
    };
}

export function getOffsetPosition (el, roundFn = Math.round) {
    if (domUtils.isMapElement(el)) {
        const rectangle = getMapElementRectangle(el);

        return {
            left: rectangle.left,
            top:  rectangle.top,
        };
    }

    const doc            = domUtils.findDocument(el);
    const isInIframe     = domUtils.isElementInIframe(el, doc);
    const currentIframe  = isInIframe ? domUtils.getIframeByElement(doc) : null;
    const offsetPosition = doc === el ? styleUtils.getOffset(doc.documentElement) : styleUtils.getOffset(el);

    // NOTE: The jquery .offset() function doesn't take the body's border into account
    // http://bugs.jquery.com/ticket/7948.

    const borders = styleUtils.getBordersWidth(doc.body);

    const calcOffsetPositionFn = !isInIframe || !currentIframe ? calcOffsetPosition : calcOffsetPositionInIframe;

    let { left, top } = calcOffsetPositionFn(el, borders, offsetPosition, doc, currentIframe);

    if (isFunction(roundFn)) {
        left = roundFn(left);
        top  = roundFn(top);
    }

    return { left, top };
}

export function offsetToClientCoords (coords, currentDocument?: Document) {
    const doc                = currentDocument || document;
    const documentScrollLeft = styleUtils.getScrollLeft(doc);
    const documentScrollTop  = styleUtils.getScrollTop(doc);
    const bodyScrollLeft     = styleUtils.getScrollLeft(doc.body);
    const bodyScrollTop      = styleUtils.getScrollTop(doc.body);

    const scrollLeft = documentScrollLeft === 0 && bodyScrollLeft !== 0 ? bodyScrollLeft : documentScrollLeft;
    const scrollTop  = documentScrollTop === 0 && bodyScrollTop !== 0 ? bodyScrollTop : documentScrollTop;

    return {
        x: coords.x - scrollLeft,
        y: coords.y - scrollTop,
    };
}
