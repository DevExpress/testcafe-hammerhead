import XHR_HEADERS from './xhr/headers';
import AUTHORIZATION from './xhr/authorization';
import * as urlUtils from '../utils/url';
import { parse as parseUrl, resolve as resolveUrl } from 'url';

// Skipping transform
function skip () {
    return void 0;
}

function isCrossDomainXhrWithoutCredentials (ctx) {
    return ctx.isXhr && !!ctx.req.headers[XHR_HEADERS.corsSupported] && !ctx.req.headers[XHR_HEADERS.withCredentials] &&
           ctx.dest.reqOrigin !== ctx.dest.domain;
}

function transformAuthorizationHeader (src, ctx) {
    if (src.indexOf(AUTHORIZATION.valuePrefix) !== -1)
        return src.replace(AUTHORIZATION.valuePrefix, '');

    return isCrossDomainXhrWithoutCredentials(ctx) ? void 0 : src;
}

function transformCookieForFetch (src, ctx) {
    var requestCredentials = ctx.req.headers[XHR_HEADERS.fetchRequestCredentials];

    switch (requestCredentials) {
        case 'omit':
            return void 0;
        case 'same-origin':
            return ctx.dest.reqOrigin === ctx.dest.domain ? src : void 0;
        case 'include':
            return src;
        default:
            return void 0;
    }
}

function transformCookie (src, ctx) {
    if (ctx.isXhr)
        return isCrossDomainXhrWithoutCredentials(ctx) ? void 0 : src;
    else if (ctx.isFetch)
        return transformCookieForFetch(src, ctx);

    return src;
}

// Request headers
var requestTransforms = Object.assign({
    'host':                                (src, ctx) => ctx.dest.host,
    'referer':                             (src, ctx) => ctx.dest.referer || void 0,
    'origin':                              (src, ctx) => ctx.dest.reqOrigin || src,
    'content-length':                      (src, ctx) => ctx.reqBody.length,
    'cookie':                              skip,
    [XHR_HEADERS.requestMarker]:           skip,
    [XHR_HEADERS.corsSupported]:           skip,
    [XHR_HEADERS.withCredentials]:         skip,
    [XHR_HEADERS.origin]:                  skip,
    [XHR_HEADERS.fetchRequestCredentials]: skip
}, AUTHORIZATION.headers.reduce((obj, header) => {
    obj[header] = transformAuthorizationHeader;

    return obj;
}, {}));

var requestForced = {
    'cookie': (src, ctx) => transformCookie(ctx.session.cookies.getHeader(ctx.dest.url) || void 0, ctx),

    // NOTE: All browsers except Chrome don't send the 'Origin' header in case of the same domain XHR requests.
    // So, if the request is actually cross-domain, we need to force the 'Origin' header to support CORS. (B234325)
    'origin': (src, ctx) => {
        var force = (ctx.isXhr || ctx.isFetch) && !src && ctx.dest.domain !== ctx.dest.reqOrigin;

        return force ? ctx.dest.reqOrigin : src;
    }
};


// Response headers
var responseTransforms = {
    'set-cookie': (src, ctx) => {
        if (src) {
            var cookies = Array.isArray(src) ? src : [src];

            cookies = cookies.filter(cookieStr => !!cookieStr);
            ctx.session.cookies.setByServer(ctx.dest.url, cookies);
        }

        // NOTE: Delete header.
        return void 0;
    },

    // NOTE: Disable Content Security Policy (see http://en.wikipedia.org/wiki/Content_Security_Policy).
    'content-security-policy':               skip,
    'content-security-policy-report-only':   skip,
    'x-content-security-policy':             skip,
    'x-content-security-policy-report-only': skip,
    'x-webkit-csp':                          skip,

    // NOTE: Even if we are not able to be authorized, we should prevent showing the native credentials window.
    'www-authenticate': skip,

    // NOTE: We perform CORS checks on our side, so we skip the related headers.
    'access-control-allow-origin': skip,

    // NOTE: Change the transform type if we have an iframe with an image as src,
    // because it was transformed to HTML with the image tag.
    'content-type':   (src, ctx) => ctx.contentInfo.isIframeWithImageSrc ? 'text/html' : src,
    'content-length': (src, ctx) => ctx.contentInfo.requireProcessing ? ctx.destResBody.length : src,

    'location': (src, ctx) => {
        // NOTE: The RFC 1945 standard requires location URLs to be absolute. However, most popular browsers
        // accept relative URLs. We transform relative URLs to absolute to correctly handle this situation.
        var { host } = parseUrl(src);

        if (!host)
            src = resolveUrl(ctx.dest.url, src);

        var isCrossDomain = ctx.isIframe && !urlUtils.sameOriginCheck(ctx.dest.url, src);

        return ctx.toProxyUrl(src, isCrossDomain, ctx.contentInfo.contentTypeUrlToken);
    },

    'x-frame-options': (src, ctx) => {
        if (src.indexOf('ALLOW-FROM') === -1)
            return src;

        src = src.replace('ALLOW-FROM', '').trim();

        var isCrossDomain = ctx.isIframe && !urlUtils.sameOriginCheck(ctx.dest.url, src);
        var proxiedUrl    = ctx.toProxyUrl(src, isCrossDomain, ctx.contentInfo.contentTypeUrlToken);

        return 'ALLOW-FROM ' + proxiedUrl;
    },

    'sourcemap': skip
};

var responseForced = {
    [XHR_HEADERS.setCookie]: (src, ctx) => {
        if (ctx.isXhr && ctx.destRes && ctx.destRes.headers && ctx.destRes.headers['set-cookie']) {
            var setCookieHeader = ctx.destRes.headers['set-cookie'];
            var cookieArr       = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];

            return JSON.stringify(cookieArr);
        }

        return void 0;
    }
};

// Transformation routine
function transformHeaders (srcHeaders, ctx, transformList, forced) {
    var destHeaders = {};

    var applyTransform = function (headerName, headers, transforms) {
        var src       = headers[headerName];
        var transform = transforms[headerName];
        var dest      = transform ? transform(src, ctx) : src;

        if (dest !== void 0)
            destHeaders[headerName] = dest;
    };

    Object.keys(srcHeaders).forEach(headerName => applyTransform(headerName, srcHeaders, transformList));

    if (forced)
        Object.keys(forced).forEach(headerName => applyTransform(headerName, destHeaders, forced));

    return destHeaders;
}

// API
export function forRequest (ctx) {
    return transformHeaders(ctx.req.headers, ctx, requestTransforms, requestForced);
}

export function forResponse (ctx) {
    return transformHeaders(ctx.destRes.headers, ctx, responseTransforms, responseForced);
}
