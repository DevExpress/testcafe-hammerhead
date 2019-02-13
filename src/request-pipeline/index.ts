/*eslint-disable no-unused-vars*/
import net from 'net';
import http from 'http';
import Session from '../session';
import { ServerInfo } from '../proxy';
/*eslint-enable no-unused-vars*/
import RequestPipelineContext from './context';
import { process as processResource } from '../processing/resources';
import { MESSAGE, getText } from '../messages';
import connectionResetGuard from './connection-reset-guard';
import SAME_ORIGIN_CHECK_FAILED_STATUS_CODE from './xhr/same-origin-check-failed-status-code';
import { fetchBody, respond404 } from '../utils/http';
import { respondOnWebSocket } from './websocket';
import createSpecialPageResponse from './special-page';
import * as requestEventInfo from '../session/events/info';
import REQUEST_EVENT_NAMES from '../session/events/names';
import ConfigureResponseEvent from '../session/events/configure-response-event';
import ConfigureResponseEventOptions from '../session/events/configure-response-event-options';
import {
    createReqOpts,
    sendRequest,
    error,
    callResponseEventCallbackForProcessedRequest,
    callOnRequestEventCallback,
    callOnResponseEventCallbackForFailedSameOriginCheck,
    callOnConfigureResponseEventForNonProcessedRequest,
    callOnResponseEventCallbackWithBodyForNonProcessedRequest,
    callOnResponseEventCallbackWithoutBodyForNonProcessedResource,
    callOnResponseEventCallbackForMotModifiedResource
} from './utils';

const EVENT_SOURCE_REQUEST_TIMEOUT = 60 * 60 * 1000;

const stages = [
    function handleSocketError (ctx: RequestPipelineContext) {
        // NOTE: In some case on MacOS, browser reset connection with server and we need to catch this exception.
        if (!ctx.isWebSocket)
            return;

        ctx.res.on('error', e => {
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
        if (ctx.isPage && !ctx.isIframe && !ctx.isHtmlImport)
            ctx.session.onPageRequest(ctx);

        ctx.reqBody = await fetchBody(ctx.req);
    },

    async function sendDestinationRequest (ctx: RequestPipelineContext) {
        if (ctx.isSpecialPage) {
            ctx.destRes = createSpecialPageResponse();
            return;
        }

        ctx.reqOpts = createReqOpts(ctx);

        if (ctx.session.hasRequestEventListeners()) {
            const requestInfo = requestEventInfo.createRequestInfo(ctx, ctx.reqOpts);

            ctx.requestFilterRules = ctx.session.getRequestFilterRules(requestInfo);
            await ctx.forEachRequestFilterRule(async rule => {
                await callOnRequestEventCallback(ctx, rule, requestInfo);
                ctx.setupMockIfNecessary(rule);
            });
        }

        if (ctx.mock)
            ctx.mockResponse();
        else
            await sendRequest(ctx);
    },

    async function checkSameOriginPolicyCompliance (ctx: RequestPipelineContext) {
        ctx.buildContentInfo();

        if (ctx.isPassSameOriginPolicy())
            return;

        await ctx.forEachRequestFilterRule(async rule => {
            const configureResponseEvent = new ConfigureResponseEvent(ctx, rule, ConfigureResponseEventOptions.DEFAULT);

            await ctx.session.callRequestEventCallback(REQUEST_EVENT_NAMES.onConfigureResponse, rule, configureResponseEvent);
            await callOnResponseEventCallbackForFailedSameOriginCheck(ctx, rule, configureResponseEvent);
        });
        ctx.closeWithError(SAME_ORIGIN_CHECK_FAILED_STATUS_CODE);
    },

    async function decideOnProcessingStrategy (ctx: RequestPipelineContext) {
        ctx.goToNextStage = false;

        if (ctx.isWebSocket) {
            respondOnWebSocket(ctx);

            return;
        }

        if (ctx.contentInfo.requireProcessing && ctx.destRes.statusCode === 204)
            ctx.destRes.statusCode = 200;

        // NOTE: Just pipe the content body to the browser if we don't need to process it.
        else if (!ctx.contentInfo.requireProcessing) {
            if (!ctx.isSpecialPage) {
                await callOnConfigureResponseEventForNonProcessedRequest(ctx);
                ctx.sendResponseHeaders();

                if (ctx.contentInfo.isNotModified)
                    await callOnResponseEventCallbackForMotModifiedResource(ctx);
                else {
                    const onResponseEventDataWithBody    = ctx.getOnResponseEventData({ includeBody: true });
                    const onResponseEventDataWithoutBody = ctx.getOnResponseEventData({ includeBody: false });

                    if (onResponseEventDataWithBody.length)
                        await callOnResponseEventCallbackWithBodyForNonProcessedRequest(ctx, onResponseEventDataWithBody);
                    else if (onResponseEventDataWithoutBody.length)
                        await callOnResponseEventCallbackWithoutBodyForNonProcessedResource(ctx, onResponseEventDataWithoutBody);
                    else
                        ctx.destRes.pipe(ctx.res);
                }

                // NOTE: sets 60 minutes timeout for the "event source" requests instead of 2 minutes by default
                if (ctx.dest.isEventSource) {
                    ctx.req.setTimeout(EVENT_SOURCE_REQUEST_TIMEOUT);
                    ctx.req.on('close', () => ctx.destRes.destroy());
                }
            }
            else {
                ctx.sendResponseHeaders();
                ctx.res.end();
            }

            return;
        }

        ctx.goToNextStage = true;
    },

    async function fetchContent (ctx: RequestPipelineContext) {
        ctx.destResBody = await fetchBody(ctx.destRes);

        if (ctx.requestFilterRules.length)
            ctx.saveNonProcessedDestResBody(ctx.destResBody);

        // NOTE: Sometimes the underlying socket emits an error event. But if we have a response body,
        // we can still process such requests. (B234324)
        if (ctx.hasDestReqErr && ctx.isDestResBodyMalformed()) {
            error(ctx, getText(MESSAGE.destConnectionTerminated, ctx.dest.url));
            ctx.goToNextStage = false;
        }
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

            await ctx.session.callRequestEventCallback(REQUEST_EVENT_NAMES.onConfigureResponse, rule, configureResponseEvent);

            return configureResponseEvent;
        }));

        ctx.sendResponseHeaders();

        connectionResetGuard(async () => {
            await Promise.all(configureResponseEvents.map(async configureResponseEvent => {
                await callResponseEventCallbackForProcessedRequest(ctx, configureResponseEvent);
            }));

            ctx.res.write(ctx.destResBody);
            ctx.res.end();
        });
    }
];

export async function run (req: http.IncomingMessage, res: http.ServerResponse | net.Socket, serverInfo: ServerInfo, openSessions: Map<string, Session>): Promise<void> {
    const ctx = new RequestPipelineContext(req, res, serverInfo);

    if (!ctx.dispatch(openSessions)) {
        respond404(res);

        return;
    }

    for (let i = 0; i < stages.length; i++) {
        await stages[i](ctx);

        if (!ctx.goToNextStage)
            return;
    }
}
