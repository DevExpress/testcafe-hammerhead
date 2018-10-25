import EventEmitter from '../../../utils/event-emitter';
import createPropertyDesc from '../../../utils/create-property-desc';
import { get as getDestLocation, getParsed as getParsedDestLocation } from '../../../utils/destination-location';
import {
    getProxyUrl,
    changeDestUrlPart,
    parseProxyUrl,
    parseResourceType,
    isChangedOnlyHash,
    getCrossDomainProxyPort,
    getProxiedUrlOrigin
} from '../../../utils/url';
import {
    getDomain,
    getResourceTypeString,
    sameOriginCheck,
    ensureTrailingSlash,
    prepareUrl
} from '../../../../utils/url';
import nativeMethods from '../../native-methods';
import urlResolver from '../../../utils/url-resolver';
import { processJsAttrValue, isJsProtocol } from '../../../../processing/dom/index';
import { isCrossDomainWindows, getParentWindowWithSrc } from '../../../utils/dom';
import DOMStringListWrapper from './dom-string-list-wrapper';

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
            // eslint-disable-next-line no-restricted-properties
            if (window !== window.top && window.location.href === 'about:blank')
                return 'about:blank';

            const locationUrl    = getDestLocation();
            const resolveElement = urlResolver.getResolverElement(window.document);

            nativeMethods.anchorHrefSetter.call(resolveElement, locationUrl);

            const href = nativeMethods.anchorHrefGetter.call(resolveElement);

            return ensureTrailingSlash(href, locationUrl);
        };
        const getProxiedHref = href => {
            if (typeof href !== 'string')
                href = String(href);

            href = prepareUrl(href);

            if (isJsProtocol(href))
                return processJsAttrValue(href, { isJsProtocol: true, isEventAttr: false });

            const locationUrl = getLocationUrl(window);

            let proxyPort = null;

            if (window !== window.parent) {
                const parentLocationUrl       = getLocationUrl(window.parent);
                const parsedParentLocationUrl = parseProxyUrl(parentLocationUrl);

                if (parsedParentLocationUrl && parsedParentLocationUrl.proxy) {
                    // eslint-disable-next-line no-restricted-properties
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

        nativeMethods.objectDefineProperty.call(window.Object, this, 'href', createPropertyDesc({
            get: getHref,
            set: href => {
                const proxiedHref = getProxiedHref(href);

                // eslint-disable-next-line no-restricted-properties
                window.location.href = proxiedHref;

                onChanged(proxiedHref);

                return href;
            }
        }));

        nativeMethods.objectDefineProperty.call(window.Object, this, 'search', createPropertyDesc({
            // eslint-disable-next-line no-restricted-properties
            get: () => window.location.search,

            set: search => {
                const newLocation = changeDestUrlPart(window.location.toString(), nativeMethods.anchorSearchSetter, search, resourceType);

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

        if (window.location.ancestorOrigins) {
            nativeMethods.objectDefineProperty.call(window.Object, this, 'ancestorOrigins', {
                get: () => {
                    const nativeAncestorOrigins       = window.location.ancestorOrigins;
                    const nativeAncestorOriginsLength = nativeAncestorOrigins.length;
                    let parentWindow                  = window;
                    const ancestorOrigins             = [];

                    if (!isCrossDomainWindows(window, window.top)) {
                        for (let i = 0; i < nativeAncestorOriginsLength; i++) {
                            parentWindow = parentWindow.parent;

                            const parentLocationUrl = getLocationUrl(parentWindow);

                            if (parentLocationUrl === 'about:blank') {
                                const parentWindowWithSrc            = getParentWindowWithSrc(parentWindow);
                                const parentWindowWithSrcLocationURL = getLocationUrl(parentWindowWithSrc);
                                const parentWindowWithSrcOrigin      = getProxiedUrlOrigin(parentWindowWithSrcLocationURL);

                                ancestorOrigins.push(parentWindowWithSrcOrigin);
                            }
                            else {
                                const parentLocationOrigin = getProxiedUrlOrigin(parentLocationUrl);

                                ancestorOrigins.push(parentLocationOrigin);
                            }
                        }
                    }
                    else {
                        for (let i = 0; i < nativeAncestorOriginsLength; i++)
                            ancestorOrigins.push('cross-domain-ancestor-chain');
                    }

                    return new DOMStringListWrapper(nativeAncestorOrigins, ancestorOrigins);
                }
            });
        }

        const overrideProperty = (property, nativePropSetter) => {
            nativeMethods.objectDefineProperty.call(window.Object, this, property, createPropertyDesc({
                get: () => getParsedDestLocation()[property],
                set: value => {
                    const newLocation = changeDestUrlPart(window.location.toString(), nativePropSetter, value, resourceType);

                    window.location = newLocation;
                    onChanged(newLocation);

                    return value;
                }
            }));
        };

        overrideProperty('port', nativeMethods.anchorPortSetter);
        overrideProperty('host', nativeMethods.anchorHostSetter);
        overrideProperty('hostname', nativeMethods.anchorHostnameSetter);
        overrideProperty('pathname', nativeMethods.anchorPathnameSetter);
        overrideProperty('protocol', nativeMethods.anchorProtocolSetter);

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
