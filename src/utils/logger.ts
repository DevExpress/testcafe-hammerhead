import debug from 'debug';
import RequestPipelineContext from '../request-pipeline/context';
import { IncomingMessage, OutgoingHttpHeaders } from 'http';
import { ServiceMessage } from '../typings/proxy';
import RequestOptions from '../request-pipeline/request-options';
import errToString from './err-to-string';
import { Http2Response } from '../request-pipeline/destination-request/http2';
import RequestFilterRule from '../request-pipeline/request-hooks/request-filter-rule';
import { IncomingMessageLikeInitOptions } from '../request-pipeline/incoming-message-like';

function getIncorrectErrorTypeMessage (err: object) {
    const errType = typeof err;

    return `The "${errToString(err)}" error of the "${errType}" type was passed. Make sure that service message handlers throw errors of the Error type.`;
}

debug.formatters.i = (ctx: RequestPipelineContext): string => {
    const stringifiedInfoArr: string[] = [];
    const contentInfo = ctx.contentInfo;

    if (ctx.isPage)
        stringifiedInfoArr.push('isPage');

    if (ctx.isIframe)
        stringifiedInfoArr.push('isIframe');

    if (ctx.isAjax)
        stringifiedInfoArr.push('isAjax');

    if (ctx.isWebSocket)
        stringifiedInfoArr.push('isWebSocket');

    if (contentInfo.isCSS)
        stringifiedInfoArr.push('isCSS');

    if (contentInfo.isScript)
        stringifiedInfoArr.push('isScript');

    if (contentInfo.isManifest)
        stringifiedInfoArr.push('isManifest');

    if (contentInfo.isFileDownload)
        stringifiedInfoArr.push('isFileDownload');

    if (ctx.contentInfo.isNotModified)
        stringifiedInfoArr.push('isNotModified');

    if (contentInfo.isRedirect)
        stringifiedInfoArr.push('isRedirect');

    if (contentInfo.isIframeWithImageSrc)
        stringifiedInfoArr.push('isIframeWithImageSrc');

    if (contentInfo.charset)
        stringifiedInfoArr.push('charset: ' + contentInfo.charset.get());

    stringifiedInfoArr.push('encoding: ' + contentInfo.encoding);
    stringifiedInfoArr.push('requireProcessing: ' + contentInfo.requireProcessing);

    return `{ ${stringifiedInfoArr.join(', ')} }`;
};

const testcafe                = debug('testcafe');
const hammerhead              = testcafe.extend('hammerhead');
const proxyLogger             = hammerhead.extend('proxy');
const destinationLogger       = hammerhead.extend('destination');
const http2DestinationLogger  = destinationLogger.extend('http2');
const cachedDestinationLogger = destinationLogger.extend('cached');
const destinationSocketLogger = destinationLogger.extend('socket');
const serviceMsgLogger        = hammerhead.extend('service-message');
const router                  = proxyLogger.extend('router');
const serviceSocketLogger     = hammerhead.extend('service-socket');
const requestHooksLogger      = hammerhead.extend('request-hooks');

const proxy = {
    onRequest: (ctx: RequestPipelineContext) => {
        proxyLogger('request %O', {
            requestId: ctx.requestId,
            method:    ctx.req.method,
            url:       ctx.req.url,
            headers:   ctx.req.headers,
        });
    },

    onResponse: (ctx: RequestPipelineContext, headers: OutgoingHttpHeaders) => {
        proxyLogger('response %O', {
            requestId:  ctx.requestId,
            statusCode: ctx.destRes.statusCode,
            headers,
        });
    },

    onSendResponseBody: (ctx: RequestPipelineContext) => {
        proxyLogger('send response body %O', {
            requestId: ctx.requestId,
            body:      ctx.destResBody.toString(),
        });
    },

    onRequestError: (ctx: RequestPipelineContext) => {
        proxyLogger('error: request to proxy cannot be dispatched %s, responding 404', ctx.requestId);
    },

    onWebSocketResponseError: (ctx: RequestPipelineContext, e: Error) => {
        proxyLogger('error %s %o', ctx.requestId, e);
    },

    onCORSFailed: (ctx: RequestPipelineContext) => {
        proxyLogger('CORS check failed %s', ctx.requestId);
    },

    onContentInfoBuilt: (ctx: RequestPipelineContext) => {
        proxyLogger('resource content info %s %i', ctx.requestId, ctx);
    },

    onMockResponseError: (rule: RequestFilterRule, e: Error) => {
        proxyLogger('error %s %s', rule, e);
    },
};

