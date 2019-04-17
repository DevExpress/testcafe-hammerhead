/*eslint-disable no-unused-vars*/
import net from 'net';
import http from 'http';
import Session from '../session';
import { StoragesSnapshot, FileStream } from '../typings/session';
import { ServerInfo } from '../typings/proxy';
import ResponseMock from './request-hooks/response-mock';
import { parseClientSyncCookieStr } from '../utils/cookie';
import { ParsedClientSyncCookie } from '../typings/cookie';
import RequestFilterRule from './request-hooks/request-filter-rule';
import IncomingMessageMock from './incoming-message-mock';
import ConfigureResponseEventOptions from '../session/events/configure-response-event-options';
import RequestOptions from './request-options';
import { ParsedProxyUrl } from '../typings/url';
/*eslint-enable no-unused-vars*/
import XHR_HEADERS from './xhr/headers';
import Charset from '../processing/encoding/charset';
import * as urlUtils from '../utils/url';
import * as contentTypeUtils from '../utils/content-type';
import genearateUniqueId from '../utils/generate-unique-id';
import { check as checkSameOriginPolicy } from './xhr/same-origin-policy';
import * as headerTransforms from './header-transforms';

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
    charset: string;
    reqOrigin: string;
    referer?: string;
    domain?: string;
    auth?: string;
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

interface OnResponseEventData {
    rule: RequestFilterRule;
    opts: ConfigureResponseEventOptions;
}

const REDIRECT_STATUS_CODES: Array<number>   = [301, 302, 303, 307, 308];
const CANNOT_BE_USED_WITH_WEB_SOCKET_ERR_MSG = 'The function cannot be used with a WebSocket request.';

export default class RequestPipelineContext {
    private readonly serverInfo: ServerInfo;
    readonly req: http.IncomingMessage;
    readonly res: http.ServerResponse | net.Socket;
    session: Session = null;
    reqBody: Buffer = null;
    dest: DestInfo = null;
    destRes: http.IncomingMessage | FileStream | IncomingMessageMock = null;
    destResBody: Buffer = null;
    hasDestReqErr: boolean = false;
    isXhr: boolean = false;
    isFetch: boolean = false;
    isPage: boolean = false;
    isHtmlImport: boolean = false;
    isWebSocket: boolean = false;
    isIframe: boolean = false;
    isSpecialPage: boolean = false;
    isWebSocketConnectionReset: boolean = false;
    contentInfo: ContentInfo = null;
    restoringStorages: StoragesSnapshot = null;
    requestId: string = genearateUniqueId();
    requestFilterRules: Array<RequestFilterRule> = [];
    onResponseEventData: Array<OnResponseEventData> = [];
    reqOpts: RequestOptions = null;
    parsedClientSyncCookie: ParsedClientSyncCookie;
    isFileProtocol: boolean;
    nonProcessedDestResBody: Buffer = null;
    goToNextStage: boolean = true;
    mock: ResponseMock;
    isSameOriginPolicyFailed: boolean = false;

    constructor (req: http.IncomingMessage, res: http.ServerResponse | net.Socket, serverInfo: ServerInfo) {
        this.serverInfo = serverInfo;
        this.req = req;
        this.res = res;

        const acceptHeader = req.headers['accept'];

        this.isXhr   = !!req.headers[XHR_HEADERS.requestMarker];
        this.isFetch = !!req.headers[XHR_HEADERS.fetchRequestCredentials];
        this.isPage  = !this.isXhr && !this.isFetch && acceptHeader && contentTypeUtils.isPage(acceptHeader);

        this.parsedClientSyncCookie = req.headers.cookie && parseClientSyncCookieStr(req.headers.cookie);
    }

    // TODO: Rewrite parseProxyUrl instead.
    private static _flattenParsedProxyUrl (parsed: ParsedProxyUrl): { dest: DestInfo, sessionId: string } {
        if (!parsed)
            return null;

        const parsedResourceType = urlUtils.parseResourceType(parsed.resourceType);
        const dest               = {
            url:           parsed.destUrl,
            protocol:      parsed.destResourceInfo.protocol,
            host:          parsed.destResourceInfo.host,
            hostname:      parsed.destResourceInfo.hostname,
            port:          parsed.destResourceInfo.port,
            partAfterHost: parsed.destResourceInfo.partAfterHost,
            auth:          parsed.destResourceInfo.auth,
            isIframe:      parsedResourceType.isIframe,
            isForm:        parsedResourceType.isForm,
            isScript:      parsedResourceType.isScript,
            isEventSource: parsedResourceType.isEventSource,
            isHtmlImport:  parsedResourceType.isHtmlImport,
            isWebSocket:   parsedResourceType.isWebSocket,
            charset:       parsed.charset,
            reqOrigin:     parsed.reqOrigin
        };

        return { dest, sessionId: parsed.sessionId };
    }

