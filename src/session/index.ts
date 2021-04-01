import Proxy from '../proxy';
import { RequestTimeout, ServerInfo, ServiceMessage } from '../typings/proxy';
import RequestPipelineContext from '../request-pipeline/context';
import RequestFilterRule from '../request-pipeline/request-hooks/request-filter-rule';
import ResponseMock from '../request-pipeline/request-hooks/response-mock';
import RequestEventNames from '../session/events/names';
import { RequestInfo } from './events/info';
import RequestEvent from './events/request-event';
import ResponseEvent from './events/response-event';
import ConfigureResponseEvent from './events/configure-response-event';
import {
    Credentials,
    ExternalProxySettings,
    ExternalProxySettingsRaw,
    RequestEventListenerError
} from '../typings/session';
import { GetUploadedFilesServiceMessage, StoreUploadedFilesServiceMessage } from '../typings/upload';
import StateSnapshot from './state-snapshot';
import mustache from 'mustache';
import { readSync as read } from 'read-file-relative';
import { EventEmitter } from 'events';
import { parse as parseUrl } from 'url';
import Cookies from './cookies';
import UploadStorage from '../upload/storage';
import COMMAND from './command';
import generateUniqueId from '../utils/generate-unique-id';
import SERVICE_ROUTES from '../proxy/service-routes';
import DEFAULT_REQUEST_TIMEOUT from '../request-pipeline/destination-request/default-request-timeout';
import { stringify as stringifyJSON } from '../utils/json';
import requestIsMatchRule from '../request-pipeline/request-hooks/request-is-match-rule';

const TASK_TEMPLATE: string = read('../client/task.js.mustache');

interface UserScript {
    url: string;
    page: RequestFilterRule;
}

interface InjectableResources {
    scripts: string[];
    styles: string[];
    userScripts: UserScript[];
}

interface RequestEventListeners {
    [RequestEventNames.onRequest]: Function;
    [RequestEventNames.onConfigureResponse]: Function;
    [RequestEventNames.onResponse]: Function;
}

interface RequestEventListenersData {
    listeners: RequestEventListeners;
    errorHandler: (event: RequestEventListenerError) => void;
    rule: RequestFilterRule;
}

interface TaskScriptTemplateOpts {
    serverInfo: ServerInfo;
    isFirstPageLoad: boolean;
    referer: string | null;
    cookie: string | null;
    iframeTaskScriptTemplate: string;
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
    requestTimeout: RequestTimeout;
}

export default abstract class Session extends EventEmitter {
    uploadStorage: UploadStorage;
    id: string = generateUniqueId();
    cookies: Cookies = new Cookies();
    proxy: Proxy | null = null;
    externalProxySettings: ExternalProxySettings | null = null;
    pageLoadCount = 0;
    pendingStateSnapshot: StateSnapshot | null = null;
    injectable: InjectableResources = { scripts: ['/hammerhead.js'], styles: [], userScripts: [] };
    requestEventListeners: Map<string, RequestEventListenersData> = new Map();
    mocks: Map<string, ResponseMock> = new Map();
    private _recordMode = false;
    options: SessionOptions;

    protected constructor (uploadRoots: string[], options: Partial<SessionOptions>) {
        super();

        this.uploadStorage = new UploadStorage(uploadRoots);
        this.options       = this._getOptions(options);
    }

