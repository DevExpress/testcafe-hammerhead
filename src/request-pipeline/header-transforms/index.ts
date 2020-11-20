import { IncomingHttpHeaders, OutgoingHttpHeaders } from 'http';
import RequestPipelineContext from '../context';
import BUILTIN_HEADERS from '../builtin-header-names';
import {
    requestTransforms,
    forcedRequestTransforms,
    responseTransforms,
    forcedResponseTransforms
} from './transforms';

import { PREVENT_CACHING_HEADERS } from '../../utils/http';

function transformHeaders (srcHeaders, ctx: RequestPipelineContext, transformList, forcedTransforms) {
    const destHeaders = {};

    const applyTransform = function (headerName, headers, transforms) {
        const src       = headers[headerName];
        const transform = transforms[headerName];
        const dest      = transform ? transform(src, ctx) : src;

        if (dest !== void 0)
            destHeaders[headerName] = dest;
    };

    Object.keys(srcHeaders).forEach(headerName => applyTransform(headerName, srcHeaders, transformList));

    if (forcedTransforms)
        Object.keys(forcedTransforms).forEach(headerName => applyTransform(headerName, destHeaders, forcedTransforms));

    return destHeaders;
}

// API
export function forRequest (ctx: RequestPipelineContext): IncomingHttpHeaders {
    return transformHeaders(ctx.req.headers, ctx, requestTransforms, forcedRequestTransforms);
}

export function forResponse (ctx: RequestPipelineContext): OutgoingHttpHeaders {
    return transformHeaders(ctx.destRes.headers, ctx, responseTransforms, forcedResponseTransforms);
}

export function transformHeadersCaseToRaw (headers: OutgoingHttpHeaders, rawHeaders: string[]) {
    const processedHeaders = {};
    const headersNames     = Object.keys(headers);

    for (let i = 0; i < rawHeaders.length; i += 2) {
        const rawHeaderName = rawHeaders[i];
        const headerName    = rawHeaderName.toLowerCase();
        const headerIndex   = headersNames.indexOf(headerName);

        if (headerIndex > -1) {
            processedHeaders[rawHeaderName] = headers[headerName];
            headersNames[headerIndex]       = void 0;
        }
    }

    // NOTE: We doesn't send a cross-domain client request as cross-domain.
    // Therefore, the origin header can be absent and we cannot decide its case. GH-2382
    if (headers.hasOwnProperty('origin') && processedHeaders.hasOwnProperty('Referer')) {
        processedHeaders['Origin']                   = headers['origin'];
        headersNames[headersNames.indexOf('origin')] = void 0;
    }

    for (const headerName of headersNames) {
        if (headerName !== void 0)
            processedHeaders[headerName] = headers[headerName];
    }

    return processedHeaders;
}

export function setupPreventCachingHeaders (headers: OutgoingHttpHeaders) {
    headers[BUILTIN_HEADERS.cacheControl] = PREVENT_CACHING_HEADERS[BUILTIN_HEADERS.cacheControl];
    headers[BUILTIN_HEADERS.pragma]       = PREVENT_CACHING_HEADERS[BUILTIN_HEADERS.pragma];

    delete headers[BUILTIN_HEADERS.eTag];
    delete headers[BUILTIN_HEADERS.expires];
}
