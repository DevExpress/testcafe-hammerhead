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

        var onChanged            = value => this.emit(this.CHANGED_EVENT, value);
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

            return getProxyUrl(href, { resourceType: changedOnlyHash ? locationResourceType : resourceType });
        };
        var urlProps       = ['port', 'host', 'hostname', 'pathname', 'protocol'];

        Object.defineProperty(this, 'href', createPropertyDesc({
            get: getHref,
            set: href => {
                var proxiedHref = getProxiedHref(href);

                window.location.href = proxiedHref;
                onChanged(proxiedHref);

                return href;
            }
        }));

        Object.defineProperty(this, 'search', createPropertyDesc({
            get: () => window.location.search,
            set: search => {
                var newLocation = changeDestUrlPart(window.location.toString(), 'search', search, resourceType);

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

        var overrideProperty = property => {
            Object.defineProperty(this, property, createPropertyDesc({
                get: () => getParsedDestLocation()[property],
                set: value => {
                    var newLocation = changeDestUrlPart(window.location.toString(), property, value, resourceType);

                    window.location = newLocation;
                    onChanged(newLocation);

                    return value;
                }
            }));
        };

        for (var i = 0, len = urlProps.length; i < len; i++)
            overrideProperty(urlProps[i]);

        this.assign = url => {
            var proxiedHref = getProxiedHref(url);
            var result      = window.location.assign(proxiedHref);

            onChanged(proxiedHref);

            return result;
        };

        this.replace = url => {
            var proxiedHref = getProxiedHref(url);
            var result      = window.location.replace(proxiedHref);

            onChanged(proxiedHref);

            return result;
        };

        this.reload = forceget => {
            var result = window.location.reload(forceget);

            onChanged(window.location.toString());

            return result;
        };

        this.toString = () => getHref();
    }
}
