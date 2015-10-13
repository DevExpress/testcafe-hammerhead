import * as sharedUrlUtils from '../../utils/url';
import { isIframeWithoutSrc } from './dom';
import { get as getSettings } from '../settings';

const DOCUMENT_URL_RESOLVER = 'hammerhead|document-url-resolver';

document[DOCUMENT_URL_RESOLVER] = document.createElement('a');

var forcedLocation = null;

function getLocation () {
    // NOTE: Used for testing. Unfortunately, we cannot override the 'getLocation' method in a test.
    if (forcedLocation)
        return forcedLocation;

    try {
        // NOTE: fallback to the owner page's URL if we are in the iframe without src
        if (window.frameElement && isIframeWithoutSrc(window.frameElement))
            return getSettings().referer;
    }
        /*eslint-disable no-empty */
    catch (e) {
        // NOTE: Cross-domain iframe
    }
    /*eslint-enable no-empty */

    return window.location.toString();
}

// NOTE: We need to be able to force the page location. During the test, Hammerhead should think that it is on the
// proxied page, not in the test environment. Unfortunately, we cannot do it in any other way.
export function forceLocation (url) {
    forcedLocation = url;
}

export function sameOriginCheck (location, checkedUrl) {
    if (checkedUrl)
        checkedUrl = resolveUrl(checkedUrl);

    return sharedUrlUtils.sameOriginCheck(location, checkedUrl);
}

export function getResolver (doc) {
    // IE clean up document after document.open call
    if (!doc[DOCUMENT_URL_RESOLVER])
        doc[DOCUMENT_URL_RESOLVER] = doc.createElement('a');

    return doc[DOCUMENT_URL_RESOLVER];
}

export function resolveUrl (url, doc) {
    url = sharedUrlUtils.prepareUrl(url);

    if (url && url.indexOf('//') === 0)
        url = getParsed().protocol + url;

    var urlResolver = getResolver(doc || document);

    if (url === null)
        urlResolver.removeAttribute('href');
    else {
        urlResolver.href = url;

        //NOTE: it looks like a chrome bug: in nested iframe without src (when iframe is placed in another iframe) you
        //cannot set relative link href for some time while the iframe loading is not completed. So, we'll do it with
        //parent's urlResolver
        //In Safari presents equal behaviour,
        // but urlResolver.href has relative url value
        var needUseParentResolver = url && isIframeWithoutSrc && window.parent && window.parent.document &&
                                    (!urlResolver.href || urlResolver.href.indexOf('/') === 0);

        if (needUseParentResolver)
            return resolveUrl(url, window.parent.document);
    }

    return urlResolver.href;
}

export function get () {
    var location = getLocation();

    return sharedUrlUtils.parseProxyUrl(location).originUrl;
}

export function withHash (hash) {
    var location = get();

    // NOTE: remove previous hash if we have one
    location = location.replace(/(#.*)$/, '');

    return location + hash;
}

export function getCookiePathPrefix () {
    var parsedLocation = sharedUrlUtils.parseProxyUrl(getLocation());

    return parsedLocation.partAfterHost.replace(parsedLocation.originResourceInfo.partAfterHost, '');
}

export function getParsed () {
    var resolver     = getResolver(document);
    var origin       = get();
    var parsedOrigin = sharedUrlUtils.parseUrl(origin);

    // NOTE: IE "browser" adds default port for the https protocol while resolving
    resolver.href = get();

    // NOTE: IE ignores first '/' symbol in the pathname
    var pathname = resolver.pathname.indexOf('/') === 0 ? resolver.pathname : '/' + resolver.pathname;

    //TODO describe default ports logic
    return {
        protocol: resolver.protocol,
        // NOTE: remove default port
        port:     parsedOrigin.port ? resolver.port : '',
        hostname: resolver.hostname,
        // NOTE: remove default port form the host
        host:     parsedOrigin.port ? resolver.host : resolver.host.replace(/:\d+$/, ''),
        pathname: pathname,
        hash:     resolver.hash,
        search:   resolver.search
    };
}

