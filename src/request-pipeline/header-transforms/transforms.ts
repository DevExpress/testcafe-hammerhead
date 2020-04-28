import RequestPipelineContext from '../context';
import BUILTIN_HEADERS from '../builtin-header-names';
import INTERNAL_HEADERS from '../internal-header-names';
import * as urlUtils from '../../utils/url';
import { parse as parseUrl, resolve as resolveUrl } from 'url';
import { shouldOmitCredentials } from '../xhr/same-origin-policy';
import {
    formatSyncCookie,
    generateDeleteSyncCookieStr,
    isOutdatedSyncCookie
} from '../../utils/cookie';

function skip (): undefined {
    return void 0;
}

function skipIfStateSnapshotIsApplied (src: string, ctx: RequestPipelineContext): string | undefined {
    return ctx.restoringStorages ? void 0 : src;
}

function transformAuthorizationHeader (src: string, ctx: RequestPipelineContext): string | undefined {
    return shouldOmitCredentials(ctx) ? void 0 : src;
}

function generateSyncCookie (ctx: RequestPipelineContext, parsedServerCookies) {
    parsedServerCookies = parsedServerCookies.filter(cookie => !cookie.httpOnly);

    let syncWithClientCookies = parsedServerCookies
        .map(cookie => {
            cookie.isServerSync = true;
            cookie.sid          = ctx.session.id;

            return formatSyncCookie(cookie);
        });

    if (ctx.parsedClientSyncCookie) {
        const outdatedSyncCookies = ctx.parsedClientSyncCookie.actual.filter(clientCookie => {
            if (clientCookie.isClientSync && !clientCookie.isWindowSync)
                return true;

            for (const serverCookie of parsedServerCookies) {
                if (isOutdatedSyncCookie(clientCookie, serverCookie))
                    return true;
            }

            return false;
        });

        syncWithClientCookies = ctx.parsedClientSyncCookie.outdated
            .concat(outdatedSyncCookies)
            .map(generateDeleteSyncCookieStr)
            .concat(syncWithClientCookies);
    }

    return syncWithClientCookies;
}

function resolveAndGetProxyUrl (url: string, ctx: RequestPipelineContext): string {
    url = urlUtils.prepareUrl(url);

    const { host }    = parseUrl(url);
    let isCrossDomain = false;

    if (!host)
        url = resolveUrl(ctx.dest.url, url);

    if (ctx.isIframe && ctx.dest.referer) {
        const isCrossDomainLocationBeforeRedirect = !urlUtils.sameOriginCheck(ctx.dest.referer, ctx.dest.url);
        const isCrossDomainLocationAfterRedirect  = !urlUtils.sameOriginCheck(ctx.dest.referer, url);

        isCrossDomain = isCrossDomainLocationBeforeRedirect !== isCrossDomainLocationAfterRedirect;
    }

    return ctx.toProxyUrl(url, isCrossDomain, ctx.contentInfo.contentTypeUrlToken);
}

function transformRefreshHeader (src: string, ctx: RequestPipelineContext) {
    return src.replace(/(url=)(.*)$/i, (_match, prefix, url) => prefix + resolveAndGetProxyUrl(url, ctx));
}

export function processSetCookieHeader (src: string | string[], ctx: RequestPipelineContext) {
    let parsedCookies = src && !shouldOmitCredentials(ctx) ? ctx.session.cookies.setByServer(ctx.dest.url, src) : [];

    return generateSyncCookie(ctx, parsedCookies);
}

// Request headers
export const requestTransforms = {
    [BUILTIN_HEADERS.host]:                (_src, ctx) => ctx.dest.host,
    [BUILTIN_HEADERS.referer]:             (_src: string, ctx: RequestPipelineContext) => ctx.dest.referer || void 0,
    [BUILTIN_HEADERS.origin]:              (src: string, ctx: RequestPipelineContext) => ctx.dest.reqOrigin || src,
    [BUILTIN_HEADERS.contentLength]:       (_src: string, ctx: RequestPipelineContext) => ctx.reqBody.length,
    [BUILTIN_HEADERS.cookie]:              skip,
    [BUILTIN_HEADERS.ifModifiedSince]:     skipIfStateSnapshotIsApplied,
    [BUILTIN_HEADERS.ifNoneMatch]:         skipIfStateSnapshotIsApplied,
    [BUILTIN_HEADERS.authorization]:       transformAuthorizationHeader,
    [BUILTIN_HEADERS.proxyAuthorization]:  transformAuthorizationHeader,
    [INTERNAL_HEADERS.origin]:             skip,
    [INTERNAL_HEADERS.credentials]:        skip,
    [INTERNAL_HEADERS.authorization]:      skip,
    [INTERNAL_HEADERS.proxyAuthorization]: skip
};

