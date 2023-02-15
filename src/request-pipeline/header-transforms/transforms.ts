import RequestPipelineContext from '../context';
import BUILTIN_HEADERS from '../builtin-header-names';
import * as urlUtils from '../../utils/url';
import { parse as parseUrl, resolve as resolveUrl } from 'url';
import { shouldOmitCredentials } from '../same-origin-policy';

import {
    formatSyncCookie,
    generateDeleteSyncCookieStr,
    isOutdatedSyncCookie,
} from '../../utils/cookie';

import {
    addAuthenticatePrefix,
    hasAuthorizationPrefix,
    removeAuthorizationPrefix,
} from '../../utils/headers';


function skip (): undefined {
    return void 0;
}

function skipIfStateSnapshotIsApplied (src: string, ctx: RequestPipelineContext): string | undefined {
    return ctx.restoringStorages ? void 0 : src;
}

function transformAuthorizationHeader (src: string): string | undefined {
    return hasAuthorizationPrefix(src) ? removeAuthorizationPrefix(src) : void 0;
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
        const isCrossDomainLocationBeforeRedirect = !ctx.session.isCrossDomainDisabled() && !urlUtils.sameOriginCheck(ctx.dest.referer, ctx.dest.url);
        const isCrossDomainLocationAfterRedirect  = !ctx.session.isCrossDomainDisabled() && !urlUtils.sameOriginCheck(ctx.dest.referer, url);

        isCrossDomain = isCrossDomainLocationBeforeRedirect !== isCrossDomainLocationAfterRedirect;
    }
    else if (ctx.isAjax) {
        return ctx.toProxyUrl(url, isCrossDomain, ctx.contentInfo.contentTypeUrlToken,
            void 0, ctx.dest.reqOrigin, ctx.dest.credentials);
    }

    return ctx.toProxyUrl(url, isCrossDomain, ctx.contentInfo.contentTypeUrlToken);
}

function transformRefreshHeader (src: string, ctx: RequestPipelineContext) {
    return urlUtils.processMetaRefreshContent(src, url => resolveAndGetProxyUrl(url, ctx));
}

function processSetCookieHeader (src: string | string[], ctx: RequestPipelineContext) {
    const parsedCookies = src && !shouldOmitCredentials(ctx) ? ctx.session.cookies.setByServer(ctx.dest.url, src) : [];

    return generateSyncCookie(ctx, parsedCookies);
}

function transformContentDispositionHeader (src: string, ctx: RequestPipelineContext) {
    return ctx.contentInfo.isAttachment && !(src && src.includes('attachment')) ? 'attachment;' + (src || '') : src;
}

// Request headers
export const requestTransforms = {
    [BUILTIN_HEADERS.host]:    (_src, ctx) => ctx.dest.host,
    [BUILTIN_HEADERS.referer]: (_src: string, ctx: RequestPipelineContext) => {
        const referer = ctx.dest.referer;

        return referer && !urlUtils.isSpecialPage(referer) ? referer : void 0;
    },
    [BUILTIN_HEADERS.origin]:             (_src: string, ctx: RequestPipelineContext) => ctx.dest.reqOrigin || ctx.dest.domain,
    [BUILTIN_HEADERS.contentLength]:      (_src: string, ctx: RequestPipelineContext) => ctx.reqBody.length,
    [BUILTIN_HEADERS.cookie]:             skip,
    [BUILTIN_HEADERS.ifModifiedSince]:    skipIfStateSnapshotIsApplied,
    [BUILTIN_HEADERS.ifNoneMatch]:        skipIfStateSnapshotIsApplied,
    [BUILTIN_HEADERS.authorization]:      transformAuthorizationHeader,
    [BUILTIN_HEADERS.proxyAuthorization]: transformAuthorizationHeader,
};

export const forcedRequestTransforms = {
    [BUILTIN_HEADERS.cookie]: (_src: string, ctx: RequestPipelineContext) => {
        const isApiRequest = !!ctx.req.headers[BUILTIN_HEADERS.isApiRequest];

        if (isApiRequest)
            return ctx.req.headers[BUILTIN_HEADERS.cookie] || void 0;

        return shouldOmitCredentials(ctx) ? void 0 : ctx.session.cookies.getHeader(ctx.dest) || void 0;
    },
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
    [BUILTIN_HEADERS.wwwAuthenticate]:   addAuthenticatePrefix,
    [BUILTIN_HEADERS.proxyAuthenticate]: addAuthenticatePrefix,

    [BUILTIN_HEADERS.accessControlAllowOrigin]: (_src: string, ctx: RequestPipelineContext) =>
        ctx.isSameOriginPolicyFailed ? void 0 : ctx.getProxyOrigin(!!ctx.dest.reqOrigin),

    // NOTE: Change the transform type if we have an iframe with an image as src,
    // because it was transformed to HTML with the image tag.
    [BUILTIN_HEADERS.contentType]: (src: string, ctx: RequestPipelineContext) =>
        ctx.contentInfo.isIframeWithImageSrc || ctx.contentInfo.isTextPage ? 'text/html' : src,

    [BUILTIN_HEADERS.contentLength]: (src: string, ctx: RequestPipelineContext) =>
        ctx.contentInfo.requireProcessing ? ctx.destResBody.length.toString() : src,

    // NOTE: We should skip an invalid trailer header (GH-2692).
    [BUILTIN_HEADERS.trailer]: (src: string, ctx: RequestPipelineContext) =>
        ctx.destRes.headers[BUILTIN_HEADERS.transferEncoding] === 'chunked' ? src : void 0,

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

        const isCrossDomain = ctx.isIframe && !ctx.session.isCrossDomainDisabled() && !urlUtils.sameOriginCheck(ctx.dest.url, src);
        const proxiedUrl    = ctx.toProxyUrl(src, isCrossDomain, ctx.contentInfo.contentTypeUrlToken);

        return 'ALLOW-FROM ' + proxiedUrl;
    },

    [BUILTIN_HEADERS.sourceMap]:      skip,
    [BUILTIN_HEADERS.referrerPolicy]: () => 'unsafe-url',
    [BUILTIN_HEADERS.refresh]:        (src: string, ctx: RequestPipelineContext) => transformRefreshHeader(src, ctx),

    [BUILTIN_HEADERS.link]: (src: string) => {
        if (/[;\s]rel=\s*prefetch/i.test(src))
            return void 0;

        return src;
    },
};

export const forcedResponseTransforms = {
    [BUILTIN_HEADERS.setCookie]: processSetCookieHeader,

    [BUILTIN_HEADERS.serviceWorkerAllowed]: (_src: string, ctx: RequestPipelineContext) => ctx.dest.isServiceWorker ? '/' : void 0,
    [BUILTIN_HEADERS.contentDisposition]:   (_src: string, ctx: RequestPipelineContext) => transformContentDispositionHeader(_src, ctx),
};
