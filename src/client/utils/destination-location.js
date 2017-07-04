import * as sharedUrlUtils from '../../utils/url';
import * as domUtils from './dom';
import * as urlResolver from './url-resolver';
import settings from '../settings';

let forcedLocation = null;

function getLocation () {
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
    url = sharedUrlUtils.prepareUrl(url);

    if (url && url.indexOf('//') === 0)
        url = getParsed().protocol + url;

    return urlResolver.resolve(url, doc || document);
}

export function get () {
    const location = getLocation();

    return sharedUrlUtils.parseProxyUrl(location).destUrl;
}

export function withHash (hash) {
    let location = get();

    // NOTE: Remove the previous hash if there is any.
    location = location.replace(/(#.*)$/, '');

    return location + hash;
}

export function getCookiePathPrefix () {
    const parsedLocation = sharedUrlUtils.parseProxyUrl(getLocation());

    return parsedLocation.partAfterHost.replace(parsedLocation.destResourceInfo.partAfterHost, '');
}

export function getParsed () {
    const resolver   = urlResolver.getResolverElement(document);
    const dest       = get();
    const parsedDest = sharedUrlUtils.parseUrl(dest);

    // NOTE: IE browser adds the default port for the https protocol while resolving.
    resolver.href = get();

    // NOTE: IE ignores the first '/' symbol in the pathname.
    const pathname = resolver.pathname.indexOf('/') === 0 ? resolver.pathname : '/' + resolver.pathname;

    // TODO: Describe default ports logic.
    return {
        protocol: resolver.protocol,
        // NOTE: Remove the default port.
        port:     parsedDest.port ? resolver.port : '',
        hostname: resolver.hostname,
        // NOTE: Remove the default port from the host.
        host:     parsedDest.port ? resolver.host : resolver.host.replace(/:\d+$/, ''),
        pathname: pathname,
        hash:     resolver.hash,
        search:   resolver.search
    };
}

export function getOriginHeader () {
    const parsedDest = getParsed();

    return parsedDest.protocol === 'file:' ? get() : sharedUrlUtils.getDomain(parsedDest);
}
