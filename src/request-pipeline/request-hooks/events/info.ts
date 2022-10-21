import RequestPipelineContext from '../../context';
import ConfigureResponseEventOptions from './configure-response-event-options';
import { OutgoingHttpHeaders } from 'http';
import BUILTIN_HEADER_NAMES from '../../builtin-header-names';

export class RequestInfo {
    public readonly requestId: string;
    public readonly userAgent: string;
    public readonly url: string;
    public readonly method: string;
    public readonly isAjax: boolean;
    public readonly headers: OutgoingHttpHeaders;
    public readonly body: string | Buffer;
    public readonly sessionId: string;

    constructor (init: RequestInfo) {
        Object.assign(this, init);
    }

    public static getUserAgent (headers: any): string {
        const userAgentKey = Object
            .keys(headers)
            .find(key => key.toLowerCase() === BUILTIN_HEADER_NAMES.userAgent);

        return userAgentKey
            ? headers[userAgentKey]
            : '';
    }

    public static from (ctx: RequestPipelineContext): RequestInfo {
        const requestId = ctx.requestId;
        const userAgent = RequestInfo.getUserAgent(ctx.reqOpts.headers);
        const url       = ctx.isWebSocket ? ctx.reqOpts.url.replace(/^http/, 'ws') : ctx.reqOpts.url;
        const method    = ctx.reqOpts.method.toLowerCase();
        const isAjax    = ctx.isAjax;
        const headers   = ctx.reqOpts.headers;
        const body      = ctx.reqOpts.body;
        const sessionId = ctx.session.id;

        return new RequestInfo({
            requestId,
            userAgent,
            url,
            method,
            isAjax,
            headers,
            body,
            sessionId,
        });
    }
}

export class ResponseInfo {
    public readonly requestId: string;
    public readonly statusCode: number;
    public readonly sessionId: string;
    public readonly headers: OutgoingHttpHeaders;
    public readonly body: Buffer;
    public readonly isSameOriginPolicyFailed: boolean;

    constructor (init: ResponseInfo) {
        Object.assign(this, init);
    }

    public static from (ctx: RequestPipelineContext): ResponseInfo {
        const requestId                = ctx.requestId;
        const headers                  = ctx.destRes.headers;
        const body                     = ctx.nonProcessedDestResBody;
        const sessionId                = ctx.session.id;
        const statusCode               = ctx.destRes.statusCode || 200;
        const isSameOriginPolicyFailed = ctx.isSameOriginPolicyFailed;

        return new ResponseInfo({
            requestId,
            statusCode,
            sessionId,
            headers,
            body,
            isSameOriginPolicyFailed,
        });
    }
}

export class PreparedResponseInfo {
    public readonly requestId: string;
    public readonly statusCode: number;
    public readonly sessionId: string;
    public headers?: OutgoingHttpHeaders;
    public body?: Buffer;
    public readonly isSameOriginPolicyFailed: boolean;

    constructor (responseInfo: ResponseInfo, opts: ConfigureResponseEventOptions) {
        Object.assign(this, responseInfo);

        if (!opts.includeHeaders)
            delete this.headers;

        if (!opts.includeBody)
            delete this.body;
    }
}
