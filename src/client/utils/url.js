import NativeMethods from '../sandboxes/native-methods';
import Const from '../../const';
import SharedUrlUtil from '../../utils/url';
import Settings from '../settings';

var UrlUtil = {};

//URL processing funcs
UrlUtil.DOCUMENT_URL_RESOLVER               = 'doc_url_resolver_8ff20d5e';
UrlUtil.REQUEST_DESCRIPTOR_VALUES_SEPARATOR = SharedUrlUtil.REQUEST_DESCRIPTOR_VALUES_SEPARATOR;

UrlUtil.IFRAME = SharedUrlUtil.IFRAME;
UrlUtil.SCRIPT = SharedUrlUtil.SCRIPT;

document[UrlUtil.DOCUMENT_URL_RESOLVER] = document.createElement('a');

function getResolver (doc) {
    // IE clean up document after document.open call
    if (!doc[UrlUtil.DOCUMENT_URL_RESOLVER])
        doc[UrlUtil.DOCUMENT_URL_RESOLVER] = doc.createElement('a');

    return doc[UrlUtil.DOCUMENT_URL_RESOLVER];
}

UrlUtil.getProxyUrl = function (url, proxyHostname, proxyPort, jobUid, jobOwnerToken, resourceType) {
    if (!UrlUtil.isSupportedProtocol(url))
        return url;

    // NOTE: resolve relative URLs
    url = UrlUtil.resolveUrl(url);

    // NOTE: if we have a relative URL without slash (e.g. 'img123') resolver will keep
    // original proxy information, so we can return such URL as is. TODO: implement is proxy URL func
    var parsedAsProxy   = SharedUrlUtil.parseProxyUrl(url);
    var isValidProxyUrl = !!parsedAsProxy;

    if (isValidProxyUrl) {
        if (resourceType && parsedAsProxy.resourceType === resourceType)
            return url;

        // NOTE: we need to change proxy url resource type
        var destUrl = SharedUrlUtil.formatUrl(parsedAsProxy.originResourceInfo);

        return UrlUtil.getProxyUrl(destUrl, proxyHostname, proxyPort, jobUid, jobOwnerToken, resourceType);
    }

    proxyHostname = proxyHostname || location.hostname;
    proxyPort     = proxyPort || location.port.toString();
    jobUid        = jobUid || Settings.get().JOB_UID;
    jobOwnerToken = jobOwnerToken || Settings.get().JOB_OWNER_TOKEN;

    var parsedUrl = SharedUrlUtil.parseUrl(url);

    // NOTE: seems like we've had a relative URL with leading slash or dots,
    // so our proxy info path part was removed by resolver and we have an origin URL,
    // but with incorrect host and protocol.
    if (parsedUrl.protocol === 'http:' && parsedUrl.hostname === proxyHostname && parsedUrl.port === proxyPort) {
        var parsedOriginLocation = UrlUtil.OriginLocation.getParsed();

        parsedUrl.protocol = parsedOriginLocation.protocol;
        parsedUrl.host     = parsedOriginLocation.host;
        parsedUrl.hostname = parsedOriginLocation.hostname;
        parsedUrl.port     = parsedOriginLocation.port || '';

        url = SharedUrlUtil.formatUrl(parsedUrl);
    }


    return SharedUrlUtil.getProxyUrl(url, proxyHostname, proxyPort, jobUid, jobOwnerToken, resourceType);
};

UrlUtil.getCrossDomainIframeProxyUrl = function (url) {
    return UrlUtil.getProxyUrl(url, null, Settings.get().CROSS_DOMAIN_PROXY_PORT, null, null, UrlUtil.IFRAME);
};

UrlUtil.getCrossDomainProxyUrl = function () {
    return location.protocol + '//' + location.hostname + ':' + Settings.get().CROSS_DOMAIN_PROXY_PORT + '/';
};

UrlUtil.resolveUrl = function (url, doc) {
    url = SharedUrlUtil.prepareUrl(url);

    if (url && url.indexOf('//') === 0)
        url = UrlUtil.OriginLocation.getParsed().protocol + url;

    var urlResolver = getResolver(doc || document);

    if (url === null)
        urlResolver.removeAttribute('href');
    else {
        urlResolver.href = url;

        //NOTE: it looks like a chrome bug: in nested iframe without src (when iframe is placed in another iframe) you
        //cannot set relative link href for some time while the iframe loading is not completed. So, we'll do it with
        //parent's urlResolver
        if (url && !urlResolver.href && isIFrameWithoutSrc && window.parent && window.parent.document)
            return UrlUtil.resolveUrl(url, window.parent.document);
    }

    return urlResolver.href;
};

UrlUtil.resolveUrlAsOrigin = function (url) {
    return SharedUrlUtil.resolveUrlAsOrigin(url, UrlUtil.getProxyUrl);
};

UrlUtil.formatUrl = function (parsedUrl) {
    return SharedUrlUtil.formatUrl(parsedUrl);
};

UrlUtil.parseProxyUrl = function (proxyUrl) {
    return SharedUrlUtil.parseProxyUrl(proxyUrl);
};

UrlUtil.parseUrl = function (url) {
    return SharedUrlUtil.parseUrl(url);
};

