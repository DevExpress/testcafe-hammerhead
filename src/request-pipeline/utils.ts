/*eslint-disable no-unused-vars*/
import http from 'http';
import FileRequest, { FileStream } from './file-request';
import { Credentials, ExternalProxySettings } from '../session';
import RequestPipelineContext from './context';
/*eslint-enable no-unused-vars*/
import { inject as injectUpload } from '../upload';
import matchUrl from 'match-url-wildcard';
import * as headerTransforms from './header-transforms';
import DestinationRequest from './destination-request';
import { ResponseInfo, PreparedResponseInfo } from '../session/events/info';
import promisifyStream from '../utils/promisify-stream';
import ConfigureResponseEvent from '../session/events/configure-response-event';
import RequestEvent from '../session/events/request-event';
import ResponseEvent from '../session/events/response-event';
import RequestEventNames from '../session/events/names';
import ConfigureResponseEventOptions from '../session/events/configure-response-event-options';
import { toReadableStream } from '../utils/buffer';
import { PassThrough } from 'stream';

export class ReqOpts {
    url: string;
    protocol: string;
    hostname: string;
    host: string;
    port: string;
    path: string;
    method: string;
    credentials: Credentials;
    body: Buffer;
    isXhr: boolean;
    rawHeaders: Array<string>;
    headers: { [name: string]: string };
    proxy?: ExternalProxySettings;

    constructor (ctx: RequestPipelineContext) {
        const bodyWithUploads = injectUpload(ctx.req.headers['content-type'], ctx.reqBody);

        // NOTE: First, we should rewrite the request body, because the 'content-length' header will be built based on it.
        if (bodyWithUploads)
            ctx.reqBody = bodyWithUploads;

        // NOTE: All headers, including 'content-length', are built here.
        const headers = headerTransforms.forRequest(ctx);
        const proxy   = ctx.session.externalProxySettings;

        this.url         = ctx.dest.url;
        this.protocol    = ctx.dest.protocol;
        this.hostname    = ctx.dest.hostname;
        this.host        = ctx.dest.host;
        this.port        = ctx.dest.port;
        this.path        = ctx.dest.partAfterHost;
        this.method      = ctx.req.method;
        this.credentials = ctx.session.getAuthCredentials();
        this.body        = ctx.reqBody;
        this.isXhr       = ctx.isXhr;
        this.rawHeaders  = ctx.req.rawHeaders;
        this.headers     = headers;

        if (proxy && !matchUrl(ctx.dest.url, proxy.bypassRules)) {
            this.proxy = proxy;

            if (ctx.dest.protocol === 'http:') {
                this.path     = this.protocol + '//' + this.host + this.path;
                this.host     = proxy.host;
                this.hostname = proxy.hostname;
                this.port     = proxy.port;

                if (proxy.authHeader)
                    headers['proxy-authorization'] = proxy.authHeader;
            }
        }
    }
}

export function sendRequest (ctx) {
    return new Promise(resolve => {
        const req = ctx.isFileProtocol ? new FileRequest(ctx.reqOpts) : new DestinationRequest(ctx.reqOpts);

        ctx.goToNextStage = false;

        req.on('response', (res: http.IncomingMessage | FileStream) => {
            if (ctx.isWebSocketConnectionReset) {
                res.destroy();

                resolve();
            }

            ctx.destRes       = res;
            ctx.goToNextStage = true;
            resolve();
        });

        req.on('error', () => {
            ctx.hasDestReqErr = true;
            resolve();
        });

        req.on('fatalError', err => {
            error(ctx, err);
            resolve();
        });

        req.on('socketHangUp', () => {
            ctx.req.socket.end();
            resolve();
        });
    });
}

export function error (ctx, err) {
    if (ctx.isPage && !ctx.isIframe)
        ctx.session.handlePageError(ctx, err);
    else if (ctx.isFetch || ctx.isXhr)
        ctx.req.destroy();
    else
        ctx.closeWithError(500, err.toString());
}

export async function callResponseEventCallbackForProcessedRequest (ctx, configureResponseEvent) {
    const responseInfo         = new ResponseInfo(ctx);
    const preparedResponseInfo = new PreparedResponseInfo(responseInfo, configureResponseEvent.opts);
    const responseEvent        = new ResponseEvent(configureResponseEvent._requestFilterRule, preparedResponseInfo);

    await ctx.session.callRequestEventCallback(RequestEventNames.onResponse, configureResponseEvent._requestFilterRule, responseEvent);
}

export async function callOnRequestEventCallback (ctx, rule, reqInfo) {
    const requestEvent = new RequestEvent(ctx, rule, reqInfo);

    await ctx.session.callRequestEventCallback(RequestEventNames.onRequest, rule, requestEvent);
}

export async function callOnResponseEventCallbackForFailedSameOriginCheck (ctx, rule, configureOpts) {
    const responseInfo         = new ResponseInfo(ctx);
    const preparedResponseInfo = new PreparedResponseInfo(responseInfo, configureOpts);
    const responseEvent        = new ResponseEvent(rule, preparedResponseInfo);

    await ctx.session.callRequestEventCallback(RequestEventNames.onResponse, rule, responseEvent);
}

export async function callOnConfigureResponseEventForNonProcessedRequest (ctx) {
    await ctx.forEachRequestFilterRule(async rule => {
        const configureResponseEvent = new ConfigureResponseEvent(ctx, rule, ConfigureResponseEventOptions.DEFAULT);

        await ctx.session.callRequestEventCallback(RequestEventNames.onConfigureResponse, rule, configureResponseEvent);

        ctx.onResponseEventData.push({ rule, opts: configureResponseEvent.opts });
    });
}

export async function callOnResponseEventCallbackWithBodyForNonProcessedRequest (ctx, onResponseEventDataWithBody) {
    const destResBodyCollectorStream = new PassThrough();

    ctx.destRes.pipe(destResBodyCollectorStream);

    promisifyStream(destResBodyCollectorStream).then(async data => {
        ctx.saveNonProcessedDestResBody(data);

        const responseInfo = new ResponseInfo(ctx);

        await Promise.all(onResponseEventDataWithBody.map(async ({ rule, opts }) => {
            const preparedResponseInfo = new PreparedResponseInfo(responseInfo, opts);
            const responseEvent        = new ResponseEvent(rule, preparedResponseInfo);

            await ctx.session.callRequestEventCallback(RequestEventNames.onResponse, rule, responseEvent);
        }));

        toReadableStream(data).pipe(ctx.res);
    });
}

export async function callOnResponseEventCallbackWithoutBodyForNonProcessedResource (ctx, onResponseEventDataWithoutBody) {
    const responseInfo = new ResponseInfo(ctx);

    await Promise.all(onResponseEventDataWithoutBody.map(async item => {
        const preparedResponseInfo = new PreparedResponseInfo(responseInfo, item.opts);
        const responseEvent        = new ResponseEvent(item.rule, preparedResponseInfo);

        await ctx.session.callRequestEventCallback(RequestEventNames.onResponse, item.rule, responseEvent);
    }));

    ctx.destRes.pipe(ctx.res);
}

export async function callOnResponseEventCallbackForMotModifiedResource (ctx) {
    const responseInfo = new ResponseInfo(ctx);

    await Promise.all(ctx.onResponseEventData.map(async item => {
        const preparedResponseInfo = new PreparedResponseInfo(responseInfo, item.opts);
        const responseEvent        = new ResponseEvent(item.rule, preparedResponseInfo);

        await ctx.session.callRequestEventCallback(RequestEventNames.onResponse, item.rule, responseEvent);
    }));

    ctx.res.end();
}
