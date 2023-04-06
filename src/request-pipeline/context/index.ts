import net from 'net';

import {
    IncomingMessage,
    ServerResponse,
    OutgoingHttpHeaders,
} from 'http';

import Session from '../../session';
import { StoragesSnapshot, FileStream } from '../../typings/session';
import { ServerInfo } from '../../typings/proxy';
import { parseClientSyncCookieStr } from '../../utils/cookie';
import { ParsedClientSyncCookie } from '../../typings/cookie';
import IncomingMessageLike from '../incoming-message-like';
import { ParsedProxyUrl } from '../../typings/url';
import { OnResponseEventData, RequestCacheEntry } from '../../typings/context';
import Charset from '../../processing/encoding/charset';
import * as urlUtils from '../../utils/url';
import * as contentTypeUtils from '../../utils/content-type';
import generateUniqueId from '../../utils/generate-unique-id';
import { check as checkSameOriginPolicy } from '../same-origin-policy';
import * as headerTransforms from '../header-transforms';
import SERVICE_ROUTES from '../../proxy/service-routes';
import BUILTIN_HEADERS from '../builtin-header-names';
import logger from '../../utils/logger';
import createSpecialPageResponse from '../create-special-page-response';
import { fetchBody } from '../../utils/http';
import * as requestCache from '../cache';
import { Http2Response } from '../destination-request/http2';
import BaseRequestPipelineContext from './base';
import RequestPipelineRequestHookEventFactory from '../request-hooks/events/factory';
import RequestHookEventProvider from '../request-hooks/events/event-provider';
import { PassThrough } from 'stream';
import promisifyStream from '../../utils/promisify-stream';
import { toReadableStream } from '../../utils/buffer';
import isRedirectStatusCode from '../../utils/is-redirect-status-code';

export interface DestInfo {
    url: string;
    protocol: string;
    host: string;
    hostname: string;
    port: string;
    partAfterHost: string;
    isIframe: boolean;
    isForm: boolean;
    isScript: boolean;
    isEventSource: boolean;
    isHtmlImport: boolean;
    isWebSocket: boolean;
    isServiceWorker: boolean;
    isAjax: boolean;
    isObject: boolean;
    charset: string;
    reqOrigin: string;
    referer?: string;
    domain?: string;
    auth?: string;
    credentials?: urlUtils.Credentials;
}

interface ContentInfo {
    charset: Charset;
    requireProcessing: boolean;
    isIframeWithImageSrc: boolean;
    isCSS: boolean;
    isScript: boolean;
    isManifest: boolean;
    encoding: string;
    contentTypeUrlToken: string;
    isFileDownload: boolean;
    isNotModified: boolean;
    isRedirect: boolean;
    isAttachment: boolean;
    isTextPage: boolean;
    isObject: boolean;
}

interface FlattenParsedProxyUrl {
    dest: DestInfo;
    sessionId: string;
    windowId?: string;
}

interface Socket extends net.Socket {
    // TODO: we have to override the net.Socket.write method due to conflicting definitions:
    // https://github.com/DefinitelyTyped/DefinitelyTyped/blob/019dfa1bde9d1549e9f3d8c5ef61aaeba9bfa53a/types/node/net.d.ts#L64
    // https://github.com/DefinitelyTyped/DefinitelyTyped/blob/019dfa1bde9d1549e9f3d8c5ef61aaeba9bfa53a/types/node/stream.d.ts#L159
    // To get rid of it, we should inform https://github.com/DefinitelyTyped/DefinitelyTyped about the problem or fix it by ourselves in upstream
    write(chunk: Uint8Array | string): boolean;
}

export type DestinationResponse = IncomingMessage | FileStream | IncomingMessageLike | Http2Response;

const CANNOT_BE_USED_WITH_WEB_SOCKET_ERR_MSG = 'The function cannot be used with a WebSocket request.';

export default class RequestPipelineContext extends BaseRequestPipelineContext {
    session: Session;
    reqBody: Buffer;
    dest: DestInfo;
    destRes: DestinationResponse;
    isDestResReadableEnded = false;
    destResBody: Buffer;
    isAjax = false;
    isPage = false;
    isHTMLPage = false;
    isHtmlImport = false;
    isWebSocket = false;
    isIframe = false;
    isSpecialPage = false;
    isWebSocketConnectionReset = false;
    contentInfo: ContentInfo;
    restoringStorages: StoragesSnapshot;
    parsedClientSyncCookie: ParsedClientSyncCookie;
    isFileProtocol: boolean;
    nonProcessedDestResBody: Buffer;
    goToNextStage = true;
    isSameOriginPolicyFailed = false;
    windowId?: string;
    temporaryCacheEntry?: RequestCacheEntry;
    eventFactory: RequestPipelineRequestHookEventFactory;

