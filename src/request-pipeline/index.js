import DestinationRequest from './destination-request';
import RequestPipelineContext from './context';
import * as headerTransforms from './header-transforms';
import { process as processResource } from '../processing/resources';
import { MESSAGE, getText } from '../messages';
import connectionResetGuard from './connection-reset-guard';
import { check as checkSameOriginPolicy, SAME_ORIGIN_CHECK_FAILED_STATUS_CODE } from './xhr/same-origin-policy';
import { fetchBody, respond404 } from '../utils/http';
import { inject as injectUpload } from '../upload';
import { isSpecialPage } from '../utils/url';

// Stages
var stages = {
    0: async function fetchProxyRequestBody (ctx, next) {
        ctx.reqBody = await fetchBody(ctx.req);
        next();
    },

    1: function sendDestinationRequest (ctx, next) {
        var opts = createReqOpts(ctx);

        if (isSpecialPage(opts.url)) {
            ctx.isSpecialPage = true;
            assignSpecialPageHeadersToDestRes(ctx);
            next();
        }

        var req = new DestinationRequest(opts);

        req.on('response', res => {
            ctx.destRes = res;
            next();
        });

        req.on('error', () => ctx.hasDestReqErr = true);
        req.on('fatalError', err => error(ctx, err));
    },

    2: function checkSameOriginPolicyCompliance (ctx, next) {
        if (ctx.isXhr && !checkSameOriginPolicy(ctx)) {
            ctx.closeWithError(SAME_ORIGIN_CHECK_FAILED_STATUS_CODE);
            return;
        }

        next();
    },

    3: function decideOnProcessingStrategy (ctx, next) {
        ctx.buildContentInfo();

        if (ctx.contentInfo.requireProcessing && ctx.destRes.statusCode === 204)
            ctx.destRes.statusCode = 200;

        // NOTE: Just pipe the content body to the browser if we don't need to process it.
        if (!ctx.contentInfo.requireProcessing) {
            sendResponseHeaders(ctx);
            ctx.destRes.pipe(ctx.res);
            return;
        }

        next();
    },

    4: async function fetchContent (ctx, next) {
        if (ctx.isSpecialPage)
            ctx.destResBody = new Buffer(0);
        else
            ctx.destResBody = await fetchBody(ctx.destRes);

        // NOTE: Sometimes the underlying socket emits an error event. But if we have a response body,
        // we can still process such requests. (B234324)
        if (ctx.hasDestReqErr && isDestResBodyMalformed(ctx)) {
            error(getText(MESSAGE.destConnectionTerminated, ctx.dest.url));

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
    var bodyWithUploads = injectUpload(ctx.req.headers['content-type'], ctx.reqBody);

    // NOTE: First, we should rewrite the request body, because the 'content-length' header will be built based on it.
    if (bodyWithUploads)
        ctx.reqBody = bodyWithUploads;

    // NOTE: All headers, including 'content-length', are built here.
    var headers = headerTransforms.forRequest(ctx);

    return {
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
}

function sendResponseHeaders (ctx) {
    var headers = headerTransforms.forResponse(ctx);

    ctx.res.writeHead(ctx.destRes.statusCode, headers);
    ctx.res.addTrailers(ctx.destRes.trailers);
}

function error (ctx, err) {
    if (ctx.isPage && !ctx.isIframe)
        ctx.session.handlePageError(ctx, err);
    else
        ctx.closeWithError(500, err);
}

function isDestResBodyMalformed (ctx) {
    return !ctx.destResBody || ctx.destResBody.length !== ctx.destRes.headers['content-length'];
}

function assignSpecialPageHeadersToDestRes (ctx) {
    ctx.destRes = {
        headers: {
            'content-type': 'text/html'
        },
        statusCode: 200,
        trailers:   {}
    };
}


// API
export function run (req, res, serverInfo, openSessions) {
    var ctx = new RequestPipelineContext(req, res, serverInfo);

    if (ctx.dispatch(openSessions)) {
        var stageIdx = 0;
        var next     = () => stages[++stageIdx](ctx, next);

        stages[0](ctx, next);
    }
    else
        respond404(res);
}
