import nativeMethods from '../sandbox/native-methods';

import {
    isDocumentFragmentNode,
    isDomElement,
    isShadowRoot,
} from './dom';

export function getNativeQuerySelector (el) {
    if (isDomElement(el))
        return nativeMethods.elementQuerySelector;

    return isDocumentFragmentNode(el) || isShadowRoot(el)
        ? nativeMethods.documentFragmentQuerySelector
        : nativeMethods.querySelector;
}

export function getNativeQuerySelectorAll (el) {
    if (isDomElement(el))
        return nativeMethods.elementQuerySelectorAll;

    return isDocumentFragmentNode(el) || isShadowRoot(el)
        ? nativeMethods.documentFragmentQuerySelectorAll
        : nativeMethods.querySelectorAll;
}
