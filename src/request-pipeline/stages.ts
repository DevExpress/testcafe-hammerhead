import RequestPipelineContext from './context';
import logger from '../utils/logger';
import { fetchBody } from '../utils/http';
import RequestOptions from './request-options';
import createSpecialPageResponse from "./special-page";
import { RequestInfo } from '../session/events/info';
import {
    callOnConfigureResponseEventForNonProcessedRequest,
    callOnRequestEventCallback,
    callOnResponseEventCallbackForFailedSameOriginCheck,
    callOnResponseEventCallbackForMotModifiedResource,
    callOnResponseEventCallbackWithBodyForNonProcessedRequest,
    callOnResponseEventCallbackWithoutBodyForNonProcessedResource,
    callResponseEventCallbackForProcessedRequest,
    error,
    sendRequest
} from './utils';
import ConfigureResponseEvent from '../session/events/configure-response-event';
import ConfigureResponseEventOptions from '../session/events/configure-response-event-options';
import RequestEventNames from '../session/events/names';
import { respondOnWebSocket } from './websocket';
import { noop } from 'lodash';
import { process as processResource } from '../processing/resources';
import connectionResetGuard from './connection-reset-guard';
import http from 'http';

const EVENT_SOURCE_REQUEST_TIMEOUT = 60 * 60 * 1000;

export default [
    function handleSocketError (ctx: RequestPipelineContext) {
        // NOTE: In some case on MacOS, browser reset connection with server and we need to catch this exception.
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
        ctx.reqOpts = new RequestOptions(ctx);

        if (ctx.isSpecialPage) {
            ctx.destRes = createSpecialPageResponse();

            ctx.buildContentInfo();
            return;
        }

        if (ctx.session.hasRequestEventListeners()) {
            const requestInfo = new RequestInfo(ctx);

            ctx.requestFilterRules = ctx.session.getRequestFilterRules(requestInfo);
            await ctx.forEachRequestFilterRule(async rule => {
                await callOnRequestEventCallback(ctx, rule, requestInfo);
                ctx.setupMockIfNecessary(rule);
            });
        }

        if (ctx.mock)
            await ctx.mockResponse();
        else
            await sendRequest(ctx);
    },

    async function checkSameOriginPolicyCompliance (ctx: RequestPipelineContext) {
        if (ctx.isPassSameOriginPolicy())
            return;

        ctx.isSameOriginPolicyFailed = true;

        await ctx.forEachRequestFilterRule(async rule => {
            const configureResponseEvent = new ConfigureResponseEvent(ctx, rule, ConfigureResponseEventOptions.DEFAULT);

            await ctx.session.callRequestEventCallback(RequestEventNames.onConfigureResponse, rule, configureResponseEvent);
            await callOnResponseEventCallbackForFailedSameOriginCheck(ctx, rule, ConfigureResponseEventOptions.DEFAULT);
        });
        logger.proxy.onCORSFailed(ctx);
    },

    async function decideOnProcessingStrategy (ctx: RequestPipelineContext) {
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
            await callOnConfigureResponseEventForNonProcessedRequest(ctx);
            ctx.sendResponseHeaders();

            if (ctx.contentInfo.isNotModified)
                return await callOnResponseEventCallbackForMotModifiedResource(ctx);

            const onResponseEventDataWithBody    = ctx.getOnResponseEventData({ includeBody: true });
            const onResponseEventDataWithoutBody = ctx.getOnResponseEventData({ includeBody: false });

            if (onResponseEventDataWithBody.length)
                await callOnResponseEventCallbackWithBodyForNonProcessedRequest(ctx, onResponseEventDataWithBody);
            else if (onResponseEventDataWithoutBody.length)
                await callOnResponseEventCallbackWithoutBodyForNonProcessedResource(ctx, onResponseEventDataWithoutBody);
            else if (ctx.req.socket.destroyed && !ctx.isDestResReadableEnded)
                ctx.destRes.destroy();
            else {
                ctx.res.once('close', () => !ctx.isDestResReadableEnded && ctx.destRes.destroy());
                ctx.destRes.pipe(ctx.res);
            }

            // NOTE: sets 60 minutes timeout for the "event source" requests instead of 2 minutes by default
            if (ctx.dest.isEventSource) {
                ctx.req.setTimeout(EVENT_SOURCE_REQUEST_TIMEOUT, noop);
                ctx.req.on('close', () => ctx.destRes.destroy());
            }
        }
    },

    async function fetchContent (ctx: RequestPipelineContext) {
        ctx.destResBody = await fetchBody(ctx.destRes);

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
        const configureResponseEvents = await Promise.all(ctx.requestFilterRules.map(async rule => {
            const configureResponseEvent = new ConfigureResponseEvent(ctx, rule, ConfigureResponseEventOptions.DEFAULT);

            await ctx.session.callRequestEventCallback(RequestEventNames.onConfigureResponse, rule, configureResponseEvent);

            return configureResponseEvent;
        }));

        ctx.sendResponseHeaders();

        connectionResetGuard(async () => {
            await Promise.all(configureResponseEvents.map(async configureResponseEvent => {
                await callResponseEventCallbackForProcessedRequest(ctx, configureResponseEvent);
            }));

            const res = ctx.res as http.ServerResponse;

            res.write(ctx.destResBody);
            ctx.res.end();
        });
    }
];
