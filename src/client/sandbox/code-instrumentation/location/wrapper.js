import createPropertyDesc from '../../../utils/create-property-desc';
import { get as getOriginLocation, getParsed as getParsedOriginLocation } from '../../../utils/origin-location';
import { IFRAME, getProxyUrl, changeOriginUrlPart } from '../../../utils/url';

export default class LocationWrapper {
    constructor (window) {
        var resourceType   = window !== window.top ? IFRAME : null;
        var getHref        = () => window.location.href === 'about:blank' ? 'about:blank' : getOriginLocation();
        var getProxiedHref = href => getProxyUrl(href, null, null, null, resourceType);

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
                window.location = changeOriginUrlPart(window.location.toString(), 'search', search, resourceType);

                return search;
            }
        }));

        Object.defineProperty(this, 'origin', createPropertyDesc({
            get: () => {
                var parsedOriginLocation = getParsedOriginLocation();

                return parsedOriginLocation.protocol + '//' + parsedOriginLocation.host;
            },
            set: origin => origin
        }));

        Object.defineProperty(this, 'hash', createPropertyDesc({
            get: () => window.location.hash,
            set: hash => window.location.hash = hash
        }));

        ['port', 'host', 'hostname', 'pathname', 'protocol'].forEach(prop => {
            Object.defineProperty(this, prop, createPropertyDesc({
                get: () => getParsedOriginLocation()[prop],
                set: value => {
                    window.location = changeOriginUrlPart(window.location.toString(), prop, value, resourceType);

                    return value;
                }
            }));
        });

        this.assign   = url => window.location.assign(getProxiedHref(url));
        this.replace  = url => window.location.replace(getProxiedHref(url));
        this.reload   = forceget => window.location.reload(forceget);
        this.toString = () => getHref();
    }
}
