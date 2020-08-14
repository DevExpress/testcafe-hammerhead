import INTERNAL_PROPS from '../../processing/dom/internal-properties';
import * as sharedUrlUtils from '../../utils/url';
import * as destLocation from './destination-location';
import * as urlResolver from './url-resolver';
import settings from '../settings';
import { ResourceType } from '../../typings/url';
import getGlobalContextInfo from './global-context-info';

const HASH_RE                          = /#[\S\s]*$/;
const SUPPORTED_WEB_SOCKET_PROTOCOL_RE = /^wss?:/i;

// NOTE: The window.location equals 'about:blank' in iframes without src
// therefore we need to find a window with src to get the proxy settings
const DEFAULT_PROXY_SETTINGS = (function () {
    /*eslint-disable no-restricted-properties*/
    const globalCtx    = getGlobalContextInfo();
    let locationWindow = globalCtx.isInWorker ? { location: parseUrl(self.location.origin), parent: null } : window;
    let proxyLocation  = locationWindow.location;

    while (!proxyLocation.hostname) {
        locationWindow = locationWindow.parent;
        proxyLocation  = locationWindow.location;
    }

    return {
        hostname: proxyLocation.hostname,
        port:     proxyLocation.port.toString(),
        protocol: proxyLocation.protocol
    };
    /*eslint-enable no-restricted-properties*/
})();

export const REQUEST_DESCRIPTOR_VALUES_SEPARATOR = sharedUrlUtils.REQUEST_DESCRIPTOR_VALUES_SEPARATOR;