    constructor (readonly req: IncomingMessage,
        readonly res: ServerResponse | Socket,
        readonly serverInfo: ServerInfo,
        readonly nativeAutomation: boolean) {
        super(generateUniqueId());
        this._initParsedClientSyncCookie();

        this.eventFactory = new RequestPipelineRequestHookEventFactory(this);
    }

    private _initParsedClientSyncCookie (): void {
        if (!this.req.headers.cookie)
            return;

        const parsedClientSyncCookieStr = parseClientSyncCookieStr(this.req.headers.cookie);

        if (parsedClientSyncCookieStr)
            this.parsedClientSyncCookie = parsedClientSyncCookieStr;
    }

    // TODO: Rewrite parseProxyUrl instead.
    private static _flattenParsedProxyUrl (parsed: ParsedProxyUrl | null): FlattenParsedProxyUrl | null {
        if (!parsed)
            return null;

        const parsedResourceType = urlUtils.parseResourceType(parsed.resourceType);
        const dest               = {
            url:             parsed.destUrl,
            protocol:        parsed.destResourceInfo.protocol || '',
            host:            parsed.destResourceInfo.host || '',
            hostname:        parsed.destResourceInfo.hostname || '',
            port:            parsed.destResourceInfo.port || '',
            partAfterHost:   parsed.destResourceInfo.partAfterHost || '',
            auth:            parsed.destResourceInfo.auth,
            isIframe:        !!parsedResourceType.isIframe,
            isForm:          !!parsedResourceType.isForm,
            isScript:        !!(parsedResourceType.isScript || parsedResourceType.isServiceWorker),
            isEventSource:   !!parsedResourceType.isEventSource,
            isHtmlImport:    !!parsedResourceType.isHtmlImport,
            isWebSocket:     !!parsedResourceType.isWebSocket,
            isServiceWorker: !!parsedResourceType.isServiceWorker,
            isAjax:          !!parsedResourceType.isAjax,
            isObject:        !!parsedResourceType.isObject,
            charset:         parsed.charset || '',
            reqOrigin:       parsed.reqOrigin || '',
            credentials:     parsed.credentials,
        };

        return { dest, sessionId: parsed.sessionId, windowId: parsed.windowId };
    }

    private _isFileDownload (): boolean {
        const contentDisposition = this.destRes.headers[BUILTIN_HEADERS.contentDisposition];

        return !!contentDisposition &&
               contentDisposition.includes('attachment') &&
               contentDisposition.includes('filename');
    }

    private _resolveInjectableUrls (injectableUrls: string[]): string[] {
        return injectableUrls.map(url => this.resolveInjectableUrl(url));
    }

    private _initRequestNatureInfo (): void {
        const acceptHeader = this.req.headers[BUILTIN_HEADERS.accept] as string;

        this.isWebSocket    = this.dest.isWebSocket;
        this.isHtmlImport   = this.dest.isHtmlImport;
        this.isAjax         = this.dest.isAjax;
        this.isPage         = !this.isAjax && !this.isWebSocket && acceptHeader &&
                              contentTypeUtils.isPage(acceptHeader) || this.isHtmlImport;
        this.isIframe       = this.dest.isIframe;
        this.isSpecialPage  = urlUtils.isSpecialPage(this.dest.url);
        this.isFileProtocol = this.dest.protocol === 'file:';
        this.isHTMLPage     = this.isPage && !this.isIframe && !this.isHtmlImport;
    }

    private _getDestFromReferer (parsedReferer: FlattenParsedProxyUrl): FlattenParsedProxyUrl {
        const dest = parsedReferer.dest;

        dest.partAfterHost = this.req.url || '';
        dest.url           = urlUtils.formatUrl(dest);

        return { dest, sessionId: parsedReferer.sessionId, windowId: parsedReferer.windowId };
    }

    private _addTemporaryEntryToCache (): void {
        if (!this.temporaryCacheEntry)
            return;

        this.temporaryCacheEntry.value.res.setBody(this.destResBody);
        requestCache.add(this.temporaryCacheEntry);

        this.temporaryCacheEntry = void 0;
    }

