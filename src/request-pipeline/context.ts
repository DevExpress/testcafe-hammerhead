import net from 'net';
import http from 'http';
import Session from '../session';
import { StoragesSnapshot, FileStream } from '../typings/session';
import { ServerInfo } from '../typings/proxy';
import ResponseMock from './request-hooks/response-mock';
import { parseClientSyncCookieStr } from '../utils/cookie';
import { ParsedClientSyncCookie } from '../typings/cookie';
import RequestFilterRule from './request-hooks/request-filter-rule';
import IncomingMessageLike from './incoming-message-like';
import RequestOptions from './request-options';
import { ParsedProxyUrl } from '../typings/url';
import { OnResponseEventData, RequestCacheEntry } from '../typings/context';
import Charset from '../processing/encoding/charset';
import * as urlUtils from '../utils/url';
import * as contentTypeUtils from '../utils/content-type';
import generateUniqueId from '../utils/generate-unique-id';
import { check as checkSameOriginPolicy } from './same-origin-policy';
import * as headerTransforms from './header-transforms';
import { RequestInfo } from '../session/events/info';
import SERVICE_ROUTES from '../proxy/service-routes';
import BUILTIN_HEADERS from './builtin-header-names';
import logger from '../utils/logger';
import { Credentials } from '../utils/url';
import createSpecialPageResponse from './create-special-page-response';
import { fetchBody } from '../utils/http';
import * as requestCache from './cache';

interface DestInfo {
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
}

interface FlattenParsedProxyUrl {
    dest: DestInfo;
    sessionId: string;
    windowId?: string;
}

const REDIRECT_STATUS_CODES                  = [301, 302, 303, 307, 308];
const CANNOT_BE_USED_WITH_WEB_SOCKET_ERR_MSG = 'The function cannot be used with a WebSocket request.';

export default class RequestPipelineContext {
    session: Session = null;
    reqBody: Buffer = null;
    dest: DestInfo = null;
    destRes: http.IncomingMessage | FileStream | IncomingMessageLike = null;
    isDestResReadableEnded = false;
    destResBody: Buffer = null;
    isAjax = false;
    isPage = false;
    isHTMLPage = false;
    isHtmlImport = false;
    isWebSocket = false;
    isIframe = false;
    isSpecialPage = false;
    isWebSocketConnectionReset = false;
    contentInfo: ContentInfo = null;
    restoringStorages: StoragesSnapshot = null;
    requestId: string = generateUniqueId();
    requestFilterRules: RequestFilterRule[] = [];
    onResponseEventData: OnResponseEventData[] = [];
    reqOpts: RequestOptions = null;
    parsedClientSyncCookie: ParsedClientSyncCookie;
    isFileProtocol: boolean;
    nonProcessedDestResBody: Buffer = null;
    goToNextStage = true;
    mock: ResponseMock;
    isSameOriginPolicyFailed = false;
    windowId?: string;
    temporaryCacheEntry?: RequestCacheEntry;

    constructor (readonly req: http.IncomingMessage,
        readonly res: http.ServerResponse | net.Socket,
        readonly serverInfo: ServerInfo) {
        this.parsedClientSyncCookie = req.headers.cookie && parseClientSyncCookieStr(req.headers.cookie);
    }

