import createPropertyDesc from '../../../utils/create-property-desc';
import { get as getDestLocation, getParsed as getParsedDestLocation } from '../../../utils/destination-location';
import { getProxyUrl, changeDestUrlPart, parseProxyUrl, parseResourceType, isChangedOnlyHash } from '../../../utils/url';
import { getDomain, getResourceTypeString } from '../../../../utils/url';

function getLocationUrl (window) {
    try {
        return window.location.toString();
    }
    catch (e) {
        return void 0;
    }
}

export default class LocationWrapper {
    constructor (window) {
        var locationUrl          = getLocationUrl(window);
        var parsedLocation       = locationUrl && parseProxyUrl(locationUrl);
        var locationResourceType = parsedLocation ? parsedLocation.resourceType : '';
        var { isIframe, isForm } = parseResourceType(locationResourceType);

        isIframe |= window !== window.top;

        var resourceType   = getResourceTypeString({ isIframe, isForm });
        var getHref        = () => {
            if (window !== window.top && window.location.href === 'about:blank')
                return 'about:blank';

            return getDestLocation();
        };
        var getProxiedHref = href => {
            locationUrl = getLocationUrl(window);

            var changedOnlyHash = locationUrl && isChangedOnlyHash(locationUrl, href);

            return getProxyUrl(href, null, null, null, changedOnlyHash ? locationResourceType : resourceType);
        };
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
