import NativeMethods from '../sandboxes/native-methods';
import * as Browser from './browser';

export function inaccessibleTypeToStr (obj) {
    return obj === null ? 'null' : 'undefined';
}

export function isDocument (instance) {
    if (instance instanceof NativeMethods.documentClass)
        return true;

    return instance && typeof instance === 'object' && typeof instance.referrer !== 'undefined' &&
           instance.toString &&
           (instance.toString() === '[object HTMLDocument]' || instance.toString() === '[object Document]');
}

export function isLocation (instance) {
    if (instance instanceof NativeMethods.locationClass)
        return true;

    return instance && typeof instance === 'object' && typeof instance.href !== 'undefined' &&
           typeof instance.assign !== 'undefined';
}

export function isNullOrUndefined (obj) {
    return !obj && (obj === null || typeof obj === 'undefined');
}

export function isSVGElement (obj) {
    return window.SVGElement && obj instanceof window.SVGElement;
}

export function isStyle (instance) {
    if (instance instanceof NativeMethods.styleClass)
        return true;

    if (instance && typeof instance === 'object' && typeof instance.border !== 'undefined') {
        instance = instance.toString();

        return instance === '[object CSSStyleDeclaration]' || instance === '[object CSS2Properties]' ||
               instance === '[object MSStyleCSSProperties]';
    }

    return false;
}

export function isWindow (instance) {
    if (instance instanceof NativeMethods.windowClass)
        return true;

    var result = instance && typeof instance === 'object' && typeof instance.top !== 'undefined' &&
                 (Browser.isMozilla ? true : instance.toString && (instance.toString() === '[object Window]' ||
                                                                   instance.toString() === '[object global]'));

    if (result && instance.top !== instance)
        return isWindow(instance.top);

    return result;
}

