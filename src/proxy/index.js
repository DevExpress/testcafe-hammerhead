import Router from './router';
import http from 'http';
import https from 'https';
import * as urlUtils from '../utils/url';
import { readSync as read } from 'read-file-relative';
import { respond204, respond500, respondWithJSON, fetchBody, preventCaching } from '../utils/http';
import { run as runRequestPipeline } from '../request-pipeline';
import prepareShadowUIStylesheet from '../shadow-ui/create-shadow-stylesheet';

// Const
const CLIENT_SCRIPT             = read('../client/hammerhead.js');
const SESSION_IS_NOT_OPENED_ERR = 'Session is not opened in proxy';

// Static
function parseAsJson (msg) {
    msg = msg.toString();

    try {
        return JSON.parse(msg);
    }
    catch (err) {
        return null;
    }
}

function createServerInfo (hostname, port, crossDomainPort, protocol) {
    return {
        hostname:        hostname,
        port:            port,
        crossDomainPort: crossDomainPort,
        protocol:        protocol,
        domain:          `${protocol}//${hostname}:${port}`
    };
}

// Proxy
export default class Proxy extends Router {
    constructor (hostname, port1, port2, options) {
        super();

        this.openSessions = {};

        options = options || {};

        const serverProvider = options.ssl ? https : http;
        const protocol = options.ssl ? 'https:' : 'http:';
        const serverOptions = {
            key:  options.key || '',
            cert: options.cert || ''
        };

        this.server1Info = createServerInfo(hostname, port1, port2, protocol);
        this.server2Info = createServerInfo(hostname, port2, port1, protocol);
        this.server1     = serverProvider.createServer(serverOptions, (req, res) => this._onRequest(req, res, this.server1Info));
        this.server2     = serverProvider.createServer(serverOptions, (req, res) => this._onRequest(req, res, this.server2Info));

        this.server1.on('upgrade', (req, socket, head) => this._onUpgradeRequest(req, socket, head, this.server1Info));
        this.server2.on('upgrade', (req, socket, head) => this._onUpgradeRequest(req, socket, head, this.server2Info));

        this.server1.listen(port1);
        this.server2.listen(port2);

        this.sockets = [];

        // BUG: GH-89
        this._startSocketsCollecting();
        this._registerServiceRoutes();
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

    _registerServiceRoutes () {
        this.GET('/hammerhead.js', {
            contentType: 'application/x-javascript',
            content:     CLIENT_SCRIPT
        });

        this.POST('/messaging', (req, res, serverInfo) => this._onServiceMessage(req, res, serverInfo));
        this.POST('/cookie-sync', (req, res, serverInfo) => this._onCookieSync(req, res, serverInfo));
        this.GET('/task.js', (req, res, serverInfo) => this._onTaskScriptRequest(req, res, serverInfo, false));
        this.GET('/iframe-task.js', (req, res, serverInfo) => this._onTaskScriptRequest(req, res, serverInfo, true));
    }

    async _onServiceMessage (req, res, serverInfo) {
        const body    = await fetchBody(req);
        const msg     = parseAsJson(body);
        const session = msg && this.openSessions[msg.sessionId];

        if (session) {
            try {
                const result = await session.handleServiceMessage(msg, serverInfo);

                respondWithJSON(res, result || '');
            }
            catch (err) {
                respond500(res, err.toString());
            }
        }
        else
            respond500(res, SESSION_IS_NOT_OPENED_ERR);
    }

    async _onCookieSync (req, res) {
        const body    = await fetchBody(req);
        const msg     = parseAsJson(body);
        const session = msg && this.openSessions[msg.sessionId];

        if (session) {
            try {
                session.setCookie(msg.queue);

                respond204(res);
            }
            catch (err) {
                respond500(res, err.toString());
            }
        }
        else
            respond500(res, SESSION_IS_NOT_OPENED_ERR);
    }

    _onTaskScriptRequest (req, res, serverInfo, isIframe) {
        const referer     = req.headers['referer'];
        const refererDest = referer && urlUtils.parseProxyUrl(referer);
        const session     = refererDest && this.openSessions[refererDest.sessionId];

        if (session) {
            res.setHeader('content-type', 'application/x-javascript');
            preventCaching(res);
            res.end(session.getTaskScript(referer, refererDest.destUrl, serverInfo, isIframe, true));
        }
        else
            respond500(res, SESSION_IS_NOT_OPENED_ERR);
    }

    _onRequest (req, res, serverInfo) {
        // NOTE: Not a service request, execute the proxy pipeline.
        if (!this._route(req, res, serverInfo))
            runRequestPipeline(req, res, serverInfo, this.openSessions);
    }

    _onUpgradeRequest (req, socket, head, serverInfo) {
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
    }

    openSession (url, session, externalProxySettings) {
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
