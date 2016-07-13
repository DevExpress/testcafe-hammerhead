import EventEmiter from '../../../utils/event-emitter';
import createPropertyDesc from '../../../utils/create-property-desc';
import { get as getDestLocation, getParsed as getParsedDestLocation } from '../../../utils/destination-location';
import { getProxyUrl, changeDestUrlPart, parseProxyUrl, parseResourceType } from '../../../utils/url';
import { getDomain, getResourceTypeString } from '../../../../utils/url';

export default class LocationWrapper extends EventEmiter {
    constructor (window) {
        super();

        this.CHANGED_EVENT = 'hammerhead|event|location-changed';

        var isIframe  = window !== window.top;
        var isForm    = false;
        var onChanged = value => this.emit(this.CHANGED_EVENT, value);

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

        var resourceType   = getResourceTypeString({ isIframe: isIframe, isForm: isForm });
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

        var overrideProperty = porperty => {
            Object.defineProperty(this, porperty, createPropertyDesc({
                get: () => getParsedDestLocation()[porperty],
                set: value => {
                    var newLocation = changeDestUrlPart(window.location.toString(), porperty, value, resourceType);

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
