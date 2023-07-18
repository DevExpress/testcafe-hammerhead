import * as sharedUrlUtils from '../../utils/url';
import * as domUtils from './dom';
import urlResolver from './url-resolver';
import settings from '../settings';
import nativeMethods from '../sandbox/native-methods';
import globalContextInfo from './global-context-info';

let forcedLocation = null;

// NOTE: exposed only for tests
export function getLocation (): string {
    // NOTE: Used for testing. Unfortunately, we cannot override the 'getLocation' method in a test.
    if (forcedLocation)
        return forcedLocation;

    const frameElement = domUtils.getFrameElement(globalContextInfo.global);

    // NOTE: Fallback to the owner page's URL if we are in an iframe without src.
    if (frameElement && domUtils.isIframeWithoutSrc(frameElement))
        return settings.get().referer;

    return globalContextInfo.global.location.toString();
}

// NOTE: We need to be able to force the page location. During the test, Hammerhead should think that it is on the
// proxied page, not in the test environment. Unfortunately, we cannot do it in any other way.
export function forceLocation (url: string): void {
    forcedLocation = url;
}

export function sameOriginCheck (location: string, checkedUrl: string | URL): boolean {
    if (checkedUrl)
        checkedUrl = resolveUrl(checkedUrl);

    return settings.get().disableCrossDomain || sharedUrlUtils.sameOriginCheck(location, checkedUrl);
}

export function resolveUrl (url: string | URL, doc?: Document): string {
    let preProcessedUrl = sharedUrlUtils.getURLString(url);

    if (preProcessedUrl && preProcessedUrl.indexOf('//') === 0) {
        // eslint-disable-next-line no-restricted-properties
        const pageProtocol = getParsed().protocol;

        preProcessedUrl = pageProtocol + sharedUrlUtils.correctMultipleSlashes(preProcessedUrl, pageProtocol);
    }
    else
        preProcessedUrl = sharedUrlUtils.correctMultipleSlashes(preProcessedUrl);

    if (globalContextInfo.isInWorker) {
        if (self.location.protocol !== 'blob:') // eslint-disable-line no-restricted-properties
            return new nativeMethods.URL(preProcessedUrl, get()).href; // eslint-disable-line no-restricted-properties

        return String(url);
    }

    return urlResolver.resolve(preProcessedUrl, doc || document);
}

export let get = function (): string {
    const location       = getLocation();
    const parsedProxyUrl = sharedUrlUtils.parseProxyUrl(location);

    return parsedProxyUrl ? parsedProxyUrl.destUrl : location;
};

export function getReferrer () {
    const location       = getLocation();
    const parsedProxyUrl = sharedUrlUtils.parseProxyUrl(location);

    return parsedProxyUrl?.reqOrigin ? parsedProxyUrl.reqOrigin + '/' : '';
}

export function overrideGet (func: typeof get) {
    get = func;
}

export function withHash (hash: string): string {
    let location = get();

    // NOTE: Remove the previous hash if there is any.
    location = location.replace(/(#.*)$/, '');

    return location + hash;
}

function parseLocationThroughAnchor (url: string) {
    const resolver = urlResolver.getResolverElement(document);

    // eslint-disable-next-line no-restricted-properties
    const destPort = sharedUrlUtils.parseUrl(url).port;

    nativeMethods.anchorHrefSetter.call(resolver, get());

    const hostname = nativeMethods.anchorHostnameGetter.call(resolver);
    const pathname = nativeMethods.anchorPathnameGetter.call(resolver);

    // TODO: Describe default ports logic.
    return {
        protocol: nativeMethods.anchorProtocolGetter.call(resolver),
        // NOTE: Remove the default port.
        port:     destPort ? nativeMethods.anchorPortGetter.call(resolver) : '',
        hostname: hostname,
        // NOTE: Remove the default port from the host.
        host:     destPort ? nativeMethods.anchorHostGetter.call(resolver) : hostname,
        pathname: pathname,
        hash:     resolver.hash,
        search:   nativeMethods.anchorSearchGetter.call(resolver),
    };
}

function parseLocationThroughURL (url: string) {
    const parsedUrl = new nativeMethods.URL(url);

    /* eslint-disable no-restricted-properties */
    return {
        protocol: parsedUrl.protocol,
        port:     parsedUrl.port,
        hostname: parsedUrl.hostname,
        host:     parsedUrl.host,
        pathname: parsedUrl.pathname,
        hash:     parsedUrl.hash,
        search:   parsedUrl.search,
    };
    /* eslint-enable no-restricted-properties */
}

export function getParsed () {
    const dest = get();

    return globalContextInfo.isInWorker ? parseLocationThroughURL(dest) : parseLocationThroughAnchor(dest);
}

export function getOriginHeader (): string {
    return sharedUrlUtils.getDomain(getParsed());
}