    // TODO: Rewrite parseProxyUrl instead.
    private static _flattenParsedProxyUrl (parsed: ParsedProxyUrl): FlattenParsedProxyUrl {
        if (!parsed)
            return null;

        const parsedResourceType = urlUtils.parseResourceType(parsed.resourceType);
        const dest               = {
            url:             parsed.destUrl,
            protocol:        parsed.destResourceInfo.protocol,
            host:            parsed.destResourceInfo.host,
            hostname:        parsed.destResourceInfo.hostname,
            port:            parsed.destResourceInfo.port,
            partAfterHost:   parsed.destResourceInfo.partAfterHost,
            auth:            parsed.destResourceInfo.auth,
            isIframe:        !!parsedResourceType.isIframe,
            isForm:          !!parsedResourceType.isForm,
            isScript:        !!(parsedResourceType.isScript || parsedResourceType.isServiceWorker),
            isEventSource:   !!parsedResourceType.isEventSource,
            isHtmlImport:    !!parsedResourceType.isHtmlImport,
            isWebSocket:     !!parsedResourceType.isWebSocket,
            isServiceWorker: !!parsedResourceType.isServiceWorker,
            isAjax:          !!parsedResourceType.isAjax,
            charset:         parsed.charset,
            reqOrigin:       parsed.reqOrigin,
            credentials:     parsed.credentials
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

        dest.partAfterHost = this.req.url;
        dest.url           = urlUtils.formatUrl(dest);

        return { dest, sessionId: parsedReferer.sessionId, windowId: parsedReferer.windowId };
    }

    // API
    dispatch (openSessions: Map<string, Session>): boolean {
        const parsedReqUrl  = urlUtils.parseProxyUrl(this.req.url);
        const referer       = this.req.headers[BUILTIN_HEADERS.referer] as string;
        const parsedReferer = referer && urlUtils.parseProxyUrl(referer);

        // TODO: Remove it after parseProxyURL is rewritten.
        let flattenParsedReqUrl    = RequestPipelineContext._flattenParsedProxyUrl(parsedReqUrl);
        const flattenParsedReferer = RequestPipelineContext._flattenParsedProxyUrl(parsedReferer);

        // NOTE: Remove that after implementing the https://github.com/DevExpress/testcafe-hammerhead/issues/2155
        if (!flattenParsedReqUrl && flattenParsedReferer)
            flattenParsedReqUrl = this._getDestFromReferer(flattenParsedReferer);

        if (!flattenParsedReqUrl)
            return false;

        this.session = openSessions.get(flattenParsedReqUrl.sessionId);

        if (!this.session)
            return false;

        this.dest               = flattenParsedReqUrl.dest;
        this.windowId           = flattenParsedReqUrl.windowId;
        this.dest.partAfterHost = this._preparePartAfterHost(this.dest.partAfterHost);
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

    private _preparePartAfterHost (str: string): string {
        // Browsers add a leading slash to the pathname part of url (GH-608)
        // For example: url http://www.example.com?gd=GID12082014 will be converted
        // to http://www.example.com/?gd=GID12082014
        return (str[0] === '/' ? '' : '/') + str;
    }

    buildContentInfo () {
        const contentType = this.destRes.headers[BUILTIN_HEADERS.contentType] as string || '';
        const accept      = this.req.headers[BUILTIN_HEADERS.accept] as string || '';
        const encoding    = (this.destRes.headers[BUILTIN_HEADERS.contentEncoding] as string || '').toLowerCase();

        if (this.isPage && contentType)
            this.isPage = !this.isAjax && contentTypeUtils.isPage(contentType);

        const isCSS                   = contentTypeUtils.isCSSResource(contentType, accept);
        const isManifest              = contentTypeUtils.isManifest(contentType);
        const isScript                = this.dest.isScript || contentTypeUtils.isScriptResource(contentType, accept);
        const isForm                  = this.dest.isForm;
        const isFormWithEmptyResponse = isForm && this.destRes.statusCode === 204;

        const isRedirect              = this.destRes.headers[BUILTIN_HEADERS.location] &&
                                        REDIRECT_STATUS_CODES.includes(this.destRes.statusCode);
        const requireAssetsProcessing = (isCSS || isScript || isManifest) && this.destRes.statusCode !== 204;
        const isNotModified           = this.req.method === 'GET' && this.destRes.statusCode === 304 &&
                                        !!(this.req.headers[BUILTIN_HEADERS.ifModifiedSince] ||
                                           this.req.headers[BUILTIN_HEADERS.ifNoneMatch]);
        const requireProcessing       = !this.isAjax && !isFormWithEmptyResponse && !isRedirect &&
                                        !isNotModified && (this.isPage || this.isIframe || requireAssetsProcessing);
        const isFileDownload          = this._isFileDownload() && !this.dest.isScript;
        const isIframeWithImageSrc    = this.isIframe && !this.isPage && /^\s*image\//.test(contentType);

        let charset               = null;
        const contentTypeUrlToken = urlUtils.getResourceTypeString({
            isIframe: this.isIframe,
            isAjax:   this.isAjax,

            isForm, isScript
        });

        // NOTE: We need charset information if we are going to process the resource.
        if (requireProcessing) {
            charset = new Charset();

            if (!charset.fromContentType(contentType))
                charset.fromUrl(this.dest.charset);
        }

        if (isFileDownload)
            this.session.handleFileDownload();

        this.contentInfo = {
            charset,
            requireProcessing,
            isIframeWithImageSrc,
            isCSS,
            isScript,
            isManifest,
            encoding,
            contentTypeUrlToken,
            isFileDownload,
            isNotModified,
            isRedirect
        };

        logger.proxy.onContentInfoBuilt(this);
    }

    private _getInjectableUserScripts () {
        const requestInfo = new RequestInfo(this);

        return this.session.injectable.userScripts
            .filter(userScript => userScript.page.match(requestInfo))
            .map(userScript => userScript.url);
    }

    private async _getDestResBody (res: IncomingMessageLike | http.IncomingMessage | FileStream): Promise<Buffer> {
        if (IncomingMessageLike.isIncomingMessageLike(res))
            return (res as IncomingMessageLike).getBody();

        return fetchBody(this.destRes);
    }

    calculateIsDestResReadableEnded () {
        if (!this.contentInfo.isNotModified && !this.contentInfo.isRedirect) {
            this.destRes.once('end', () => {
                this.isDestResReadableEnded = true;
            });
        }
        else
            this.isDestResReadableEnded = true;
    }

    getInjectableScripts (): string[] {
        const taskScript = this.isIframe ? SERVICE_ROUTES.iframeTask : SERVICE_ROUTES.task;
        const scripts    = this.session.injectable.scripts.concat(taskScript, this._getInjectableUserScripts());

        return this._resolveInjectableUrls(scripts);
    }

    getInjectableStyles (): string[] {
        return this._resolveInjectableUrls(this.session.injectable.styles);
    }

    redirect (url: string): void {
        if (this.isWebSocket)
            throw new Error(CANNOT_BE_USED_WITH_WEB_SOCKET_ERR_MSG);

        const res: http.ServerResponse = this.res as http.ServerResponse;

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

    toProxyUrl (url: string, isCrossDomain: boolean, resourceType: string, charset?: string, reqOrigin?: string, credentials?: Credentials): string {
        const proxyHostname = this.serverInfo.hostname;
        const proxyProtocol = this.serverInfo.protocol;
        const proxyPort     = isCrossDomain ? this.serverInfo.crossDomainPort.toString() : this.serverInfo.port.toString();
        const sessionId     = this.session.id;
        const windowId      = this.windowId;

        return urlUtils.getProxyUrl(url, {
            proxyHostname,
            proxyProtocol,
            proxyPort,
            sessionId,
            resourceType,
            charset,
            windowId,
            reqOrigin,
            credentials
        });
    }

    getProxyOrigin(isCrossDomain = false) {
        return urlUtils.getDomain({
            protocol: this.serverInfo.protocol,
            hostname: this.serverInfo.hostname,
            port:     isCrossDomain ? this.serverInfo.crossDomainPort : this.serverInfo.port
        });
    }

    isPassSameOriginPolicy (): boolean {
        const shouldPerformCORSCheck = this.isAjax && !this.contentInfo.isNotModified;

        return !shouldPerformCORSCheck || checkSameOriginPolicy(this);
    }

    async forEachRequestFilterRule (fn: (rule: RequestFilterRule) => Promise<void>): Promise<void> {
        await Promise.all(this.requestFilterRules.map(fn));
    }

    sendResponseHeaders (): void {
        if (this.isWebSocket)
            throw new Error(CANNOT_BE_USED_WITH_WEB_SOCKET_ERR_MSG);

        const headers = headerTransforms.forResponse(this);
        const res     = this.res as http.ServerResponse;

        if (this.isHTMLPage && this.session.options.disablePageCaching)
            headerTransforms.setupPreventCachingHeaders(headers);

        logger.proxy.onResponse(this, headers);

        res.writeHead(this.destRes.statusCode as number, headers);
        res.addTrailers(this.destRes.trailers as http.OutgoingHttpHeaders);
    }

    async mockResponse (): Promise<void> {
        logger.destination.onMockedRequest(this);

        this.mock.setRequestOptions(this.reqOpts);

        this.destRes = await this.mock.getResponse();

        this.buildContentInfo();
    }

    setupMockIfNecessary (rule: RequestFilterRule): void {
        const mock = this.session.getMock(rule);

        if (mock && !this.mock)
            this.mock = mock;
    }

    getOnResponseEventData ({ includeBody }: { includeBody: boolean }): OnResponseEventData[] {
        return this.onResponseEventData.filter(eventData => eventData.opts.includeBody === includeBody);
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

        this.temporaryCacheEntry.value.res.setBody(this.destResBody);

        requestCache.add(this.temporaryCacheEntry);
    }

    createCacheEntry (res: http.IncomingMessage | IncomingMessageLike | FileStream): void {
        if (requestCache.shouldCache(this) && !IncomingMessageLike.isIncomingMessageLike(res))
            this.temporaryCacheEntry = requestCache.create(this.reqOpts, res);
    }
}
