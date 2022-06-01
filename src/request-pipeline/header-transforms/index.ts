import { IncomingHttpHeaders, OutgoingHttpHeaders } from 'http';
import RequestPipelineContext from '../context';
import BUILTIN_HEADERS from '../builtin-header-names';
import { PREVENT_CACHING_HEADERS } from '../../utils/http';
import {
    requestTransforms,
    forcedRequestTransforms,
    responseTransforms,
    forcedResponseTransforms,
} from './transforms';


const FORCED_REQ_HEADERS_BROWSER_CASES = [
    {
        lowerCase:   BUILTIN_HEADERS.cookie,
        browserCase: 'Cookie',
    },
    {
        lowerCase:   BUILTIN_HEADERS.origin,
        browserCase: 'Origin',
    },
];

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

// NOTE: We doesn't send a cross-domain client request as cross-domain.
// Therefore, the "origin" header can be absent and we cannot decide its case. GH-2382
// The similar situation also occurs with the forced "cookie" header.
function calculateForcedHeadersCase (headers: OutgoingHttpHeaders, processedHeaders: object, headersNames: (string | void)[]) {
    const isBrowserRefererStartsWithUpperChar = processedHeaders.hasOwnProperty('Referer'); // eslint-disable-line no-prototype-builtins

    for (const { lowerCase, browserCase } of FORCED_REQ_HEADERS_BROWSER_CASES) {
        if (isBrowserRefererStartsWithUpperChar && headers.hasOwnProperty(lowerCase)) { // eslint-disable-line no-prototype-builtins
            processedHeaders[browserCase]                 = headers[lowerCase];
            headersNames[headersNames.indexOf(lowerCase)] = void 0;
        }
    }
}

function transformOriginHeaders (headers: OutgoingHttpHeaders, processedHeaders: object, headersNames: (string | undefined)[], rawHeaders: string[]): void {
    for (let i = 0; i < rawHeaders.length; i += 2) {
        const rawHeaderName           = rawHeaders[i];
        const lowerCasedRawHeaderName = rawHeaderName.toLowerCase();
        const headerIndex             = headersNames.indexOf(lowerCasedRawHeaderName);

        if (headerIndex > -1) {
            processedHeaders[rawHeaderName] = headers[lowerCasedRawHeaderName];
            headersNames[headerIndex]       = void 0;
        }
    }
}

function addServiceHeaders (headers: OutgoingHttpHeaders, processedHeaders: object, headersNames: (string | void)[]): void {
    for (const headerName of headersNames) {
        if (headerName !== void 0)
            processedHeaders[headerName as string] = headers[headerName as string];
    }
}

export function transformHeadersCaseToRaw (headers: OutgoingHttpHeaders, rawHeaders: string[] = []): object {
    const processedHeaders = {};
    const headersNames     = Object.keys(headers);

    transformOriginHeaders(headers, processedHeaders, headersNames, rawHeaders);
    calculateForcedHeadersCase(headers, processedHeaders, headersNames);
    addServiceHeaders(headers, processedHeaders, headersNames);

    return processedHeaders;
}

export function setupPreventCachingHeaders (headers: OutgoingHttpHeaders) {
    headers[BUILTIN_HEADERS.cacheControl] = PREVENT_CACHING_HEADERS[BUILTIN_HEADERS.cacheControl];
    headers[BUILTIN_HEADERS.pragma]       = PREVENT_CACHING_HEADERS[BUILTIN_HEADERS.pragma];

    delete headers[BUILTIN_HEADERS.eTag];
    delete headers[BUILTIN_HEADERS.expires];
}
