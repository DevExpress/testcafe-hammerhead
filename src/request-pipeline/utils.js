import { inject as injectUpload } from '../upload';
import matchUrl from 'match-url-wildcard';
import * as headerTransforms from './header-transforms';
import FileRequest from './file-request';
import DestinationRequest from './destination-request';
import * as requestEventInfo from '../session/events/info';
import promisifyStream from '../utils/promisify-stream';
import ConfigureResponseEvent from '../session/events/configure-response-event';
import RequestEvent from '../session/events/request-event';
import ResponseEvent from '../session/events/response-event';
import REQUEST_EVENT_NAMES from '../session/events/names';
import ConfigureResponseEventOptions from '../session/events/configure-response-event-options';
import { toReadableStream } from '../utils/buffer';
import { PassThrough } from 'stream';
import SAME_ORIGIN_CHECK_FAILED_STATUS_CODE from './xhr/same-origin-check-failed-status-code';

export function createReqOpts (ctx) {
    const bodyWithUploads = injectUpload(ctx.req.headers['content-type'], ctx.reqBody);

    // NOTE: First, we should rewrite the request body, because the 'content-length' header will be built based on it.
    if (bodyWithUploads)
        ctx.reqBody = bodyWithUploads;

    // NOTE: All headers, including 'content-length', are built here.
    const headers = headerTransforms.forRequest(ctx);
    const proxy   = ctx.session.externalProxySettings;
    const options = {
        url:         ctx.dest.url,
        protocol:    ctx.dest.protocol,
        hostname:    ctx.dest.hostname,
        host:        ctx.dest.host,
        port:        ctx.dest.port,
        path:        ctx.dest.partAfterHost,
        method:      ctx.req.method,
        credentials: ctx.session.getAuthCredentials(),
        body:        ctx.reqBody,
        isXhr:       ctx.isXhr,
        rawHeaders:  ctx.req.rawHeaders,

        headers
    };

    if (proxy && !matchUrl(ctx.dest.url, proxy.bypassRules)) {
        options.proxy = proxy;

        if (ctx.dest.protocol === 'http:') {
            options.path     = options.protocol + '//' + options.host + options.path;
            options.host     = proxy.host;
            options.hostname = proxy.hostname;
            options.port     = proxy.port;

            if (proxy.authHeader)
                headers['proxy-authorization'] = proxy.authHeader;
        }
    }

    return options;
}

export function sendRequest (ctx) {
    return new Promise(resolve => {
        const req = ctx.isFileProtocol ? new FileRequest(ctx.reqOpts) : new DestinationRequest(ctx.reqOpts);

        ctx.goToNextStage = false;

        req.on('response', res => {
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
            ctx.goToNextStage = true;
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
    const responseInfo         = requestEventInfo.createResponseInfo(ctx);
    const preparedResponseInfo = requestEventInfo.prepareEventData(responseInfo, configureResponseEvent.opts);
    const responseEvent        = new ResponseEvent(configureResponseEvent._requestFilterRule, preparedResponseInfo);

    await ctx.session.callRequestEventCallback(REQUEST_EVENT_NAMES.onResponse, configureResponseEvent._requestFilterRule, responseEvent);
}

export async function callOnRequestEventCallback (ctx, rule, reqInfo) {
    const requestEvent = new RequestEvent(ctx, rule, reqInfo);

    await ctx.session.callRequestEventCallback(REQUEST_EVENT_NAMES.onRequest, rule, requestEvent);
}

export async function callOnResponseEventCallbackForFailedSameOriginCheck (ctx, rule, configureOpts) {
    const responseInfo = requestEventInfo.createResponseInfo(ctx);

    responseInfo.statusCode = SAME_ORIGIN_CHECK_FAILED_STATUS_CODE;

    const preparedResponseInfo = requestEventInfo.prepareEventData(responseInfo, configureOpts);
    const responseEvent        = new ResponseEvent(rule, preparedResponseInfo);

    await ctx.session.callRequestEventCallback(REQUEST_EVENT_NAMES.onResponse, rule, responseEvent);
}

export async function callOnConfigureResponseEventForNonProcessedRequest (ctx) {
    await ctx.forEachRequestFilterRule(async rule => {
        const configureResponseEvent = new ConfigureResponseEvent(ctx, rule, ConfigureResponseEventOptions.DEFAULT);

        await ctx.session.callRequestEventCallback(REQUEST_EVENT_NAMES.onConfigureResponse, rule, configureResponseEvent);

        ctx.onResponseEventData.push({ rule, opts: configureResponseEvent.opts });
    });
}

export async function callOnResponseEventCallbackWithBodyForNonProcessedRequest (ctx, onResponseEventDataWithBody) {
    const destResBodyCollectorStream = new PassThrough();

    ctx.destRes.pipe(destResBodyCollectorStream);

    promisifyStream(destResBodyCollectorStream).then(async data => {
        ctx.saveNonProcessedDestResBody(data);

        const responseInfo = requestEventInfo.createResponseInfo(ctx);

        await Promise.all(onResponseEventDataWithBody.map(async ({ rule, opts }) => {
            const preparedResponseInfo = requestEventInfo.prepareEventData(responseInfo, opts);
            const responseEvent        = new ResponseEvent(rule, preparedResponseInfo);

            await ctx.session.callRequestEventCallback(REQUEST_EVENT_NAMES.onResponse, rule, responseEvent);
        }));

        toReadableStream(data).pipe(ctx.res);
    });
}

export async function callOnResponseEventCallbackWithoutBodyForNonProcessedResource (ctx, onResponseEventDataWithoutBody) {
    const responseInfo = requestEventInfo.createResponseInfo(ctx);

    await Promise.all(onResponseEventDataWithoutBody.map(async item => {
        const preparedResponseInfo = requestEventInfo.prepareEventData(responseInfo, item.opts);
        const responseEvent        = new ResponseEvent(item.rule, preparedResponseInfo);

        await ctx.session.callRequestEventCallback(REQUEST_EVENT_NAMES.onResponse, item.rule, responseEvent);
    }));

    ctx.destRes.pipe(ctx.res);
}
