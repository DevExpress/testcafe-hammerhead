import RequestPipelineContext from './context';
import { Credentials, ExternalProxySettings } from '../typings/session';
import { OutgoingHttpHeaders } from 'http';
import BUILTIN_HEADERS from './builtin-header-names';
import * as headerTransforms from './header-transforms';
import { inject as injectUpload } from '../upload';
import matchUrl from 'match-url-wildcard';
import { RequestTimeout } from '../typings/proxy';
import { transformHeadersCaseToRaw } from "./header-transforms";

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
    headers: OutgoingHttpHeaders;
    transformedHeaders: OutgoingHttpHeaders;
    auth: string | void;
    requestId: string;
    proxy?: ExternalProxySettings;
    agent?: any;
    ecdhCurve?: string;
    rejectUnauthorized?: boolean;
    requestTimeout: RequestTimeout;

    constructor (ctx: RequestPipelineContext) {
        const bodyWithUploads = injectUpload(ctx.req.headers[BUILTIN_HEADERS.contentType] as string, ctx.reqBody);

        // NOTE: First, we should rewrite the request body, because the 'content-length' header will be built based on it.
        if (bodyWithUploads)
            ctx.reqBody = bodyWithUploads;

        // NOTE: All headers, including 'content-length', are built here.
        const headers = headerTransforms.forRequest(ctx);
        const proxy   = ctx.session.externalProxySettings;

        this.url            = ctx.dest.url;
        this.protocol       = ctx.dest.protocol;
        this.hostname       = ctx.dest.hostname;
        this.host           = ctx.dest.host;
        this.port           = ctx.dest.port;
        this.path           = ctx.dest.partAfterHost;
        this.auth           = ctx.dest.auth;
        this.method         = ctx.req.method;
        this.credentials    = ctx.session.getAuthCredentials();
        this.body           = ctx.reqBody;
        this.isAjax         = ctx.isAjax;
        this.rawHeaders     = ctx.req.rawHeaders;
        this.headers        = headers;
        this.requestId      = ctx.requestId;
        this.requestTimeout = ctx.session.options.requestTimeout;

        this._applyExternalProxySettings(proxy, ctx, headers);
    }

    private _applyExternalProxySettings (proxy, ctx: RequestPipelineContext, headers: OutgoingHttpHeaders): void {
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

    get isHttps (): boolean {
        return this.protocol === 'https:';
    }

    ignoreSSLAuth (): void {
        this.rejectUnauthorized = false;
        this.ecdhCurve          = 'auto';
    }

    prepare (): object {
        // NOTE: The headers are converted to raw headers because some sites ignore headers in a lower case. (GH-1380)
        // We also need to restore the request option headers to a lower case because headers may change
        // if a request is unauthorized, so there can be duplicated headers, for example, 'www-authenticate' and 'WWW-Authenticate'.
        const transformedHeaders = transformHeadersCaseToRaw(this.headers, this.rawHeaders);
        const clonedReqOptions   = Object.assign({}, this) as object;

        clonedReqOptions['headers'] = transformedHeaders;

        return clonedReqOptions;
    }
}