    // API
    dispatch (openSessions: Map<string, Session>): boolean {
        const parsedReqUrl = urlUtils.parseProxyUrl(this.req.url || '');
        const referer      = this.req.headers[BUILTIN_HEADERS.referer] as string;
        let parsedReferer  = referer && urlUtils.parseProxyUrl(referer) || null;

        // TODO: Remove it after parseProxyURL is rewritten.
        let flattenParsedReqUrl  = RequestPipelineContext._flattenParsedProxyUrl(parsedReqUrl);
        let flattenParsedReferer = RequestPipelineContext._flattenParsedProxyUrl(parsedReferer);

        // NOTE: Remove that after implementing the https://github.com/DevExpress/testcafe-hammerhead/issues/2155
        if (!flattenParsedReqUrl && flattenParsedReferer)
            flattenParsedReqUrl = this._getDestFromReferer(flattenParsedReferer);

        if (!flattenParsedReqUrl)
            return false;

        const session = openSessions.get(flattenParsedReqUrl.sessionId);

        if (session)
            this.session = session;

        if (!this.session)
            return false;

        if (!flattenParsedReferer && this.session.options.referer) {
            parsedReferer        = urlUtils.parseProxyUrl(this.session.options.referer) || null;
            flattenParsedReferer = RequestPipelineContext._flattenParsedProxyUrl(parsedReferer);
        }

        this.dest               = flattenParsedReqUrl.dest;
        this.windowId           = flattenParsedReqUrl.windowId;
        this.dest.partAfterHost = RequestPipelineContext._preparePartAfterHost(this.dest.partAfterHost);
        this.dest.domain        = urlUtils.getDomain(this.dest);

        if (flattenParsedReferer) {
            this.dest.referer   = flattenParsedReferer.dest.url;
            this.dest.reqOrigin = this.dest.reqOrigin || urlUtils.getDomain(flattenParsedReferer.dest);
        }
        else
            this.dest.reqOrigin = this.dest.reqOrigin || this.dest.domain;

        this._initRequestNatureInfo();
        this._applyClientSyncCookie();

        return true;
    }

    private _applyClientSyncCookie (): void {
        if (!this.parsedClientSyncCookie)
            return;

        const clientCookie = this.parsedClientSyncCookie.actual.filter(
            syncCookie => syncCookie.isClientSync && syncCookie.sid === this.session.id);

        this.session.cookies.setByClient(clientCookie);
    }

    private static _preparePartAfterHost (str: string): string {
        // Browsers add a leading slash to the pathname part of url (GH-608)
        // For example: url http://www.example.com?gd=GID12082014 will be converted
        // to http://www.example.com/?gd=GID12082014
        return (str[0] === '/' ? '' : '/') + str;
    }

    buildContentInfo (): void {
        const contentType = this.destRes.headers[BUILTIN_HEADERS.contentType] as string || '';
        const accept      = this.req.headers[BUILTIN_HEADERS.accept] as string || '';
        const encoding    = (this.destRes.headers[BUILTIN_HEADERS.contentEncoding] as string || '').toLowerCase();

        const isTextPage = this.isPage && contentTypeUtils.isTextPage(contentType);

        if (this.isPage && contentType && !isTextPage)
            this.isPage = !this.isAjax && contentTypeUtils.isPage(contentType);

        const isCSS                   = contentTypeUtils.isCSSResource(contentType, accept);
        const isManifest              = contentTypeUtils.isManifest(contentType);
        const isScript                = this.dest.isScript || contentTypeUtils.isScriptResource(contentType, accept);
        const isForm                  = this.dest.isForm;
        const isObject                = this.dest.isObject;
        const isFormWithEmptyResponse = isForm && this.destRes.statusCode === 204;

        const isRedirect              = this.destRes.headers[BUILTIN_HEADERS.location] &&
                                        this.destRes.statusCode &&
                                        isRedirectStatusCode(this.destRes.statusCode) ||
                                        false;
        const requireAssetsProcessing = (isCSS || isScript || isManifest) && this.destRes.statusCode !== 204;
        const isNotModified           = this.req.method === 'GET' && this.destRes.statusCode === 304 &&
                                        !!(this.req.headers[BUILTIN_HEADERS.ifModifiedSince] ||
                                           this.req.headers[BUILTIN_HEADERS.ifNoneMatch]);
        const requireProcessing       = !this.isAjax && !isFormWithEmptyResponse && !isRedirect &&
                                        !isNotModified && (this.isPage || this.isIframe || requireAssetsProcessing);
        const isFileDownload          = this._isFileDownload() && !this.dest.isScript;
        const isIframeWithImageSrc    = this.isIframe && !this.isPage && /^\s*image\//.test(contentType);
        const isAttachment            = !this.isPage && !this.isAjax && !this.isWebSocket && !this.isIframe &&
                                        !isTextPage && !isManifest && !isScript && !isForm && !isObject;

        const charset                 = new Charset();

        const contentTypeUrlToken        = urlUtils.getResourceTypeString({
            isIframe: this.isIframe,
            isAjax:   this.isAjax,

            isForm, isScript,
        }) || '';

        // NOTE: We need charset information if we are going to process the resource.
        if (requireProcessing && !charset.fromContentType(contentType))
            charset.fromUrl(this.dest.charset);

        if (isFileDownload)
            this.session.handleFileDownload();

        if (isAttachment)
            this._handleAttachment();

        this.contentInfo = {
            charset,
            requireProcessing,
            isIframeWithImageSrc,
            isCSS,
            isScript,
            isManifest,
            isObject,
            encoding,
            contentTypeUrlToken,
            isFileDownload,
            isNotModified,
            isRedirect,
            isAttachment,
            isTextPage,
        };

        logger.proxy.onContentInfoBuilt(this);
    }

