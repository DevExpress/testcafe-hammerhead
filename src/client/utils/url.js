import INTERNAL_PROPS from '../../processing/dom/internal-properties';
import * as sharedUrlUtils from '../../utils/url';
import * as destLocation from './destination-location';
import * as urlResolver from './url-resolver';
import settings from '../settings';

export const REQUEST_DESCRIPTOR_VALUES_SEPARATOR = sharedUrlUtils.REQUEST_DESCRIPTOR_VALUES_SEPARATOR;

export function getProxyUrl (url, proxyHostname, proxyPort, sessionId, resourceType, charsetAttrValue) {
    if (!isSupportedProtocol(url))
        return url;

    // NOTE: Resolves relative URLs.
    url = destLocation.resolveUrl(url);

    // NOTE: If the relative URL contains no slash (e.g. 'img123'), the resolver will keep
    // the original proxy information, so that we can return such URL as is.
    // TODO: Implement the isProxyURL function.
    var parsedAsProxy   = sharedUrlUtils.parseProxyUrl(url);
    var isValidProxyUrl = !!parsedAsProxy;

    if (isValidProxyUrl) {
        if (resourceType && parsedAsProxy.resourceType === resourceType)
            return url;

        // NOTE: Need to change the proxy URL resource type.
        var destUrl = sharedUrlUtils.formatUrl(parsedAsProxy.destResourceInfo);

        return getProxyUrl(destUrl, proxyHostname, proxyPort, sessionId, resourceType, charsetAttrValue);
    }

    proxyHostname = proxyHostname || location.hostname;
    proxyPort     = proxyPort || location.port.toString();
    sessionId     = sessionId || settings.get().sessionId;


    var parsedUrl = sharedUrlUtils.parseUrl(url);
    var isScript  = sharedUrlUtils.parseResourceType(resourceType).isScript;
    var charset   = charsetAttrValue || isScript && document[INTERNAL_PROPS.documentCharset];

    // NOTE: It seems that the relative URL had the leading slash or dots, so that the proxy info path part was
    // removed by the resolver and we have an origin URL with the incorrect host and protocol.
    if (parsedUrl.protocol === 'http:' && parsedUrl.hostname === proxyHostname && parsedUrl.port === proxyPort) {
        var parsedDestLocation = destLocation.getParsed();

        parsedUrl.protocol = parsedDestLocation.protocol;
        parsedUrl.host     = parsedDestLocation.host;
        parsedUrl.hostname = parsedDestLocation.hostname;
        parsedUrl.port     = parsedDestLocation.port || '';

        url = sharedUrlUtils.formatUrl(parsedUrl);
    }

    return sharedUrlUtils.getProxyUrl(url, proxyHostname, proxyPort, sessionId, resourceType, charset);
}

export function getCrossDomainIframeProxyUrl (url) {
    return getProxyUrl(url, null, settings.get().crossDomainProxyPort, null, sharedUrlUtils.stringifyResourceType(true));
}

export function getCrossDomainProxyUrl () {
    return location.protocol + '//' + location.hostname + ':' + settings.get().crossDomainProxyPort + '/';
}

export function resolveUrlAsDest (url) {
    return sharedUrlUtils.resolveUrlAsDest(url, getProxyUrl);
}

export function formatUrl (parsedUrl) {
    return sharedUrlUtils.formatUrl(parsedUrl);
}

export function parseProxyUrl (proxyUrl) {
    return sharedUrlUtils.parseProxyUrl(proxyUrl);
}

export function parseUrl (url) {
    return sharedUrlUtils.parseUrl(url);
}

export function convertToProxyUrl (url, resourceType, charsetAttrValue) {
    return getProxyUrl(url, null, null, null, resourceType, charsetAttrValue);
}

export function changeDestUrlPart (proxyUrl, prop, value, resourceType) {
    var parsed = sharedUrlUtils.parseProxyUrl(proxyUrl);

    if (parsed) {
        var sessionId = parsed.sessionId;
        var proxy     = parsed.proxy;
        var destUrl   = urlResolver.changeUrlPart(parsed.destUrl, prop, value, document);

        return getProxyUrl(destUrl, proxy.hostname, proxy.port, sessionId, resourceType);
    }

    return proxyUrl;
}

export function isSubDomain (domain, subDomain) {
    return sharedUrlUtils.isSubDomain(domain, subDomain);
}

export function isSupportedProtocol (url) {
    return sharedUrlUtils.isSupportedProtocol(url);
}
