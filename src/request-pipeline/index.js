import DestinationRequest from './destination-request';
import FileRequest from './file-request';
import RequestPipelineContext from './context';
import * as headerTransforms from './header-transforms';
import { process as processResource } from '../processing/resources';
import { MESSAGE, getText } from '../messages';
import connectionResetGuard from './connection-reset-guard';
import { check as checkSameOriginPolicy, SAME_ORIGIN_CHECK_FAILED_STATUS_CODE } from './xhr/same-origin-policy';
import { fetchBody, respond404 } from '../utils/http';
import { inject as injectUpload } from '../upload';
import { respondOnWebSocket } from './websocket';
import * as specialPage from './special-page';
import matchUrl from 'match-url-wildcard';

const EVENT_SOURCE_REQUEST_TIMEOUT = 60 * 60 * 1000;

// Stages
const stages = {
    0: async function fetchProxyRequestBody (ctx, next) {
        if (ctx.isPage && !ctx.isIframe && !ctx.isHtmlImport)
            ctx.session.onPageRequest(ctx);

        ctx.reqBody = await fetchBody(ctx.req);

        next();
    },

    1: function sendDestinationRequest (ctx, next) {
        const opts = createReqOpts(ctx);

        if (ctx.isSpecialPage) {
            ctx.destRes = specialPage.getResponse();
            next();
        }

        else {
            const req = ctx.isFileProtocol ? new FileRequest(opts) : new DestinationRequest(opts);

            req.on('response', res => {
                ctx.destRes = res;
                next();
            });

            req.on('error', () => {
                ctx.hasDestReqErr = true;
            });

            req.on('fatalError', err => error(ctx, err));

            req.on('socketHangUp', () => ctx.req.socket.end());
        }
    },

    2: function checkSameOriginPolicyCompliance (ctx, next) {
        ctx.buildContentInfo();

        if ((ctx.isXhr || ctx.isFetch) && !ctx.contentInfo.isNotModified && !checkSameOriginPolicy(ctx)) {
            ctx.closeWithError(SAME_ORIGIN_CHECK_FAILED_STATUS_CODE);
            return;
        }

        next();
    },

    3: function decideOnProcessingStrategy (ctx, next) {
        if (ctx.contentInfo.requireProcessing && ctx.destRes.statusCode === 204)
            ctx.destRes.statusCode = 200;

        if (ctx.isWebSocket) {
            respondOnWebSocket(ctx);

            return;
        }
        // NOTE: Just pipe the content body to the browser if we don't need to process it.
        else if (!ctx.contentInfo.requireProcessing) {
            sendResponseHeaders(ctx);

            if (!ctx.isSpecialPage) {
                ctx.destRes.pipe(ctx.res);

                // NOTE: sets 60 minutes timeout for the "event source" requests instead of 2 minutes by default
                if (ctx.dest.isEventSource) {
                    ctx.req.setTimeout(EVENT_SOURCE_REQUEST_TIMEOUT);
                    ctx.req.on('close', () => ctx.destRes.destroy());
                }
            }
            else
                ctx.res.end('');

            return;
        }

        next();
    },

    4: async function fetchContent (ctx, next) {
        if (ctx.isSpecialPage)
            ctx.destResBody = specialPage.getBody();
        else
            ctx.destResBody = await fetchBody(ctx.destRes);

        // NOTE: Sometimes the underlying socket emits an error event. But if we have a response body,
        // we can still process such requests. (B234324)
        if (ctx.hasDestReqErr && isDestResBodyMalformed(ctx)) {
            error(ctx, getText(MESSAGE.destConnectionTerminated, ctx.dest.url));

            return;
        }

        next();
    },

    5: async function processContent (ctx, next) {
        try {
            ctx.destResBody = await processResource(ctx);
            next();
        }
        catch (err) {
            error(ctx, err);
        }
    },

    6: function sendProxyResponse (ctx) {
        sendResponseHeaders(ctx);

        connectionResetGuard(() => {
            ctx.res.write(ctx.destResBody);
            ctx.res.end();
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