    private _getDestFromReferer (parsedReferer: { dest: DestInfo, sessionId: string }): { dest: DestInfo, sessionId: string } {
        const dest = parsedReferer.dest;

        dest.partAfterHost = this.req.url;
        dest.url           = urlUtils.formatUrl(dest);

        return { dest, sessionId: parsedReferer.sessionId };
    }

    private _isFileDownload (): boolean {
        const contentDisposition = this.destRes.headers['content-disposition'];

        return contentDisposition &&
               contentDisposition.includes('attachment') &&
               contentDisposition.includes('filename');
    }

    private _resolveInjectableUrls (injectableUrls: Array<string>): Array<string> {
        return injectableUrls.map(url => this.serverInfo.domain + url);
    }

    private _initRequestNatureInfo () {
        const acceptHeader = this.req.headers['accept'];

        this.isWebSocket    = this.dest.isWebSocket;
        this.isHtmlImport   = this.dest.isHtmlImport;
        this.isPage         = !this.isXhr && !this.isFetch && !this.isWebSocket && acceptHeader &&
                              contentTypeUtils.isPage(acceptHeader) || this.isHtmlImport;
        this.isIframe       = this.dest.isIframe;
        this.isSpecialPage  = urlUtils.isSpecialPage(this.dest.url);
        this.isFileProtocol = this.dest.protocol === 'file:';
    }

    // API
    dispatch (openSessions: Map<string, Session>): boolean {
        const parsedReqUrl  = urlUtils.parseProxyUrl(this.req.url);
        const referer       = this.req.headers['referer'];
        const parsedReferer = referer && urlUtils.parseProxyUrl(referer);

        // TODO: Remove it after parseProxyURL is rewritten.
        let flattenParsedReqUrl    = RequestPipelineContext._flattenParsedProxyUrl(parsedReqUrl);
        const flattenParsedReferer = RequestPipelineContext._flattenParsedProxyUrl(parsedReferer);

        // NOTE: Try to extract the destination from the 'referer' header.
        if (!flattenParsedReqUrl && flattenParsedReferer)
            flattenParsedReqUrl = this._getDestFromReferer(flattenParsedReferer);

        if (!flattenParsedReqUrl)
            return false;

        this.session = openSessions.get(flattenParsedReqUrl.sessionId);

        if (!this.session)
            return false;

        this.dest = flattenParsedReqUrl.dest;

        // Browsers add a leading slash to the pathname part of url (GH-608)
        // For example: url http://www.example.com?gd=GID12082014 will be converted
        // to http://www.example.com/?gd=GID12082014
        this.dest.partAfterHost = (this.dest.partAfterHost[0] === '/' ? '' : '/') + this.dest.partAfterHost;

        this.dest.domain = urlUtils.getDomain(this.dest);

        if (flattenParsedReferer) {
            this.dest.referer   = flattenParsedReferer.dest.url;
            this.dest.reqOrigin = flattenParsedReferer.dest.protocol === 'file:'
                ? flattenParsedReferer.dest.url
                : urlUtils.getDomain(flattenParsedReferer.dest);
        }
        else if (this.req.headers[XHR_HEADERS.origin])
            this.dest.reqOrigin = <string> this.req.headers[XHR_HEADERS.origin];

        this._initRequestNatureInfo();

        if (this.parsedClientSyncCookie) {
            const clientCookie = this.parsedClientSyncCookie.actual.filter(
                syncCookie => syncCookie.isClientSync && syncCookie.sid === this.session.id);

            this.session.cookies.setByClient(clientCookie);
        }

        return true;
    }

