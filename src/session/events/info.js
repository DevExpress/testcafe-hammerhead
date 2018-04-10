export function createRequestInfo (ctx, opts) {
    return {
        requestId: ctx.requestId,
        userAgent: opts.headers['user-agent'],
        url:       opts.url,
        method:    opts.method.toLowerCase(),
        isAjax:    ctx.isXhr || ctx.isFetch,
        headers:   opts.headers,
        body:      opts.body,
        sessionId: ctx.session.id
    };
}

export function createResponseInfo (ctx) {
    return {
        requestId:  ctx.requestId,
        headers:    ctx.destRes.headers,
        body:       ctx.nonProcessedDestResBody,
        statusCode: ctx.destRes.statusCode,
        sessionId:  ctx.session.id
    };
}

export function prepareEventData (eventData, opts) {
    const clonedEventData = Object.assign({}, eventData);

    if (!opts.includeHeaders)
        delete clonedEventData.headers;

    if (!opts.includeBody)
        delete clonedEventData.body;

    return clonedEventData;
}
