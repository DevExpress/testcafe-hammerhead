import DestinationRequest from './destination-request';
import FileRequest from './file-request';
import RequestPipelineContext from './context';
import * as headerTransforms from './header-transforms';
import { process as processResource } from '../processing/resources';
import { MESSAGE, getText } from '../messages';
import connectionResetGuard from './connection-reset-guard';
import SAME_ORIGIN_CHECK_FAILED_STATUS_CODE from './xhr/same-origin-check-failed-status-code';
import { fetchBody, respond404 } from '../utils/http';
import { inject as injectUpload } from '../upload';
import { respondOnWebSocket } from './websocket';
import { PassThrough, Readable } from 'stream';
import createSpecialPageResponse from './special-page';
import matchUrl from 'match-url-wildcard';
import * as requestEventInfo from '../session/events/info';
import REQUEST_EVENT_NAMES from '../session/events/names';
import ResponseEvent from '../session/events/response-event';
import RequestEvent from '../session/events/request-event';
import ConfigureResponseEvent from '../session/events/configure-response-event';
import ConfigureResponseEventOptions from '../session/events/configure-response-event-options';
import promisifyStream from '../utils/promisify-stream';

const EVENT_SOURCE_REQUEST_TIMEOUT = 60 * 60 * 1000;

const stages = [
    function handleSocketError (ctx) {
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

    async function fetchProxyRequestBody (ctx) {
        if (ctx.isPage && !ctx.isIframe && !ctx.isHtmlImport)
            ctx.session.onPageRequest(ctx);

        ctx.reqBody = await fetchBody(ctx.req);
    },

    async function sendDestinationRequest (ctx) {
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

    async function checkSameOriginPolicyCompliance (ctx) {
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

    async function decideOnProcessingStrategy (ctx) {
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
                await ctx.forEachRequestFilterRule(async rule => {
                    const configureResponseEvent = new ConfigureResponseEvent(ctx, rule, ConfigureResponseEventOptions.DEFAULT);

                    await ctx.session.callRequestEventCallback(REQUEST_EVENT_NAMES.onConfigureResponse, rule, configureResponseEvent);

                    if (configureResponseEvent.opts.includeBody)
                        ctx.onResponseEventDataWithBody.push({ rule, opts: configureResponseEvent.opts });
                    else
                        ctx.onResponseEventDataWithoutBody.push({ rule, opts: configureResponseEvent.opts });
                });

                sendResponseHeaders(ctx);

                if (ctx.contentInfo.isNotModified)
                    ctx.res.end();
                else {
                    if (ctx.onResponseEventDataWithBody.length) {
                        const destResBodyCollectorStream = new PassThrough();

                        ctx.destRes.pipe(destResBodyCollectorStream);

                        promisifyStream(destResBodyCollectorStream).then(async data => {
                            ctx.saveNonProcessedDestResBody(data);

                            const responseInfo = requestEventInfo.createResponseInfo(ctx);

                            await Promise.all(ctx.onResponseEventDataWithBody.map(async ({ rule, opts }) => {
                                const preparedResponseInfo = requestEventInfo.prepareEventData(responseInfo, opts);
                                const responseEvent        = new ResponseEvent(rule, preparedResponseInfo);

                                await ctx.session.callRequestEventCallback(REQUEST_EVENT_NAMES.onResponse, rule, responseEvent);
                            }));

                            bufferToStream(data).pipe(ctx.res);
                        });
                    }
                    else if (ctx.onResponseEventDataWithoutBody.length) {
                        const responseInfo = requestEventInfo.createResponseInfo(ctx);

                        await Promise.all(ctx.onResponseEventDataWithoutBody.map(async item => {
                            const preparedResponseInfo = requestEventInfo.prepareEventData(responseInfo, item.opts);
                            const responseEvent        = new ResponseEvent(item.rule, preparedResponseInfo);

                            await ctx.session.callRequestEventCallback(REQUEST_EVENT_NAMES.onResponse, item.rule, responseEvent);
                        }));

                        ctx.destRes.pipe(ctx.res);
                    }
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
                sendResponseHeaders(ctx);
                ctx.res.end();
            }

            return;
        }

        ctx.goToNextStage = true;
    },

    async function fetchContent (ctx) {
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

    async function processContent (ctx) {
        try {
            ctx.destResBody = await processResource(ctx);
        }
        catch (err) {
            error(ctx, err);
        }
    },

    async function sendProxyResponse (ctx) {
        const configureResponseEvents = await Promise.all(ctx.requestFilterRules.map(async rule => {
            const configureResponseEvent = new ConfigureResponseEvent(ctx, rule, ConfigureResponseEventOptions.DEFAULT);

            await ctx.session.callRequestEventCallback(REQUEST_EVENT_NAMES.onConfigureResponse, rule, configureResponseEvent);

            return configureResponseEvent;
        }));

        sendResponseHeaders(ctx);

        connectionResetGuard(async () => {
            await Promise.all(configureResponseEvents.map(async configureResponseEvent => {
                await callResponseEventCallbackForProcessedRequest(ctx, configureResponseEvent);
            }));

            ctx.res.write(ctx.destResBody);
            ctx.res.end();
        });
    }
];


// Utils
function createReqOpts (ctx) {
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

function sendResponseHeaders (ctx) {
    const headers = headerTransforms.forResponse(ctx);

    ctx.res.writeHead(ctx.destRes.statusCode, headers);
    ctx.res.addTrailers(ctx.destRes.trailers);
}

function error (ctx, err) {
    if (ctx.isPage && !ctx.isIframe)
        ctx.session.handlePageError(ctx, err);
    else if (ctx.isFetch || ctx.isXhr)
        ctx.req.destroy();
    else
        ctx.closeWithError(500, err.toString());
}

function bufferToStream (buffer) {
    const stream = new Readable();

    stream.push(buffer);
    stream.push(null);

    return stream;
}

async function callResponseEventCallbackForProcessedRequest (ctx, configureResponseEvent) {
    const responseInfo         = requestEventInfo.createResponseInfo(ctx);
    const preparedResponseInfo = requestEventInfo.prepareEventData(responseInfo, configureResponseEvent.opts);
    const responseEvent        = new ResponseEvent(configureResponseEvent._requestFilterRule, preparedResponseInfo);

    await ctx.session.callRequestEventCallback(REQUEST_EVENT_NAMES.onResponse, configureResponseEvent._requestFilterRule, responseEvent);
}

async function callOnRequestEventCallback (ctx, rule, reqInfo) {
    const requestEvent = new RequestEvent(ctx, rule, reqInfo);

    await ctx.session.callRequestEventCallback(REQUEST_EVENT_NAMES.onRequest, rule, requestEvent);
}

async function callOnResponseEventCallbackForFailedSameOriginCheck (ctx, rule, configureOpts) {
    const responseInfo = requestEventInfo.createResponseInfo(ctx);

    responseInfo.statusCode = SAME_ORIGIN_CHECK_FAILED_STATUS_CODE;

    const preparedResponseInfo = requestEventInfo.prepareEventData(responseInfo, configureOpts);
    const responseEvent        = new ResponseEvent(rule, preparedResponseInfo);

    await ctx.session.callRequestEventCallback(REQUEST_EVENT_NAMES.onResponse, rule, responseEvent);
}

function sendRequest (ctx) {
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

// API
export async function run (req, res, serverInfo, openSessions) {
    const ctx = new RequestPipelineContext(req, res, serverInfo);

    if (ctx.dispatch(openSessions)) {
        for (let i = 0; i < stages.length; i++) {
            await stages[i](ctx);

            if (!ctx.goToNextStage)
                return;
        }
    }
    else
        respond404(res);
}
