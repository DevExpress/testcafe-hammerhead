import nativeMethods from '../sandbox/native-methods';
import { isDocumentFragmentNode, isDocument } from './dom';

export default function getNativeQuerySelectorAll (el) {
    if (isDocument(el))
        return nativeMethods.querySelectorAll;

    return isDocumentFragmentNode(el) ? nativeMethods.documentFragmentQuerySelectorAll
                                      : nativeMethods.elementQuerySelectorAll;
}
