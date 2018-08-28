import * as sharedUrlUtils from '../../utils/url';
import * as domUtils from './dom';
import * as urlResolver from './url-resolver';
import settings from '../settings';
import nativeMethods from '../sandbox/native-methods';

let forcedLocation = null;

// NOTE: exposed only for tests
export function getLocation () {
    // NOTE: Used for testing. Unfortunately, we cannot override the 'getLocation' method in a test.
    if (forcedLocation)
        return forcedLocation;

    const frameElement = domUtils.getFrameElement(window);

    // NOTE: Fallback to the owner page's URL if we are in an iframe without src.
    if (frameElement && domUtils.isIframeWithoutSrc(frameElement))
        return settings.get().referer;

    return window.location.toString();
}

// NOTE: We need to be able to force the page location. During the test, Hammerhead should think that it is on the
// proxied page, not in the test environment. Unfortunately, we cannot do it in any other way.
export function forceLocation (url) {
    forcedLocation = url;
}

export function sameOriginCheck (location, checkedUrl, rejectForSubdomains) {
    if (checkedUrl)
        checkedUrl = resolveUrl(checkedUrl);

    return sharedUrlUtils.sameOriginCheck(location, checkedUrl, rejectForSubdomains);
}

export function resolveUrl (url, doc) {
    url = sharedUrlUtils.getURLString(url);

    if (url && url.indexOf('//') === 0) {
        // eslint-disable-next-line no-restricted-properties
        const pageProtocol = getParsed().protocol;

        url = pageProtocol + sharedUrlUtils.correctMultipleSlashes(url, pageProtocol);
    }
    else
        url = sharedUrlUtils.correctMultipleSlashes(url);

    return urlResolver.resolve(url, doc || document);
}

export function get () {
    const location       = getLocation();
    const parsedProxyUrl = sharedUrlUtils.parseProxyUrl(location);

    return parsedProxyUrl ? parsedProxyUrl.destUrl : location;
}

export function withHash (hash) {
    let location = get();

    // NOTE: Remove the previous hash if there is any.
    location = location.replace(/(#.*)$/, '');

    return location + hash;
}

export function getParsed () {
    const resolver = urlResolver.getResolverElement(document);
    const dest     = get();

    // eslint-disable-next-line no-restricted-properties
    const destPort = sharedUrlUtils.parseUrl(dest).port;

    // NOTE: IE browser adds the default port for the https protocol while resolving.
    nativeMethods.anchorHrefSetter.call(resolver, get());

    const hostname = nativeMethods.anchorHostnameGetter.call(resolver);
    let pathname   = nativeMethods.anchorPathnameGetter.call(resolver);

    // NOTE: IE ignores the first '/' symbol in the pathname.
    if (pathname.indexOf('/') !== 0)
        pathname = '/' + pathname;

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
        search:   nativeMethods.anchorSearchGetter.call(resolver)
    };
}

export function getOriginHeader () {
    const parsedDest = getParsed();

    // eslint-disable-next-line no-restricted-properties
    return parsedDest.protocol === 'file:' ? get() : sharedUrlUtils.getDomain(parsedDest);
}