    private _getOptions (options: Partial<SessionOptions> = {}): SessionOptions {
        const requestTimeout = {
            page: options.requestTimeout && options.requestTimeout.page || DEFAULT_REQUEST_TIMEOUT.page,
            ajax: options.requestTimeout && options.requestTimeout.ajax || DEFAULT_REQUEST_TIMEOUT.ajax,
        };

        delete options.requestTimeout;

        return Object.assign({
            disablePageCaching:   false,
            allowMultipleWindows: false,
            windowId:             '',
            requestTimeout
        }, options);
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

    _fillTaskScriptTemplate ({ serverInfo, isFirstPageLoad, referer, cookie, iframeTaskScriptTemplate, payloadScript, allowMultipleWindows, isRecordMode, windowId }: TaskScriptTemplateOpts): string {
        referer                  = referer && stringifyJSON(referer) || '{{{referer}}}';
        cookie                   = cookie || '{{{cookie}}}';
        iframeTaskScriptTemplate = iframeTaskScriptTemplate || '{{{iframeTaskScriptTemplate}}}';

        const { domain, crossDomainPort } = serverInfo;

        return mustache.render(TASK_TEMPLATE, {
            sessionId:             this.id,
            serviceMsgUrl:         domain + SERVICE_ROUTES.messaging,
            transportWorkerUrl:    domain + SERVICE_ROUTES.transportWorker,
            forceProxySrcForImage: this.hasRequestEventListeners(),
            crossDomainPort,
            isFirstPageLoad,
            referer,
            cookie,
            iframeTaskScriptTemplate,
            payloadScript,
            allowMultipleWindows,
            isRecordMode,
            windowId: windowId || ''
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
            isRecordMode:             this._recordMode
        });

        return stringifyJSON(taskScriptTemplate);
    }

    async getTaskScript ({ referer, cookieUrl, serverInfo, isIframe, withPayload, windowId }: TaskScriptOpts): Promise<string> {
        const cookies     = stringifyJSON(this.cookies.getClientString(cookieUrl));
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
            windowId
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
        let settings               = null;

        if (parsedUrl && parsedUrl.host) {
            settings = {
                host:     parsedUrl.host,
                hostname: parsedUrl.hostname
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

        ctx.restoringStorages     = this.pendingStateSnapshot.storages;
        this.pendingStateSnapshot = null;
    }

    // Request hooks
    hasRequestEventListeners (): boolean {
        return !!this.requestEventListeners.size;
    }

    addRequestEventListeners (rule: RequestFilterRule, listeners: RequestEventListeners, errorHandler: (event: RequestEventListenerError) => void): void {
        const listenersData = {
            listeners,
            errorHandler,
            rule
        };

        this.requestEventListeners.set(rule.id, listenersData);
    }

    removeRequestEventListeners (rule: RequestFilterRule): void {
        this.requestEventListeners.delete(rule.id);
    }

    clearRequestEventListeners (): void {
        this.requestEventListeners.clear();
    }

    async getRequestFilterRules (requestInfo: RequestInfo): Promise<RequestFilterRule[]> {
        const rulesArray = Array.from(this.requestEventListeners.values())
            .map(listenerData => listenerData.rule);

        const matchedRules = await Promise.all(rulesArray.map(async rule => {
            if (await requestIsMatchRule(rule, requestInfo))
                return rule;

            return void 0;
        }));

        return matchedRules.filter(rule => !!rule);
    }

    async callRequestEventCallback (eventName: RequestEventNames, requestFilterRule: RequestFilterRule, eventData: RequestEvent | ResponseEvent | ConfigureResponseEvent) {
        const requestEventListenersData = this.requestEventListeners.get(requestFilterRule.id);

        if (!requestEventListenersData)
            return;

        const { listeners, errorHandler } = requestEventListenersData;
        const targetRequestEventCallback  = listeners[eventName];

        if (typeof targetRequestEventCallback !== 'function')
            return;

        try {
            await targetRequestEventCallback(eventData);
        }
        catch (e) {
            if (typeof errorHandler !== 'function')
                return;

            const event = {
                error:      e,
                methodName: eventName
            };

            errorHandler(event);
        }
    }

    async setMock (requestFilterRule: RequestFilterRule, mock: ResponseMock): Promise<void> {
        this.mocks.set(requestFilterRule.id, mock);
    }

    getMock (requestFilterRule: RequestFilterRule): ResponseMock | undefined {
        return this.mocks.get(requestFilterRule.id);
    }

    setRecordMode(): void {
        this._recordMode = true;
    }

    abstract async getIframePayloadScript (iframeWithoutSrc: boolean): Promise<string>;
    abstract async getPayloadScript (): Promise<string>;
    abstract handleFileDownload (): void;
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
