import RequestPipelineContext from '../../request-pipeline/context';
import ConfigureResponseEventOptions from './configure-response-event-options';
import { OutgoingHttpHeaders } from 'http';

export class RequestInfo {
    readonly requestId: string;
    readonly userAgent: string;
    readonly url: string;
    readonly method: string;
    readonly isAjax: boolean;
    readonly headers: OutgoingHttpHeaders;
    readonly body: string | Buffer;
    readonly sessionId: string;

    constructor (ctx: RequestPipelineContext) {
        this.requestId = ctx.requestId;
        this.userAgent = (ctx.reqOpts.headers['user-agent'] || '').toString();
        this.url       = ctx.reqOpts.url;
        this.method    = ctx.reqOpts.method.toLowerCase();
        this.isAjax    = ctx.isAjax;
        this.headers   = ctx.reqOpts.headers;
        this.body      = ctx.reqOpts.body;
        this.sessionId = ctx.session.id;
    }
}

export class ResponseInfo {
    readonly requestId: string;
    readonly statusCode: number;
    readonly sessionId: string;
    readonly headers: { [name: string]: string|string[] };
    readonly body: Buffer;
    readonly isSameOriginPolicyFailed: boolean;

    constructor (ctx: RequestPipelineContext) {
        this.requestId  = ctx.requestId;
        this.headers    = ctx.destRes.headers;
        this.body       = ctx.nonProcessedDestResBody;
        this.statusCode = ctx.destRes.statusCode;
        this.sessionId  = ctx.session.id;

        this.isSameOriginPolicyFailed = ctx.isSameOriginPolicyFailed;
    }
}

export class PreparedResponseInfo {
    readonly requestId: string;
    readonly statusCode: number;
    readonly sessionId: string;
    readonly headers?: { [name: string]: string|string[] };
    readonly body?: Buffer;
    readonly isSameOriginPolicyFailed: boolean;

    constructor (responseInfo: ResponseInfo, opts: ConfigureResponseEventOptions) {
        this.requestId  = responseInfo.requestId;
        this.statusCode = responseInfo.statusCode;
        this.sessionId  = responseInfo.sessionId;

        this.isSameOriginPolicyFailed = responseInfo.isSameOriginPolicyFailed;

        if (opts.includeHeaders)
            this.headers = responseInfo.headers;

        if (opts.includeBody)
            this.body = responseInfo.body;
    }
}
