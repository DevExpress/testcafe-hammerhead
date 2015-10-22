import INTERNAL_PROPS from '../../processing/dom/internal-properties';
import * as sharedUrlUtils from '../../utils/url';
import * as originLocation from './origin-location';
import { get as getSettings } from '../settings';

export const REQUEST_DESCRIPTOR_VALUES_SEPARATOR = sharedUrlUtils.REQUEST_DESCRIPTOR_VALUES_SEPARATOR;
export const IFRAME                              = sharedUrlUtils.IFRAME;
export const SCRIPT                              = sharedUrlUtils.SCRIPT;

export function getProxyUrl (url, proxyHostname, proxyPort, sessionId, resourceType, charsetAttrValue) {
    if (!isSupportedProtocol(url))
        return url;

    // NOTE: Resolves relative URLs.
    url = originLocation.resolveUrl(url);

    // NOTE: If the relative URL contains no slash (e.g. 'img123'), the resolver will keep
    // the original proxy information, so that we can return such URL as is.
    // TODO: Implement the isProxyURL function.
    var parsedAsProxy   = sharedUrlUtils.parseProxyUrl(url);
    var isValidProxyUrl = !!parsedAsProxy;

    if (isValidProxyUrl) {
        if (resourceType && parsedAsProxy.resourceType === resourceType)
            return url;

        // NOTE: Need to change the proxy URL resource type.
        var destUrl = sharedUrlUtils.formatUrl(parsedAsProxy.originResourceInfo);

        return getProxyUrl(destUrl, proxyHostname, proxyPort, sessionId, resourceType, charsetAttrValue);
    }

    proxyHostname = proxyHostname || location.hostname;
    proxyPort     = proxyPort || location.port.toString();
    sessionId     = sessionId || getSettings().sessionId;


    var parsedUrl = sharedUrlUtils.parseUrl(url);
    var charset   = charsetAttrValue || resourceType === SCRIPT && document[INTERNAL_PROPS.documentCharset];

    // NOTE: It seems that the relative URL had the leading slash or dots, so that the proxy info path part was
    // removed by the resolver and we have an origin URL with the incorrect host and protocol.
    if (parsedUrl.protocol === 'http:' && parsedUrl.hostname === proxyHostname && parsedUrl.port === proxyPort) {
        var parsedOriginLocation = originLocation.getParsed();

        parsedUrl.protocol = parsedOriginLocation.protocol;
        parsedUrl.host     = parsedOriginLocation.host;
        parsedUrl.hostname = parsedOriginLocation.hostname;
        parsedUrl.port     = parsedOriginLocation.port || '';

        url = sharedUrlUtils.formatUrl(parsedUrl);
    }

    return sharedUrlUtils.getProxyUrl(url, proxyHostname, proxyPort, sessionId, resourceType, charset);
}

export function getCrossDomainIframeProxyUrl (url) {
    return getProxyUrl(url, null, getSettings().crossDomainProxyPort, null, IFRAME);
}

export function getCrossDomainProxyUrl () {
    return location.protocol + '//' + location.hostname + ':' + getSettings().crossDomainProxyPort + '/';
}

export function resolveUrlAsOrigin (url) {
    return sharedUrlUtils.resolveUrlAsOrigin(url, getProxyUrl);
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

export function changeOriginUrlPart (proxyUrl, prop, value, resourceType) {
    var parsed = sharedUrlUtils.parseProxyUrl(proxyUrl);

    if (parsed) {
        var resolver  = originLocation.getResolver(document);
        var sessionId = parsed.sessionId;
        var proxy     = parsed.proxy;

        resolver.href  = parsed.originUrl;
        resolver[prop] = value;

        return getProxyUrl(resolver.href, proxy.hostname, proxy.port, sessionId, resourceType);
    }

    return proxyUrl;
}

export function isSubDomain (domain, subDomain) {
    return sharedUrlUtils.isSubDomain(domain, subDomain);
}

export function isSupportedProtocol (url) {
    return sharedUrlUtils.isSupportedProtocol(url);
}
