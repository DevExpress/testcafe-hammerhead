import { get as getDestLocation, getParsed as getParsedDestLocation } from '../../../utils/destination-location';
import {
    getProxyUrl,
    changeDestUrlPart,
    parseProxyUrl,
    parseResourceType,
    isChangedOnlyHash,
    getCrossDomainProxyPort
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
import DomProcessor from '../../../../processing/dom/index';
import DOMStringListWrapper from './ancestor-origins-wrapper';
import createIntegerIdGenerator from '../../../utils/integer-id-generator';
import { createOverriddenDescriptor } from '../../../utils/property-overriding';

const GET_ORIGIN_CMD      = 'hammerhead|command|get-origin';
const ORIGIN_RECEIVED_CMD = 'hammerhead|command|origin-received';

function getLocationUrl (window: Window) {
    try {
        return window.location.toString();
    }
    catch (e) {
        return void 0;
    }
}

export default class LocationWrapper {
    constructor (window: Window, messageSandbox?, onChanged?) {
        const parsedLocation         = parseProxyUrl(getLocationUrl(window));
        const locationResourceType   = parsedLocation ? parsedLocation.resourceType : '';
        const parsedResourceType     = parseResourceType(locationResourceType);
        // @ts-ignore
        const isLocationPropsInProto = nativeMethods.objectHasOwnProperty.call(window.Location.prototype, 'href');
        // @ts-ignore
        const locationPropsOwner     = isLocationPropsInProto ? window.Location.prototype : window.location;
        const locationProps: any     = {};

        parsedResourceType.isIframe = parsedResourceType.isIframe || window !== window.top;

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

            if (DomProcessor.isJsProtocol(href))
                return DomProcessor.processJsAttrValue(href, { isJsProtocol: true, isEventAttr: false });

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

        // eslint-disable-next-line no-restricted-properties
        locationProps.href = createOverriddenDescriptor(locationPropsOwner, 'href', {
            getter: getHref,
            setter: href => {
                const proxiedHref = getProxiedHref(href);

                // eslint-disable-next-line no-restricted-properties
                window.location.href = proxiedHref;

                onChanged(proxiedHref);

                return href;
            }
        });

        // eslint-disable-next-line no-restricted-properties
        locationProps.search = createOverriddenDescriptor(locationPropsOwner, 'search', {
            // eslint-disable-next-line no-restricted-properties
            getter: () => window.location.search,
            setter: search => {
                const newLocation = changeDestUrlPart(window.location.toString(), nativeMethods.anchorSearchSetter, search, resourceType);

                window.location = newLocation;
                onChanged(newLocation);

                return search;
            }
        });

        // eslint-disable-next-line no-restricted-properties
        locationProps.origin = createOverriddenDescriptor(locationPropsOwner, 'origin', {
            getter: () => getDomain(getParsedDestLocation()),
            setter: origin => origin
        });

        locationProps.hash = createOverriddenDescriptor(locationPropsOwner, 'hash', {
            getter: () => window.location.hash,
            setter: hash => {
                window.location.hash = hash;

                return hash;
            }
        });

        if (window.location.ancestorOrigins) {
            const callbacks   = nativeMethods.objectCreate(null);
            const idGenerator = createIntegerIdGenerator();

            const getCrossDomainOrigin = (win, callback) => {
                const id = idGenerator.increment();

                callbacks[id] = callback;

                messageSandbox.sendServiceMsg({ id, cmd: GET_ORIGIN_CMD }, win);
            };

            messageSandbox.on(messageSandbox.SERVICE_MSG_RECEIVED_EVENT, ({ message, source }) => {
                if (message.cmd === GET_ORIGIN_CMD) {
                    // @ts-ignore
                    messageSandbox.sendServiceMsg({ id: message.id, cmd: ORIGIN_RECEIVED_CMD, origin: this.origin }, source);// eslint-disable-line no-restricted-properties
                }
                else if (message.cmd === ORIGIN_RECEIVED_CMD) {
                    const callback = callbacks[message.id];

                    if (callback)
                        callback(message.origin); // eslint-disable-line no-restricted-properties
                }
            });

            const ancestorOrigins = new DOMStringListWrapper(window, getCrossDomainOrigin);

            locationProps.ancestorOrigins = createOverriddenDescriptor(locationPropsOwner, 'ancestorOrigins', {
                getter: () => ancestorOrigins
            });
        }

        const createLocationPropertyDesc = (property, nativePropSetter) => {
            locationProps[property] = createOverriddenDescriptor(locationPropsOwner, property, {
                getter: () => getParsedDestLocation()[property],
                setter: value => {
                    const newLocation = changeDestUrlPart(window.location.toString(), nativePropSetter, value, resourceType);

                    window.location = newLocation;
                    onChanged(newLocation);

                    return value;
                }
            });
        };

        createLocationPropertyDesc('port', nativeMethods.anchorPortSetter);
        createLocationPropertyDesc('host', nativeMethods.anchorHostSetter);
        createLocationPropertyDesc('hostname', nativeMethods.anchorHostnameSetter);
        createLocationPropertyDesc('pathname', nativeMethods.anchorPathnameSetter);
        createLocationPropertyDesc('protocol', nativeMethods.anchorProtocolSetter);

        locationProps.assign = createOverriddenDescriptor(locationPropsOwner, 'assign', {
            value: url => {
                const proxiedHref = getProxiedHref(url);
                const result      = window.location.assign(proxiedHref);

                onChanged(proxiedHref);

                return result;
            }
        });

        locationProps.replace = createOverriddenDescriptor(locationPropsOwner, 'replace', {
            value: url => {
                const proxiedHref = getProxiedHref(url);
                const result      = window.location.replace(proxiedHref);

                onChanged(proxiedHref);

                return result;
            }
        });

        locationProps.reload = createOverriddenDescriptor(locationPropsOwner, 'reload', {
            value: forcedReload => {
                const result = window.location.reload(forcedReload);

                onChanged(window.location.toString());

                return result;
            }
        });

        locationProps.toString = createOverriddenDescriptor(locationPropsOwner, 'toString', { value: getHref });

        if (!isLocationPropsInProto && nativeMethods.objectHasOwnProperty.call(window.location, 'valueOf'))
            locationProps.valueOf  = createOverriddenDescriptor(locationPropsOwner, 'valueOf', { value: () => this });

        nativeMethods.objectDefineProperties(this, locationProps);
    }
}
