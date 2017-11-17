import { parseProxyUrl } from '../../../utils/url';
import nativeMethods from '../../native-methods';

let anchor      = nativeMethods.createElement.call(document, 'a');
let emptyAnchor = nativeMethods.createElement.call(document, 'a');

export function getAnchorProperty (el, prop) {
    if (el.href) {
        const parsedProxyUrl = parseProxyUrl(el.href);

        anchor.href = parsedProxyUrl ? parsedProxyUrl.destUrl : el.href;

        return anchor[prop];
    }

    return emptyAnchor[prop];
}

export function setAnchorProperty (el, prop, value) {
    if (el.href) {
        const parsedProxyUrl = parseProxyUrl(el.href);

        anchor.href  = parsedProxyUrl ? parsedProxyUrl.destUrl : el.href;
        anchor[prop] = value;
        el.setAttribute('href', anchor.href);

        return anchor[prop];
    }

    return '';
}

export function dispose () {
    anchor      = null;
    emptyAnchor = null;
}
