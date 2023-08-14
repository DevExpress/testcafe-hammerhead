import Proxy from '../proxy';

import {
    RequestTimeout,
    ServerInfo,
    ServiceMessage,
} from '../typings/proxy';

import RequestPipelineContext from '../request-pipeline/context';
import RequestFilterRule from '../request-pipeline/request-hooks/request-filter-rule';
import RequestHookEventProvider from '../request-pipeline/request-hooks/events/event-provider';
import {
    Credentials,
    ExternalProxySettings,
    ExternalProxySettingsRaw,
} from '../typings/session';
import { GetUploadedFilesServiceMessage, StoreUploadedFilesServiceMessage } from '../typings/upload';
import StateSnapshot from './state-snapshot';
import mustache from 'mustache';
import { readSync as read } from 'read-file-relative';
import { parse as parseUrl } from 'url';
import Cookies from './cookies';
import UploadStorage from '../upload/storage';
import COMMAND from './command';
import generateUniqueId from '../utils/generate-unique-id';
import SERVICE_ROUTES from '../proxy/service-routes';
import ConfigureResponseEventOptions from '../request-pipeline/request-hooks/events/configure-response-event-options';
import { formatSyncCookie } from '../utils/cookie';
import { SCRIPTS } from './injectables';
import { ConfigureResponseEventData } from '../request-pipeline/request-hooks/typings';
import { EventEmitter } from 'events';


const TASK_TEMPLATE = read('../client/task.js.mustache');

export interface UserScript {
    url: string;
    page: RequestFilterRule;
}

interface InjectableResources {
    scripts: string[];
    styles: string[];
    userScripts: UserScript[];
}

interface TaskScriptTemplateOpts {
    serverInfo: ServerInfo;
    isFirstPageLoad: boolean;
    referer: string | null;
    cookie: string | null;
    iframeTaskScriptTemplate: string | null;
    payloadScript: string;
    allowMultipleWindows: boolean;
    isRecordMode: boolean;
    windowId?: string;
}

interface TaskScriptOpts {
    serverInfo: ServerInfo;
    referer: string | null;
    cookieUrl: string;
    isIframe: boolean;
    withPayload: boolean;
    windowId?: string;
}

interface SessionOptions {
    disablePageCaching: boolean;
    allowMultipleWindows: boolean;
    windowId: string;
    requestTimeout?: RequestTimeout;
    referer?: string;
    nativeAutomation?: boolean;
}

export default abstract class Session extends EventEmitter {
    uploadStorage: UploadStorage;
    id: string = generateUniqueId();
    cookies: Cookies;
    proxy: Proxy | null = null;
    externalProxySettings: ExternalProxySettings | null = null;
    pageLoadCount = 0;
    pendingStateSnapshot: StateSnapshot | null = null;
    injectable: InjectableResources = { scripts: [], styles: [], userScripts: [] };
    private _recordMode = false;
    options: SessionOptions;
    private _disableHttp2 = false;
    private _disableCrossDomain = false;
    public requestHookEventProvider: RequestHookEventProvider;

    protected constructor (uploadRoots: string[], options: Partial<SessionOptions>) {
        super();

        this.uploadStorage            = new UploadStorage(uploadRoots);
        this.options                  = this._getOptions(options);
        this.cookies                  = this.createCookies();
        this.requestHookEventProvider = new RequestHookEventProvider();

        if (!this.options.nativeAutomation)
            this.injectable.scripts.push(...SCRIPTS);
    }

    private _getOptions (options: Partial<SessionOptions> = {}): SessionOptions {
        return Object.assign({
            disablePageCaching:   false,
            allowMultipleWindows: false,
            windowId:             '',
        }, options);
    }

    protected createCookies (): Cookies {
        return new Cookies();
    }

    // State
    getStateSnapshot (): StateSnapshot {
        return new StateSnapshot(this.cookies.serializeJar(), null);
    }

