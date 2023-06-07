import RequestPipelineContext from './context';
import logger from '../utils/logger';
import { fetchBody } from '../utils/http';
import { error, sendRequest } from './utils';
import { respondOnWebSocket } from './websocket';
import { noop } from 'lodash';
import { process as processResource } from '../processing/resources';
import { connectionResetGuard } from './connection-reset-guard';
import ConfigureResponseEventOptions from './request-hooks/events/configure-response-event-options';

const EVENT_SOURCE_REQUEST_TIMEOUT = 60 * 60 * 1000;

export default [
    function handleSocketError (ctx: RequestPipelineContext) {
        // NOTE: In some case on macOS, browser reset connection with server and we need to catch this exception.
        if (!ctx.isWebSocket)
            return;

        ctx.res.on('error', e => {
            logger.proxy.onWebSocketResponseError(ctx, e);

            // @ts-ignore
            if (e.code === 'ECONNRESET' && !ctx.mock) {
                if (ctx.destRes)
                    ctx.destRes.destroy();
                else
                    ctx.isWebSocketConnectionReset = true;
            }
            else
                throw e;
        });
    },

    async function fetchProxyRequestBody (ctx: RequestPipelineContext) {
        if (ctx.isHTMLPage)
            ctx.session.onPageRequest(ctx);

        ctx.reqBody = await fetchBody(ctx.req);
    },

    async function sendDestinationRequest (ctx: RequestPipelineContext) {
        ctx.setRequestOptions(ctx.eventFactory);

        if (ctx.isSpecialPage) {
            ctx.respondForSpecialPage();

            return;
        }

        await ctx.onRequestHookRequest(ctx.session.requestHookEventProvider, ctx.eventFactory);

        if (ctx.mock)
            await ctx.mockResponse(ctx.session.requestHookEventProvider);
        else
            await sendRequest(ctx);
    },

    async function checkSameOriginPolicyCompliance (ctx: RequestPipelineContext) {
        if (ctx.isPassSameOriginPolicy())
            return;

        ctx.isSameOriginPolicyFailed = true;

        await ctx.onRequestHookConfigureResponse(ctx.session.requestHookEventProvider, ctx.eventFactory);

        await Promise.all(ctx.onResponseEventData.map(async eventData => {
            await ctx.onRequestHookResponse(ctx.session.requestHookEventProvider, ctx.eventFactory, eventData.rule, ConfigureResponseEventOptions.DEFAULT);
        }));

        logger.proxy.onCORSFailed(ctx);
    },

    async function decideOnProcessingStrategy (ctx: RequestPipelineContext) { // eslint-disable-line consistent-return
        ctx.goToNextStage = false;

        if (ctx.isWebSocket)
            respondOnWebSocket(ctx);

        else if (ctx.contentInfo.requireProcessing) {
            if (ctx.destRes.statusCode === 204)
                ctx.destRes.statusCode = 200;

            ctx.goToNextStage = true;
        }

        else if (ctx.isSpecialPage) {
            ctx.sendResponseHeaders();
            ctx.res.end();
        }

        // NOTE: Just pipe the content body to the browser if we don't need to process it.
        else {
            await ctx.onRequestHookConfigureResponse(ctx.session.requestHookEventProvider, ctx.eventFactory);

            ctx.sendResponseHeaders();

            if (ctx.contentInfo.isNotModified)
                return await ctx.callOnResponseEventCallbackForMotModifiedResource(ctx);

            const onResponseEventDataWithBody    = ctx.getOnResponseEventData({ includeBody: true });
            const onResponseEventDataWithoutBody = ctx.getOnResponseEventData({ includeBody: false });

            if (onResponseEventDataWithBody.length)
                await ctx.callOnResponseEventCallbackWithBodyForNonProcessedRequest(ctx, onResponseEventDataWithBody);
            else if (onResponseEventDataWithoutBody.length)
                await ctx.callOnResponseEventCallbackWithoutBodyForNonProcessedResource(ctx, onResponseEventDataWithoutBody);
            else if (ctx.req.socket.destroyed && !ctx.isDestResReadableEnded)
                ctx.destRes.destroy();
            else {
                ctx.res.once('close', () => !ctx.isDestResReadableEnded && ctx.destRes.destroy());

                await ctx.pipeNonProcessedResponse();
            }

            // NOTE: sets 60 minutes timeout for the "event source" requests instead of 2 minutes by default
            if (ctx.dest.isEventSource) {
                ctx.req.setTimeout(EVENT_SOURCE_REQUEST_TIMEOUT, noop);
                ctx.req.on('close', () => ctx.destRes.destroy());
            }
        }
    },

    async function fetchContent (ctx: RequestPipelineContext) {
        await ctx.fetchDestResBody();

        if (ctx.requestFilterRules.length)
            ctx.saveNonProcessedDestResBody(ctx.destResBody);
    },

    async function processContent (ctx: RequestPipelineContext) {
        try {
            ctx.destResBody = await processResource(ctx);
        }
        catch (err) {
            error(ctx, err);
        }
    },

    async function sendProxyResponse (ctx: RequestPipelineContext) {
        await ctx.onRequestHookConfigureResponse(ctx.session.requestHookEventProvider, ctx.eventFactory);

        ctx.sendResponseHeaders();

        connectionResetGuard(async () => {
            await Promise.all(ctx.onResponseEventData.map(async eventData => {
                await ctx.onRequestHookResponse(ctx.session.requestHookEventProvider, ctx.eventFactory, eventData.rule, eventData.opts);
            }));

            logger.proxy.onSendResponseBody(ctx);

            ctx.res.write(ctx.destResBody);
            ctx.res.end();
        });
    },
];
