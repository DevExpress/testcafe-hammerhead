import mustache from 'mustache';
import { readSync as read } from 'read-file-relative';
import { EventEmitter } from 'events';
import { parse as parseUrl } from 'url';
import Cookies from './cookies';
import UploadStorage from '../upload/storage';
import COMMAND from './command';
import { parseProxyUrl } from '../utils/url';
import generateUniqueId from '../utils/generate-unique-id';

// Const
const TASK_TEMPLATE = read('../client/task.js.mustache');

// Session
export default class Session extends EventEmitter {
    constructor (uploadsRoot) {
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

    _fillTaskScriptTemplate (serverInfo, isFirstPageLoad, referer, cookie, iframeTaskScriptTemplate, payloadScript) {
        referer = referer === null ? '{{{referer}}}' : referer;
        cookie  = cookie === null ? '{{{cookie}}}' : cookie;

        iframeTaskScriptTemplate = iframeTaskScriptTemplate ===
                                   null ? '{{{iframeTaskScriptTemplate}}}' : iframeTaskScriptTemplate;

        return mustache.render(TASK_TEMPLATE, {
            sessionId:                this.id,
            serviceMsgUrl:            serverInfo.domain + '/messaging',
            cookieSyncUrl:            serverInfo.domain + '/cookie-sync',
            crossDomainPort:          serverInfo.crossDomainPort,
            isFirstPageLoad:          isFirstPageLoad,
            referer:                  referer,
            cookie:                   cookie,
            forceProxySrcForImage:    this.hasRequestEventListeners(),
            iframeTaskScriptTemplate: iframeTaskScriptTemplate,
            payloadScript:            payloadScript
        });
    }

    getIframeTaskScriptTemplate (serverInfo) {
        return JSON.stringify(this._fillTaskScriptTemplate(serverInfo, false, null, null, null, this._getIframePayloadScript(true)));
    }

    getTaskScript (referer, cookieUrl, serverInfo, isIframe, withPayload) {
        const cookies     = JSON.stringify(this.cookies.getClientString(cookieUrl));
        let payloadScript = '';

        if (withPayload)
            payloadScript = isIframe ? this._getIframePayloadScript() : this._getPayloadScript();

        const taskScript = this._fillTaskScriptTemplate(serverInfo, this.pageLoadCount === 0, referer,
            cookies, this.getIframeTaskScriptTemplate(serverInfo), payloadScript);

        this.pageLoadCount++;

        return taskScript;
    }

    setExternalProxySettings (proxySettings) {
        if (typeof proxySettings === 'string')
            proxySettings = { url: proxySettings };

        const { url, bypassRules } = proxySettings || {};
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
                settings.authHeader = 'Basic ' + new Buffer(parsedUrl.auth).toString('base64');
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

    setCookie (queue) {
        for (const msg of queue) {
            const parsedUrl = parseProxyUrl(msg.url);
            const cookieUrl = parsedUrl ? parsedUrl.destUrl : msg.url;

            this.cookies.setByClient(cookieUrl, msg.cookie);
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
        const rulesArray = Array.from(this.requestEventListeners.keys());

        return rulesArray.filter(rule => rule.match(requestInfo));
    }

    callRequestEventCallback (eventName, requestFilterRule, eventData) {
        const eventListeners             = this.requestEventListeners.get(requestFilterRule);
        const targetRequestEventCallback = eventListeners[eventName];

        if (typeof targetRequestEventCallback === 'function')
            targetRequestEventCallback(eventData);
    }

    setMock (requestFilterRule, mock) {
        this.mocks.set(requestFilterRule, mock);
    }

    getMock (requestFilterRule) {
        return this.mocks.get(requestFilterRule);
    }

    _getIframePayloadScript (/* iframeWithoutSrc */) {
        throw new Error('Not implemented');
    }

    _getPayloadScript () {
        throw new Error('Not implemented');
    }

    handleFileDownload (/* ctx */) {
        throw new Error('Not implemented');
    }

    handlePageError (/* ctx, err */) {
        throw new Error('Not implemented');
    }

    getAuthCredentials () {
        throw new Error('Not implemented');
    }
}

// Service message handlers
const ServiceMessages = Session.prototype;

ServiceMessages[COMMAND.uploadFiles] = async function (msg) {
    return await this.uploadStorage.store(msg.fileNames, msg.data);
};

ServiceMessages[COMMAND.getUploadedFiles] = async function (msg) {
    return await this.uploadStorage.get(msg.filePaths);
};