    useStateSnapshot (snapshot: StateSnapshot) {
        if (!snapshot)
            throw new Error('"snapshot" parameter cannot be null. Use StateSnapshot.empty() instead of it.');

        // NOTE: we don't perform state switch immediately, since there might be
        // pending requests from current page. Therefore, we perform switch in
        // onPageRequest handler when new page is requested.
        this.pendingStateSnapshot = snapshot;
    }

    async handleServiceMessage (msg: ServiceMessage, serverInfo: ServerInfo): Promise<object> {
        if (this[msg.cmd])
            return await this[msg.cmd](msg, serverInfo);

        throw new Error('Malformed service message or message handler is not implemented');
    }

    takePendingSyncCookies () {
        return this.cookies.takePendingSyncCookies().map(syncCookie => formatSyncCookie({
            ...syncCookie,
            sid:          this.id,
            isServerSync: true,
            domain:       syncCookie.domain || '',
            path:         syncCookie.path || '',
            lastAccessed: new Date(),
            syncKey:      '',
        }));
    }

    _fillTaskScriptTemplate ({ serverInfo, isFirstPageLoad, referer, cookie, iframeTaskScriptTemplate, payloadScript, allowMultipleWindows, isRecordMode, windowId }: TaskScriptTemplateOpts): string {
        referer                  = referer && JSON.stringify(referer) || '{{{referer}}}';
        cookie                   = cookie || '{{{cookie}}}';
        iframeTaskScriptTemplate = iframeTaskScriptTemplate || '{{{iframeTaskScriptTemplate}}}';

        if (this.proxy?.isNativeAutomation) {
            referer = '""';
            cookie  = '""';
        }

        const { domain, crossDomainPort } = serverInfo;

        return mustache.render(TASK_TEMPLATE, {
            sessionId:             this.id,
            serviceMsgUrl:         domain + SERVICE_ROUTES.messaging,
            transportWorkerUrl:    domain + SERVICE_ROUTES.transportWorker,
            forceProxySrcForImage: this.requestHookEventProvider.hasRequestEventListeners(),
            crossDomainPort,
            isFirstPageLoad,
            referer,
            cookie,
            iframeTaskScriptTemplate,
            payloadScript,
            allowMultipleWindows,
            isRecordMode,

            windowId:         windowId || '',
            nativeAutomation: this.proxy?.isNativeAutomation || false,

            disableCrossDomain: this.isCrossDomainDisabled() || false,
        });
    }

    async getIframeTaskScriptTemplate (serverInfo: ServerInfo): Promise<string> {
        const taskScriptTemplate = this._fillTaskScriptTemplate({
            serverInfo,
            isFirstPageLoad:          false,
            referer:                  null,
            cookie:                   null,
            iframeTaskScriptTemplate: null,
            payloadScript:            await this.getIframePayloadScript(true),
            allowMultipleWindows:     this.options.allowMultipleWindows,
            isRecordMode:             this._recordMode,
        });

        return JSON.stringify(taskScriptTemplate);
    }

    async getTaskScript ({ referer, cookieUrl, serverInfo, isIframe, withPayload, windowId }: TaskScriptOpts): Promise<string> {
        const cookies     = JSON.stringify(this.cookies.getClientString(cookieUrl));
        let payloadScript = '';

        if (withPayload)
            payloadScript = isIframe ? await this.getIframePayloadScript(false) : await this.getPayloadScript();

        const taskScript = this._fillTaskScriptTemplate({
            serverInfo,
            isFirstPageLoad:          this.pageLoadCount === 0,
            referer,
            cookie:                   cookies,
            iframeTaskScriptTemplate: await this.getIframeTaskScriptTemplate(serverInfo),
            payloadScript,
            allowMultipleWindows:     this.options.allowMultipleWindows,
            isRecordMode:             this._recordMode,
            windowId,
        });

        this.pageLoadCount++;

        return taskScript;
    }

