import debug from 'debug';
import RequestPipelineContext from '../request-pipeline/context';
import { IncomingMessage, OutgoingHttpHeaders } from 'http';
import { ServiceMessage } from '../typings/proxy';
import RequestOptions from '../request-pipeline/request-options';
import errToString from './err-to-string'

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

const hammerhead              = debug('hammerhead');
const proxyLogger             = hammerhead.extend('proxy');
const destinationLogger       = hammerhead.extend('destination');
const destinationSocketLogger = destinationLogger.extend('socket');
const serviceMsgLogger        = hammerhead.extend('service-message');

const proxy = {
    onRequest: (ctx: RequestPipelineContext) => {
        proxyLogger('Proxy request %s %s %s %j', ctx.requestId, ctx.req.method, ctx.req.url, ctx.req.headers);
    },

    onResponse: (ctx: RequestPipelineContext, headers: OutgoingHttpHeaders) => {
        proxyLogger('Proxy response %s %d %j', ctx.requestId, ctx.destRes.statusCode, headers);
    },

    onRequestError: (ctx: RequestPipelineContext) => {
        proxyLogger('Proxy error: request to proxy cannot be dispatched %s, responding 404', ctx.requestId);
    },

    onWebSocketResponseError: (ctx: RequestPipelineContext, e: Error) => {
        proxyLogger('Proxy error %s %o', ctx.requestId, e);
    },

    onCORSFailed: (ctx: RequestPipelineContext) => {
        proxyLogger('Proxy CORS check failed %s', ctx.requestId)
    },

    onContentInfoBuilt: (ctx: RequestPipelineContext) => {
        proxyLogger('Proxy resource content info %s %i', ctx.requestId, ctx);
    }
};

const serviceMsg = {
    onMessage: (msg: ServiceMessage, result: object) => {
        serviceMsgLogger('Service message %j, result %j', msg, result);
    },

    onError: (msg: ServiceMessage, err: object) => {
        const isError = err instanceof Error;
        const errMsg  = isError ? err : getIncorrectErrorTypeMessage(err);

        serviceMsgLogger('Service message %j, error %o', msg, errMsg);
    }
};

const destination = {
    onMockedRequest: (ctx: RequestPipelineContext) => {
        destinationLogger('Destination request is mocked %s %s %j', ctx.requestId, ctx.mock.statusCode, ctx.mock.headers);
    },

    onRequest: (opts: RequestOptions) => {
        destinationLogger('Destination request %s %s %s %j', opts.requestId, opts.method, opts.url, opts.headers);
    },

    onUpgradeRequest: (opts: RequestOptions, res: IncomingMessage) => {
        destinationLogger('Destination upgrade %s %d %j', opts.requestId, res.statusCode, res.headers);
    },

    onResponse: (opts: RequestOptions, res: IncomingMessage) => {
        destinationLogger('Destination response %s %d %j', opts.requestId, res.statusCode, res.headers);
    },

    onProxyAuthenticationError: (opts: RequestOptions) => {
        destinationLogger('Destination error: Cannot authorize to proxy %s', opts.requestId);
    },

    onResendWithCredentials: (opts: RequestOptions) => {
        destinationLogger('Destination request resent with credentials %s', opts.requestId);
    },

    onFileRead: (ctx: RequestPipelineContext) => {
        destinationLogger('Read file %s %s', ctx.requestId, ctx.reqOpts.url);
    },

    onFileReadError: (ctx: RequestPipelineContext, err: Error) => {
        destinationLogger('File read error %s %o', ctx.requestId, err);
    },

    onTimeoutError: (opts: RequestOptions, timeout: number) => {
        destinationLogger('Destination request timeout %s (%d ms)', opts.requestId, timeout);
    },

    onError: (opts: RequestOptions, err: Error) => {
        destinationLogger('Destination error %s %o', opts.requestId, err);
    }
};

const destinationSocket = {
    enabled: destinationSocketLogger.enabled,

    onFirstChunk: (opts: RequestOptions, data: Buffer) => {
        destinationSocketLogger('Destination request socket first chunk of data %s %d %s', opts.requestId, data.length, JSON.stringify(data.toString()));
    },

    onError: (opts: RequestOptions, err: Error) => {
        destinationSocketLogger('Destination request socket error %s %o', opts.requestId, err);
    }
};

export default { proxy, destination, destinationSocket, serviceMsg };
