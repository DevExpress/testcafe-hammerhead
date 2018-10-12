import {
    transformHeaders,
    requestTransforms,
    requestForced,
    responseTransforms,
    responseForced
} from './header-transforms';

export function forRequest (ctx) {
    return transformHeaders(ctx.req.headers, ctx, requestTransforms, requestForced);
}

export function forResponse (ctx) {
    return transformHeaders(ctx.destRes.headers, ctx, responseTransforms, responseForced);
}

export function transformHeadersCaseToRaw (headers, rawHeaders) {
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
