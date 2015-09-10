import sharedUrlUtil from '../../utils/url';
import { isCrossDomainWindows } from '../utils/dom';
import { getAttribute as nativeGetAttribute } from '../sandbox/native-methods';
import { DOM_SANDBOX_STORED_ATTR_POSTFIX } from '../../const';
import { get as getSettings } from '../settings';

var urlUtil = {};

//URL processing funcs
urlUtil.DOCUMENT_URL_RESOLVER               = 'doc_url_resolver_8ff20d5e';
urlUtil.REQUEST_DESCRIPTOR_VALUES_SEPARATOR = sharedUrlUtil.REQUEST_DESCRIPTOR_VALUES_SEPARATOR;

urlUtil.IFRAME = sharedUrlUtil.IFRAME;
urlUtil.SCRIPT = sharedUrlUtil.SCRIPT;

document[urlUtil.DOCUMENT_URL_RESOLVER] = document.createElement('a');

function getResolver (doc) {
    // IE clean up document after document.open call
    if (!doc[urlUtil.DOCUMENT_URL_RESOLVER])
        doc[urlUtil.DOCUMENT_URL_RESOLVER] = doc.createElement('a');

    return doc[urlUtil.DOCUMENT_URL_RESOLVER];
}

urlUtil.getProxyUrl = function (url, proxyHostname, proxyPort, sessionId, resourceType) {
    if (!urlUtil.isSupportedProtocol(url))
        return url;

    // NOTE: resolve relative URLs
    url = urlUtil.resolveUrl(url);

    // NOTE: if we have a relative URL without slash (e.g. 'img123') resolver will keep
    // original proxy information, so we can return such URL as is. TODO: implement is proxy URL func
    var parsedAsProxy   = sharedUrlUtil.parseProxyUrl(url);
    var isValidProxyUrl = !!parsedAsProxy;

    if (isValidProxyUrl) {
        if (resourceType && parsedAsProxy.resourceType === resourceType)
            return url;

        // NOTE: we need to change proxy url resource type
        var destUrl = sharedUrlUtil.formatUrl(parsedAsProxy.originResourceInfo);

        return urlUtil.getProxyUrl(destUrl, proxyHostname, proxyPort, sessionId, resourceType);
    }

    proxyHostname = proxyHostname || location.hostname;
    proxyPort     = proxyPort || location.port.toString();
    sessionId     = sessionId || getSettings().sessionId;

    var parsedUrl = sharedUrlUtil.parseUrl(url);

    // NOTE: seems like we've had a relative URL with leading slash or dots,
    // so our proxy info path part was removed by resolver and we have an origin URL,
    // but with incorrect host and protocol.
    if (parsedUrl.protocol === 'http:' && parsedUrl.hostname === proxyHostname && parsedUrl.port === proxyPort) {
        var parsedOriginLocation = urlUtil.OriginLocation.getParsed();

        parsedUrl.protocol = parsedOriginLocation.protocol;
        parsedUrl.host     = parsedOriginLocation.host;
        parsedUrl.hostname = parsedOriginLocation.hostname;
        parsedUrl.port     = parsedOriginLocation.port || '';

        url = sharedUrlUtil.formatUrl(parsedUrl);
    }


    return sharedUrlUtil.getProxyUrl(url, proxyHostname, proxyPort, sessionId, resourceType);
};

urlUtil.getCrossDomainIframeProxyUrl = function (url) {
    return urlUtil.getProxyUrl(url, null, getSettings().crossDomainProxyPort, null, urlUtil.IFRAME);
};

urlUtil.getCrossDomainProxyUrl = function () {
    return location.protocol + '//' + location.hostname + ':' + getSettings().crossDomainProxyPort + '/';
};

urlUtil.resolveUrl = function (url, doc) {
    url = sharedUrlUtil.prepareUrl(url);

    if (url && url.indexOf('//') === 0)
        url = urlUtil.OriginLocation.getParsed().protocol + url;

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
        var needUseParentResolver = url && isIFrameWithoutSrc && window.parent && window.parent.document &&
                                    (!urlResolver.href || urlResolver.href.indexOf('/') === 0);

        if (needUseParentResolver)
            return urlUtil.resolveUrl(url, window.parent.document);
    }

    return urlResolver.href;
};

urlUtil.resolveUrlAsOrigin = function (url) {
    return sharedUrlUtil.resolveUrlAsOrigin(url, urlUtil.getProxyUrl);
};

urlUtil.formatUrl = function (parsedUrl) {
    return sharedUrlUtil.formatUrl(parsedUrl);
};

urlUtil.parseProxyUrl = function (proxyUrl) {
    return sharedUrlUtil.parseProxyUrl(proxyUrl);
};

urlUtil.parseUrl = function (url) {
    return sharedUrlUtil.parseUrl(url);
};

urlUtil.convertToProxyUrl = function (url, resourceType) {
    return urlUtil.getProxyUrl(url, null, null, null, resourceType);
};

