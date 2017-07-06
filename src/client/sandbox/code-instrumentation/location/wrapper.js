import EventEmitter from '../../../utils/event-emitter';
import createPropertyDesc from '../../../utils/create-property-desc';
import { get as getDestLocation, getParsed as getParsedDestLocation } from '../../../utils/destination-location';
import {
    getProxyUrl,
    changeDestUrlPart,
    parseProxyUrl,
    parseResourceType,
    isChangedOnlyHash
} from '../../../utils/url';
import { getDomain, getResourceTypeString } from '../../../../utils/url';

function getLocationUrl (window) {
    try {
        return window.location.toString();
    }
    catch (e) {
        return void 0;
    }
}

export default class LocationWrapper extends EventEmitter {
    constructor (window) {
        super();

        this.CHANGED_EVENT = 'hammerhead|location-wrapper|changed';

        const onChanged            = value => this.emit(this.CHANGED_EVENT, value);
        let locationUrl            = getLocationUrl(window);
        const parsedLocation       = locationUrl && parseProxyUrl(locationUrl);
        const locationResourceType = parsedLocation ? parsedLocation.resourceType : '';
        const parsedResourceType   = parseResourceType(locationResourceType);

        parsedResourceType.isIframe |= window !== window.top;

        const resourceType   = getResourceTypeString({ isIframe: parsedResourceType.isIframe, isForm: parsedResourceType.isForm });
        const getHref        = () => {
            if (window !== window.top && window.location.href === 'about:blank')
                return 'about:blank';

            return getDestLocation();
        };
        const getProxiedHref = href => {
            locationUrl = getLocationUrl(window);

            const changedOnlyHash = locationUrl && isChangedOnlyHash(locationUrl, href);

            return getProxyUrl(href, { resourceType: changedOnlyHash ? locationResourceType : resourceType });
        };
        const urlProps       = ['port', 'host', 'hostname', 'pathname', 'protocol'];

        Object.defineProperty(this, 'href', createPropertyDesc({
            get: getHref,
            set: href => {
                const proxiedHref = getProxiedHref(href);

                window.location.href = proxiedHref;
                onChanged(proxiedHref);

                return href;
            }
        }));

        Object.defineProperty(this, 'search', createPropertyDesc({
            get: () => window.location.search,
            set: search => {
                const newLocation = changeDestUrlPart(window.location.toString(), 'search', search, resourceType);

                window.location = newLocation;
                onChanged(newLocation);

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

        const overrideProperty = property => {
            Object.defineProperty(this, property, createPropertyDesc({
                get: () => getParsedDestLocation()[property],
                set: value => {
                    const newLocation = changeDestUrlPart(window.location.toString(), property, value, resourceType);

                    window.location = newLocation;
                    onChanged(newLocation);

                    return value;
                }
            }));
        };

        for (const urlProp of urlProps)
            overrideProperty(urlProp);

        this.assign = url => {
            const proxiedHref = getProxiedHref(url);
            const result      = window.location.assign(proxiedHref);

            onChanged(proxiedHref);

            return result;
        };

        this.replace = url => {
            const proxiedHref = getProxiedHref(url);
            const result      = window.location.replace(proxiedHref);

            onChanged(proxiedHref);

            return result;
        };

        this.reload = forceget => {
            const result = window.location.reload(forceget);

            onChanged(window.location.toString());

            return result;
        };

        this.toString = () => getHref();
    }
}
