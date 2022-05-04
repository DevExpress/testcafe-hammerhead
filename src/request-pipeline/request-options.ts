import RequestPipelineContext from './context';
import { Credentials, ExternalProxySettings, RequestOptionsInit } from '../typings/session';
import { OutgoingHttpHeaders } from 'http';
import BUILTIN_HEADERS from './builtin-header-names';
import * as headerTransforms from './header-transforms';
import { inject as injectUpload } from '../upload';
import matchUrl from 'match-url-wildcard';
import { RequestTimeout } from '../typings/proxy';
import { addAuthorizationPrefix } from '../utils/headers';

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
    externalProxySettings?: ExternalProxySettings;
    agent?: any;
    ecdhCurve?: string;
    rejectUnauthorized?: boolean;
    requestTimeout: RequestTimeout;
    isWebSocket: boolean;
    disableHttp2: boolean;

    constructor (params: RequestOptionsInit) {
        Object.assign(this, params);

        this._applyExternalProxySettings();
        this._prepareAuthorizationHeaders();
        this.prepare();
    }

    public static createFrom (ctx: RequestPipelineContext): RequestOptions {
        const bodyWithUploads = injectUpload(ctx.req.headers[BUILTIN_HEADERS.contentType] as string, ctx.reqBody);

        // NOTE: First, we should rewrite the request body, because the 'content-length' header will be built based on it.
        if (bodyWithUploads)
            ctx.reqBody = bodyWithUploads;

        return new RequestOptions({
            // NOTE: All headers, including 'content-length', are built here.
            headers:               headerTransforms.forRequest(ctx),
            externalProxySettings: ctx.session.externalProxySettings || void 0,
            url:                   ctx.dest.url,
            protocol:              ctx.dest.protocol,
            hostname:              ctx.dest.hostname,
            host:                  ctx.dest.host,
            port:                  ctx.dest.port,
            path:                  ctx.dest.partAfterHost,
            auth:                  ctx.dest.auth,
            method:                ctx.req.method || '',
            credentials:           ctx.session.getAuthCredentials(),
            body:                  ctx.reqBody,
            isAjax:                ctx.isAjax,
            rawHeaders:            ctx.req.rawHeaders,
            requestId:             ctx.requestId,
            requestTimeout:        ctx.session.options.requestTimeout,
            isWebSocket:           ctx.isWebSocket,
            disableHttp2:          ctx.session.isHttp2Disabled(),
        });
    }

    private _prepareAuthorizationHeaders (): void {
        // NOTE: We should save authorization and proxyAuthorization headers for API requests.
        if (this.headers[BUILTIN_HEADERS.isRequest]) {
            if (this.headers[BUILTIN_HEADERS.authorization])
                this.headers[BUILTIN_HEADERS.authorization] = addAuthorizationPrefix(this.headers[BUILTIN_HEADERS.authorization] as string);
            if (this.headers[BUILTIN_HEADERS.proxyAuthorization])
                this.headers[BUILTIN_HEADERS.proxyAuthorization] = addAuthorizationPrefix(this.headers[BUILTIN_HEADERS.proxyAuthorization] as string);
        }
    }

    private _applyExternalProxySettings (): void {
        if (!this.externalProxySettings || matchUrl(this.url, this.externalProxySettings.bypassRules))
            return;

        this.proxy = this.externalProxySettings;

        if (this.protocol === 'http:') {
            this.path     = this.protocol + '//' + this.host + this.path;
            this.host     = this.externalProxySettings.host;
            this.hostname = this.externalProxySettings.hostname;
            this.port     = this.externalProxySettings.port;

            if (this.externalProxySettings.authHeader)
                this.headers[BUILTIN_HEADERS.proxyAuthorization] = this.externalProxySettings.authHeader;
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
        const transformedHeaders = headerTransforms.transformHeadersCaseToRaw(this.headers, this.rawHeaders);
        const clonedReqOptions   = Object.assign({}, this) as object;

        clonedReqOptions['headers'] = transformedHeaders;

        return clonedReqOptions;
    }
}
