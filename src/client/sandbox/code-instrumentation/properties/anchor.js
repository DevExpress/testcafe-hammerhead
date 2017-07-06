import { parseProxyUrl } from '../../../utils/url';
import nativeMethods from '../../native-methods';

const anchor      = nativeMethods.createElement.call(document, 'a');
const emptyAnchor = nativeMethods.createElement.call(document, 'a');

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
        anchor.href  = parseProxyUrl(el.href).destUrl;
        anchor[prop] = value;
        el.setAttribute('href', anchor.href);

        return anchor[prop];
    }

    return '';
}
