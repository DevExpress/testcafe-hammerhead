import nativeMethods from '../sandbox/native-methods';
import * as browserUtils from './browser';


export let instanceAndPrototypeToStringAreEqual = false;
export let hasTouchEvents = false;
export let isTouchDevice = false;
export let hasDataTransfer = false;

if (nativeMethods.createElement) {
    // NOTE: In Chrome, toString(window) equals '[object Window]' and toString(Window.prototype) equals '[object Blob]',
    // this condition is also satisfied for Blob, Document, XMLHttpRequest, etc
    instanceAndPrototypeToStringAreEqual = nativeMethods.objectToString.call(window) ===
        nativeMethods.objectToString.call(Window.prototype);

    hasTouchEvents = 'ontouchstart' in window;

    isTouchDevice = (browserUtils.isMobile || browserUtils.isTablet) && hasTouchEvents;

    // @ts-ignore
    hasDataTransfer = !!window.DataTransfer;
}
