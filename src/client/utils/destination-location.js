import * as sharedUrlUtils from '../../utils/url';
import * as domUtils from './dom';
import { get as getSettings } from '../settings';

const DOCUMENT_URL_RESOLVER = 'hammerhead|document-url-resolver';

document[DOCUMENT_URL_RESOLVER] = document.createElement('a');

var forcedLocation = null;

function getLocation () {
    // NOTE: Used for testing. Unfortunately, we cannot override the 'getLocation' method in a test.
    if (forcedLocation)
        return forcedLocation;

    try {
        // NOTE: Fallback to the owner page's URL if we are in an iframe without src.
        if (window.frameElement && domUtils.isIframeWithoutSrc(window.frameElement))
            return getSettings().referer;
    }
        /*eslint-disable no-empty */
    catch (e) {
        // NOTE: Cross-domain iframe.
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
    // NOTE: IE cleans the document up after document.open is called.
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

        // NOTE: It looks like a Chrome bug: in a nested iframe without src (when an iframe is placed into another
        // iframe) you cannot set a relative link href while the iframe loading is not completed. So, we'll do it with
        // the parent's urlResolver Safari demonstrates similar behavior, but urlResolver.href has a relative URL value.
        var needUseParentResolver = url && isIframeWithoutSrc && window.parent && window.parent.document &&
                                    (!urlResolver.href || urlResolver.href.indexOf('/') === 0);

        if (needUseParentResolver)
            return resolveUrl(url, window.parent.document);
    }

    return urlResolver.href;
}

export function get () {
    var location = getLocation();

    return sharedUrlUtils.parseProxyUrl(location).destUrl;
}

export function withHash (hash) {
    var location = get();

    // NOTE: Remove the previous hash if there is any.
    location = location.replace(/(#.*)$/, '');

    return location + hash;
}

export function getCookiePathPrefix () {
    var parsedLocation = sharedUrlUtils.parseProxyUrl(getLocation());

    return parsedLocation.partAfterHost.replace(parsedLocation.destResourceInfo.partAfterHost, '');
}

export function getParsed () {
    var resolver   = getResolver(document);
    var dest       = get();
    var parsedDest = sharedUrlUtils.parseUrl(dest);

    // NOTE: IE browser adds the default port for the https protocol while resolving.
    resolver.href = get();

    // NOTE: IE ignores the first '/' symbol in the pathname.
    var pathname = resolver.pathname.indexOf('/') === 0 ? resolver.pathname : '/' + resolver.pathname;

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

export function getOrigin () {
    return sharedUrlUtils.getDomain(getParsed());
}
