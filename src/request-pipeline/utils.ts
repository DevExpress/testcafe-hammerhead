import RequestPipelineContext, { DestinationResponse } from './context';
import RequestFilterRule from './request-hooks/request-filter-rule';

import {
    ResponseInfo,
    PreparedResponseInfo,
} from './request-hooks/events/info';

import { OnResponseEventData } from '../typings/context';
import FileRequest from './file-request';
import DestinationRequest from './destination-request';
import promisifyStream from '../utils/promisify-stream';
import ConfigureResponseEvent from '../session/events/configure-response-event';
import ResponseEvent from '../session/events/response-event';
import RequestEventNames from './request-hooks/events/names';
import ConfigureResponseEventOptions from '../session/events/configure-response-event-options';
import { toReadableStream } from '../utils/buffer';
import { PassThrough } from 'stream';
import { getText, MESSAGE } from '../messages';
import logger from '../utils/logger';
import { getFormattedInvalidCharacters } from './http-header-parser';


// An empty line that indicates the end of the header section
// https://tools.ietf.org/html/rfc7230#section-3
const HTTP_BODY_SEPARATOR = '\r\n\r\n';

// Used to calculate the recommended maximum header size
// See getRecommendedMaxHeaderSize() below
const HEADER_SIZE_MULTIPLIER            = 2;
const HEADER_SIZE_CALCULATION_PRECISION = 2;

// Calculates the HTTP header size in bytes that a customer should specify via the
// --max-http-header-size Node option so that the proxy can process the site
// https://nodejs.org/api/cli.html#cli_max_http_header_size_size
// Example:
// (8211 * 2).toPrecision(2) -> 16 * 10^3 -> 16000
function getRecommendedMaxHeaderSize (currentHeaderSize: number): number {
    return Number((currentHeaderSize * HEADER_SIZE_MULTIPLIER).toPrecision(HEADER_SIZE_CALCULATION_PRECISION));
}

export function sendRequest (ctx: RequestPipelineContext) {
    return new Promise<void>(resolve => {
        const req = ctx.isFileProtocol ? new FileRequest(ctx.reqOpts.url) : new DestinationRequest(ctx.reqOpts, ctx.serverInfo.cacheRequests);

        ctx.goToNextStage = false;

        req.on('response', (res: DestinationResponse) => {
            if (ctx.isWebSocketConnectionReset) {
                res.destroy();
                resolve();
                return;
            }

            ctx.destRes       = res;
            ctx.goToNextStage = true;

            ctx.buildContentInfo();
            ctx.calculateIsDestResReadableEnded();
            ctx.createCacheEntry(res);

            resolve();
        });

        req.on('error', err => {
            // NOTE: Sometimes the underlying socket emits an error event. But if we have a response body,
            // we can still process such requests. (B234324)
            if (!ctx.isDestResReadableEnded) {
                const rawHeadersStr = err.rawPacket ? err.rawPacket.asciiSlice().split(HTTP_BODY_SEPARATOR)[0].split('\n').splice(1).join('\n') : '';
                const headerSize = rawHeadersStr.length;

                error(ctx, getText(MESSAGE.destConnectionTerminated, {
                    url:                      ctx.dest.url,
                    message:                  MESSAGE.nodeError[err.code] || err.toString(),
                    headerSize:               headerSize,
                    recommendedMaxHeaderSize: getRecommendedMaxHeaderSize(headerSize).toString(),
                    invalidChars:             getFormattedInvalidCharacters(rawHeadersStr),
                }));
            }

            resolve();
        });

        req.on('fatalError', err => {
            if (ctx.isFileProtocol)
                logger.destination.onFileReadError(ctx, err);

            error(ctx, err);
            resolve();
        });

        req.on('socketHangUp', () => {
            ctx.req.socket.end();
            resolve();
        });

        if (req instanceof FileRequest) {
            logger.destination.onFileRead(ctx);
            req.init();
        }
    });
}

export function error (ctx: RequestPipelineContext, err: string) {
    if (ctx.isPage && !ctx.isIframe)
        ctx.session.handlePageError(ctx, err);
    else if (ctx.isAjax)
        ctx.req.destroy();
    else
        ctx.closeWithError(500, err.toString());
}

