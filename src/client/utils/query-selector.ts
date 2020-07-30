import nativeMethods from '../sandbox/native-methods-adapter';
import { isDocumentFragmentNode, isDomElement, isShadowRoot } from './dom';

export function getNativeQuerySelector (el) {
    if (isDomElement(el))
        return nativeMethods.elementQuerySelector;

    return isDocumentFragmentNode(el) || isShadowRoot(el)
        ? nativeMethods.documentFragmentQuerySelector
        : nativeMethods.querySelector;
}

export function getNativeQuerySelectorAll (el) {
    // NOTE: Do not return the isDocument function instead of the isDomElement
    // it leads to the `Invalid calling object` error in some cases in IE11 (GH-1846)
    if (isDomElement(el))
        return nativeMethods.elementQuerySelectorAll;

    return isDocumentFragmentNode(el) || isShadowRoot(el)
        ? nativeMethods.documentFragmentQuerySelectorAll
        : nativeMethods.querySelectorAll;
}