export const forcedRequestTransforms = {
    [BUILTIN_HEADERS.cookie]: (_src: string, ctx: RequestPipelineContext) =>
        shouldOmitCredentials(ctx) ? void 0 : ctx.session.cookies.getHeader(ctx.dest.url) || void 0,

    // NOTE: All browsers except Chrome don't send the 'Origin' header in case of the same domain XHR requests.
    // So, if the request is actually cross-domain, we need to force the 'Origin' header to support CORS. (B234325)
    [BUILTIN_HEADERS.origin]: (src: string, ctx: RequestPipelineContext) => {
        const force = ctx.isAjax && !src && ctx.dest.domain !== ctx.dest.reqOrigin;

        return force ? ctx.dest.reqOrigin : src;
    },

    [BUILTIN_HEADERS.authorization]: (_src: string, ctx: RequestPipelineContext) =>
        ctx.req.headers[INTERNAL_HEADERS.authorization],

    [BUILTIN_HEADERS.proxyAuthorization]: (_src: string, ctx: RequestPipelineContext) =>
        ctx.req.headers[INTERNAL_HEADERS.proxyAuthorization]
};

// Response headers
export const responseTransforms = {
    // NOTE: Disable Content Security Policy (see http://en.wikipedia.org/wiki/Content_Security_Policy).
    [BUILTIN_HEADERS.contentSecurityPolicy]:            skip,
    [BUILTIN_HEADERS.contentSecurityPolicyReportOnly]:  skip,
    [BUILTIN_HEADERS.xContentSecurityPolicy]:           skip,
    [BUILTIN_HEADERS.xContentSecurityPolicyReportOnly]: skip,
    [BUILTIN_HEADERS.xWebkitCsp]:                       skip,

    // NOTE: Even if we are not able to be authorized, we should prevent showing the native credentials window.
    [BUILTIN_HEADERS.wwwAuthenticate]:   skip,
    [BUILTIN_HEADERS.proxyAuthenticate]: skip,

    // NOTE: We perform CORS checks on our side, so we skip the related headers.
    [BUILTIN_HEADERS.accessControlAllowOrigin]: skip,

    // NOTE: Change the transform type if we have an iframe with an image as src,
    // because it was transformed to HTML with the image tag.
    [BUILTIN_HEADERS.contentType]: (src: string, ctx: RequestPipelineContext) =>
        ctx.contentInfo.isIframeWithImageSrc ? 'text/html' : src,

    [BUILTIN_HEADERS.contentLength]: (src: string, ctx: RequestPipelineContext) =>
        ctx.contentInfo.requireProcessing ? ctx.destResBody.length.toString() : src,

    [BUILTIN_HEADERS.location]: (src: string, ctx: RequestPipelineContext) => {
        // NOTE: The RFC 1945 standard requires location URLs to be absolute. However, most popular browsers
        // accept relative URLs. We transform relative URLs to absolute to correctly handle this situation.
        if (ctx.contentInfo.isRedirect)
            return resolveAndGetProxyUrl(src, ctx);

        return src;
    },

    [BUILTIN_HEADERS.xFrameOptions]: (src: string, ctx: RequestPipelineContext) => {
        const cspHeader = ctx.destRes.headers[BUILTIN_HEADERS.contentSecurityPolicy];

        if (cspHeader && cspHeader.includes('frame-ancestors '))
            return void 0;

        if (!src.includes('ALLOW-FROM'))
            return src;

        src = src.replace('ALLOW-FROM', '').trim();

        const isCrossDomain = ctx.isIframe && !urlUtils.sameOriginCheck(ctx.dest.url, src);
        const proxiedUrl = ctx.toProxyUrl(src, isCrossDomain, ctx.contentInfo.contentTypeUrlToken);

        return 'ALLOW-FROM ' + proxiedUrl;
    },

    [BUILTIN_HEADERS.sourceMap]:      skip,
    [BUILTIN_HEADERS.referrerPolicy]: () => 'unsafe-url',
    [BUILTIN_HEADERS.refresh]:        (src: string, ctx: RequestPipelineContext) => transformRefreshHeader(src, ctx),

    [BUILTIN_HEADERS.link]: (src: string) => {
        if (/[;\s]rel=\s*prefetch/i.test(src))
            return void 0;

        return src;
    }
};

export const forcedResponseTransforms = {
    [BUILTIN_HEADERS.setCookie]: processSetCookieHeader,

    [INTERNAL_HEADERS.wwwAuthenticate]: (_src: string, ctx: RequestPipelineContext) =>
        ctx.destRes.headers[BUILTIN_HEADERS.wwwAuthenticate],

    [INTERNAL_HEADERS.proxyAuthenticate]: (_src: string, ctx: RequestPipelineContext) =>
        ctx.destRes.headers[BUILTIN_HEADERS.proxyAuthenticate]
};