urlUtil.changeOriginUrlPart = function (proxyUrl, prop, value, resourceType) {
    var parsed = sharedUrlUtil.parseProxyUrl(proxyUrl);

    if (parsed) {
        var resolver  = getResolver(document);
        var sessionId = parsed.sessionId;
        var proxy     = parsed.proxy;

        resolver.href  = parsed.originUrl;
        resolver[prop] = value;

        return urlUtil.getProxyUrl(resolver.href, proxy.hostname, proxy.port, sessionId, resourceType);
    }

    return proxyUrl;
};

urlUtil.isSubDomain = function (domain, subDomain) {
    return sharedUrlUtil.isSubDomain(domain, subDomain);
};

urlUtil.sameOriginCheck = function (location, checkedUrl) {
    if (checkedUrl)
        checkedUrl = urlUtil.resolveUrl(checkedUrl);

    return sharedUrlUtil.sameOriginCheck(location, checkedUrl);
};

urlUtil.isSupportedProtocol = function (url) {
    return sharedUrlUtil.isSupportedProtocol(url);
};

function getParentWindowWithSrc (window) {
    var parent = window.parent;

    if (window === window.top)
        return window;

    if (isCrossDomainWindows(window, parent))
        return parent;

    if (parent === window.top || !urlUtil.isIframeWithoutSrc(parent.frameElement))
        return parent;

    return getParentWindowWithSrc(parent);
}

urlUtil.isIframeWithoutSrc = function (iframe) {
    var iFrameLocation         = urlUtil.getIframeLocation(iframe);
    var iFrameSrcLocation      = iFrameLocation.srcLocation;
    var iFrameDocumentLocation = iFrameLocation.documentLocation;

    if (iFrameDocumentLocation === null) // is a cross-domain iframe
        return false;

    var iFrameDocumentLocationHaveSupportedProtocol = urlUtil.isSupportedProtocol(iFrameDocumentLocation);

    //NOTE: when an iFrame have empty src attribute (<iframe src></iframe>) the iframe.src property doesn't empty but it has different values
    //in different browsers. Its document location is 'about:blank'. Therefore we should check the src attribute.
    if (!iFrameDocumentLocationHaveSupportedProtocol && !(iframe.attributes['src'] && iframe.attributes['src'].value))
        return true;

    var parentWindowWithSrc  = getParentWindowWithSrc(iframe.contentWindow);
    var windowLocation       = parentWindowWithSrc.location.toString();
    var parsedWindowLocation = sharedUrlUtil.parseProxyUrl(windowLocation);

    if (iFrameDocumentLocation === (parsedWindowLocation ? parsedWindowLocation.originUrl : windowLocation) ||
        iFrameSrcLocation === (parsedWindowLocation ? parsedWindowLocation.originUrl : windowLocation))
        return true;


    // NOTE: in Chrome an iFrame with src has documentLocation 'about:blank' when it is just created. So, we should check
    // srcLocation in this case.
    if (iFrameSrcLocation && urlUtil.isSupportedProtocol(iFrameSrcLocation))
        return false;

    return !iFrameDocumentLocationHaveSupportedProtocol;
};

urlUtil.getIframeLocation = function (iframe) {
    var documentLocation = null;

    try {
        documentLocation = iframe.contentDocument.location.href;
    }
    catch (e) {
        documentLocation = null;
    }

    var srcLocation = nativeGetAttribute.call(iframe, 'src' + DOM_SANDBOX_STORED_ATTR_POSTFIX) ||
                      nativeGetAttribute.call(iframe, 'src') || iframe.src;

    var parsedProxyDocumentLocation = documentLocation && urlUtil.isSupportedProtocol(documentLocation) &&
                                      sharedUrlUtil.parseProxyUrl(documentLocation);
    var parsedProxySrcLocation      = srcLocation && urlUtil.isSupportedProtocol(srcLocation) &&
                                      sharedUrlUtil.parseProxyUrl(srcLocation);

    return {
        documentLocation: parsedProxyDocumentLocation ? parsedProxyDocumentLocation.originUrl : documentLocation,
        srcLocation:      parsedProxySrcLocation ? parsedProxySrcLocation.originUrl : srcLocation
    };
};

function getLocation () {
    try {
        // NOTE: fallback to the owner page's URL if we are in the iFrame without src
        if (window.frameElement && urlUtil.isIframeWithoutSrc(window.frameElement))
            return getSettings().referer;
    }
        /*eslint-disable no-empty */
    catch (e) {
        // NOTE: Cross-domain iframe
    }
    /*eslint-enable no-empty */

    return window.location.toString();
}

urlUtil.OriginLocation = {
    get: function () {
        var location = getLocation();

        return sharedUrlUtil.parseProxyUrl(location).originUrl;
    },

    withHash: function (hash) {
        var location = this.get();

        // NOTE: remove previous hash if we have one
        location = location.replace(/(#.*)$/, '');

        return location + hash;
    },

    getCookiePathPrefix: function () {
        var parsedLocation = sharedUrlUtil.parseProxyUrl(getLocation());

        return parsedLocation.partAfterHost.replace(parsedLocation.originResourceInfo.partAfterHost, '');
    },

    getParsed: function () {
        var resolver     = getResolver(document);
        var origin       = this.get();
        var parsedOrigin = sharedUrlUtil.parseUrl(origin);

        // NOTE: IE "browser" adds default port for the https protocol while resolving
        resolver.href = this.get();

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
};

export default urlUtil;
