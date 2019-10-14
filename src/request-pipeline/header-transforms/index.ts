import { IncomingHttpHeaders, OutgoingHttpHeaders } from 'http';
import RequestPipelineContext from '../context';
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

export function transformHeadersCaseToRaw (headers: OutgoingHttpHeaders, rawHeaders) {
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

    for (const headerName of headersNames) {
        if (headerName !== void 0)
            processedHeaders[headerName] = headers[headerName];
    }

    return processedHeaders;
}

export function setupPreventCachingHeaders (headers: OutgoingHttpHeaders) {
    headers['cache-control'] = PREVENT_CACHING_HEADERS['cache-control'];
    headers['pragma']        = PREVENT_CACHING_HEADERS['pragma'];

    delete headers['etag'];
    delete headers['expires'];
}
