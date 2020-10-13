import * as sharedUrlUtils from '../../utils/url';
import * as domUtils from './dom';
import * as urlResolver from './url-resolver';
import { PATHNAME_IN_IFRAME_WITHOUT_SRC_IN_FIREFOX, SPECIAL_BLANK_PAGE } from '../../utils/url';
import nativeMethods from '../sandbox/native-methods';
import getGlobalContextInfo from './global-context-info';
import { isFirefox } from './browser';

let forcedLocation = null;

export function inIframeWithourSrc (): boolean {
    const globalCtx    = getGlobalContextInfo().global;
    const frameElement = domUtils.getFrameElement(globalCtx);

    return frameElement && domUtils.isIframeWithoutSrc(frameElement);
}

// NOTE: exposed only for tests
export function getLocation (): string {
    // NOTE: Used for testing. Unfortunately, we cannot override the 'getLocation' method in a test.
    if (forcedLocation)
        return forcedLocation;

    const globalCtx = getGlobalContextInfo().global;

    if (inIframeWithourSrc())
        return SPECIAL_BLANK_PAGE;

    return globalCtx.location.toString();
}

// NOTE: We need to be able to force the page location. During the test, Hammerhead should think that it is on the
// proxied page, not in the test environment. Unfortunately, we cannot do it in any other way.
export function forceLocation (url: string): void {
    forcedLocation = url;
}

export function sameOriginCheck (location: string, checkedUrl: string): boolean {
    if (checkedUrl)
        checkedUrl = resolveUrl(checkedUrl);

    return sharedUrlUtils.sameOriginCheck(location, checkedUrl);
}

export function resolveUrl (url: string, doc?: Document): string {
    url = sharedUrlUtils.getURLString(url);

    if (url && url.indexOf('//') === 0) {
        // eslint-disable-next-line no-restricted-properties
        const pageProtocol = getParsed().protocol;

        url = pageProtocol + sharedUrlUtils.correctMultipleSlashes(url, pageProtocol);
    }
    else
        url = sharedUrlUtils.correctMultipleSlashes(url);

    return typeof document !== 'undefined'
    // @ts-ignore
        ? urlResolver.resolve(url, doc || document)
        : new nativeMethods.URL(url, get()).href; // eslint-disable-line no-restricted-properties
}

export function get (): string {
    const location       = getLocation();
    const parsedProxyUrl = sharedUrlUtils.parseProxyUrl(location);

    return parsedProxyUrl ? parsedProxyUrl.destUrl : location;
}

export function withHash (hash: string): string {
    let location = get();

    // NOTE: Remove the previous hash if there is any.
    location = location.replace(/(#.*)$/, '');

    return location + hash;
}

function parseLocationThroughAnchor (url: string) {
    // @ts-ignore
    const resolver = urlResolver.getResolverElement(document);

    // eslint-disable-next-line no-restricted-properties
    const destPort = sharedUrlUtils.parseUrl(url).port;

    const hrefValue = get();

    // NOTE: IE browser adds the default port for the https protocol while resolving.
    nativeMethods.anchorHrefSetter.call(resolver, hrefValue);

    const hostname = nativeMethods.anchorHostnameGetter.call(resolver);
    let pathname   = nativeMethods.anchorPathnameGetter.call(resolver);

    // NOTE: IE ignores the first '/' symbol in the pathname.
    if (hrefValue !== SPECIAL_BLANK_PAGE && pathname.charAt(0) !== '/')
        pathname = '/' + pathname;

    if (hrefValue === SPECIAL_BLANK_PAGE && isFirefox)
        pathname = PATHNAME_IN_IFRAME_WITHOUT_SRC_IN_FIREFOX;

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
        origin:   nativeMethods.anchorOriginGetter ? nativeMethods.anchorOriginGetter.call(resolver) : null
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
        origin:   parsedUrl.origin
    };
    /* eslint-enable no-restricted-properties */
}

export function getParsed () {
    const dest = get();

    return typeof document !== 'undefined' ? parseLocationThroughAnchor(dest) : parseLocationThroughURL(dest);
}

export function getOriginHeader (): string {
    const parsedDest = getParsed();

    // eslint-disable-next-line no-restricted-properties
    return parsedDest.protocol === 'file:' ? get() : sharedUrlUtils.getDomain(parsedDest);
}