    buildContentInfo () {
        const contentType = this.destRes.headers['content-type'] || '';
        const accept      = this.req.headers['accept'] || '';
        const encoding    = this.destRes.headers['content-encoding'];

        if (this.isPage && contentType)
            this.isPage = !this.isXhr && !this.isFetch && contentTypeUtils.isPage(contentType);

        const isCSS                   = contentTypeUtils.isCSSResource(contentType, accept);
        const isManifest              = contentTypeUtils.isManifest(contentType);
        const isScript                = this.dest.isScript || contentTypeUtils.isScriptResource(contentType, accept);
        const isForm                  = this.dest.isForm;
        const isFormWithEmptyResponse = isForm && this.destRes.statusCode === 204;

        const isRedirect              = this.destRes.headers['location'] &&
                                        REDIRECT_STATUS_CODES.includes(this.destRes.statusCode);
        const requireAssetsProcessing = (isCSS || isScript || isManifest) && this.destRes.statusCode !== 204;
        const isNotModified           = this.req.method === 'GET' && this.destRes.statusCode === 304 &&
                                        !!(this.req.headers['if-modified-since'] || this.req.headers['if-none-match']);
        const requireProcessing       = !this.isXhr && !this.isFetch && !isFormWithEmptyResponse && !isRedirect &&
                                        !isNotModified && (this.isPage || this.isIframe || requireAssetsProcessing);
        const isFileDownload          = this._isFileDownload() && !this.dest.isScript;
        const isIframeWithImageSrc    = this.isIframe && !this.isPage && /^\s*image\//.test(contentType);

        let charset               = null;
        const contentTypeUrlToken = urlUtils.getResourceTypeString({
            isIframe: this.isIframe,
            isForm:   isForm,
            isScript: isScript
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
    }

    getInjectableScripts (): Array<string> {
        const taskScript = this.isIframe ? '/iframe-task.js' : '/task.js';
        const scripts    = this.session.injectable.scripts.concat(taskScript);

        return this._resolveInjectableUrls(scripts);
    }

    getInjectableStyles (): Array<string> {
        return this._resolveInjectableUrls(this.session.injectable.styles);
    }

    redirect (url: string) {
        if (this.isWebSocket)
            throw new Error(CANNOT_BE_USED_WITH_WEB_SOCKET_ERR_MSG);

        const res: http.ServerResponse = <http.ServerResponse> this.res;

        res.statusCode = 302;
        res.setHeader('location', url);
        res.end();
    }

    saveNonProcessedDestResBody (value: Buffer) {
        this.nonProcessedDestResBody = value;
    }

    closeWithError (statusCode: number, resBody: String | Buffer = '') {
        if ('setHeader' in this.res && !this.res.headersSent) {
            this.res.statusCode = statusCode;
            this.res.setHeader('content-type', 'text/html');
            this.res.write(resBody);
        }

        this.res.end();

        this.goToNextStage = false;
    }

    toProxyUrl (url: string, isCrossDomain: boolean, resourceType: string, charset?: string): string {
        const proxyHostname = this.serverInfo.hostname;
        const proxyProtocol = this.serverInfo.protocol;
        const proxyPort     = isCrossDomain ? this.serverInfo.crossDomainPort : this.serverInfo.port;
        const sessionId     = this.session.id;

        return urlUtils.getProxyUrl(url, {
            proxyHostname,
            proxyProtocol,
            proxyPort,
            sessionId,
            resourceType,
            charset
        });
    }

    isPassSameOriginPolicy (): boolean {
        const isAjaxRequest          = this.isXhr || this.isFetch;
        const shouldPerformCORSCheck = isAjaxRequest && !this.contentInfo.isNotModified;

        return !shouldPerformCORSCheck || checkSameOriginPolicy(this);
    }

    async forEachRequestFilterRule (fn: (rule: RequestFilterRule) => Promise<void>): Promise<void> {
        await Promise.all(this.requestFilterRules.map(fn));
    }

    sendResponseHeaders () {
        if (this.isWebSocket)
            throw new Error(CANNOT_BE_USED_WITH_WEB_SOCKET_ERR_MSG);

        const headers                  = headerTransforms.forResponse(this);
        const res: http.ServerResponse = <http.ServerResponse> this.res;

        res.writeHead(this.destRes.statusCode, headers);
        res.addTrailers(this.destRes.trailers);
    }

    mockResponse () {
        this.mock.setRequestOptions(this.reqOpts);
        this.destRes = this.mock.getResponse();
    }

    setupMockIfNecessary (rule: RequestFilterRule) {
        const mock = this.session.getMock(rule);

        if (mock && !this.mock)
            this.mock = mock;
    }

    isDestResBodyMalformed (): boolean {
        return !this.destResBody || this.destResBody.length.toString() !== this.destRes.headers['content-length'];
    }

    getOnResponseEventData ({ includeBody }: { includeBody: boolean }): Array<OnResponseEventData> {
        return this.onResponseEventData.filter(eventData => eventData.opts.includeBody === includeBody);
    }
}
