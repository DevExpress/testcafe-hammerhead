// -------------------------------------------------------------
// WARNING: this file is used by both the client and the server.
// Do not use any browser or node-specific API!
// -------------------------------------------------------------

import trim from './string-trim';

//Const
const PROTOCOL_RE        = /^([\w-]+?:)(\/\/|[^\\/]|$)/;
const LEADING_SLASHES_RE = /^(\/\/)/;
const HOST_RE            = /^(.*?)(\/|%|\?|;|#|$)/;
const PORT_RE            = /:([0-9]*)$/;
const QUERY_AND_HASH_RE  = /(\?.+|#[^#]*)$/;
const PATH_AFTER_HOST_RE = /^\/([^/]+?)\/([\S\s]+)$/;
const HTTP_RE            = /^(?:https?):/;
const FILE_RE            = /^file:/i;

export const SUPPORTED_PROTOCOL_RE               = /^(?:https?|file):/i;
export const HASH_RE                             = /^#/;
export const REQUEST_DESCRIPTOR_VALUES_SEPARATOR = '!';
export const TRAILING_SLASH_RE                   = /\/$/;
export const SPECIAL_PAGES                       = ['about:blank', 'about:error'];

export const HTTP_DEFAULT_PORT  = '80';
export const HTTPS_DEFAULT_PORT = '443';

export function parseResourceType (resourceType) {
    if (!resourceType) {
        return {
            isIframe:      false,
            isForm:        false,
            isScript:      false,
            isEventSource: false,
            isHtmlImport:  false,
            isWebSocket:   false
        };
    }

    return {
        isIframe:      /i/.test(resourceType),
        isForm:        /f/.test(resourceType),
        isScript:      /s/.test(resourceType),
        isEventSource: /e/.test(resourceType),
        isHtmlImport:  /h/.test(resourceType),
        isWebSocket:   /w/.test(resourceType)
    };
}

export function getResourceTypeString (resourceType) {
    resourceType = resourceType || {};

    if (!resourceType.isIframe && !resourceType.isForm && !resourceType.isScript && !resourceType.isEventSource &&
        !resourceType.isHtmlImport && !resourceType.isWebSocket)
        return null;

    return [
        resourceType.isIframe ? 'i' : '',
        resourceType.isForm ? 'f' : '',
        resourceType.isScript ? 's' : '',
        resourceType.isEventSource ? 'e' : '',
        resourceType.isHtmlImport ? 'h' : '',
        resourceType.isWebSocket ? 'w' : ''
    ].join('');
}

export function isSubDomain (domain, subDomain) {
    domain    = domain.replace(/^www./i, '');
    subDomain = subDomain.replace(/^www./i, '');

    if (domain === subDomain)
        return true;

    const index = subDomain.lastIndexOf(domain);

    return subDomain[index - 1] === '.' && subDomain.length === index + domain.length;
}

export function sameOriginCheck (location, checkedUrl, rejectForSubdomains) {
    if (!checkedUrl)
        return true;

    const parsedLocation      = parseUrl(location);
    const parsedCheckedUrl    = parseUrl(checkedUrl);
    const parsedProxyLocation = parseProxyUrl(location);
    const parsedDestUrl       = parsedProxyLocation ? parsedProxyLocation.destResourceInfo : parsedLocation;
    const isRelative          = !parsedCheckedUrl.host;

    if (isRelative ||
        parsedCheckedUrl.host === parsedLocation.host && parsedCheckedUrl.protocol === parsedLocation.protocol)
        return true;

    if (parsedDestUrl) {
        const portsEq = !parsedDestUrl.port && !parsedCheckedUrl.port ||
                        parsedDestUrl.port && parsedDestUrl.port.toString() === parsedCheckedUrl.port;

        if (parsedDestUrl.protocol === parsedCheckedUrl.protocol && portsEq) {
            if (parsedDestUrl.hostname === parsedCheckedUrl.hostname)
                return true;

            const isSubDomainHostname = isSubDomain(parsedDestUrl.hostname, parsedCheckedUrl.hostname) ||
                                        isSubDomain(parsedCheckedUrl.hostname, parsedDestUrl.hostname);

            return !rejectForSubdomains && isSubDomainHostname;
        }
    }

    return false;
}

// NOTE: Convert the destination protocol and hostname to the lower case. (GH-1)
function convertHostToLowerCase (url) {
    const parsedUrl             = parseUrl(url);
    const protocolHostSeparator = parsedUrl.protocol === 'about:' ? '' : '//';

    return (parsedUrl.protocol + protocolHostSeparator + parsedUrl.host).toLowerCase() + parsedUrl.partAfterHost;
}

export function getURLString (url) {
    // TODO: fix it
    // eslint-disable-next-line no-undef
    if (url === null && /iPad|iPhone/i.test(window.navigator.userAgent))
        return '';

    return String(url).replace(/\n|\t/g, '');
}

export function getProxyUrl (url, opts) {
    let params = [opts.sessionId];

    if (opts.resourceType)
        params.push(opts.resourceType);

    if (opts.charset)
        params.push(opts.charset.toLowerCase());

    if (opts.reqOrigin)
        params.push(opts.reqOrigin);

    params = params.join(REQUEST_DESCRIPTOR_VALUES_SEPARATOR);

    const proxyProtocol = opts.proxyProtocol || 'http:';

    return proxyProtocol + '//' + opts.proxyHostname + ':' + opts.proxyPort + '/' + params + '/' +
           convertHostToLowerCase(url);
}

export function getDomain (parsed) {
    return formatUrl({
        protocol: parsed.protocol,
        host:     parsed.host,
        hostname: parsed.hostname,
        port:     parsed.port
    });
}

function parseRequestDescriptor (desc) {
    const params = desc.split(REQUEST_DESCRIPTOR_VALUES_SEPARATOR);

    if (!params.length)
        return null;

    const sessionId    = params[0];
    const resourceType = params[1] || null;
    const resourceData = params[2] || null;
    const parsedDesc   = { sessionId, resourceType };

    if (resourceType && resourceData) {
        const parsedResourceType = parseResourceType(resourceType);

        if (parsedResourceType.isScript)
            parsedDesc.charset = resourceData;
        else if (parsedResourceType.isWebSocket)
            parsedDesc.reqOrigin = decodeURIComponent(resourceData);
    }

    return parsedDesc;
}

export function parseProxyUrl (proxyUrl) {
    // TODO: Remove it.
    const parsedUrl = parseUrl(proxyUrl);

    if (!parsedUrl.partAfterHost)
        return null;

    const match = parsedUrl.partAfterHost.match(PATH_AFTER_HOST_RE);

    if (!match)
        return null;

    const parsedDesc = parseRequestDescriptor(match[1]);

    // NOTE: We should have, at least, the job uid and the owner token.
    if (!parsedDesc)
        return null;

    const destUrl = match[2];

    if (!isSpecialPage(destUrl) && !SUPPORTED_PROTOCOL_RE.test(destUrl))
        return null;

    const destResourceInfo = !isSpecialPage(destUrl) ? parseUrl(match[2]) : {
        protocol:      'about:',
        host:          '',
        hostname:      '',
        port:          '',
        partAfterHost: ''
    };

    return {
        destUrl:          destUrl,
        destResourceInfo: destResourceInfo,
        partAfterHost:    parsedUrl.partAfterHost,

        proxy: {
            hostname: parsedUrl.hostname,
            port:     parsedUrl.port
        },

        sessionId:    parsedDesc.sessionId,
        resourceType: parsedDesc.resourceType,
        charset:      parsedDesc.charset,
        reqOrigin:    parsedDesc.reqOrigin
    };
}

export function getPathname (path) {
    return path.replace(QUERY_AND_HASH_RE, '');
}

export function parseUrl (url) {
    const parsed = {};

    url = processSpecialChars(url);

    if (!url)
        return parsed;

    url = trim(url);

    // Protocol
    let hasImplicitProtocol = false;
    const remainder         = url
        .replace(PROTOCOL_RE, (str, protocol, strAfterProtocol) => {
            parsed.protocol = protocol;
            return strAfterProtocol;
        })
        .replace(LEADING_SLASHES_RE, () => {
            hasImplicitProtocol = true;
            return '';
        });

    // NOTE: the URL is relative.
    if (!parsed.protocol && !hasImplicitProtocol) {
        parsed.partAfterHost = url;
        return parsed;
    }

    // Host
    parsed.partAfterHost = remainder
        .replace(HOST_RE, (str, host, restPartSeparator) => {
            parsed.host = host;
            parsed.port = '';
            return restPartSeparator;
        });

    parsed.hostname = parsed.host ? parsed.host.replace(PORT_RE, (str, port) => {
        parsed.port = port;
        return '';
    }) : '';

    return parsed;
}

export function isSupportedProtocol (url) {
    url = trim(url || '');

    const isHash = HASH_RE.test(url);

    if (isHash)
        return false;

    const protocol = url.match(PROTOCOL_RE);

    if (!protocol)
        return true;

    return SUPPORTED_PROTOCOL_RE.test(protocol[0]);
}

export function resolveUrlAsDest (url, getProxyUrlMeth) {
    getProxyUrlMeth = getProxyUrlMeth || getProxyUrl;

    if (isSupportedProtocol(url)) {
        const proxyUrl       = getProxyUrlMeth(url);
        const parsedProxyUrl = parseProxyUrl(proxyUrl);

        return parsedProxyUrl ? formatUrl(parsedProxyUrl.destResourceInfo) : url;
    }

    return url;
}

export function formatUrl (parsedUrl) {
    // NOTE: the URL is relative.
    if (parsedUrl.protocol !== 'file:' && !parsedUrl.host && (!parsedUrl.hostname || !parsedUrl.port))
        return parsedUrl.partAfterHost;

    let url = parsedUrl.protocol || '';

    url += '//';

    if (parsedUrl.username || parsedUrl.password)
        url += parsedUrl.username + ':' + parsedUrl.password + '@';

    if (parsedUrl.host)
        url += parsedUrl.host;

    else {
        url += parsedUrl.hostname;

        if (parsedUrl.port)
            url += ':' + parsedUrl.port;
    }

    if (parsedUrl.partAfterHost)
        url += parsedUrl.partAfterHost;

    return url;
}

export function correctMultipleSlashes (url, pageProtocol = '') {
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

    return url.replace(/^(https?:)?\/+(\/\/.*$)/i, '$1$2');
}

export function processSpecialChars (url) {
    return correctMultipleSlashes(getURLString(url));
}

export function ensureTrailingSlash (srcUrl, processedUrl) {
    if (!isValidUrl(processedUrl))
        return processedUrl;

    const srcUrlEndsWithTrailingSlash       = TRAILING_SLASH_RE.test(srcUrl);
    const processedUrlEndsWithTrailingSlash = TRAILING_SLASH_RE.test(processedUrl);

    if (srcUrlEndsWithTrailingSlash && !processedUrlEndsWithTrailingSlash)
        processedUrl += '/';
    else if (!srcUrlEndsWithTrailingSlash && processedUrlEndsWithTrailingSlash)
        processedUrl = processedUrl.replace(TRAILING_SLASH_RE, '');

    return processedUrl;
}

export function isSpecialPage (url) {
    return SPECIAL_PAGES.indexOf(url) !== -1;
}

export function isRelativeUrl (url) {
    const parsedUrl = parseUrl(url);

    return parsedUrl.protocol !== 'file:' && !parsedUrl.host;
}

function isValidPort (port) {
    const parsedPort = parseInt(port, 10);

    return parsedPort > 0 && parsedPort <= 65535;
}

export function isValidUrl (url) {
    const parsedUrl = parseUrl(url);

    return parsedUrl.protocol === 'file:' || parsedUrl.hostname && (!parsedUrl.port || isValidPort(parsedUrl.port));
}

export function ensureOriginTrailingSlash (url) {
    // NOTE: If you request an url containing only port, host and protocol
    // then browser adds the trailing slash itself.
    const parsedUrl = parseUrl(url);

    if (!parsedUrl.partAfterHost && HTTP_RE.test(parsedUrl.protocol))
        return url + '/';

    return url;
}

export function omitDefaultPort (url) {
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

export function prepareUrl (url) {
    url = omitDefaultPort(url);
    url = ensureOriginTrailingSlash(url);

    return url;
}
