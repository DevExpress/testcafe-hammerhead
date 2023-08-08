import dns from 'dns';
import net from 'net';
import Session from '../session';
import { ExternalProxySettingsRaw } from '../typings/session';
import Router from './router';

import {
    StaticContent,
    ServiceMessage,
    WebSocketServiceMessage,
    ServerInfo,
    ProxyOptions,
    RouterOptions,
} from '../typings/proxy';

import http, { ServerOptions } from 'http';
import https from 'https';
import * as urlUtils from '../utils/url';
import scriptProcessor from '../processing/resources/script';

import {
    respond500,
    respondWithJSON,
    fetchBody,
    addPreventCachingHeaders,
    acceptCrossOrigin,
    respond204,
} from '../utils/http';

import { run as runRequestPipeline } from '../request-pipeline';
import prepareShadowUIStylesheet from '../shadow-ui/create-shadow-stylesheet';
import { resetKeepAliveConnections } from '../request-pipeline/destination-request/agent';
import SERVICE_ROUTES from './service-routes';
import BUILTIN_HEADERS from '../request-pipeline/builtin-header-names';
import logger from '../utils/logger';
import errToString from '../utils/err-to-string';
import { parse as parseJSON } from '../utils/json';
import loadClientScript from '../utils/load-client-script';
import nodeWebSocket from 'ws';

const SESSION_IS_NOT_OPENED_ERR = 'Session is not opened in proxy';

function parseAsJson (msg: Buffer): ServiceMessage | WebSocketServiceMessage | null {
    try {
        return parseJSON(msg.toString());
    }
    catch (err) {
        return null;
    }
}

function createServerInfo (hostname: string, port: number, crossDomainPort: number, protocol: string, cacheRequests: boolean): ServerInfo {
    return {
        hostname,
        port,
        crossDomainPort,
        protocol,
        cacheRequests,
        domain: `${protocol}//${hostname}:${port}`,
    };
}

const DEFAULT_PROXY_OPTIONS = {
    developmentMode:  false,
    cache:            false,
    nativeAutomation: false,
};

export default class Proxy extends Router {
    private readonly openSessions: Map<string, Session> = new Map();
    private server1Info: ServerInfo | null;
    private server2Info: ServerInfo | null;
    private server1: http.Server | https.Server | null;
    private server2: http.Server | https.Server | null;
    private proxyOptions: ProxyOptions | null;
    private readonly sockets: Set<net.Socket>;
    private wss1: nodeWebSocket.Server;
    private wss2: nodeWebSocket.Server;

    // Max header size for incoming HTTP requests
    // Set to 80 KB as it was the original limit:
    // https://github.com/nodejs/node/blob/186035243fad247e3955fa0c202987cae99e82db/deps/http_parser/http_parser.h#L63
    // Before the change to 8 KB:
    // https://github.com/nodejs/node/commit/186035243fad247e3955fa0c202987cae99e82db#diff-1d0d420098503156cddb601e523b82e7R59
    public static MAX_REQUEST_HEADER_SIZE = 80 * 1024;

    constructor (options: RouterOptions) {
        super(options);

        this.server1       = null;
        this.server2       = null;
        this.server1Info   = null;
        this.server2Info   = null;
        this.proxyOptions  = null;
        this.sockets       = new Set<net.Socket>();
    }

    _getOpts (ssl?: {}): ServerOptions {
        let opts = {} as ServerOptions;

        if (ssl)
            opts = ssl;

        opts.maxHeaderSize = Proxy.MAX_REQUEST_HEADER_SIZE;

        return opts;
    }

    _getCreateServerMethod (ssl?: {}): typeof http.createServer {
        return ssl ? https.createServer : http.createServer;
    }

    _closeSockets (): void {
        this.sockets.forEach(socket => socket.destroy());
    }

    _startSocketsCollecting (): void {
        const handler = (socket: net.Socket) => {
            this.sockets.add(socket);

            socket.on('close', () => this.sockets.delete(socket));
        };

        this.server1?.on('connection', handler); // eslint-disable-line no-unused-expressions
        this.server2?.on('connection', handler); // eslint-disable-line no-unused-expressions
    }

