import EventEmitter from '../../../utils/event-emitter';
import createPropertyDesc from '../../../utils/create-property-desc';
import { get as getDestLocation, getParsed as getParsedDestLocation } from '../../../utils/destination-location';
import {
    getProxyUrl,
    changeDestUrlPart,
    parseProxyUrl,
    parseResourceType,
    isChangedOnlyHash,
    getCrossDomainProxyPort
} from '../../../utils/url';
import { getDomain, getResourceTypeString, sameOriginCheck } from '../../../../utils/url';
import nativeMethods from '../../native-methods';

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
        const parsedLocation       = parseProxyUrl(getLocationUrl(window));
        const locationResourceType = parsedLocation ? parsedLocation.resourceType : '';
        const parsedResourceType   = parseResourceType(locationResourceType);

        parsedResourceType.isIframe |= window !== window.top;

        const resourceType   = getResourceTypeString({
            isIframe: parsedResourceType.isIframe,
            isForm:   parsedResourceType.isForm
        });
        const getHref        = () => {
            if (window !== window.top && window.location.href === 'about:blank')
                return 'about:blank';

            return getDestLocation();
        };
        const getProxiedHref = href => {
            const locationUrl = getLocationUrl(window);

            let proxyPort = null;

            if (window !== window.parent) {
                const parentLocationUrl       = getLocationUrl(window.parent);
                const parsedParentLocationUrl = parseProxyUrl(parentLocationUrl);

                if (parsedParentLocationUrl && parsedParentLocationUrl.proxy) {
                    const parentProxyPort = parsedParentLocationUrl.proxy.port;

                    proxyPort = sameOriginCheck(parentLocationUrl, href)
                        ? parentProxyPort
                        : getCrossDomainProxyPort(parentProxyPort);
                }
            }

            const changedOnlyHash     = locationUrl && isChangedOnlyHash(locationUrl, href);
            const currentResourceType = changedOnlyHash ? locationResourceType : resourceType;

            return getProxyUrl(href, { resourceType: currentResourceType, proxyPort });
        };
        const urlProps       = ['port', 'host', 'hostname', 'pathname', 'protocol'];

        nativeMethods.objectDefineProperty.call(window.Object, this, 'href', createPropertyDesc({
            get: getHref,
            set: href => {
                const proxiedHref = getProxiedHref(href);

                window.location.href = proxiedHref;
                onChanged(proxiedHref);

                return href;
            }
        }));

        nativeMethods.objectDefineProperty.call(window.Object, this, 'search', createPropertyDesc({
            get: () => window.location.search,
            set: search => {
                const newLocation = changeDestUrlPart(window.location.toString(), 'search', search, resourceType);

                window.location = newLocation;
                onChanged(newLocation);

                return search;
            }
        }));

        nativeMethods.objectDefineProperty.call(window.Object, this, 'origin', createPropertyDesc({
            get: () => getDomain(getParsedDestLocation()),
            set: origin => origin
        }));

        nativeMethods.objectDefineProperty.call(window.Object, this, 'hash', createPropertyDesc({
            get: () => window.location.hash,
            set: hash => {
                window.location.hash = hash;

                return hash;
            }
        }));

        const overrideProperty = property => {
            nativeMethods.objectDefineProperty.call(window.Object, this, property, createPropertyDesc({
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
