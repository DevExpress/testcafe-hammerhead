import RequestPipelineContext from './context';
import {
    Credentials,
    ExternalProxySettings,
    RequestOptionsInit,
} from '../typings/session';
import { OutgoingHttpHeaders } from 'http';
import BUILTIN_HEADERS from './builtin-header-names';
import * as headerTransforms from './header-transforms';
import { inject as injectUpload } from '../upload';
import matchUrl from 'match-url-wildcard';
import { RequestTimeout } from '../typings/proxy';
import generateUniqueId from '../utils/generate-unique-id';
import { addAuthorizationPrefix } from '../utils/headers';
import { EventEmitter } from 'events';

const DEFAULT_REQUEST_OPTIONS = {
    isAjax:      false,
    rawHeaders:  [],
    isWebSocket: false,
    get requestId () {
        return generateUniqueId();
    },
};

interface ChangedProperty {
    name: string;
    value: unknown;
}

export default class RequestOptions {
    url: string;
    protocol: string;
    hostname: string;
    host: string;
    port?: string;
    path: string;
    method: string;
    credentials: Credentials;
    body: Buffer;
    isAjax: boolean;
    rawHeaders: string[];
    headers: OutgoingHttpHeaders;
    transformedHeaders: OutgoingHttpHeaders;
    auth?: string;
    requestId: string;
    proxy?: ExternalProxySettings;
    externalProxySettings?: ExternalProxySettings;
    agent?: any;
    ecdhCurve?: string;
    rejectUnauthorized?: boolean;
    requestTimeout?: RequestTimeout;
    isWebSocket: boolean;
    disableHttp2: boolean;
    _changedUrlProperties: ChangedProperty[] = [];
    _changedHeaders: ChangedProperty[] = [];
    _removedHeaders: string[] = [];
    _eventEmitter: EventEmitter = new EventEmitter();

    constructor (params: RequestOptionsInit, trackChanges = false) {
        Object.assign(this, DEFAULT_REQUEST_OPTIONS, params);

        this._applyExternalProxySettings();
        this.prepare();

        if (trackChanges)
            return this._setTrackChanges(this);
    }

    private _setTrackChanges (obj: RequestOptions): RequestOptions {
        // NOTE: this code is necessary to support request modification inside RequestHooks
        // in the 'nativeAutomation' mode.
        const self = obj;

        obj.headers = new Proxy(obj.headers, {
            set (target: OutgoingHttpHeaders, propName: string, newValue: any): boolean {
                if (target[propName] !== newValue) {
                    const changedHeader = {
                        name:  propName,
                        value: newValue,
                    };

                    self._changedHeaders.push(changedHeader);
                    self._eventEmitter.emit('headerChanged', changedHeader);
                }

                return Reflect.set(target, propName, newValue);
            },
            deleteProperty (target: OutgoingHttpHeaders, propName: string): boolean {
                if (propName in target) {
                    self._removedHeaders.push(propName);
                    self._eventEmitter.emit('headerRemoved', propName);
                }

                return Reflect.deleteProperty(target, propName);
            },
        });

        obj = new Proxy(obj, {
            set (target: RequestOptions, propName: string, newValue: any): boolean {
                if (target[propName] !== newValue) {
                    const changedUrlProperty = {
                        name:  propName,
                        value: newValue,
                    };

                    self._changedUrlProperties.push(changedUrlProperty);
                    self._eventEmitter.emit('urlPropertyChange', changedUrlProperty);
                }

                return Reflect.set(target, propName, newValue);
            },
        });

        return obj;
    }

    public static createFrom (ctx: RequestPipelineContext): RequestOptions {
        const bodyWithUploads = injectUpload(ctx.req.headers[BUILTIN_HEADERS.contentType] as string, ctx.reqBody);

        // NOTE: First, we should rewrite the request body, because the 'content-length' header will be built based on it.
        if (bodyWithUploads)
            ctx.reqBody = bodyWithUploads;

        // NOTE: We should save authorization and proxyAuthorization headers for API requests.
        if (ctx.req.headers[BUILTIN_HEADERS.isApiRequest]) {
            if (ctx.req.headers[BUILTIN_HEADERS.authorization])
                ctx.req.headers[BUILTIN_HEADERS.authorization] = addAuthorizationPrefix(ctx.req.headers[BUILTIN_HEADERS.authorization] as string);
            if (ctx.req.headers[BUILTIN_HEADERS.proxyAuthorization])
                ctx.req.headers[BUILTIN_HEADERS.proxyAuthorization] = addAuthorizationPrefix(ctx.req.headers[BUILTIN_HEADERS.proxyAuthorization] as string);
        }

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

    on (event: string, listener: (...args: any[]) => void): void {
        this._eventEmitter.on(event, listener);
    }
}
