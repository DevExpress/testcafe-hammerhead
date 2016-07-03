import createPropertyDesc from '../../../utils/create-property-desc';
import { get as getDestLocation, getParsed as getParsedDestLocation } from '../../../utils/destination-location';
import { getProxyUrl, changeDestUrlPart, parseProxyUrl, parseResourceType } from '../../../utils/url';
import { getDomain, stringifyResourceType } from '../../../../utils/url';

export default class LocationWrapper {
    constructor (window) {
        var isIframe = window !== window.top;
        var isForm   = false;

        // NOTE: cross-domain window
        try {
            var parsedLocation = parseProxyUrl(window.location.toString());

            if (parsedLocation) {
                var locationResType = parseResourceType(parsedLocation.resourceType);

                isIframe |= locationResType.isIframe;
                isForm |= locationResType.isForm;
            }
        }
        /*eslint-disable no-empty */
        catch (e) {
        }
        /*eslint-enable no-empty */

        var resourceType   = stringifyResourceType(isIframe, isForm);
        var getHref        = () => {
            if (window !== window.top && window.location.href === 'about:blank')
                return 'about:blank';

            return getDestLocation();
        };
        var getProxiedHref = href => getProxyUrl(href, null, null, null, resourceType);
        var urlProps       = ['port', 'host', 'hostname', 'pathname', 'protocol'];

        Object.defineProperty(this, 'href', createPropertyDesc({
            get: getHref,
            set: href => {
                window.location.href = getProxiedHref(href);

                return href;
            }
        }));

        Object.defineProperty(this, 'search', createPropertyDesc({
            get: () => window.location.search,
            set: search => {
                window.location = changeDestUrlPart(window.location.toString(), 'search', search, resourceType);

                return search;
            }
        }));

        Object.defineProperty(this, 'origin', createPropertyDesc({
            get: () => getDomain(getParsedDestLocation()),
            set: origin => origin
        }));

        Object.defineProperty(this, 'hash', createPropertyDesc({
            get: () => window.location.hash,
            set: hash => {
                window.location.hash = hash;

                return hash;
            }
        }));

        for (var i = 0, len = urlProps.length; i < len; i++)
            LocationWrapper._defineUrlProp(this, window, urlProps[i], resourceType);

        this.assign   = url => window.location.assign(getProxiedHref(url));
        this.replace  = url => window.location.replace(getProxiedHref(url));
        this.reload   = forceget => window.location.reload(forceget);
        this.toString = () => getHref();
    }

    static _defineUrlProp (wrapper, window, prop, resourceType) {
        Object.defineProperty(wrapper, prop, createPropertyDesc({
            get: () => getParsedDestLocation()[prop],
            set: value => {
                window.location = changeDestUrlPart(window.location.toString(), prop, value, resourceType);

                return value;
            }
        }));
    }
}
