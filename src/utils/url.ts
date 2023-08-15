// -------------------------------------------------------------
// WARNING: this file is used by both the client and the server.
// Do not use any browser or node-specific API!
// -------------------------------------------------------------

import trim from './string-trim';

import {
    ParsedUrl,
    ResourceType,
    RequestDescriptor,
    ParsedProxyUrl,
    ProxyUrlOptions,
} from '../typings/url';

import { ServerInfo } from '../typings/proxy';

const URL_RE              = /^\s*([\w-]+?:)?(?:\/\/(?:([^/]+)@)?(([^/%?;#: ]*)(?::(\d+))?))?(.*?)\s*$/;
const PROTOCOL_RE         = /^([\w-]+?:)(\/\/|[^\\/]|$)/;
const QUERY_AND_HASH_RE   = /(\?.+|#[^#]*)$/;
const PATH_AFTER_HOST_RE  = /^\/([^/]+?)\/([\S\s]+)$/;
const HTTP_RE             = /^https?:/;
const FILE_RE             = /^file:/i;
const SHORT_ORIGIN_RE     = /^http(s)?:\/\//;
const IS_SECURE_ORIGIN_RE = /^s\*/;
const META_REFRESH_RE     = /^(.+?[;,]\s*(?:url\s*=\s*)?(['"])?)(.+?)?(\2)?$/i;

export const SUPPORTED_PROTOCOL_RE                            = /^(?:https?|file):/i;
export const HASH_RE                                          = /^#/;
export const REQUEST_DESCRIPTOR_VALUES_SEPARATOR              = '!';
export const REQUEST_DESCRIPTOR_SESSION_INFO_VALUES_SEPARATOR = '*';
export const TRAILING_SLASH_RE                                = /\/$/;
export const SPECIAL_BLANK_PAGE                               = 'about:blank';
export const SPECIAL_ERROR_PAGE                               = 'about:error';
export const SPECIAL_PAGES                                    = [SPECIAL_BLANK_PAGE, SPECIAL_ERROR_PAGE];

export const HTTP_DEFAULT_PORT  = '80';
export const HTTPS_DEFAULT_PORT = '443';

export enum Credentials { include, sameOrigin, omit, unknown } // eslint-disable-line no-shadow

const SPECIAL_PAGE_DEST_RESOURCE_INFO = {
    protocol:      'about:',
    host:          '',
    hostname:      '',
    port:          '',
    partAfterHost: '',
};
const RESOURCE_TYPES = [
    { name: 'isIframe', flag: 'i' },
    { name: 'isForm', flag: 'f' },
    { name: 'isScript', flag: 's' },
    { name: 'isEventSource', flag: 'e' },
    { name: 'isHtmlImport', flag: 'h' },
    { name: 'isWebSocket', flag: 'w' },
    { name: 'isServiceWorker', flag: 'c' },
    { name: 'isAjax', flag: 'a' },
    { name: 'isObject', flag: 'o' },
] as { name: keyof ResourceType, flag: string }[];

export function parseResourceType (resourceType: string): ResourceType {
    const parsedResourceType = {};

    if (!resourceType)
        return parsedResourceType;

    for (const { name, flag } of RESOURCE_TYPES) {
        if (resourceType.indexOf(flag) > -1)
            parsedResourceType[name] = true;
    }

    return parsedResourceType;
}

export function getResourceTypeString (parsedResourceType: ResourceType): string | null {
    if (!parsedResourceType)
        return null;

    let resourceType = '';

    for (const { name, flag } of RESOURCE_TYPES) {
        if (parsedResourceType[name])
            resourceType += flag;
    }

    return resourceType || null;
}

function makeShortOrigin (origin: string) {
    return origin === 'null' ? '' : origin.replace(SHORT_ORIGIN_RE, (_, secure) => secure ? 's*' : '');
}

export function restoreShortOrigin (origin: string) {
    if (!origin)
        return 'null';

    return IS_SECURE_ORIGIN_RE.test(origin) ? origin.replace(IS_SECURE_ORIGIN_RE, 'https://') : 'http://' + origin;
}

export function isSubDomain (domain: string, subDomain: string): boolean {
    domain    = domain.replace(/^www./i, '');
    subDomain = subDomain.replace(/^www./i, '');

    if (domain === subDomain)
        return true;

    const index = subDomain.lastIndexOf(domain);

    return subDomain[index - 1] === '.' && subDomain.length === index + domain.length;
}

export function sameOriginCheck (location: string, checkedUrl: string | URL): boolean {
    if (!checkedUrl)
        return true;

    const parsedCheckedUrl = parseUrl(checkedUrl);
    const isRelative       = !parsedCheckedUrl.host;

    if (isRelative)
        return true;

    const parsedLocation      = parseUrl(location);
    const parsedProxyLocation = parseProxyUrl(location);

    if (parsedCheckedUrl.host === parsedLocation.host && parsedCheckedUrl.protocol === parsedLocation.protocol)
        return true;

    const parsedDestUrl = parsedProxyLocation ? parsedProxyLocation.destResourceInfo : parsedLocation;

    if (!parsedDestUrl)
        return false;

    const isSameProtocol = !parsedCheckedUrl.protocol || parsedCheckedUrl.protocol === parsedDestUrl.protocol;

    const portsEq = !parsedDestUrl.port && !parsedCheckedUrl.port ||
                    parsedDestUrl.port && parsedDestUrl.port.toString() === parsedCheckedUrl.port;

    return isSameProtocol && !!portsEq && parsedDestUrl.hostname === parsedCheckedUrl.hostname;
}

// NOTE: Convert the destination protocol and hostname to the lower case. (GH-1)
function convertHostToLowerCase (url: string): string {
    const parsedUrl = parseUrl(url);

    parsedUrl.protocol = parsedUrl.protocol && parsedUrl.protocol.toLowerCase();
    parsedUrl.host     = parsedUrl.host && parsedUrl.host.toLowerCase();

    return formatUrl(parsedUrl);
}

export function getURLString (url: string | URL): string {
    // TODO: fix it
    // eslint-disable-next-line no-undef
    if (url === null && /iPad|iPhone/i.test(window.navigator.userAgent))
        return '';

    return String(url).replace(/[\n\t]/g, '');
}

export function getProxyUrl (url: string, opts: ProxyUrlOptions): string {
    const sessionInfo = [opts.sessionId];

    if (opts.windowId)
        sessionInfo.push(opts.windowId);

    const params = [sessionInfo.join(REQUEST_DESCRIPTOR_SESSION_INFO_VALUES_SEPARATOR)];

    if (opts.resourceType)
        params.push(opts.resourceType);

    if (opts.charset)
        params.push(opts.charset.toLowerCase());

    if (typeof opts.credentials === 'number')
        params.push(opts.credentials.toString());

    if (opts.reqOrigin)
        params.push(encodeURIComponent(makeShortOrigin(opts.reqOrigin)));

    const descriptor    = params.join(REQUEST_DESCRIPTOR_VALUES_SEPARATOR);
    const proxyProtocol = opts.proxyProtocol || 'http:';

    return `${proxyProtocol}//${opts.proxyHostname}:${opts.proxyPort}/${descriptor}/${convertHostToLowerCase(url)}`;
}

export function getDomain (parsed: { protocol?: string, host?: string, hostname?: string, port?: string | number }): string {
    if (parsed.protocol === 'file:')
        return 'null';

    return formatUrl({
        protocol: parsed.protocol,
        host:     parsed.host,
        hostname: parsed.hostname,
        port:     String(parsed.port || ''),
    });
}

function parseRequestDescriptor (desc: string): RequestDescriptor | null {
    const [sessionInfo, resourceType, ...resourceData] = desc.split(REQUEST_DESCRIPTOR_VALUES_SEPARATOR);

    if (!sessionInfo)
        return null;

    const [sessionId, windowId] = sessionInfo.split(REQUEST_DESCRIPTOR_SESSION_INFO_VALUES_SEPARATOR);
    const parsedDesc            = { sessionId, resourceType: resourceType || null } as RequestDescriptor;

    if (windowId)
        parsedDesc.windowId = windowId;

    if (resourceType && resourceData.length) {
        const parsedResourceType = parseResourceType(resourceType);

        if (parsedResourceType.isScript || parsedResourceType.isServiceWorker)
            parsedDesc.charset = resourceData[0];
        else if (parsedResourceType.isWebSocket)
            parsedDesc.reqOrigin = decodeURIComponent(restoreShortOrigin(resourceData[0]));
        else if (parsedResourceType.isIframe && resourceData[0])
            parsedDesc.reqOrigin = decodeURIComponent(restoreShortOrigin(resourceData[0]));
        else if (parsedResourceType.isAjax) {
            parsedDesc.credentials = parseInt(resourceData[0], 10);

            if (resourceData.length === 2)
                parsedDesc.reqOrigin = decodeURIComponent(restoreShortOrigin(resourceData[1]));
        }
    }

    return parsedDesc;
}

export function parseProxyUrl (proxyUrl: string): ParsedProxyUrl | null {
    // TODO: Remove it.
    const parsedUrl = parseUrl(proxyUrl);

    if (!parsedUrl.partAfterHost)
        return null;

    const match = parsedUrl.partAfterHost.match(PATH_AFTER_HOST_RE);

    if (!match)
        return null;

    const parsedDesc: any = parseRequestDescriptor(match[1]);

    // NOTE: We should have, at least, the job uid and the owner token.
    if (!parsedDesc)
        return null;

    let destUrl = match[2];

    // Browser can redirect to a special page with hash (GH-1671)
    const destUrlWithoutHash = destUrl.replace(/#[\S\s]*$/, '');

    if (!isSpecialPage(destUrlWithoutHash) && !SUPPORTED_PROTOCOL_RE.test(destUrl))
        return null;

    let destResourceInfo : ParsedUrl;

    if (isSpecialPage(destUrlWithoutHash))
        destResourceInfo = SPECIAL_PAGE_DEST_RESOURCE_INFO;
    else {
        destUrl          = omitDefaultPort(destUrl);
        destResourceInfo = parseUrl(destUrl);
    }

    return {
        destUrl,
        destResourceInfo,

        partAfterHost: parsedUrl.partAfterHost,

        proxy: {
            hostname: parsedUrl.hostname || '',
            port:     parsedUrl.port || '',
        },

        sessionId:    parsedDesc.sessionId,
        resourceType: parsedDesc.resourceType,
        charset:      parsedDesc.charset,
        reqOrigin:    parsedDesc.reqOrigin,
        windowId:     parsedDesc.windowId,
        credentials:  parsedDesc.credentials,
    };
}

export function getPathname (path: string): string {
    return path.replace(QUERY_AND_HASH_RE, '');
}

export function parseUrl (url: string | URL): ParsedUrl {
    url = processSpecialChars(url);

    if (!url)
        return {};

    const urlMatch = url.match(URL_RE) as (string | undefined)[];

    return urlMatch ? {
        protocol:      urlMatch[1],
        auth:          urlMatch[2],
        host:          urlMatch[3],
        hostname:      urlMatch[4],
        port:          urlMatch[5],
        partAfterHost: urlMatch[6],
    } : {};
}

export function isSupportedProtocol (url: string): boolean {
    url = trim(url || '');

    const isHash = HASH_RE.test(url);

    if (isHash)
        return false;

    const protocol = url.match(PROTOCOL_RE);

    if (!protocol)
        return true;

    return SUPPORTED_PROTOCOL_RE.test(protocol[0]);
}

export function resolveUrlAsDest (url: string, getProxyUrlMeth: Function, isUrlsSet = false): string {
    if (isUrlsSet)
        return handleUrlsSet(resolveUrlAsDest, url, getProxyUrlMeth);

    getProxyUrlMeth = getProxyUrlMeth || getProxyUrl;

    if (isSupportedProtocol(url)) {
        const proxyUrl       = getProxyUrlMeth(url);
        const parsedProxyUrl = parseProxyUrl(proxyUrl);

        return parsedProxyUrl ? formatUrl(parsedProxyUrl.destResourceInfo) : url;
    }

    return url;
}

export function formatUrl (parsedUrl: ParsedUrl): string {
    // NOTE: the URL is relative.
    if (parsedUrl.protocol !== 'file:' && parsedUrl.protocol !== 'about:' &&
        !parsedUrl.host && (!parsedUrl.hostname || !parsedUrl.port))
        return parsedUrl.partAfterHost || '';

    let url = parsedUrl.protocol || '';

    if (parsedUrl.protocol !== 'about:')
        url += '//';

    if (parsedUrl.auth)
        url += parsedUrl.auth + '@';

    if (parsedUrl.host)
        url += parsedUrl.host;

    else if (parsedUrl.hostname) {
        url += parsedUrl.hostname;

        if (parsedUrl.port)
            url += ':' + parsedUrl.port;
    }

    if (parsedUrl.partAfterHost)
        url += parsedUrl.partAfterHost;

    return url;
}

export function handleUrlsSet (handler: Function, url: string, ...args) {
    const resourceUrls = url.split(',');
    const replacedUrls = [] as string[];

    for (const fullUrlStr of resourceUrls) {
        const [urlStr, postUrlStr] = fullUrlStr.replace(/ +/g, ' ').trim().split(' ');

        if (urlStr) {
            const replacedUrl = handler(urlStr, ...args);

            replacedUrls.push(replacedUrl + (postUrlStr ? ` ${postUrlStr}` : ''));
        }
    }

    return replacedUrls.join(',');
}

export function correctMultipleSlashes (url: string, pageProtocol = ''): string {
    // NOTE: Remove unnecessary slashes from the beginning of the url and after scheme.
    // For example:
    // "//////example.com" -> "//example.com" (scheme-less HTTP(S) URL)
    // "////home/testcafe/documents" -> "///home/testcafe/documents" (scheme-less unix file URL)
    // "http:///example.com" -> "http://example.com"
    //
    // And add missing slashes after the file scheme.
    // "file://C:/document.txt" -> "file:///C:/document.txt"
    if (url.match(FILE_RE) || pageProtocol.match(FILE_RE)) {
        return url
            .replace(/^(file:)?\/+(\/\/\/.*$)/i, '$1$2')
            .replace(/^(file:)?\/*([A-Za-z]):/i, '$1///$2:');
    }

    return url.replace(/^(https?:)?\/{1,100}(\/\/.*$)/i, '$1$2');
}

export function processSpecialChars (url: string | URL): string {
    return correctMultipleSlashes(getURLString(url));
}

export function ensureTrailingSlash (srcUrl: string, processedUrl: string): string {
    if (!isValidUrl(processedUrl))
        return processedUrl;

    const srcUrlEndsWithTrailingSlash       = TRAILING_SLASH_RE.test(srcUrl);
    const processedUrlEndsWithTrailingSlash = TRAILING_SLASH_RE.test(processedUrl);

    if (srcUrlEndsWithTrailingSlash && !processedUrlEndsWithTrailingSlash)
        processedUrl += '/';
    else if (srcUrl && !srcUrlEndsWithTrailingSlash && processedUrlEndsWithTrailingSlash)
        processedUrl = processedUrl.replace(TRAILING_SLASH_RE, '');

    return processedUrl;
}

export function isSpecialPage (url: string): boolean {
    return SPECIAL_PAGES.indexOf(url) !== -1;
}

export function isRelativeUrl (url: string): boolean {
    const parsedUrl = parseUrl(url);

    return parsedUrl.protocol !== 'file:' && !parsedUrl.host;
}

function isValidPort (port: string): boolean {
    const parsedPort = parseInt(port, 10);

    return parsedPort > 0 && parsedPort <= 65535;
}

export function isValidUrl (url: string): boolean {
    const parsedUrl = parseUrl(url);

    return parsedUrl.protocol === 'file:' || parsedUrl.protocol === 'about:' ||
        !!parsedUrl.hostname && (!parsedUrl.port || isValidPort(parsedUrl.port));
}

export function ensureOriginTrailingSlash (url: string): string {
    // NOTE: If you request an url containing only port, host and protocol
    // then browser adds the trailing slash itself.
    const parsedUrl = parseUrl(url);

    if (!parsedUrl.partAfterHost && parsedUrl.protocol && HTTP_RE.test(parsedUrl.protocol))
        return url + '/';

    return url;
}

export function omitDefaultPort (url: string): string {
    // NOTE: If you request an url containing default port
    // then browser remove this one itself.
    const parsedUrl = parseUrl(url);

    const hasDefaultPort = parsedUrl.protocol === 'https:' && parsedUrl.port === HTTPS_DEFAULT_PORT ||
                           parsedUrl.protocol === 'http:' && parsedUrl.port === HTTP_DEFAULT_PORT;

    if (hasDefaultPort) {
        parsedUrl.host = parsedUrl.hostname;
        parsedUrl.port = '';

        return formatUrl(parsedUrl);
    }

    return url;
}

export function prepareUrl (url: string): string {
    url = omitDefaultPort(url);
    url = ensureOriginTrailingSlash(url);

    return url;
}

export function updateScriptImportUrls (cachedScript: string, serverInfo: ServerInfo, sessionId: string, windowId?: string) {
    const regExp  = new RegExp('(' + serverInfo.protocol + '//' + serverInfo.hostname + ':(?:' + serverInfo.port + '|' +
        serverInfo.crossDomainPort + ')/)[^/' + REQUEST_DESCRIPTOR_VALUES_SEPARATOR + ']+', 'g');
    const pattern = '$1' + sessionId + (windowId ? REQUEST_DESCRIPTOR_SESSION_INFO_VALUES_SEPARATOR + windowId : '');

    return cachedScript.replace(regExp, pattern);
}

export function processMetaRefreshContent (content: string, urlReplacer: (url: string) => string): string {
    const match = content.match(META_REFRESH_RE);

    if (!match || !match[3])
        return content;

    return match[1] + urlReplacer(match[3]) + (match[4] || '');
}