    _registerServiceRoutes (developmentMode: boolean): void {
        const hammerheadScriptContent = loadClientScript(SERVICE_ROUTES.hammerhead, developmentMode);
        const transportWorkerContent  = loadClientScript(SERVICE_ROUTES.transportWorker, developmentMode);
        const workerHammerheadContent = loadClientScript(SERVICE_ROUTES.workerHammerhead, developmentMode);

        this.GET(SERVICE_ROUTES.hammerhead, {
            contentType: 'application/x-javascript',
            content:     hammerheadScriptContent,
        });

        this.GET(SERVICE_ROUTES.transportWorker, {
            contentType: 'application/x-javascript',
            content:     transportWorkerContent,
        });

        this.GET(SERVICE_ROUTES.workerHammerhead, {
            contentType: 'application/x-javascript',
            content:     workerHammerheadContent,
        });

        this.GET(SERVICE_ROUTES.messaging, (req: http.IncomingMessage, res: http.ServerResponse, serverInfo: ServerInfo) => this._onServiceWebSocket(req, res, serverInfo));
        this.POST(SERVICE_ROUTES.messaging, (req: http.IncomingMessage, res: http.ServerResponse, serverInfo: ServerInfo) => this._onServiceMessage(req, res, serverInfo));
        this.OPTIONS(SERVICE_ROUTES.messaging, (req: http.IncomingMessage, res: http.ServerResponse) => this._onServiceMessagePreflight(req, res));

        this.GET(SERVICE_ROUTES.task, (req: http.IncomingMessage, res: http.ServerResponse, serverInfo: ServerInfo) => this._onTaskScriptRequest(req, res, serverInfo, false));
        this.GET(SERVICE_ROUTES.iframeTask, (req: http.IncomingMessage, res: http.ServerResponse, serverInfo: ServerInfo) => this._onTaskScriptRequest(req, res, serverInfo, true));
    }

    async _onServiceMessage (req: http.IncomingMessage, res: http.ServerResponse, serverInfo: ServerInfo): Promise<void> {
        const body    = await fetchBody(req);
        const msg     = parseAsJson(body);
        const session = msg && this.openSessions.get(msg.sessionId);

        if (msg && session) {
            try {
                const result = await session.handleServiceMessage(msg, serverInfo);

                logger.serviceMsg.onMessage(msg, result);

                res.setHeader(BUILTIN_HEADERS.setCookie, session.takePendingSyncCookies());

                respondWithJSON(res, result, false, this.isNativeAutomation);
            }
            catch (err) {
                logger.serviceMsg.onError(msg, err);

                respond500(res, errToString(err));
            }
        }
        else
            respond500(res, SESSION_IS_NOT_OPENED_ERR);
    }

    _onServiceWebSocket (req: http.IncomingMessage, res: http.ServerResponse, serverInfo: ServerInfo): void {
        if (req.headers?.upgrade?.toLowerCase() !== 'websocket')
            return;

        serverInfo.wss.handleUpgrade(req, res, Buffer.alloc(0), (ws) => {
            serverInfo.wss.emit('connection', ws, req);
        });
    }

    _onServiceWebSocketConnection (ws, serverInfo): void {
        logger.serviceSocket.onConnection(ws);

        ws.on('error', (err) => logger.serviceSocket.onError(err));

        ws.on('message', (data) => {
            this._onServiceWebSocketMessage(ws, data, serverInfo);
        });
    }

    async _onServiceWebSocketMessage (ws, data, serverInfo): Promise<void> {
        const msg     = parseAsJson(data) as WebSocketServiceMessage;
        const id      = msg && msg.id;
        const session = msg && this.openSessions.get(msg.sessionId);

        if (msg && session) {
            try {
                const result = await session.handleServiceMessage(msg, serverInfo);

                logger.serviceMsg.onMessage(msg, result);

                ws.send(JSON.stringify({ result, id }));
            }
            catch (err) {
                logger.serviceMsg.onError(msg, err);

                ws.send(JSON.stringify({ result: errToString(err), id }));
            }
        }
        else
            ws.send(JSON.stringify({ result: SESSION_IS_NOT_OPENED_ERR, id }));
    }

    _onServiceMessagePreflight (_req: http.IncomingMessage, res: http.ServerResponse): void {
        // NOTE: 'Cache-control' header set in the 'Transport' sandbox on the client side.
        // Request becomes non-simple (https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS#simple_requests)
        // and initiates the CORS preflight request.
        res.setHeader(BUILTIN_HEADERS.accessControlAllowHeaders, BUILTIN_HEADERS.cacheControl);
        acceptCrossOrigin(res);
        respond204(res);
    }

    async _onTaskScriptRequest (req: http.IncomingMessage, res: http.ServerResponse, serverInfo: ServerInfo, isIframe: boolean): Promise<void> {
        const referer     = req.headers[BUILTIN_HEADERS.referer] as string;
        const refererDest = referer && urlUtils.parseProxyUrl(referer);
        const session     = refererDest && this.openSessions.get(refererDest.sessionId);
        const windowId    = refererDest && refererDest.windowId || void 0;

        if (session) {
            if (referer && !isIframe)
                session.options.referer = referer;

            res.setHeader(BUILTIN_HEADERS.contentType, 'application/x-javascript');
            addPreventCachingHeaders(res);

            const taskScript = await session.getTaskScript({
                referer,
                cookieUrl:   refererDest ? refererDest.destUrl : '',
                serverInfo,
                isIframe,
                withPayload: true,
                windowId,
            });

            res.end(taskScript);
        }
        else
            respond500(res, SESSION_IS_NOT_OPENED_ERR);
    }

