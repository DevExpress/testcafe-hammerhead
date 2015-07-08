import { trim } from './util';

var UrlUtil = {};

//Const
const PROTOCOL_RE        = /(^(\w+?\:))/;
const LEADING_SLASHES_RE = /^(\/\/)/;
const HOST_RE            = /^(.*?)(\/|%|\?|;|#|$)/;
const PORT_RE            = /:([0-9]*)$/;
const QUERY_AND_HASH_RE  = /(\?.+|#[^#]*)$/;

const URL_UTIL_PROTOCOL_IS_NOT_SUPPORTED  = 'CLIENT_URL_UTIL_PROTOCOL_IS_NOT_SUPPORTED';
const REQUEST_DESCRIPTOR_VALUES_SEPARATOR = '!';

const IFRAME = 'iframe';
const SCRIPT = 'script';

UrlUtil.URL_UTIL_PROTOCOL_IS_NOT_SUPPORTED  = URL_UTIL_PROTOCOL_IS_NOT_SUPPORTED;
UrlUtil.REQUEST_DESCRIPTOR_VALUES_SEPARATOR = REQUEST_DESCRIPTOR_VALUES_SEPARATOR;
UrlUtil.IFRAME                              = IFRAME;
UrlUtil.SCRIPT                              = SCRIPT;

function validateOriginUrl (url) {
    if (!/^https?:/.test(url)) {
        throw {
            code:      URL_UTIL_PROTOCOL_IS_NOT_SUPPORTED,
            originUrl: url
        };
    }
}

UrlUtil.isSubDomain = function (domain, subDomain) {
    domain    = domain.replace(/^www./i, '');
    subDomain = subDomain.replace(/^www./i, '');

    if (domain === subDomain)
        return true;

    var index = subDomain.lastIndexOf(domain);

    return subDomain[index - 1] === '.' && subDomain.length === index + domain.length;
};

UrlUtil.sameOriginCheck = function (location, checkedUrl) {
    if (!checkedUrl)
        return true;

    var parsedLocation      = UrlUtil.parseUrl(location);
    var parsedCheckedUrl    = UrlUtil.parseUrl(checkedUrl);
    var parsedProxyLocation = UrlUtil.parseProxyUrl(location);
    var parsedOriginUrl     = parsedProxyLocation ? parsedProxyLocation.originResourceInfo : parsedLocation;
    var isRelative          = !parsedCheckedUrl.host;

    if (isRelative ||
        parsedCheckedUrl.host === parsedLocation.host && parsedCheckedUrl.protocol === parsedLocation.protocol)
        return true;

    if (parsedOriginUrl) {
        var portsEq = !parsedOriginUrl.port && !parsedCheckedUrl.port ||
                      parsedOriginUrl.port && parsedOriginUrl.port.toString() === parsedCheckedUrl.port;

        if (parsedOriginUrl.protocol === parsedCheckedUrl.protocol && portsEq) {
            if (parsedOriginUrl.hostname === parsedCheckedUrl.hostname)
                return true;

            return UrlUtil.isSubDomain(parsedOriginUrl.hostname, parsedCheckedUrl.hostname) ||
                   UrlUtil.isSubDomain(parsedCheckedUrl.hostname, parsedOriginUrl.hostname);
        }
    }

    return false;
};

// NOTE: Convert origin protocol and hostname to lower case
// (https://github.com/superroma/testcafe-hammerhead/issues/1)
UrlUtil.convertHostToLowerCase = function (url) {
    var parsedUrl = UrlUtil.parseUrl(url);

    return (parsedUrl.protocol + '//' + parsedUrl.host).toLowerCase() + parsedUrl.partAfterHost;
};

UrlUtil.getProxyUrl = function (url, proxyHostname, proxyPort, jobUid, jobOwnerToken, resourceType) {
    validateOriginUrl(url);

    var params = [jobOwnerToken, jobUid];

    if (resourceType)
        params.push(resourceType);

    params = params.join(REQUEST_DESCRIPTOR_VALUES_SEPARATOR);

    return 'http://' + proxyHostname + ':' + proxyPort + '/' + params + '/' + UrlUtil.convertHostToLowerCase(url);
};

UrlUtil.getDomain = function (parsed) {
    return UrlUtil.formatUrl({
        protocol: parsed.protocol,
        host:     parsed.host,
        hostname: parsed.hostname,
        port:     parsed.port
    });
};

UrlUtil.parseProxyUrl = function (proxyUrl) {
    //TODO remove it
    var parsedUrl = UrlUtil.parseUrl(proxyUrl);

    if (!parsedUrl.partAfterHost)
        return null;

    var match = parsedUrl.partAfterHost.match(/^\/(\S+?)\/(https?:\/\/\S+)/);

    if (!match)
        return null;

    var params = match[1].split(REQUEST_DESCRIPTOR_VALUES_SEPARATOR);

    // NOTE: we should have at least job uid and owner token
    if (params.length < 2)
        return null;

    return {
        originUrl:          match[2],
        originResourceInfo: UrlUtil.parseUrl(match[2]),
        partAfterHost:      parsedUrl.partAfterHost,

        proxy: {
            hostname: parsedUrl.hostname,
            port:     parsedUrl.port
        },

        jobInfo: {
            ownerToken: params[0],
            uid:        params[1]
        },

        resourceType: params[2] || null
    };
};

UrlUtil.getPathname = function (path) {
    return path.replace(QUERY_AND_HASH_RE, '');
};

UrlUtil.parseUrl = function (url) {
    var parsed = {};

    url = UrlUtil.prepareUrl(url);

    if (!url)
        return parsed;

    url = trim(url);

    // Protocol
    var hasImplicitProtocol = false;
    var remainder           = url
        .replace(PROTOCOL_RE, function (str, protocol) {
            parsed.protocol = protocol;
            return '';
        })
        .replace(LEADING_SLASHES_RE, function () {
            hasImplicitProtocol = true;
            return '';
        });

    // NOTE: URL is relative
    if (!parsed.protocol && !hasImplicitProtocol) {
        parsed.partAfterHost = url;
        return parsed;
    }

    // Host
    parsed.partAfterHost = remainder
        .replace(HOST_RE, function (str, host, restPartSeparator) {
            parsed.host = host;
            return restPartSeparator;
        });

    if (parsed.host) {
        parsed.hostname = parsed.host.replace(PORT_RE, function (str, port) {
            parsed.port = port;
            return '';
        });
    }

    return parsed;
};

UrlUtil.isSupportedProtocol = function (url) {
    return !/^\s*(chrome-extension:|blob:|javascript:|about:|mailto:|tel:|data:|skype:|skypec2c:|file:|#)/i.test(url);
};

UrlUtil.resolveUrlAsOrigin = function (url, getProxyUrl) {
    getProxyUrl = getProxyUrl || UrlUtil.getProxyUrl;

    if (UrlUtil.isSupportedProtocol(url)) {
        var proxyUrl       = getProxyUrl(url);
        var parsedProxyUrl = UrlUtil.parseProxyUrl(proxyUrl);

        return UrlUtil.formatUrl(parsedProxyUrl.originResourceInfo);
    }

    return url;
};

UrlUtil.formatUrl = function (parsedUrl) {
    // NOTE: URL is relative
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
};

UrlUtil.prepareUrl = function (url) {
    // TODO: fix it
    /* eslint-disable no-undef */
    if (url === null && /iPad|iPhone/i.test(window.navigator.userAgent))
        return '';
    /* eslint-enable no-undef */

    url = (url + '').replace(/\n|\t/g, '');

    // NOTE: Remove unnecessary slashes form the begin of the url.
    // For example, "//////google.com" url is equal to "//google.com"
    return url.replace(/^\/+(\/\/.*$)/, '$1');
};

export default UrlUtil;
