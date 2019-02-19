/*eslint-disable no-unused-vars*/
import net from 'net';
import Session, { ExternalProxySettingsRaw } from '../session';
import Router, { StaticContent } from './router';
/*eslint-enable no-unused-vars*/
import http from 'http';
import https from 'https';
import * as urlUtils from '../utils/url';
import { readSync as read } from 'read-file-relative';
import { respond500, respondWithJSON, fetchBody, preventCaching } from '../utils/http';
import { run as runRequestPipeline } from '../request-pipeline';
import prepareShadowUIStylesheet from '../shadow-ui/create-shadow-stylesheet';
import { resetKeepAliveConnections } from '../request-pipeline/destination-request/agent';

const SESSION_IS_NOT_OPENED_ERR: string = 'Session is not opened in proxy';

export interface ServerInfo {
    hostname: string,
    port: string,
    crossDomainPort: string,
    protocol: string,
    domain: string
}

export interface ServiceMessage {
    sessionId: string,
    [propName: string]: any;
}

function parseAsJson (msg: Buffer): ServiceMessage | null {
    try {
        return JSON.parse(msg.toString());
    }
    catch (err) {
        return null;
    }
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
    private readonly openSessions: Map<string, Session> = new Map();
    private readonly server1Info: ServerInfo;
    private readonly server2Info: ServerInfo;
    private readonly server1: http.Server | https.Server;
    private readonly server2: http.Server | https.Server;
    private readonly sockets: Set<net.Socket>;

    constructor (hostname: string, port1: string, port2: string, options: any = {}) {
        super(options);

        const { ssl, developmentMode } = options;
        const protocol                 = ssl ? 'https:' : 'http:';

        this.server1Info = createServerInfo(hostname, port1, port2, protocol);
        this.server2Info = createServerInfo(hostname, port2, port1, protocol);

        if (ssl) {
            this.server1 = https.createServer(ssl, (req: http.IncomingMessage, res: http.ServerResponse) => this._onRequest(req, res, this.server1Info));
            this.server2 = https.createServer(ssl, (req: http.IncomingMessage, res: http.ServerResponse) => this._onRequest(req, res, this.server2Info));
        }
        else {
            this.server1 = http.createServer((req: http.IncomingMessage, res: http.ServerResponse) => this._onRequest(req, res, this.server1Info));
            this.server2 = http.createServer((req: http.IncomingMessage, res: http.ServerResponse) => this._onRequest(req, res, this.server2Info));
        }

        this.server1.on('upgrade', (req: http.IncomingMessage, socket: net.Socket, head: Buffer) => this._onUpgradeRequest(req, socket, head, this.server1Info));
        this.server2.on('upgrade', (req: http.IncomingMessage, socket: net.Socket, head: Buffer) => this._onUpgradeRequest(req, socket, head, this.server2Info));

        this.server1.listen(port1);
        this.server2.listen(port2);

        this.sockets = new Set<net.Socket>();

        // BUG: GH-89
        this._startSocketsCollecting();
        this._registerServiceRoutes(developmentMode);
    }

    _closeSockets () {
        this.sockets.forEach(socket => socket.destroy());
    }

    _startSocketsCollecting () {
        const handler = (socket: net.Socket) => {
            this.sockets.add(socket);

            socket.on('close', () => this.sockets.delete(socket));
        };

        this.server1.on('connection', handler);
        this.server2.on('connection', handler);
    }

    _registerServiceRoutes (developmentMode: boolean) {
        const hammerheadFileName      = developmentMode ? 'hammerhead.js' : 'hammerhead.min.js';
        const hammerheadScriptContent = <Buffer>read(`../client/${hammerheadFileName}`);

        this.GET('/hammerhead.js', {
            contentType: 'application/x-javascript',
            content:     hammerheadScriptContent
        });

        this.POST('/messaging', (req: http.IncomingMessage, res: http.ServerResponse, serverInfo: ServerInfo) => this._onServiceMessage(req, res, serverInfo));
        this.GET('/task.js', (req: http.IncomingMessage, res: http.ServerResponse, serverInfo: ServerInfo) => this._onTaskScriptRequest(req, res, serverInfo, false));
        this.GET('/iframe-task.js', (req: http.IncomingMessage, res: http.ServerResponse, serverInfo: ServerInfo) => this._onTaskScriptRequest(req, res, serverInfo, true));
    }

    async _onServiceMessage (req: http.IncomingMessage, res: http.ServerResponse, serverInfo: ServerInfo) {
        const body    = await fetchBody(req);
        const msg     = parseAsJson(body);
        const session = msg && this.openSessions.get(msg.sessionId);

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

    _onTaskScriptRequest (req: http.IncomingMessage, res: http.ServerResponse, serverInfo: ServerInfo, isIframe: boolean) {
        const referer     = req.headers['referer'];
        const refererDest = referer && urlUtils.parseProxyUrl(referer);
        const session     = refererDest && this.openSessions.get(refererDest.sessionId);

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

    _onRequest (req: http.IncomingMessage, res: http.ServerResponse | net.Socket, serverInfo: ServerInfo) {
        // NOTE: Not a service request, execute the proxy pipeline.
        if (!this._route(req, res, serverInfo))
            runRequestPipeline(req, res, serverInfo, this.openSessions);
    }

    _onUpgradeRequest (req: http.IncomingMessage, socket: net.Socket, head: Buffer, serverInfo: ServerInfo) {
        if (head && head.length)
            socket.unshift(head);

        this._onRequest(req, socket, serverInfo);
    }

    _processStaticContent (handler: StaticContent) {
        if (handler.isShadowUIStylesheet)
            handler.content = prepareShadowUIStylesheet(<string>handler.content);
    }

    // API
    close () {
        this.server1.close();
        this.server2.close();
        this._closeSockets();
        resetKeepAliveConnections();
    }

    openSession (url: string, session: Session, externalProxySettings: ExternalProxySettingsRaw) {
        session.proxy = this;

        this.openSessions.set(session.id, session);

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

        this.openSessions.delete(session.id);
    }
}
