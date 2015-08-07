import { EventEmitter } from 'events';
import Mustache from 'mustache';
import SERVICE_CMD from './service-msg-cmd';
import Cookies from './cookies';
import read from './utils/read-file-relative';
import { parseProxyUrl } from './utils/url';
import UploadStorage from './upload/storage';

// Const
const TASK_TEMPLATE = read('./client/task.js.mustache');


// Global instance counter used to generate ID's
var instanceCount = 0;


// Session
export default class Session extends EventEmitter {
    constructor (uploadPath) {
        super();

        this.uploadStorage = new UploadStorage(uploadPath);

        this.id         = ++instanceCount;
        this.cookies    = new Cookies();
        this.proxy      = null;
        this.injectable = {
            scripts: ['/hammerhead.js'],
            styles:  []
        };
    }

    async handleServiceMessage (msg, serverInfo) {
        if (this[msg.cmd])
            return await this[msg.cmd](msg, serverInfo);


        throw new Error('Malformed service message or message handler is not implemented');
    }

    getTaskScript (referer, cookieUrl, serverInfo, isIFrame, withPayload) {
        var cookies       = this.cookies.getClientString(cookieUrl);
        var payloadScript = '';

        if (withPayload)
            payloadScript = isIFrame ? this._getIFramePayloadScript() : this._getPayloadScript();

        return Mustache.render(TASK_TEMPLATE, {
            cookie:               cookies.replace(/'/g, "\\'"),
            jobUid:               this.id,
            jobOwnerToken:        '',
            serviceMsgUrl:        serverInfo.domain + '/messaging',
            ie9FileReaderShimUrl: serverInfo.domain + '/ie9-file-reader-shim',
            crossDomainPort:      serverInfo.crossDomainPort,
            payloadScript:        payloadScript,
            referer:              referer
        });
    }

    _getIFramePayloadScript () {
        throw new Error('Not implemented');
    }

    _getPayloadScript () {
        throw new Error('Not implemented');
    }

    _getUploadStorageFolder () {
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
var ServiceMessages = Session.prototype;

ServiceMessages[SERVICE_CMD.SET_COOKIE] = function (msg) {
    var parsedUrl = parseProxyUrl(msg.url);
    var cookieUrl = parsedUrl ? parsedUrl.originUrl : msg.url;

    this.cookies.setByClient(cookieUrl, msg.cookie);

    return this.cookies.getClientString(cookieUrl);
};

ServiceMessages[SERVICE_CMD.GET_IFRAME_TASK_SCRIPT] = function (msg, serverInfo) {
    var referer     = msg.referer || '';
    var refererDest = referer && parseProxyUrl(referer);
    var cookieUrl   = refererDest && refererDest.originUrl;

    return this.getTaskScript(referer, cookieUrl, serverInfo, true, false);
};

ServiceMessages[SERVICE_CMD.UPLOAD_FILES] = async function (msg) {
    return await this.uploadStorage.store(msg.fileNames, msg.data);
};

ServiceMessages[SERVICE_CMD.GET_UPLOADED_FILES] = async function (msg) {
    return await this.uploadStorage.get(msg.filePaths);
};