const serviceMsg = {
    onMessage: (msg: ServiceMessage, result: object) => {
        serviceMsgLogger('%j, result %j', msg, result);
    },

    onError: (msg: ServiceMessage, err: object) => {
        const isError = err instanceof Error;
        const errMsg  = isError ? err : getIncorrectErrorTypeMessage(err);

        serviceMsgLogger('%j, error %o', msg, errMsg);
    },
};

const serviceSocket = {
    onConnection: (ws) => {
        serviceSocketLogger('Service socket connected to %j', ws.url);
    },

    onError: (err: object) => {
        const isError = err instanceof Error;
        const errMsg  = isError ? err : getIncorrectErrorTypeMessage(err);

        serviceSocketLogger('Service socket error %j', errMsg);
    },
};

const destination = {
    onMockedRequest: (ctx: RequestPipelineContext) => {
        destinationLogger('mocked %O', {
            requestId:  ctx.requestId,
            statusCode: ctx.mock.statusCode,
            headers:    ctx.mock.headers,
        });
    },

    onRequest: (opts: RequestOptions) => {
        destinationLogger('%O', {
            requestId: opts.requestId,
            method:    opts.method,
            url:       opts.url,
            headers:   opts.headers,
        });
    },

    onCachedRequest: (opts: RequestOptions, hitCount: number) => {
        cachedDestinationLogger('%O', {
            requestId: opts.requestId,
            method:    opts.method,
            url:       opts.url,
            headers:   opts.headers,
            hitCount,
        });
    },

    onHttp2Stream: (requestId: string, headers: OutgoingHttpHeaders) => {
        http2DestinationLogger('stream %s %j', requestId, headers);
    },

    onHttp2Unsupported: (requestId: string, origin: string) => {
        http2DestinationLogger('server does not support http2 %s %s', requestId, origin);
    },

    onHttp2SessionCreated: (requestId: string, origin: string, cacheSize: number, cacheTotalSize: number) => {
        http2DestinationLogger('session created %s %s (cache size %d of %d)', requestId, origin, cacheSize, cacheTotalSize);
    },

    onHttp2SessionClosed: (requestId: string, origin: string, cacheSize: number, cacheTotalSize: number) => {
        http2DestinationLogger('session closed %s %s (cache size %d of %d)', requestId, origin, cacheSize, cacheTotalSize);
    },

    onHttp2Error: (requestId: string, origin: string, err: Error) => {
        http2DestinationLogger('error %s %s %o', requestId, origin, err);
    },

    onHttp2SessionTimeout: (origin: string, timeout: number) => {
        http2DestinationLogger('session is unused more than %d min and will be closed %s', timeout / 60_000, origin);
    },

    onUpgradeRequest: (opts: RequestOptions, res: IncomingMessage) => {
        destinationLogger('upgrade %O', {
            requestId:  opts.requestId,
            statusCode: res.statusCode,
            headers:    res.headers,
        });
    },

    onResponse: (opts: RequestOptions, res: IncomingMessage | Http2Response) => {
        destinationLogger('response %O', {
            requestId:  opts.requestId,
            statusCode: res.statusCode,
            headers:    res.headers,
        });
    },

    onProxyAuthenticationError: (opts: RequestOptions) => {
        destinationLogger('error: Cannot authorize to proxy %s', opts.requestId);
    },

    onResendWithCredentials: (opts: RequestOptions) => {
        destinationLogger('request resent with credentials %s', opts.requestId);
    },

    onFileRead: (ctx: RequestPipelineContext) => {
        destinationLogger('Read file %s %s', ctx.requestId, ctx.reqOpts.url);
    },

    onFileReadError: (ctx: RequestPipelineContext, err: Error) => {
        destinationLogger('File read error %s %o', ctx.requestId, err);
    },

    onTimeoutError: (opts: RequestOptions, timeout: number) => {
        destinationLogger('request timeout %s (%d ms)', opts.requestId, timeout);
    },

    onError: (opts: RequestOptions, err: Error) => {
        destinationLogger('error %s %o', opts.requestId, err);
    },
};

const destinationSocket = {
    enabled: destinationSocketLogger.enabled,

    onFirstChunk: (opts: RequestOptions, data: Buffer) => {
        destinationSocketLogger('socket first chunk of data %O', {
            requestId: opts.requestId,
            length:    data.length,
            data:      JSON.stringify(data.toString()),
        });
    },

    onError: (opts: RequestOptions, err: Error) => {
        destinationSocketLogger('socket error %s %o', opts.requestId, err);
    },
};

const requestHooks = {
    onMockedResponse: (init: IncomingMessageLikeInitOptions) => {
        requestHooksLogger('mocked response %O', init);
    },
};

export default {
    proxy,
    destination,
    destinationSocket,
    serviceMsg,
    router,
    serviceSocket,
    requestHooks,
};
