/*eslint-disable no-unused-vars*/
import RequestPipelineContext from '../../request-pipeline/context';
/*eslint-enable no-unused-vars*/

export class RequestInfo {
    requestId: string;
    userAgent: string | void;
    url: string;
    method: string;
    isAjax: boolean;
    headers: Array<string>;
    body: string | Buffer;
    sessionId: string;

    constructor (ctx: RequestPipelineContext, opts) {
        this.requestId = ctx.requestId;
        this.userAgent = opts.headers['user-agent'];
        this.url       = opts.url;
        this.method    = opts.method.toLowerCase();
        this.isAjax    = ctx.isXhr || ctx.isFetch;
        this.headers   = opts.headers;
        this.body      = opts.body;
        this.sessionId = ctx.session.id;
    }
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
