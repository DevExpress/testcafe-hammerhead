import { inject as injectUpload } from '../upload';
import matchUrl from 'match-url-wildcard';
import * as headerTransforms from './header-transforms';
import FileRequest from './file-request';
import DestinationRequest from './destination-request';

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
