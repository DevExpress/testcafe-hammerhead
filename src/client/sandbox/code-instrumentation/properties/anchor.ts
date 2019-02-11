import { parseProxyUrl } from '../../../utils/url';
import nativeMethods from '../../native-methods';

let anchor      = nativeMethods.createElement.call(document, 'a');
let emptyAnchor = nativeMethods.createElement.call(document, 'a');

export function getAnchorProperty (el: HTMLElement, nativePropGetter) {
    const href = nativeMethods.anchorHrefGetter.call(el);

    if (href) {
        const parsedProxyUrl = parseProxyUrl(href);

        nativeMethods.anchorHrefSetter.call(anchor, parsedProxyUrl ? parsedProxyUrl.destUrl : href);

        return nativePropGetter.call(anchor);
    }

    return nativePropGetter.call(emptyAnchor);
}

export function setAnchorProperty (el: HTMLElement, nativePropSetter, value: string) {
    const href = nativeMethods.anchorHrefGetter.call(el);

    if (href) {
        const parsedProxyUrl = parseProxyUrl(href);

        nativeMethods.anchorHrefSetter.call(anchor, parsedProxyUrl ? parsedProxyUrl.destUrl : href);
        nativePropSetter.call(anchor, value);
        el.setAttribute('href', nativeMethods.anchorHrefGetter.call(anchor));
    }

    return value;
}

export function dispose () {
    anchor      = null;
    emptyAnchor = null;
}
