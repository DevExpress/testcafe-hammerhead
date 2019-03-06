/*eslint-disable no-unused-vars*/
import RequestPipelineContext from './context';
import { Credentials, ExternalProxySettings } from '../typings/session';
/*eslint-enable no-unused-vars*/
import * as headerTransforms from './header-transforms';
import { inject as injectUpload } from '../upload';
import matchUrl from 'match-url-wildcard';

export default class RequestOptions {
    url: string;
    protocol: string;
    hostname: string;
    host: string;
    port: string;
    path: string;
    method: string;
    credentials: Credentials;
    body: Buffer;
    isXhr: boolean;
    rawHeaders: Array<string>;
    headers: { [name: string]: string };
    proxy?: ExternalProxySettings;

    constructor (ctx: RequestPipelineContext) {
        const bodyWithUploads = injectUpload(ctx.req.headers['content-type'], ctx.reqBody);

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
        this.method      = ctx.req.method;
        this.credentials = ctx.session.getAuthCredentials();
        this.body        = ctx.reqBody;
        this.isXhr       = ctx.isXhr;
        this.rawHeaders  = ctx.req.rawHeaders;
        this.headers     = headers;

        if (proxy && !matchUrl(ctx.dest.url, proxy.bypassRules)) {
            this.proxy = proxy;

            if (ctx.dest.protocol === 'http:') {
                this.path     = this.protocol + '//' + this.host + this.path;
                this.host     = proxy.host;
                this.hostname = proxy.hostname;
                this.port     = proxy.port;

                if (proxy.authHeader)
                    headers['proxy-authorization'] = proxy.authHeader;
            }
        }
    }
}
