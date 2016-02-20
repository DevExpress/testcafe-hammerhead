import nativeMethods from '../sandbox/native-methods';
import { isDocumentFragmentNode, isDocumentNode } from './dom';

export default function getNativeQuerySelectorAll (el) {
    if (isDocumentNode(el))
        return nativeMethods.querySelectorAll;

    return isDocumentFragmentNode(el) ? nativeMethods.documentFragmentQuerySelectorAll
                                      : nativeMethods.elementQuerySelectorAll;
}
