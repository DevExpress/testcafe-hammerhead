import { parseProxyUrl } from '../../../utils/url';
import nativeMethods from '../../native-methods';

var anchor      = nativeMethods.createElement.call(document, 'a');
var emptyAnchor = nativeMethods.createElement.call(document, 'a');

export function getAnchorProperty (el, prop) {
    if (el.href) {
        var parsedProxyUrl = parseProxyUrl(el.href);

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
