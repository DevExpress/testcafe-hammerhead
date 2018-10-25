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
import { PassThrough } from 'stream';
import createSpecialPageResponse from './special-page';
import matchUrl from 'match-url-wildcard';
import * as requestEventInfo from '../session/events/info';
import REQUEST_EVENT_NAMES from '../session/events/names';
import ResponseEvent from '../session/events/response-event';
import RequestEvent from '../session/events/request-event';
import ConfigureResponseEvent from '../session/events/configure-response-event';
import ConfigureResponseEventOptions from '../session/events/configure-response-event-options';

const EVENT_SOURCE_REQUEST_TIMEOUT = 60 * 60 * 1000;

// Stages
const stages = {
    0: function handleSocketError (ctx, next) {
        // NOTE: In some case on MacOS, browser reset connection with server and we need to catch this exception.
        if (ctx.isWebSocket) {
            ctx.res.on('error', e => {
                if (e.code === 'ECONNRESET' && !ctx.mock) {
                    if (ctx.destRes)
                        ctx.destRes.destroy();
                    else
                        ctx.isBrowserConnectionReset = true;
                }
                else
                    throw e;
            });
        }

        next();
    },

    1: async function fetchProxyRequestBody (ctx, next) {
        if (ctx.isPage && !ctx.isIframe && !ctx.isHtmlImport)
            ctx.session.onPageRequest(ctx);

        ctx.reqBody = await fetchBody(ctx.req);

        next();
    },

    2: function sendDestinationRequest (ctx, next) {
        if (ctx.isSpecialPage) {
            ctx.destRes = createSpecialPageResponse();
            next();
        }
        else {
            ctx.reqOpts = createReqOpts(ctx);

            if (ctx.session.hasRequestEventListeners()) {
                const requestInfo = requestEventInfo.createRequestInfo(ctx, ctx.reqOpts);

                ctx.requestFilterRules = ctx.session.getRequestFilterRules(requestInfo);
                ctx.requestFilterRules.forEach(rule => {
                    callOnRequestEventCallback(ctx, rule, requestInfo);
                    setupMockIfNecessary(ctx, rule);
                });
            }

            if (ctx.mock) {
                mockResponse(ctx);
                next();
            }
            else
                sendRequest(ctx, next);
        }
    },

    3: function checkSameOriginPolicyCompliance (ctx, next) {
        ctx.buildContentInfo();

        if (!ctx.isKeepSameOriginPolicy()) {
            ctx.requestFilterRules.forEach(rule => {
                const configureResponseEvent = new ConfigureResponseEvent(ctx, rule, ConfigureResponseEventOptions.DEFAULT);

                ctx.session.callRequestEventCallback(REQUEST_EVENT_NAMES.onConfigureResponse, rule, configureResponseEvent);
                callOnResponseEventCallbackForFailedSameOriginCheck(ctx, rule, configureResponseEvent);
            });
            ctx.closeWithError(SAME_ORIGIN_CHECK_FAILED_STATUS_CODE);

            return;
        }

        next();
    },

    4: function decideOnProcessingStrategy (ctx, next) {
        if (ctx.contentInfo.requireProcessing && ctx.destRes.statusCode === 204)
            ctx.destRes.statusCode = 200;

        if (ctx.isWebSocket) {
            respondOnWebSocket(ctx);

            return;
        }
        // NOTE: Just pipe the content body to the browser if we don't need to process it.
        else if (!ctx.contentInfo.requireProcessing) {
            if (!ctx.isSpecialPage) {
                ctx.requestFilterRules.forEach(rule => {
                    const configureResponseEvent = new ConfigureResponseEvent(ctx, rule, ConfigureResponseEventOptions.DEFAULT);

                    ctx.session.callRequestEventCallback(REQUEST_EVENT_NAMES.onConfigureResponse, rule, configureResponseEvent);

                    if (configureResponseEvent.opts.includeBody)
                        callOnResponseEventCallbackWithCollectedBody(ctx, rule, configureResponseEvent.opts);
                    else
                        ctx.onResponseEventDataWithoutBody.push({ rule, opts: configureResponseEvent.opts });
                });

                sendResponseHeaders(ctx);

                if (ctx.contentInfo.isNotModified)
                    ctx.res.end();
                else
                    ctx.destRes.pipe(ctx.res);

                if (ctx.onResponseEventDataWithoutBody.length) {
                    ctx.res.on('finish', () => {
                        const responseInfo = requestEventInfo.createResponseInfo(ctx);

                        ctx.onResponseEventDataWithoutBody.forEach(item => {
                            const preparedResponseInfo = requestEventInfo.prepareEventData(responseInfo, item.opts);
                            const responseEvent        = new ResponseEvent(item.rule, preparedResponseInfo);

                            ctx.session.callRequestEventCallback(REQUEST_EVENT_NAMES.onResponse, item.rule, responseEvent);
                        });
                    });
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

        next();
    },

    5: async function fetchContent (ctx, next) {
        ctx.destResBody = await fetchBody(ctx.destRes);

        if (ctx.requestFilterRules.length)
            ctx.saveNonProcessedDestResBody(ctx.destResBody);

        // NOTE: Sometimes the underlying socket emits an error event. But if we have a response body,
        // we can still process such requests. (B234324)
        if (ctx.hasDestReqErr && isDestResBodyMalformed(ctx)) {
            error(ctx, getText(MESSAGE.destConnectionTerminated, ctx.dest.url));

            return;
        }

        next();
    },

    6: async function processContent (ctx, next) {
        try {
            ctx.destResBody = await processResource(ctx);
            next();
        }
        catch (err) {
            error(ctx, err);
        }
    },

    7: function sendProxyResponse (ctx) {
        const configureResponseEvents = ctx.requestFilterRules.map(rule => {
            const configureResponseEvent = new ConfigureResponseEvent(ctx, rule, ConfigureResponseEventOptions.DEFAULT);

            ctx.session.callRequestEventCallback(REQUEST_EVENT_NAMES.onConfigureResponse, rule, configureResponseEvent);
            return configureResponseEvent;
        });

        sendResponseHeaders(ctx);

        connectionResetGuard(() => {
            ctx.res.write(ctx.destResBody);
            ctx.res.end(() => {
                configureResponseEvents.forEach(configureResponseEvent => callResponseEventCallbackForProcessedRequest(ctx, configureResponseEvent));
            });
        });
    }
};


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

function isDestResBodyMalformed (ctx) {
    return !ctx.destResBody || ctx.destResBody.length !== ctx.destRes.headers['content-length'];
}

function callResponseEventCallbackForProcessedRequest (ctx, configureResponseEvent) {
    const responseInfo         = requestEventInfo.createResponseInfo(ctx);
    const preparedResponseInfo = requestEventInfo.prepareEventData(responseInfo, configureResponseEvent.opts);
    const responseEvent        = new ResponseEvent(configureResponseEvent._requestFilterRule, preparedResponseInfo);

    ctx.session.callRequestEventCallback(REQUEST_EVENT_NAMES.onResponse, configureResponseEvent._requestFilterRule, responseEvent);
}

function callOnRequestEventCallback (ctx, rule, reqInfo) {
    const requestEvent = new RequestEvent(ctx, rule, reqInfo);

    ctx.session.callRequestEventCallback(REQUEST_EVENT_NAMES.onRequest, rule, requestEvent);
}

function callOnResponseEventCallbackWithCollectedBody (ctx, rule, configureOpts) {
    const destResBodyCollectorStream = new PassThrough();
    const chunks                     = [];

    destResBodyCollectorStream.on('data', chunk => chunks.push(chunk));
    destResBodyCollectorStream.on('end', () => {
        const data = Buffer.concat(chunks);

        ctx.saveNonProcessedDestResBody(data);

        const responseInfo         = requestEventInfo.createResponseInfo(ctx);
        const preparedResponseInfo = requestEventInfo.prepareEventData(responseInfo, configureOpts);
        const responseEvent        = new ResponseEvent(rule, preparedResponseInfo);

        ctx.session.callRequestEventCallback(REQUEST_EVENT_NAMES.onResponse, rule, responseEvent);
    });

    ctx.destRes.pipe(destResBodyCollectorStream);
}

function callOnResponseEventCallbackForFailedSameOriginCheck (ctx, rule, configureOpts) {
    const responseInfo = requestEventInfo.createResponseInfo(ctx);

    responseInfo.statusCode = SAME_ORIGIN_CHECK_FAILED_STATUS_CODE;

    const preparedResponseInfo = requestEventInfo.prepareEventData(responseInfo, configureOpts);
    const responseEvent        = new ResponseEvent(rule, preparedResponseInfo);

    ctx.session.callRequestEventCallback(REQUEST_EVENT_NAMES.onResponse, rule, responseEvent);
}

function mockResponse (ctx) {
    ctx.mock.setRequestOptions(ctx.reqOpts);
    ctx.destRes = ctx.mock.getResponse();
}

function setupMockIfNecessary (ctx, rule) {
    const mock = ctx.session.getMock(rule);

    if (mock && !ctx.mock)
        ctx.mock = mock;
}

function sendRequest (ctx, next) {
    const req = ctx.isFileProtocol ? new FileRequest(ctx.reqOpts) : new DestinationRequest(ctx.reqOpts);

    req.on('response', res => {
        if (ctx.isBrowserConnectionReset) {
            res.destroy();

            return;
        }

        ctx.destRes = res;
        next();
    });

    req.on('error', () => {
        ctx.hasDestReqErr = true;
    });

    req.on('fatalError', err => error(ctx, err));

    req.on('socketHangUp', () => ctx.req.socket.end());
}

// API
export function run (req, res, serverInfo, openSessions) {
    const ctx = new RequestPipelineContext(req, res, serverInfo);

    if (ctx.dispatch(openSessions)) {
        let stageIdx = 0;
        const next   = () => stages[++stageIdx](ctx, next);

        stages[0](ctx, next);
    }
    else
        respond404(res);
}
