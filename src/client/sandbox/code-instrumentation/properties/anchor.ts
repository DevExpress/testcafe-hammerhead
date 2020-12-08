import { getDestinationUrl } from '../../../utils/url';
import nativeMethods from '../../native-methods';

let anchor      = nativeMethods.createElement.call(document, 'a');
let emptyAnchor = nativeMethods.createElement.call(document, 'a');

export function getAnchorProperty (el: HTMLElement, nativePropGetter: Function) {
    const href = nativeMethods.anchorHrefGetter.call(el);

    if (!anchor)
        reattach();

    if (href) {
        nativeMethods.anchorHrefSetter.call(anchor, getDestinationUrl(href));

        return nativePropGetter.call(anchor);
    }

    return nativePropGetter.call(emptyAnchor);
}

export function setAnchorProperty (el: HTMLElement, nativePropSetter: Function, value: string) {
    const href = nativeMethods.anchorHrefGetter.call(el);

    if (!anchor)
        reattach();

    if (href) {
        nativeMethods.anchorHrefSetter.call(anchor, getDestinationUrl(href));
        nativePropSetter.call(anchor, value);
        el.setAttribute('href', nativeMethods.anchorHrefGetter.call(anchor));
    }

    return value;
}

export function reattach () {
    anchor      = nativeMethods.createElement.call(document, 'a');
    emptyAnchor = nativeMethods.createElement.call(document, 'a');
}

export function dispose () {
    anchor      = null;
    emptyAnchor = null;
}
