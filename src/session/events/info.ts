import RequestPipelineContext from '../../request-pipeline/context';
import ConfigureResponseEventOptions from './configure-response-event-options';
import { IncomingHttpHeaders } from 'http';
import SAME_ORIGIN_CHECK_FAILED_STATUS_CODE from '../../request-pipeline/xhr/same-origin-check-failed-status-code';

export class RequestInfo {
    readonly requestId: string;
    readonly userAgent: string;
    readonly url: string;
    readonly method: string;
    readonly isAjax: boolean;
    readonly headers: IncomingHttpHeaders;
    readonly body: string | Buffer;
    readonly sessionId: string;

    constructor (ctx: RequestPipelineContext) {
        this.requestId = ctx.requestId;
        this.userAgent = ctx.reqOpts.headers['user-agent'] || '';
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

    constructor (ctx: RequestPipelineContext) {
        this.requestId  = ctx.requestId;
        this.headers    = ctx.destRes.headers;
        this.body       = ctx.nonProcessedDestResBody;
        this.statusCode = ctx.isSameOriginPolicyFailed ? SAME_ORIGIN_CHECK_FAILED_STATUS_CODE : ctx.destRes.statusCode;
        this.sessionId  = ctx.session.id;
    }
}

export class PreparedResponseInfo {
    readonly requestId: string;
    readonly statusCode: number;
    readonly sessionId: string;
    readonly headers?: { [name: string]: string|string[] };
    readonly body?: Buffer;

    constructor (responseInfo: ResponseInfo, opts: ConfigureResponseEventOptions) {
        this.requestId  = responseInfo.requestId;
        this.statusCode = responseInfo.statusCode;
        this.sessionId  = responseInfo.sessionId;

        if (opts.includeHeaders)
            this.headers = responseInfo.headers;

        if (opts.includeBody)
            this.body = responseInfo.body;
    }
}