    setExternalProxySettings (proxySettings: ExternalProxySettingsRaw | string | null) {
        if (typeof proxySettings === 'string')
            proxySettings = { url: proxySettings };

        if (!proxySettings || !proxySettings.url)
            return;

        const { url, bypassRules } = proxySettings;
        const parsedUrl            = parseUrl('http://' + url);
        let settings               = null as ExternalProxySettings | null;

        if (parsedUrl && parsedUrl.host) {
            settings = {
                host:     parsedUrl.host,
                hostname: parsedUrl.hostname || '',
            };

            if (bypassRules)
                settings.bypassRules = bypassRules;

            if (parsedUrl.port)
                settings.port = parsedUrl.port;

            if (parsedUrl.auth) {
                settings.proxyAuth  = parsedUrl.auth;
                settings.authHeader = 'Basic ' + Buffer.from(parsedUrl.auth).toString('base64');
            }
        }

        this.externalProxySettings = settings;
    }

    onPageRequest (ctx: RequestPipelineContext) {
        if (!this.pendingStateSnapshot)
            return;

        this.cookies.setJar(this.pendingStateSnapshot.cookies);

        if (this.pendingStateSnapshot.storages)
            ctx.restoringStorages     = this.pendingStateSnapshot.storages;

        this.pendingStateSnapshot = null;
    }

    // Request hooks
    private _ensureConfigureResponseEventData (eventId: string): ConfigureResponseEventData {
        let eventData = this.requestHookEventProvider.requestHookEventData.configureResponse.get(eventId);

        if (!eventData) {
            eventData = {
                opts:           ConfigureResponseEventOptions.DEFAULT,
                setHeaders:     [],
                removedHeaders: [],
            };
        }

        return eventData;
    }

    private _updateConfigureResponseEventData (eventId: string, updateFn: (eventData: ConfigureResponseEventData) => void): void {
        const eventData = this._ensureConfigureResponseEventData(eventId);

        updateFn(eventData);

        this.requestHookEventProvider.requestHookEventData.configureResponse.set(eventId, eventData);
    }

    public removeConfigureResponseEventData (eventId: string): void {
        this.requestHookEventProvider.requestHookEventData.configureResponse.delete(eventId);
    }

    public async setConfigureResponseEventOptions (eventId: string, opts: ConfigureResponseEventOptions): Promise<void> {
        this._updateConfigureResponseEventData(eventId, eventData => {
            eventData.opts = opts;
        });
    }

    public async setHeaderOnConfigureResponseEvent (eventId: string, headerName: string, headerValue: string): Promise<void> {
        this._updateConfigureResponseEventData(eventId, eventData => {
            eventData.setHeaders.push({ name: headerName, value: headerValue });
        });
    }

    public async removeHeaderOnConfigureResponseEvent (eventId: string, headerName: string): Promise<void> {
        this._updateConfigureResponseEventData(eventId, eventData => {
            eventData.removedHeaders.push(headerName);
        });
    }

    setRecordMode (): void {
        this._recordMode = true;
    }

    disableHttp2 () {
        this._disableHttp2 = true;
    }

    isHttp2Disabled () {
        return this._disableHttp2;
    }

    disableCrossDomain () {
        this._disableCrossDomain = true;
    }

    isCrossDomainDisabled () {
        return this._disableCrossDomain;
    }

    abstract getIframePayloadScript (iframeWithoutSrc: boolean): Promise<string>;
    abstract getPayloadScript (): Promise<string>;
    abstract handleFileDownload (): void;
    abstract handleAttachment ({ isOpenedInNewWindow }: { isOpenedInNewWindow: boolean }): void;
    abstract handlePageError (ctx: RequestPipelineContext, err: string): void;
    abstract getAuthCredentials (): Credentials;

    // Service message handlers
    async [COMMAND.uploadFiles] (msg: StoreUploadedFilesServiceMessage): Promise<object> {
        return await this.uploadStorage.store(msg.fileNames, msg.data);
    }

    async [COMMAND.getUploadedFiles] (msg: GetUploadedFilesServiceMessage): Promise<object> {
        return await this.uploadStorage.get(msg.filePaths);
    }
}
