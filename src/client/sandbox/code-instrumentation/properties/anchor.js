import { parseProxyUrl } from '../../../utils/url';

var anchor      = document.createElement('A');
var emptyAnchor = document.createElement('A');

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
