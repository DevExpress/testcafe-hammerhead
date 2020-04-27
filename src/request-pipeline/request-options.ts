import RequestPipelineContext from './context';
import { Credentials, ExternalProxySettings } from '../typings/session';
import { IncomingHttpHeaders } from 'http';
import BUILTIN_HEADERS from './builtin-header-names';
import * as headerTransforms from './header-transforms';
import { inject as injectUpload } from '../upload';
import matchUrl from 'match-url-wildcard';

export default class RequestOptions {
    url: string;
    protocol: string;
    hostname: string;
    host: string;
    port: string|void;
    path: string;
    method: string;
    credentials: Credentials;
    body: Buffer;
    isAjax: boolean;
    rawHeaders: string[];
    headers: IncomingHttpHeaders;
    auth: string | void;
    proxy?: ExternalProxySettings;
    agent?: any;
    ecdhCurve?: string;
    rejectUnauthorized?: boolean;

    constructor (ctx: RequestPipelineContext) {
        const bodyWithUploads = injectUpload(ctx.req.headers[BUILTIN_HEADERS.contentType] as string, ctx.reqBody);

        // NOTE: First, we should rewrite the request body, because the 'content-length' header will be built based on it.
        if (bodyWithUploads)
            ctx.reqBody = bodyWithUploads;

        // NOTE: All headers, including 'content-length', are built here.
        const headers = headerTransforms.forRequest(ctx);
        const proxy   = ctx.session.externalProxySettings;

        this.url         = ctx.dest.url;
        this.protocol    = ctx.dest.protocol;
        this.hostname    = ctx.dest.hostname;
        this.host        = ctx.dest.host;
        this.port        = ctx.dest.port;
        this.path        = ctx.dest.partAfterHost;
        this.auth        = ctx.dest.auth;
        this.method      = ctx.req.method;
        this.credentials = ctx.session.getAuthCredentials();
        this.body        = ctx.reqBody;
        this.isAjax      = ctx.isAjax;
        this.rawHeaders  = ctx.req.rawHeaders;
        this.headers     = headers;

        this._applyExternalProxySettings(proxy, ctx, headers);
    }

    _applyExternalProxySettings (proxy, ctx: RequestPipelineContext, headers: IncomingHttpHeaders): void {
        if (!proxy || matchUrl(ctx.dest.url, proxy.bypassRules))
            return;

        this.proxy = proxy;

        if (ctx.dest.protocol === 'http:') {
            this.path     = this.protocol + '//' + this.host + this.path;
            this.host     = proxy.host;
            this.hostname = proxy.hostname;
            this.port     = proxy.port;

            if (proxy.authHeader)
                headers[BUILTIN_HEADERS.proxyAuthorization] = proxy.authHeader;
        }
    }
}