    private _handleAttachment (): void {
        let isOpenedInNewWindow = false;

        if (this.req.url) {
            const url1 = urlUtils.parseProxyUrl(this.req.url);
            const url2 = urlUtils.parseProxyUrl(this.req.headers[BUILTIN_HEADERS.referer] as string);

            isOpenedInNewWindow = url1?.windowId !== url2?.windowId;
        }

        this.session.handleAttachment({ isOpenedInNewWindow });
    }

    private async _getDestResBody (res: DestinationResponse): Promise<Buffer> {
        if (IncomingMessageLike.isIncomingMessageLike(res)) {
            const body = res.getBody();

            if (body)
                return body;
        }

        return fetchBody(this.destRes, this.destRes.headers[BUILTIN_HEADERS.contentLength] as string);
    }

    calculateIsDestResReadableEnded (): void {
        if (!this.contentInfo.isNotModified &&
            !this.contentInfo.isRedirect &&
            !IncomingMessageLike.isIncomingMessageLike(this.destRes)) {
            this.destRes.once('end', () => {
                this.isDestResReadableEnded = true;
            });
        }
        else
            this.isDestResReadableEnded = true;
    }

    getInjectableScripts (): string[] {
        const taskScript = this.isIframe ? SERVICE_ROUTES.iframeTask : SERVICE_ROUTES.task;
        const scripts    = this.session.injectable.scripts.concat(taskScript, this.injectableUserScripts);

        return this._resolveInjectableUrls(scripts);
    }

    getInjectableStyles (): string[] {
        return this._resolveInjectableUrls(this.session.injectable.styles);
    }

    redirect (url: string): void {
        if (this.isWebSocket)
            throw new Error(CANNOT_BE_USED_WITH_WEB_SOCKET_ERR_MSG);

        const res = this.res as ServerResponse;

        res.statusCode = 302;
        res.setHeader(BUILTIN_HEADERS.location, url);
        res.end();
    }

    saveNonProcessedDestResBody (value: Buffer): void {
        this.nonProcessedDestResBody = value;
    }

    closeWithError (statusCode: number, resBody: string | Buffer = ''): void {
        if ('setHeader' in this.res && !this.res.headersSent) {
            this.res.statusCode = statusCode;
            this.res.setHeader(BUILTIN_HEADERS.contentType, 'text/html');
            this.res.write(resBody);
        }

        this.res.end();

        this.goToNextStage = false;
    }

    toProxyUrl (url: string, isCrossDomain: boolean, resourceType: string, charset?: string, reqOrigin?: string, credentials?: urlUtils.Credentials): string {
        const proxyHostname = this.serverInfo.hostname;
        const proxyProtocol = this.serverInfo.protocol;
        const proxyPort     = isCrossDomain ? this.serverInfo.crossDomainPort.toString() : this.serverInfo.port.toString();
        const sessionId     = this.session.id;
        const windowId      = this.windowId;

        if (isCrossDomain)
            reqOrigin = this.dest.domain;

        return urlUtils.getProxyUrl(url, {
            proxyHostname,
            proxyProtocol,
            proxyPort,
            sessionId,
            resourceType,
            charset,
            windowId,
            reqOrigin,
            credentials,
        });
    }

