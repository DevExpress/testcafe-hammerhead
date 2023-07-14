import nativeMethods from '../sandbox/native-methods';
import * as browserUtils from './browser';


export let instanceAndPrototypeToStringAreEqual = false;
export let hasTouchEvents = false;
export let hasTouchPoints = false;
export let isTouchDevice = false;
export let hasDataTransfer = false;
export let getElementsByNameReturnsHTMLCollection = false;

if (nativeMethods.createElement) {
    const elements = nativeMethods.getElementsByName.call(document, '');

    // NOTE: In Chrome, toString(window) equals '[object Window]' and toString(Window.prototype) equals '[object Blob]',
    // this condition is also satisfied for Blob, Document, XMLHttpRequest, etc
    instanceAndPrototypeToStringAreEqual = nativeMethods.objectToString.call(window) ===
        nativeMethods.objectToString.call(Window.prototype);

    hasTouchEvents = 'ontouchstart' in window;

    // NOTE: We need to check touch points only for IE, because it has PointerEvent and MSPointerEvent (IE10, IE11)
    // instead of TouchEvent (T109295).
    hasTouchPoints = browserUtils.isIE && navigator.maxTouchPoints > 0;
    isTouchDevice = (browserUtils.isMobile || browserUtils.isTablet) && hasTouchEvents;

    // @ts-ignore
    hasDataTransfer = !!window.DataTransfer;

    // Both IE and Edge return an HTMLCollection, not a NodeList
    // @ts-ignore
    getElementsByNameReturnsHTMLCollection = nativeMethods.objectGetPrototypeOf.call(window.Object, elements) ===
        nativeMethods.HTMLCollection.prototype;
}