export async function callResponseEventCallbackForProcessedRequest (ctx: RequestPipelineContext, configureResponseEvent: ConfigureResponseEvent) {
    const responseInfo         = ResponseInfo.from(ctx);
    const preparedResponseInfo = new PreparedResponseInfo(responseInfo, configureResponseEvent.opts);
    const responseEvent        = new ResponseEvent(configureResponseEvent.requestFilterRule, preparedResponseInfo);

    await ctx.session.callRequestEventCallback(RequestEventNames.onResponse, configureResponseEvent.requestFilterRule, responseEvent);

    return responseEvent;
}

export async function callOnResponseEventCallbackForFailedSameOriginCheck (ctx: RequestPipelineContext, rule: RequestFilterRule, configureOpts: ConfigureResponseEventOptions) {
    const responseInfo         = ResponseInfo.from(ctx);
    const preparedResponseInfo = new PreparedResponseInfo(responseInfo, configureOpts);
    const responseEvent        = new ResponseEvent(rule, preparedResponseInfo);

    await ctx.session.callRequestEventCallback(RequestEventNames.onResponse, rule, responseEvent);

    return responseEvent;
}

export async function callOnConfigureResponseEventForNonProcessedRequest (ctx: RequestPipelineContext) {
    await ctx.forEachRequestFilterRule(async rule => {
        const configureResponseEvent = new ConfigureResponseEvent(rule, ctx, ConfigureResponseEventOptions.DEFAULT);

        await ctx.session.callRequestEventCallback(RequestEventNames.onConfigureResponse, rule, configureResponseEvent);

        ctx.onResponseEventData.push({ rule, opts: configureResponseEvent.opts });
    });
}

export async function callOnResponseEventCallbackWithBodyForNonProcessedRequest (ctx: RequestPipelineContext, onResponseEventDataWithBody: OnResponseEventData[]) {
    const destResBodyCollectorStream = new PassThrough();

    ctx.destRes.pipe(destResBodyCollectorStream);

    promisifyStream(destResBodyCollectorStream).then(async data => {
        ctx.saveNonProcessedDestResBody(data);

        const responseInfo = ResponseInfo.from(ctx);

        await Promise.all(onResponseEventDataWithBody.map(async ({ rule, opts }) => {
            const preparedResponseInfo = new PreparedResponseInfo(responseInfo, opts);
            const responseEvent        = new ResponseEvent(rule, preparedResponseInfo);

            await ctx.session.callRequestEventCallback(RequestEventNames.onResponse, rule, responseEvent);
        }));

        toReadableStream(data).pipe(ctx.res);
    });
}

export async function callOnResponseEventCallbackWithoutBodyForNonProcessedResource (ctx: RequestPipelineContext, onResponseEventDataWithoutBody: OnResponseEventData[]) {
    const responseInfo = ResponseInfo.from(ctx);

    await Promise.all(onResponseEventDataWithoutBody.map(async item => {
        const preparedResponseInfo = new PreparedResponseInfo(responseInfo, item.opts);
        const responseEvent        = new ResponseEvent(item.rule, preparedResponseInfo);

        await ctx.session.callRequestEventCallback(RequestEventNames.onResponse, item.rule, responseEvent);
    }));

    ctx.destRes.pipe(ctx.res);
}

export async function callOnResponseEventCallbackForMotModifiedResource (ctx: RequestPipelineContext) {
    const responseInfo = ResponseInfo.from(ctx);

    await Promise.all(ctx.onResponseEventData.map(async item => {
        const preparedResponseInfo = new PreparedResponseInfo(responseInfo, item.opts);
        const responseEvent        = new ResponseEvent(item.rule, preparedResponseInfo);

        await ctx.session.callRequestEventCallback(RequestEventNames.onResponse, item.rule, responseEvent);
    }));

    ctx.res.end();
}

export async function handleRequestMockingErrorIfNecessary (ctx: RequestPipelineContext): Promise<void> {
    if (!ctx.mock.hasError)
        return;

    const targetRule = ctx.requestFilterRules[0];

    logger.proxy.onMockResponseError(targetRule, ctx.mock.error as Error);

    await ctx.session.callRequestHookEventHandler(targetRule, ctx.mock.error as Error);

}
