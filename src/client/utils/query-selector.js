import nativeMethods from '../sandbox/native-methods';
import { isDocumentFragmentNode, isDocument, isShadowRoot } from './dom';

export function getNativeQuerySelector (el) {
    if (isDocument(el))
        return nativeMethods.querySelector;

    return isDocumentFragmentNode(el) || isShadowRoot(el)
        ? nativeMethods.documentFragmentQuerySelector
        : nativeMethods.elementQuerySelector;
}

export function getNativeQuerySelectorAll (el) {
    if (isDocument(el))
        return nativeMethods.querySelectorAll;

    return isDocumentFragmentNode(el) || isShadowRoot(el)
        ? nativeMethods.documentFragmentQuerySelectorAll
        : nativeMethods.elementQuerySelectorAll;
}
