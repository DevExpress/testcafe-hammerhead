import Router from './router';
import http from 'http';
import https from 'https';
import * as urlUtils from '../utils/url';
import { readSync as read } from 'read-file-relative';
import { respond500, respondWithJSON, fetchBody, preventCaching } from '../utils/http';
import { run as runRequestPipeline } from '../request-pipeline';
import prepareShadowUIStylesheet from '../shadow-ui/create-shadow-stylesheet';
import { resetKeepAliveConnections } from '../request-pipeline/destination-request/agent';

const SESSION_IS_NOT_OPENED_ERR: string = 'Session is not opened in proxy';

function parseAsJson (msg: string) {
    msg = msg.toString();

    try {
        return JSON.parse(msg);
    }
    catch (err) {
        return null;
    }
}

interface ServerInfo {
    hostname: string,
    port: string,
    crossDomainPort: string,
    protocol: string,
    domain: string
}

function createServerInfo (hostname: string, port: string, crossDomainPort: string, protocol: string): ServerInfo {
    return {
        hostname:        hostname,
        port:            port,
        crossDomainPort: crossDomainPort,
        protocol:        protocol,
        domain:          `${protocol}//${hostname}:${port}`
    };
}

export default class Proxy extends Router {
    private readonly openSessions: any;
    private readonly server1Info: ServerInfo;
    private readonly server2Info: ServerInfo;
    private readonly server1: any;
    private readonly server2: any;
    private readonly sockets: Array<any>;

    constructor (hostname: string, port1: string, port2: string, options: any = {}) {
        super(options);

        const { ssl, developmentMode } = options;

        this.openSessions = {};

        const protocol = ssl ? 'https:' : 'http:';

        this.server1Info = createServerInfo(hostname, port1, port2, protocol);
        this.server2Info = createServerInfo(hostname, port2, port1, protocol);

        if (ssl) {
            this.server1 = https.createServer(ssl, (req, res) => this._onRequest(req, res, this.server1Info));
            this.server2 = https.createServer(ssl, (req, res) => this._onRequest(req, res, this.server2Info));
        }
        else {
            this.server1 = http.createServer((req, res) => this._onRequest(req, res, this.server1Info));
            this.server2 = http.createServer((req, res) => this._onRequest(req, res, this.server2Info));
        }

        this.server1.on('upgrade', (req, socket, head) => this._onUpgradeRequest(req, socket, head, this.server1Info));
        this.server2.on('upgrade', (req, socket, head) => this._onUpgradeRequest(req, socket, head, this.server2Info));

        this.server1.listen(port1);
        this.server2.listen(port2);

        this.sockets = [];

        // BUG: GH-89
        this._startSocketsCollecting();
        this._registerServiceRoutes(developmentMode);
    }

    _closeSockets () {
        this.sockets.forEach(socket => socket.destroy());
    }

    _startSocketsCollecting () {
        const handler = socket => {
            this.sockets.push(socket);
            socket.on('close', () => this.sockets.splice(this.sockets.indexOf(socket), 1));
        };

        this.server1.on('connection', handler);
        this.server2.on('connection', handler);
    }

    _registerServiceRoutes (developmentMode) {
        const hammerheadFileName      = developmentMode ? 'hammerhead.js' : 'hammerhead.min.js';
        const hammerheadScriptContent = read(`../client/${hammerheadFileName}`);

        this.GET('/hammerhead.js', {
            contentType: 'application/x-javascript',
            content:     hammerheadScriptContent
        });

        this.POST('/messaging', (req, res, serverInfo) => this._onServiceMessage(req, res, serverInfo));
        this.GET('/task.js', (req, res, serverInfo) => this._onTaskScriptRequest(req, res, serverInfo, false));
        this.GET('/iframe-task.js', (req, res, serverInfo) => this._onTaskScriptRequest(req, res, serverInfo, true));
    }

    async _onServiceMessage (req, res, serverInfo: ServerInfo) {
        const body    = await fetchBody(req);
        const msg     = parseAsJson(body);
        const session = msg && this.openSessions[msg.sessionId];

        if (session) {
            try {
                const result = await session.handleServiceMessage(msg, serverInfo);

                respondWithJSON(res, result || '', false);
            }
            catch (err) {
                respond500(res, err.toString());
            }
        }
        else
            respond500(res, SESSION_IS_NOT_OPENED_ERR);
    }

    _onTaskScriptRequest (req, res, serverInfo: ServerInfo, isIframe: boolean) {
        const referer     = req.headers['referer'];
        const refererDest = referer && urlUtils.parseProxyUrl(referer);
        const session     = refererDest && this.openSessions[refererDest.sessionId];

        if (session) {
            res.setHeader('content-type', 'application/x-javascript');
            preventCaching(res);

            const taskScript = session.getTaskScript({
                referer,
                cookieUrl:   refererDest.destUrl,
                serverInfo,
                isIframe,
                withPayload: true
            });

            res.end(taskScript);
        }
        else
            respond500(res, SESSION_IS_NOT_OPENED_ERR);
    }

    _onRequest (req, res, serverInfo: ServerInfo) {
        // NOTE: Not a service request, execute the proxy pipeline.
        if (!this._route(req, res, serverInfo))
            runRequestPipeline(req, res, serverInfo, this.openSessions);
    }

    _onUpgradeRequest (req, socket, head, serverInfo: ServerInfo) {
        if (head && head.length)
            socket.unshift(head);

        this._onRequest(req, socket, serverInfo);
    }

    _processStaticContent (handler) {
        if (handler.isShadowUIStylesheet)
            handler.content = prepareShadowUIStylesheet(handler.content);
    }

    // API
    close () {
        this.server1.close();
        this.server2.close();
        this._closeSockets();
        resetKeepAliveConnections();
    }

    openSession (url: string, session: any, externalProxySettings) {
        session.proxy                 = this;
        this.openSessions[session.id] = session;

        if (externalProxySettings)
            session.setExternalProxySettings(externalProxySettings);

        url = urlUtils.prepareUrl(url);

        return urlUtils.getProxyUrl(url, {
            proxyHostname: this.server1Info.hostname,
            proxyPort:     this.server1Info.port,
            proxyProtocol: this.server1Info.protocol,
            sessionId:     session.id
        });
    }

    closeSession (session) {
        session.proxy = null;
        delete this.openSessions[session.id];
    }
}
