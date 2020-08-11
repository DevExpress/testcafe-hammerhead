import nativeMethods from '../sandbox/native-methods';

export default function (element: HTMLElement): HTMLElement {
    const parent = nativeMethods.nodeParentNodeGetter.call(element);

    if (parent)
        nativeMethods.removeChild.call(parent, element);

    return element;
}