UrlUtil.convertToProxyUrl = function (url, resourceType) {
    return UrlUtil.getProxyUrl(url, null, null, null, null, resourceType);
};

UrlUtil.changeOriginUrlPart = function (proxyUrl, prop, value, resourceType) {
    var parsed = SharedUrlUtil.parseProxyUrl(proxyUrl);

    if (parsed) {
        var resolver = getResolver(document);
        var job      = parsed.jobInfo;
        var proxy    = parsed.proxy;

        resolver.href  = parsed.originUrl;
        resolver[prop] = value;

        return UrlUtil.getProxyUrl(resolver.href, proxy.hostname, proxy.port, job.uid, job.ownerToken, resourceType);
    }

    return proxyUrl;
};

UrlUtil.isSubDomain = function (domain, subDomain) {
    return SharedUrlUtil.isSubDomain(domain, subDomain);
};

UrlUtil.sameOriginCheck = function (location, checkedUrl) {
    if (checkedUrl)
        checkedUrl = UrlUtil.resolveUrl(checkedUrl);

    return SharedUrlUtil.sameOriginCheck(location, checkedUrl);
};

UrlUtil.isSupportedProtocol = function (url) {
    return SharedUrlUtil.isSupportedProtocol(url);
};

UrlUtil.isIframeWithoutSrc = function (iframe) {
    var iFrameLocation         = UrlUtil.getIframeLocation(iframe);
    var iFrameSrcLocation      = iFrameLocation.srcLocation;
    var iFrameDocumentLocation = iFrameLocation.documentLocation;

    if (iFrameDocumentLocation === null) // is a cross-domain iframe
        return false;

    var window               = iframe[Const.DOM_SANDBOX_PROCESSED_CONTEXT] || iframe.contentWindow.parent;
    var windowLocation       = window.location.toString();
    var parsedWindowLocation = SharedUrlUtil.parseProxyUrl(windowLocation);

    if (iFrameDocumentLocation === (parsedWindowLocation ? parsedWindowLocation.originUrl : windowLocation) ||
        iFrameSrcLocation === (parsedWindowLocation ? parsedWindowLocation.originUrl : windowLocation))
        return true;

    var iFrameDocumentLocationHaveSupportedProtocol = UrlUtil.isSupportedProtocol(iFrameDocumentLocation);

    //NOTE: when an iFrame have empty src attribute (<iframe src></iframe>) the iframe.src property doesn't empty but it has different values
    //in different browsers. Its document location is 'about:blank'. Therefore we should check the src attribute.
    if (!iFrameDocumentLocationHaveSupportedProtocol && !(iframe.attributes['src'] && iframe.attributes['src'].value))
        return true;

    //NOTE: is Chrome an iFrame with src has documentLocation 'about:blank' when it is just created. So, we should check
    // srcLocation in this case.
    if (iFrameSrcLocation && UrlUtil.isSupportedProtocol(iFrameSrcLocation))
        return false;

    return !iFrameDocumentLocationHaveSupportedProtocol;
};

UrlUtil.getIframeLocation = function (iframe) {
    var documentLocation = null;

    try {
        documentLocation = iframe.contentDocument.location.href;
    }
    catch (e) {
        documentLocation = null;
    }

    var srcLocation = NativeMethods.getAttribute.call(iframe, 'src' +
                                                              Const.DOM_SANDBOX_STORED_ATTR_POSTFIX) ||
                      NativeMethods.getAttribute.call(iframe, 'src') || iframe.src;

    var parsedProxyDocumentLocation = documentLocation && UrlUtil.isSupportedProtocol(documentLocation) &&
                                      SharedUrlUtil.parseProxyUrl(documentLocation);
    var parsedProxySrcLocation      = srcLocation && UrlUtil.isSupportedProtocol(srcLocation) &&
                                      SharedUrlUtil.parseProxyUrl(srcLocation);

    return {
        documentLocation: parsedProxyDocumentLocation ? parsedProxyDocumentLocation.originUrl : documentLocation,
        srcLocation:      parsedProxySrcLocation ? parsedProxySrcLocation.originUrl : srcLocation
    };
};

function getLocation () {
    try {
        // NOTE: fallback to the owner page's URL if we are in the iFrame without src
        if (window.frameElement && UrlUtil.isIframeWithoutSrc(window.frameElement))
            return Settings.get().REFERER;
    }
        /*eslint-disable no-empty */
    catch (e) {
        // NOTE: Cross-domain iframe
    }
    /*eslint-enable no-empty */

    return window.location.toString();
}

UrlUtil.OriginLocation = {
    get: function () {
        var location = getLocation();

        return SharedUrlUtil.parseProxyUrl(location).originUrl;
    },

    withHash: function (hash) {
        var location = this.get();

        // NOTE: remove previous hash if we have one
        location = location.replace(/(#.*)$/, '');

        return location + hash;
    },

    getCookiePathPrefix: function () {
        var parsedLocation = SharedUrlUtil.parseProxyUrl(getLocation());

        return parsedLocation.partAfterHost.replace(parsedLocation.originResourceInfo.partAfterHost, '');
    },

    getParsed: function () {
        var resolver     = getResolver(document);
        var origin       = this.get();
        var parsedOrigin = SharedUrlUtil.parseUrl(origin);

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

export default UrlUtil;
