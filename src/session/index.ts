import mustache from 'mustache';
import { readSync as read } from 'read-file-relative';
import { EventEmitter } from 'events';
import { parse as parseUrl } from 'url';
import Cookies from './cookies';
import UploadStorage from '../upload/storage';
import COMMAND from './command';
import generateUniqueId from '../utils/generate-unique-id';

const TASK_TEMPLATE: string = read('../client/task.js.mustache');

export default abstract class Session extends EventEmitter {
    requireStateSwitch: boolean;
    uploadStorage: any;
    id: string;
    cookies: any;
    proxy: any;
    externalProxySettings: any;
    pageLoadCount: number;
    pendingStateSnapshot: any;
    injectable: any;
    requestEventListeners: any;
    mocks: any;

    constructor (uploadsRoot: string) {
        super();

        this.uploadStorage = new UploadStorage(uploadsRoot);

        this.id                    = generateUniqueId();
        this.cookies               = new Cookies();
        this.proxy                 = null;
        this.externalProxySettings = null;
        this.pageLoadCount         = 0;

        this.requireStateSwitch   = false;
        this.pendingStateSnapshot = null;

        this.injectable = {
            scripts: ['/hammerhead.js'],
            styles:  []
        };

        this.requestEventListeners = new Map();
        this.mocks                 = new Map();
    }

    // State
    getStateSnapshot () {
        return {
            cookies:  this.cookies.serializeJar(),
            storages: null
        };
    }

    useStateSnapshot (snapshot) {
        // NOTE: we don't perform state switch immediately, since there might be
        // pending requests from current page. Therefore, we perform switch in
        // onPageRequest handler when new page is requested.
        this.requireStateSwitch   = true;
        this.pendingStateSnapshot = snapshot || {
            cookies:  null,
            storages: {
                localStorage:   '[[],[]]',
                sessionStorage: '[[],[]]'
            }
        };
    }

    async handleServiceMessage (msg, serverInfo) {
        if (this[msg.cmd])
            return await this[msg.cmd](msg, serverInfo);


        throw new Error('Malformed service message or message handler is not implemented');
    }

    _fillTaskScriptTemplate ({ serverInfo, isFirstPageLoad, referer, cookie, iframeTaskScriptTemplate, payloadScript }) {
        referer                  = referer || '{{{referer}}}';
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

    getIframeTaskScriptTemplate (serverInfo) {
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

    getTaskScript ({ referer, cookieUrl, serverInfo, isIframe, withPayload }) {
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

    setExternalProxySettings (proxySettings: any) {
        if (typeof proxySettings === 'string')
            proxySettings = { url: proxySettings };

        proxySettings = proxySettings || {};

        const { url, bypassRules } = proxySettings;
        const parsedUrl            = typeof url === 'string' ? parseUrl('http://' + url) : null;
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

    onPageRequest (ctx) {
        if (this.requireStateSwitch) {
            this.cookies.setJar(this.pendingStateSnapshot.cookies);
            ctx.restoringStorages     = this.pendingStateSnapshot.storages;
            this.requireStateSwitch   = false;
            this.pendingStateSnapshot = null;
        }
    }

    // Request hooks
    hasRequestEventListeners () {
        return !!this.requestEventListeners.size;
    }

    addRequestEventListeners (requestFilterRule, eventListeners) {
        this.requestEventListeners.set(requestFilterRule, eventListeners);
    }

    removeRequestEventListeners (requestFilterRule) {
        this.requestEventListeners.delete(requestFilterRule);
    }

    getRequestFilterRules (requestInfo) {
        const rulesArray: any = Array.from(this.requestEventListeners.keys());

        return rulesArray.filter(rule => rule.match(requestInfo));
    }

    async callRequestEventCallback (eventName, requestFilterRule, eventData) {
        const eventListeners             = this.requestEventListeners.get(requestFilterRule);
        const targetRequestEventCallback = eventListeners[eventName];

        if (typeof targetRequestEventCallback === 'function')
            await targetRequestEventCallback(eventData);
    }

    setMock (requestFilterRule: any, mock) {
        this.mocks.set(requestFilterRule, mock);
    }

    getMock (requestFilterRule) {
        return this.mocks.get(requestFilterRule);
    }

    abstract _getIframePayloadScript (iframeWithoutSrc: boolean): string;
    abstract _getPayloadScript (): string;
    abstract handleFileDownload (ctx: any): void;
    abstract handlePageError (ctx, err): void;
    abstract getAuthCredentials (): any;

    // Service message handlers
    async [COMMAND.uploadFiles] (msg) {
        return await this.uploadStorage.store(msg.fileNames, msg.data);
    }

    async [COMMAND.getUploadedFiles] (msg) {
        return await this.uploadStorage.get(msg.filePaths);
    }
}

