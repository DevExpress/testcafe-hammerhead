/*eslint-disable no-unused-vars*/
import http from 'http';
import { FileStream } from '../typings/session';
import RequestPipelineContext from './context';
import RequestFilterRule from './request-hooks/request-filter-rule';
import { RequestInfo, ResponseInfo, PreparedResponseInfo } from '../session/events/info';
import { OnResponseEventData } from '../typings/context';
/*eslint-enable no-unused-vars*/
import FileRequest from './file-request';
import DestinationRequest from './destination-request';
import promisifyStream from '../utils/promisify-stream';
import ConfigureResponseEvent from '../session/events/configure-response-event';
import RequestEvent from '../session/events/request-event';
import ResponseEvent from '../session/events/response-event';
import RequestEventNames from '../session/events/names';
import ConfigureResponseEventOptions from '../session/events/configure-response-event-options';
import { toReadableStream } from '../utils/buffer';
import { PassThrough } from 'stream';

export function sendRequest (ctx: RequestPipelineContext) {
    return new Promise(resolve => {
        const req = ctx.isFileProtocol ? new FileRequest(ctx.reqOpts.url) : new DestinationRequest(ctx.reqOpts);

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

export function error (ctx: RequestPipelineContext, err: string) {
    if (ctx.isPage && !ctx.isIframe)
        ctx.session.handlePageError(ctx, err);
    else if (ctx.isFetch || ctx.isXhr)
        ctx.req.destroy();
    else
        ctx.closeWithError(500, err.toString());
}

export async function callResponseEventCallbackForProcessedRequest (ctx: RequestPipelineContext, configureResponseEvent: ConfigureResponseEvent) {
    const responseInfo         = new ResponseInfo(ctx);
    const preparedResponseInfo = new PreparedResponseInfo(responseInfo, configureResponseEvent.opts);
    const responseEvent        = new ResponseEvent(configureResponseEvent._requestFilterRule, preparedResponseInfo);

    await ctx.session.callRequestEventCallback(RequestEventNames.onResponse, configureResponseEvent._requestFilterRule, responseEvent);
}

export async function callOnRequestEventCallback (ctx: RequestPipelineContext, rule: RequestFilterRule, reqInfo: RequestInfo) {
    const requestEvent = new RequestEvent(ctx, rule, reqInfo);

    await ctx.session.callRequestEventCallback(RequestEventNames.onRequest, rule, requestEvent);
}

export async function callOnResponseEventCallbackForFailedSameOriginCheck (ctx: RequestPipelineContext, rule: RequestFilterRule, configureOpts: ConfigureResponseEventOptions) {
    const responseInfo         = new ResponseInfo(ctx);
    const preparedResponseInfo = new PreparedResponseInfo(responseInfo, configureOpts);
    const responseEvent        = new ResponseEvent(rule, preparedResponseInfo);

    await ctx.session.callRequestEventCallback(RequestEventNames.onResponse, rule, responseEvent);
}

export async function callOnConfigureResponseEventForNonProcessedRequest (ctx: RequestPipelineContext) {
    await ctx.forEachRequestFilterRule(async rule => {
        const configureResponseEvent = new ConfigureResponseEvent(ctx, rule, ConfigureResponseEventOptions.DEFAULT);

        await ctx.session.callRequestEventCallback(RequestEventNames.onConfigureResponse, rule, configureResponseEvent);

        ctx.onResponseEventData.push({ rule, opts: configureResponseEvent.opts });
    });
}

export async function callOnResponseEventCallbackWithBodyForNonProcessedRequest (ctx: RequestPipelineContext, onResponseEventDataWithBody: Array<OnResponseEventData>) {
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

export async function callOnResponseEventCallbackWithoutBodyForNonProcessedResource (ctx: RequestPipelineContext, onResponseEventDataWithoutBody: Array<OnResponseEventData>) {
    const responseInfo = new ResponseInfo(ctx);

    await Promise.all(onResponseEventDataWithoutBody.map(async item => {
        const preparedResponseInfo = new PreparedResponseInfo(responseInfo, item.opts);
        const responseEvent        = new ResponseEvent(item.rule, preparedResponseInfo);

        await ctx.session.callRequestEventCallback(RequestEventNames.onResponse, item.rule, responseEvent);
    }));

    ctx.destRes.pipe(ctx.res);
}

export async function callOnResponseEventCallbackForMotModifiedResource (ctx: RequestPipelineContext) {
    const responseInfo = new ResponseInfo(ctx);

    await Promise.all(ctx.onResponseEventData.map(async item => {
        const preparedResponseInfo = new PreparedResponseInfo(responseInfo, item.opts);
        const responseEvent        = new ResponseEvent(item.rule, preparedResponseInfo);

        await ctx.session.callRequestEventCallback(RequestEventNames.onResponse, item.rule, responseEvent);
    }));

    ctx.res.end();
}