    getProxyOrigin (isCrossDomain = false) {
        return urlUtils.getDomain({
            protocol: this.serverInfo.protocol,
            hostname: this.serverInfo.hostname,
            port:     isCrossDomain ? this.serverInfo.crossDomainPort : this.serverInfo.port,
        });
    }

    isPassSameOriginPolicy (): boolean {
        const shouldPerformCORSCheck = this.isAjax && !this.contentInfo.isNotModified;

        return !shouldPerformCORSCheck || checkSameOriginPolicy(this);
    }

    sendResponseHeaders (): void {
        if (this.isWebSocket)
            throw new Error(CANNOT_BE_USED_WITH_WEB_SOCKET_ERR_MSG);

        const headers = headerTransforms.forResponse(this);
        const res     = this.res as ServerResponse;

        if (this.isHTMLPage && this.session.options.disablePageCaching)
            headerTransforms.setupPreventCachingHeaders(headers);

        logger.proxy.onResponse(this, headers);

        res.writeHead(this.destRes.statusCode as number, headers);
        res.addTrailers(this.destRes.trailers as OutgoingHttpHeaders);
    }

    async mockResponse (eventProvider: RequestHookEventProvider): Promise<void> {
        logger.destination.onMockedRequest(this);

        this.destRes = await this.getMockResponse();

        this.buildContentInfo();

        if (!this.mock.hasError)
            return;

        await this.handleMockError(eventProvider);

        logger.proxy.onMockResponseError(this.requestFilterRules[0], this.mock.error as Error);
    }

    resolveInjectableUrl (url: string): string {
        return this.serverInfo.domain + url;
    }

    respondForSpecialPage (): void {
        this.destRes = createSpecialPageResponse();

        this.buildContentInfo();
    }

    async fetchDestResBody (): Promise<void> {
        this.destResBody = await this._getDestResBody(this.destRes);

        if (!this.temporaryCacheEntry)
            return;

        this._addTemporaryEntryToCache();
    }

    async pipeNonProcessedResponse (): Promise<void> {
        if (!this.serverInfo.cacheRequests) {
            this.destRes.pipe(this.res);

            return;
        }

        this.destResBody = await this._getDestResBody(this.destRes);

        if (this.temporaryCacheEntry && this.destResBody.length < requestCache.MAX_SIZE_FOR_NON_PROCESSED_RESOURCE)
            this._addTemporaryEntryToCache();

        this.res.write(this.destResBody);

        this.res.end();
    }

    createCacheEntry (res: DestinationResponse): void {
        if (requestCache.shouldCache(this) && !IncomingMessageLike.isIncomingMessageLike(res))
            this.temporaryCacheEntry = requestCache.create(this.reqOpts, res);
    }

    public async callOnResponseEventCallbackWithoutBodyForNonProcessedResource (ctx: RequestPipelineContext, onResponseEventDataWithoutBody: OnResponseEventData[]) {
        await Promise.all(onResponseEventDataWithoutBody.map(async eventData => {
            await ctx.onRequestHookResponse(ctx.session.requestHookEventProvider, ctx.eventFactory, eventData.rule, eventData.opts);
        }));

        ctx.destRes.pipe(ctx.res);
    }

    public async callOnResponseEventCallbackForMotModifiedResource (ctx: RequestPipelineContext) {
        await Promise.all(ctx.onResponseEventData.map(async eventData => {
            await ctx.onRequestHookResponse(ctx.session.requestHookEventProvider, ctx.eventFactory, eventData.rule, eventData.opts);
        }));

        ctx.res.end();
    }

    public async callOnResponseEventCallbackWithBodyForNonProcessedRequest (ctx: RequestPipelineContext, onResponseEventDataWithBody: OnResponseEventData[]) {
        const destResBodyCollectorStream = new PassThrough();

        ctx.destRes.pipe(destResBodyCollectorStream);

        promisifyStream(destResBodyCollectorStream).then(async data => {
            ctx.saveNonProcessedDestResBody(data);

            await Promise.all(onResponseEventDataWithBody.map(async eventData => {
                await ctx.onRequestHookResponse(ctx.session.requestHookEventProvider, ctx.eventFactory, eventData.rule, eventData.opts);
            }));

            toReadableStream(data).pipe(ctx.res);
        });
    }
}
