import INTERNAL_PROPS from '../../processing/dom/internal-properties';
import * as sharedUrlUtils from '../../utils/url';
import * as destLocation from './destination-location';
import * as urlResolver from './url-resolver';
import settings from '../settings';

const HASH_RE                          = /#[\S\s]*$/;
const SUPPORTED_WEB_SOCKET_PROTOCOL_RE = /^wss?:/i;

export const REQUEST_DESCRIPTOR_VALUES_SEPARATOR = sharedUrlUtils.REQUEST_DESCRIPTOR_VALUES_SEPARATOR;

export function getProxyUrl (url, opts) {
    const resourceType       = opts && opts.resourceType;
    const parsedResourceType = sharedUrlUtils.parseResourceType(resourceType);

    if (!parsedResourceType.isWebSocket && !isSupportedProtocol(url) && !isSpecialPage(url))
        return url;

    // NOTE: Resolves relative URLs.
    url = destLocation.resolveUrl(url);

    if (parsedResourceType.isWebSocket && !isValidWebSocketUrl(url) || !sharedUrlUtils.isValidUrl(url))
        return url;

    /*eslint-disable no-restricted-properties*/
    const proxyHostname = opts && opts.proxyHostname || location.hostname;
    const proxyPort     = opts && opts.proxyPort || location.port.toString();
    /*eslint-enable no-restricted-properties*/

    const proxyProtocol = parsedResourceType.isWebSocket ? 'ws:' : void 0;
    const sessionId     = opts && opts.sessionId || settings.get().sessionId;
    let charset         = opts && opts.charset;
    let reqOrigin       = opts && opts.reqOrigin;

    const crossDomainPort = getCrossDomainProxyPort(proxyPort);

    // NOTE: If the relative URL contains no slash (e.g. 'img123'), the resolver will keep
    // the original proxy information, so that we can return such URL as is.
    // TODO: Implement the isProxyURL function.
    const parsedProxyUrl = sharedUrlUtils.parseProxyUrl(url);

    /*eslint-disable no-restricted-properties*/
    const isValidProxyUrl = !!parsedProxyUrl && parsedProxyUrl.proxy.hostname === proxyHostname &&
                            (parsedProxyUrl.proxy.port === proxyPort || parsedProxyUrl.proxy.port === crossDomainPort);
    /*eslint-enable no-restricted-properties*/

    if (isValidProxyUrl) {
        if (resourceType && parsedProxyUrl.resourceType === resourceType)
            return url;

        // NOTE: Need to change the proxy URL resource type.
        const destUrl = sharedUrlUtils.formatUrl(parsedProxyUrl.destResourceInfo);

        return getProxyUrl(destUrl, {
            proxyProtocol,
            proxyHostname,
            proxyPort,
            sessionId,
            resourceType,
            charset,
            reqOrigin
        });
    }

    const parsedUrl = sharedUrlUtils.parseUrl(url);

    charset = charset || parsedResourceType.isScript && document[INTERNAL_PROPS.documentCharset];

    // NOTE: It seems that the relative URL had the leading slash or dots, so that the proxy info path part was
    // removed by the resolver and we have an origin URL with the incorrect host and protocol.
    /*eslint-disable no-restricted-properties*/
    if (parsedUrl.protocol === 'http:' && parsedUrl.hostname === proxyHostname && parsedUrl.port === proxyPort) {
        const parsedDestLocation = destLocation.getParsed();

        parsedUrl.protocol = parsedDestLocation.protocol;
        parsedUrl.host     = parsedDestLocation.host;
        parsedUrl.hostname = parsedDestLocation.hostname;
        parsedUrl.port     = parsedDestLocation.port || '';

        url = sharedUrlUtils.formatUrl(parsedUrl);
    }
    /*eslint-enable no-restricted-properties*/

    if (parsedResourceType.isWebSocket) {
        /*eslint-disable no-restricted-properties*/
        parsedUrl.protocol = parsedUrl.protocol.replace('ws', 'http');
        /*eslint-enable no-restricted-properties*/

        url       = sharedUrlUtils.formatUrl(parsedUrl);
        reqOrigin = reqOrigin || encodeURIComponent(destLocation.getOriginHeader());
    }

    return sharedUrlUtils.getProxyUrl(url, {
        proxyProtocol,
        proxyHostname,
        proxyPort,
        sessionId,
        resourceType,
        charset,
        reqOrigin
    });
}

export function getCrossDomainIframeProxyUrl (url) {
    return getProxyUrl(url, {
        proxyPort:    settings.get().crossDomainProxyPort,
        resourceType: sharedUrlUtils.getResourceTypeString({ isIframe: true })
    });
}

export function getCrossDomainProxyPort (proxyPort) {
    /*eslint-disable no-restricted-properties*/
    return settings.get().crossDomainProxyPort === proxyPort
        ? location.port.toString()
        : settings.get().crossDomainProxyPort;
    /*eslint-enable no-restricted-properties*/
}

export function getCrossDomainProxyUrl () {
    /*eslint-disable no-restricted-properties*/
    return location.protocol + '//' + location.hostname + ':' + settings.get().crossDomainProxyPort + '/';
    /*eslint-enable no-restricted-properties*/
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

export function convertToProxyUrl (url, resourceType, charset) {
    return getProxyUrl(url, { resourceType, charset });
}

export function changeDestUrlPart (proxyUrl, nativePropSetter, value, resourceType) {
    const parsed = sharedUrlUtils.parseProxyUrl(proxyUrl);

    if (parsed) {
        const sessionId = parsed.sessionId;
        const proxy     = parsed.proxy;
        const destUrl   = urlResolver.changeUrlPart(parsed.destUrl, nativePropSetter, value, document);

        return getProxyUrl(destUrl, {
            /*eslint-disable no-restricted-properties*/
            proxyHostname: proxy.hostname,
            proxyPort:     proxy.port,
            /*eslint-enable no-restricted-properties*/

            sessionId,
            resourceType
        });
    }

    return proxyUrl;
}

export function isValidWebSocketUrl (url) {
    const resolvedUrl = resolveUrlAsDest(url);

    return SUPPORTED_WEB_SOCKET_PROTOCOL_RE.test(resolvedUrl);
}

export function isSubDomain (domain, subDomain) {
    return sharedUrlUtils.isSubDomain(domain, subDomain);
}

export function isSupportedProtocol (url) {
    return sharedUrlUtils.isSupportedProtocol(url);
}

export function isSpecialPage (url) {
    return sharedUrlUtils.isSpecialPage(url);
}

export function parseResourceType (resourceType) {
    return sharedUrlUtils.parseResourceType(resourceType);
}

export function stringifyResourceType (resourceType) {
    return sharedUrlUtils.getResourceTypeString(resourceType);
}

export function isChangedOnlyHash (currentUrl, newUrl) {
    // NOTE: we compare proxied urls because urls passed into the function may be proxied, non-proxied
    // or relative. The getProxyUrl function solves all the corresponding problems.
    return getProxyUrl(currentUrl).replace(HASH_RE, '') === getProxyUrl(newUrl).replace(HASH_RE, '');
}