export function getProxyUrl (url: string, opts?): string {
    url = sharedUrlUtils.getURLString(url);

    const resourceType       = opts && opts.resourceType;
    const parsedResourceType = sharedUrlUtils.parseResourceType(resourceType);

    if (!parsedResourceType.isWebSocket && !isSupportedProtocol(url) && !isSpecialPage(url))
        return url;

    // NOTE: Resolves relative URLs.
    let resolvedUrl = destLocation.resolveUrl(url, opts && opts.doc);

    if (parsedResourceType.isWebSocket && !isValidWebSocketUrl(resolvedUrl) || !sharedUrlUtils.isValidUrl(resolvedUrl))
        return url;

    /*eslint-disable no-restricted-properties*/
    const proxyHostname       = opts && opts.proxyHostname || DEFAULT_PROXY_SETTINGS.hostname;
    const proxyPort           = opts && opts.proxyPort || DEFAULT_PROXY_SETTINGS.port;
    const proxyServerProtocol = opts && opts.proxyProtocol || DEFAULT_PROXY_SETTINGS.protocol;
    /*eslint-enable no-restricted-properties*/

    const proxyProtocol = parsedResourceType.isWebSocket
        ? proxyServerProtocol.replace('http', 'ws')
        : proxyServerProtocol;

    const sessionId = opts && opts.sessionId || settings.get().sessionId;
    const windowId  = opts && opts.windowId || settings.get().windowId;
    let charset     = opts && opts.charset;
    let reqOrigin   = opts && opts.reqOrigin;

    const crossDomainPort = getCrossDomainProxyPort(proxyPort);

    // NOTE: If the relative URL contains no slash (e.g. 'img123'), the resolver will keep
    // the original proxy information, so that we can return such URL as is.
    // TODO: Implement the isProxyURL function.
    const parsedProxyUrl = sharedUrlUtils.parseProxyUrl(resolvedUrl);

    /*eslint-disable no-restricted-properties*/
    const isValidProxyUrl = !!parsedProxyUrl && parsedProxyUrl.proxy.hostname === proxyHostname &&
                            (parsedProxyUrl.proxy.port === proxyPort || parsedProxyUrl.proxy.port === crossDomainPort);
    /*eslint-enable no-restricted-properties*/

    if (isValidProxyUrl) {
        if (resourceType && parsedProxyUrl.resourceType === resourceType)
            return resolvedUrl;

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

    const parsedUrl = sharedUrlUtils.parseUrl(resolvedUrl);

    charset = charset || parsedResourceType.isScript && document[INTERNAL_PROPS.documentCharset];

    // NOTE: It seems that the relative URL had the leading slash or dots, so that the proxy info path part was
    // removed by the resolver and we have an origin URL with the incorrect host and protocol.
    /*eslint-disable no-restricted-properties*/
    if (parsedUrl.protocol === proxyServerProtocol && parsedUrl.hostname === proxyHostname &&
        parsedUrl.port === proxyPort) {
        const parsedDestLocation = destLocation.getParsed();

        parsedUrl.protocol = parsedDestLocation.protocol;
        parsedUrl.host     = parsedDestLocation.host;
        parsedUrl.hostname = parsedDestLocation.hostname;
        parsedUrl.port     = parsedDestLocation.port || '';

        resolvedUrl = sharedUrlUtils.formatUrl(parsedUrl);
    }
    /*eslint-enable no-restricted-properties*/

    if (parsedResourceType.isWebSocket) {
        // eslint-disable-next-line no-restricted-properties
        parsedUrl.protocol = parsedUrl.protocol.replace('ws', 'http');

        resolvedUrl = sharedUrlUtils.formatUrl(parsedUrl);
        reqOrigin   = reqOrigin || encodeURIComponent(destLocation.getOriginHeader());
    }

    return sharedUrlUtils.getProxyUrl(resolvedUrl, {
        proxyProtocol,
        proxyHostname,
        proxyPort,
        sessionId,
        resourceType,
        charset,
        reqOrigin,
        windowId
    });
}

export function getNavigationUrl (url: string, win) {
    // NOTE: For the 'about:blank' page, we perform url proxing only for the top window, 'location' object and links.
    // For images and iframes, we keep urls as they were.
    // See details in https://github.com/DevExpress/testcafe-hammerhead/issues/339
    let destinationLocation  = null;

    const isIframe    = win.top !== win;
    const winLocation = win.location.toString();

    if (isIframe)
        destinationLocation = winLocation;
    else {
        const parsedProxyUrl = parseProxyUrl(winLocation);

        destinationLocation = parsedProxyUrl && parsedProxyUrl.destUrl;
    }

    if (isSpecialPage(destinationLocation) && sharedUrlUtils.isRelativeUrl(url))
        return '';

    url = sharedUrlUtils.prepareUrl(url);

    return getProxyUrl(url);
}

export function getCrossDomainIframeProxyUrl (url: string) {
    return getProxyUrl(url, {
        proxyPort:    settings.get().crossDomainProxyPort,
        resourceType: sharedUrlUtils.getResourceTypeString({ isIframe: true })
    });
}

export function getPageProxyUrl (url: string, windowId: string): string {
    const parsedProxyUrl = parseProxyUrl(url);
    let resourceType = null;

    if (parsedProxyUrl) {
        url = parsedProxyUrl.destUrl;
        resourceType = parsedProxyUrl.resourceType;
    }

    if (resourceType) {
        const parsedResourceType = parseResourceType(resourceType);

        parsedResourceType.isIframe = false;
        resourceType = stringifyResourceType(parsedResourceType);
    }

    const isCrossDomainUrl = !destLocation.sameOriginCheck(destLocation.getLocation(), url);
    const proxyPort        = isCrossDomainUrl ? settings.get().crossDomainProxyPort : location.port.toString(); // eslint-disable-line no-restricted-properties

    return getProxyUrl(url, { windowId, proxyPort, resourceType });
}

export function getCrossDomainProxyPort (proxyPort: string) {
    return settings.get().crossDomainProxyPort === proxyPort
        // eslint-disable-next-line no-restricted-properties
        ? location.port.toString()
        : settings.get().crossDomainProxyPort;
}

export function resolveUrlAsDest (url: string) {
    return sharedUrlUtils.resolveUrlAsDest(url, getProxyUrl);
}

export function formatUrl (parsedUrl) {
    return sharedUrlUtils.formatUrl(parsedUrl);
}

export function parseProxyUrl (proxyUrl: string) {
    return sharedUrlUtils.parseProxyUrl(proxyUrl);
}

export function parseUrl (url: string) {
    return sharedUrlUtils.parseUrl(url);
}

export function convertToProxyUrl (url: string, resourceType, charset) {
    return getProxyUrl(url, { resourceType, charset });
}

export function changeDestUrlPart (proxyUrl: string, nativePropSetter, value, resourceType) {
    const parsed = sharedUrlUtils.parseProxyUrl(proxyUrl);

    if (parsed) {
        const sessionId = parsed.sessionId;
        const proxy     = parsed.proxy;
        // @ts-ignore
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

export function isSubDomain (domain, subDomain): boolean {
    return sharedUrlUtils.isSubDomain(domain, subDomain);
}

export function isSupportedProtocol (url: string): boolean {
    return sharedUrlUtils.isSupportedProtocol(url);
}

export function isSpecialPage (url: string): boolean {
    return sharedUrlUtils.isSpecialPage(url);
}

export function parseResourceType (resourceType: string): ResourceType {
    return sharedUrlUtils.parseResourceType(resourceType);
}

export function stringifyResourceType (resourceType: ResourceType): string {
    return sharedUrlUtils.getResourceTypeString(resourceType);
}

export function isChangedOnlyHash (currentUrl: string, newUrl: string): boolean {
    // NOTE: we compare proxied urls because urls passed into the function may be proxied, non-proxied
    // or relative. The getProxyUrl function solves all the corresponding problems.
    return getProxyUrl(currentUrl).replace(HASH_RE, '') === getProxyUrl(newUrl).replace(HASH_RE, '');
}
