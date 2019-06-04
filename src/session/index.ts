/*eslint-disable no-unused-vars*/
import Proxy from '../proxy';
import { ServerInfo, ServiceMessage } from '../typings/proxy';
import RequestPipelineContext from '../request-pipeline/context';
import RequestFilterRule from '../request-pipeline/request-hooks/request-filter-rule';
import ResponseMock from '../request-pipeline/request-hooks/response-mock';
import RequestEventNames from '../session/events/names';
import { RequestInfo } from './events/info';
import RequestEvent from './events/request-event';
import ResponseEvent from './events/response-event';
import ConfigureResponseEvent from './events/configure-response-event';
import { Credentials, ExternalProxySettings, ExternalProxySettingsRaw } from '../typings/session';
import { GetUploadedFilesServiceMessage, StoreUploadedFilesServiceMessage } from '../typings/upload';
import StateSnapshot from './state-snapshot';
/*eslint-enable no-unused-vars*/
import mustache from 'mustache';
import { readSync as read } from 'read-file-relative';
import { EventEmitter } from 'events';
import { parse as parseUrl } from 'url';
import Cookies from './cookies';
import UploadStorage from '../upload/storage';
import COMMAND from './command';
import generateUniqueId from '../utils/generate-unique-id';

const TASK_TEMPLATE: string = read('../client/task.js.mustache');

interface InjectableResources {
    scripts: Array<string>,
    styles: Array<string>
}

interface RequestEventListeners {
    [RequestEventNames.onRequest]: Function,
    [RequestEventNames.onConfigureResponse]: Function,
    [RequestEventNames.onResponse]: Function
}

interface RequestEventListenersData {
    listeners: RequestEventListeners,
    errorHandler: Function
}

interface TaskScriptTemplateOpts {
    serverInfo: ServerInfo,
    isFirstPageLoad: boolean,
    referer: string | null,
    cookie: string | null,
    iframeTaskScriptTemplate: string,
    payloadScript: string
}

interface TaskScriptOpts {
    serverInfo: ServerInfo,
    referer: string | null,
    cookieUrl: string,
    isIframe: boolean,
    withPayload: boolean
}

export default abstract class Session extends EventEmitter {
    uploadStorage: UploadStorage;
    id: string = generateUniqueId();
    cookies: Cookies = new Cookies();
    proxy: Proxy = null;
    externalProxySettings: ExternalProxySettings | null = null;
    pageLoadCount: number = 0;
    pendingStateSnapshot: StateSnapshot = null;
    injectable: InjectableResources = { scripts: ['/hammerhead.js'], styles: [] };
    requestEventListeners: Map<RequestFilterRule, RequestEventListenersData> = new Map();
    mocks: Map<RequestFilterRule, ResponseMock> = new Map();

    protected constructor (uploadsRoot: string) {
        super();

        this.uploadStorage = new UploadStorage(uploadsRoot);
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

    _fillTaskScriptTemplate ({ serverInfo, isFirstPageLoad, referer, cookie, iframeTaskScriptTemplate, payloadScript }: TaskScriptTemplateOpts): string {
        referer                  = referer && JSON.stringify(referer) || '{{{referer}}}';
        cookie                   = cookie || '{{{cookie}}}';
        iframeTaskScriptTemplate = iframeTaskScriptTemplate || '{{{iframeTaskScriptTemplate}}}';

        const { domain, crossDomainPort } = serverInfo;

        return mustache.render(TASK_TEMPLATE, {
            sessionId:             this.id,
            serviceMsgUrl:         domain + '/messaging',
            forceProxySrcForImage: this.hasRequestEventListeners(),
            crossDomainPort,
            isFirstPageLoad,
            referer,
            cookie,
            iframeTaskScriptTemplate,
            payloadScript
        });
    }

    getIframeTaskScriptTemplate (serverInfo: ServerInfo): string {
        const taskScriptTemplate = this._fillTaskScriptTemplate({
            serverInfo,
            isFirstPageLoad:          false,
            referer:                  null,
            cookie:                   null,
            iframeTaskScriptTemplate: null,
            payloadScript:            this._getIframePayloadScript(true)
        });

        return JSON.stringify(taskScriptTemplate);
    }

    getTaskScript ({ referer, cookieUrl, serverInfo, isIframe, withPayload }: TaskScriptOpts): string {
        const cookies     = JSON.stringify(this.cookies.getClientString(cookieUrl));
        let payloadScript = '';

        if (withPayload)
            payloadScript = isIframe ? this._getIframePayloadScript(false) : this._getPayloadScript();

        const taskScript = this._fillTaskScriptTemplate({
            serverInfo,
            isFirstPageLoad:          this.pageLoadCount === 0,
            referer,
            cookie:                   cookies,
            iframeTaskScriptTemplate: this.getIframeTaskScriptTemplate(serverInfo),
            payloadScript
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

    addRequestEventListeners (requestFilterRule: RequestFilterRule, listeners: RequestEventListeners, errorHandler: Function) {
        const listenersData = {
            listeners,
            errorHandler
        };

        this.requestEventListeners.set(requestFilterRule, listenersData);
    }

    removeRequestEventListeners (requestFilterRule: RequestFilterRule) {
        this.requestEventListeners.delete(requestFilterRule);
    }

    clearRequestEventListeners (): void {
        this.requestEventListeners.clear();
    }

    getRequestFilterRules (requestInfo: RequestInfo): Array<RequestFilterRule> {
        const rulesArray:Array<RequestFilterRule> = Array.from(this.requestEventListeners.keys());

        return rulesArray.filter(rule => rule.match(requestInfo));
    }

    async callRequestEventCallback (eventName: RequestEventNames, requestFilterRule: RequestFilterRule, eventData: RequestEvent | ResponseEvent | ConfigureResponseEvent) {
        const requestEventListenerData = this.requestEventListeners.get(requestFilterRule);

        if (!requestEventListenerData)
            return;

        const { listeners, errorHandler } = requestEventListenerData;
        const targetRequestEventCallback  = listeners[eventName];

        if (typeof targetRequestEventCallback !== 'function')
            return;

        try {
            await targetRequestEventCallback(eventData);
        }
        catch (e) {
            if (typeof errorHandler !== 'function')
                return;

            errorHandler(e);
        }
    }

    setMock (requestFilterRule: RequestFilterRule, mock: ResponseMock) {
        this.mocks.set(requestFilterRule, mock);
    }

    getMock (requestFilterRule: RequestFilterRule): ResponseMock {
        return this.mocks.get(requestFilterRule);
    }

    abstract _getIframePayloadScript (iframeWithoutSrc: boolean): string;
    abstract _getPayloadScript (): string;
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

