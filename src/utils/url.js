// -------------------------------------------------------------
// WARNING: this file is used by both the client and the server.
// Do not use any browser or node-specific API!
// -------------------------------------------------------------

import { trim } from './string';

//Const
const PROTOCOL_RE        = /(^(\w+?\:))/;
const LEADING_SLASHES_RE = /^(\/\/)/;
const HOST_RE            = /^(.*?)(\/|%|\?|;|#|$)/;
const PORT_RE            = /:([0-9]*)$/;
const QUERY_AND_HASH_RE  = /(\?.+|#[^#]*)$/;

export const URL_UTIL_PROTOCOL_IS_NOT_SUPPORTED  = 'CLIENT_URL_UTIL_PROTOCOL_IS_NOT_SUPPORTED';
export const REQUEST_DESCRIPTOR_VALUES_SEPARATOR = '!';
export const IFRAME                              = 'iframe';
export const SCRIPT                              = 'script';

function validateDestUrl (url) {
    if (!/^https?:/.test(url)) {
        throw {
            code:    URL_UTIL_PROTOCOL_IS_NOT_SUPPORTED,
            destUrl: url
        };
    }
}

export function isSubDomain (domain, subDomain) {
    domain    = domain.replace(/^www./i, '');
    subDomain = subDomain.replace(/^www./i, '');

    if (domain === subDomain)
        return true;

    var index = subDomain.lastIndexOf(domain);

    return subDomain[index - 1] === '.' && subDomain.length === index + domain.length;
}

export function sameOriginCheck (location, checkedUrl) {
    if (!checkedUrl)
        return true;

    var parsedLocation      = parseUrl(location);
    var parsedCheckedUrl    = parseUrl(checkedUrl);
    var parsedProxyLocation = parseProxyUrl(location);
    var parsedDestUrl       = parsedProxyLocation ? parsedProxyLocation.destResourceInfo : parsedLocation;
    var isRelative          = !parsedCheckedUrl.host;

    if (isRelative ||
        parsedCheckedUrl.host === parsedLocation.host && parsedCheckedUrl.protocol === parsedLocation.protocol)
        return true;

    if (parsedDestUrl) {
        var portsEq = !parsedDestUrl.port && !parsedCheckedUrl.port ||
                      parsedDestUrl.port && parsedDestUrl.port.toString() === parsedCheckedUrl.port;

        if (parsedDestUrl.protocol === parsedCheckedUrl.protocol && portsEq) {
            if (parsedDestUrl.hostname === parsedCheckedUrl.hostname)
                return true;

            return isSubDomain(parsedDestUrl.hostname, parsedCheckedUrl.hostname) ||
                   isSubDomain(parsedCheckedUrl.hostname, parsedDestUrl.hostname);
        }
    }

    return false;
}

// NOTE: Convert the destination protocol and hostname to the lower case. (GH-1)
export function convertHostToLowerCase (url) {
    var parsedUrl = parseUrl(url);

    return (parsedUrl.protocol + '//' + parsedUrl.host).toLowerCase() + parsedUrl.partAfterHost;
}

export function getProxyUrl (url, proxyHostname, proxyPort, sessionId, resourceType, charset) {
    validateDestUrl(url);

    var params = [sessionId];

    if (resourceType)
        params.push(resourceType);

    if (charset)
        params.push(charset);

    params = params.join(REQUEST_DESCRIPTOR_VALUES_SEPARATOR);

    return 'http://' + proxyHostname + ':' + proxyPort + '/' + params + '/' + convertHostToLowerCase(url);
}

export function getDomain (parsed) {
    return formatUrl({
        protocol: parsed.protocol,
        host:     parsed.host,
        hostname: parsed.hostname,
        port:     parsed.port
    });
}

export function parseProxyUrl (proxyUrl) {
    // TODO: Remove it.
    var parsedUrl = parseUrl(proxyUrl);

    if (!parsedUrl.partAfterHost)
        return null;

    var match = parsedUrl.partAfterHost.match(/^\/(\S+?)\/(https?:\/\/\S+)/);

    if (!match)
        return null;

    var params = match[1].split(REQUEST_DESCRIPTOR_VALUES_SEPARATOR);

    // NOTE: We should have, at least, the job uid and the owner token.
    if (!params.length)
        return null;

    return {
        destUrl:          match[2],
        destResourceInfo: parseUrl(match[2]),
        partAfterHost:    parsedUrl.partAfterHost,

        proxy: {
            hostname: parsedUrl.hostname,
            port:     parsedUrl.port
        },

        sessionId:    params[0],
        resourceType: params[1] || null,
        charset:      params[2] || null
    };
}

export function getPathname (path) {
    return path.replace(QUERY_AND_HASH_RE, '');
}

export function parseUrl (url) {
    var parsed = {};

    url = prepareUrl(url);

    if (!url)
        return parsed;

    url = trim(url);

    // Protocol
    var hasImplicitProtocol = false;
    var remainder           = url
        .replace(PROTOCOL_RE, (str, protocol) => {
            parsed.protocol = protocol;
            return '';
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
            return restPartSeparator;
        });

    if (parsed.host) {
        parsed.hostname = parsed.host.replace(PORT_RE, (str, port) => {
            parsed.port = port;
            return '';
        });
    }

    return parsed;
}

export function isSupportedProtocol (url) {
    return !/^\s*(chrome-extension:|blob:|javascript:|about:|mailto:|tel:|data:|skype:|skypec2c:|file:|#)/i.test(url);
}

export function resolveUrlAsDest (url, getProxyUrlMeth) {
    getProxyUrlMeth = getProxyUrlMeth || getProxyUrl;

    if (isSupportedProtocol(url)) {
        var proxyUrl       = getProxyUrlMeth(url);
        var parsedProxyUrl = parseProxyUrl(proxyUrl);

        return formatUrl(parsedProxyUrl.destResourceInfo);
    }

    return url;
}

export function formatUrl (parsedUrl) {
    // NOTE: the URL is relative.
    if (!parsedUrl.host && (!parsedUrl.hostname || !parsedUrl.port))
        return parsedUrl.partAfterHost;

    var url = parsedUrl.protocol || '';

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

export function prepareUrl (url) {
    // TODO: fix it
    /* eslint-disable no-undef */
    if (url === null && /iPad|iPhone/i.test(window.navigator.userAgent))
        return '';
    /* eslint-enable no-undef */

    url = (url + '').replace(/\n|\t/g, '');

    // NOTE: Remove unnecessary slashes from the beginning of the url.
    // For example, the "//////google.com" url is equal to "//google.com".
    return url.replace(/^\/+(\/\/.*$)/, '$1');
}