    _onRequest (req: http.IncomingMessage, res: http.ServerResponse | net.Socket, serverInfo: ServerInfo): void {
        // NOTE: Not a service request, execute the proxy pipeline.
        if (!this._route(req, res, serverInfo))
            runRequestPipeline(req, res, serverInfo, this.openSessions, this.isNativeAutomation);
    }

    _onUpgradeRequest (req: http.IncomingMessage, socket: net.Socket, head: Buffer, serverInfo: ServerInfo): void {
        if (head && head.length)
            socket.unshift(head);

        this._onRequest(req, socket, serverInfo);
    }

    _processStaticContent (handler: StaticContent): void {
        if (handler.isShadowUIStylesheet)
            handler.content = prepareShadowUIStylesheet(handler.content as string);
    }

    _prepareDNSRouting (): void {
        // NOTE: to avoid https://github.com/DevExpress/testcafe/issues/7447
        if (typeof dns.setDefaultResultOrder === 'function')
            // NOTE: to avoid https://github.com/nodejs/node/issues/40537
            dns.setDefaultResultOrder('ipv4first');
    }

    // API
    start (options: ProxyOptions) {
        this.proxyOptions = Object.assign({}, DEFAULT_PROXY_OPTIONS, options);

        this._prepareDNSRouting();

        const {
            hostname,
            port1,
            port2,
            ssl,
            developmentMode,
            cache,
        } = this.proxyOptions;

        const protocol     = ssl ? 'https:' : 'http:';
        const opts         = this._getOpts(ssl);
        const createServer = this._getCreateServerMethod(ssl);

        this.server1Info = createServerInfo(hostname, port1, port2, protocol, !!cache);
        this.server2Info = createServerInfo(hostname, port2, port1, protocol, !!cache);

        this.server1 = createServer(opts, (req: http.IncomingMessage, res: http.ServerResponse) => this._onRequest(req, res, this.server1Info as ServerInfo));
        this.server2 = createServer(opts, (req: http.IncomingMessage, res: http.ServerResponse) => this._onRequest(req, res, this.server2Info as ServerInfo));

        this.server1.on('upgrade', (req: http.IncomingMessage, socket: net.Socket, head: Buffer) => this._onUpgradeRequest(req, socket, head, this.server1Info as ServerInfo));
        this.server2.on('upgrade', (req: http.IncomingMessage, socket: net.Socket, head: Buffer) => this._onUpgradeRequest(req, socket, head, this.server2Info as ServerInfo));

        this.server1.listen(port1);
        this.server2.listen(port2);

        this.wss1 = new nodeWebSocket.Server({ noServer: true });
        this.wss2 = new nodeWebSocket.Server({ noServer: true });

        this.wss1.on('connection', (ws) => this._onServiceWebSocketConnection(ws, this.server1Info));
        this.wss2.on('connection', (ws) => this._onServiceWebSocketConnection(ws, this.server2Info));

        this.server1Info.wss = this.wss1;
        this.server2Info.wss = this.wss2;

        // BUG: GH-89
        this._startSocketsCollecting();
        this._registerServiceRoutes(!!developmentMode);
    }
    close (): void {
        scriptProcessor.jsCache.reset();
        this.server1?.close(); // eslint-disable-line no-unused-expressions
        this.server2?.close(); // eslint-disable-line no-unused-expressions
        this._closeSockets();
        resetKeepAliveConnections();
    }

    openSession (url: string, session: Session, externalProxySettings: ExternalProxySettingsRaw): string {
        session.proxy = this;

        this.openSessions.set(session.id, session);

        if (externalProxySettings)
            session.setExternalProxySettings(externalProxySettings);

        const {
            disableHttp2,
            disableCrossDomain,
            nativeAutomation,
        } = this.proxyOptions as ProxyOptions;

        if (disableHttp2)
            session.disableHttp2();

        if (disableCrossDomain)
            session.disableCrossDomain();

        url = urlUtils.prepareUrl(url);

        if (nativeAutomation)
            return url;

        const serverInfo = this.server1Info as ServerInfo;

        return urlUtils.getProxyUrl(url, {
            proxyHostname: serverInfo.hostname,
            proxyPort:     serverInfo.port.toString(),
            proxyProtocol: serverInfo.protocol,
            sessionId:     session.id,
            windowId:      session.options.windowId,
        });
    }

    closeSession (session: Session): void {
        session.proxy = null;

        this.openSessions.delete(session.id);
    }

    public resolveRelativeServiceUrl (relativeServiceUrl: string, domain = (this.server1Info as ServerInfo).domain): string {
        return new URL(relativeServiceUrl, domain).toString();
    }

    public switchToNativeAutomation (): void {
        (this.proxyOptions as ProxyOptions).nativeAutomation = true;
    }

    public setMode (isNativeAutomation: boolean): void {
        (this.proxyOptions as ProxyOptions).nativeAutomation = isNativeAutomation;
    }

    public get isNativeAutomation (): boolean {
        return !!(this.proxyOptions as ProxyOptions).nativeAutomation;
    }
}
