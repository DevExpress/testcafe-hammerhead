import Router from './router';
import http from 'http';
import * as urlUtils from '../utils/url';
import { readSync as read } from 'read-file-relative';
import { respond500, respondWithJSON, fetchBody, preventCaching } from '../utils/http';
import { ie9FileReaderShim } from '../upload';
import { run as runRequestPipeline } from '../request-pipeline';
import prepareShadowUIStylesheet from '../shadow-ui/create-shadow-stylesheet';

// Const
const CLIENT_SCRIPT = read('../client/hammerhead.js');

// Static
function parseServiceMsg (body) {
    body = body.toString();

    try {
        return JSON.parse(body);
    }
    catch (err) {
        return null;
    }
}

function createServerInfo (hostname, port, crossDomainPort) {
    return {
        hostname:        hostname,
        port:            port,
        crossDomainPort: crossDomainPort,
        domain:          `http://${hostname}:${port}`
    };
}

// Proxy
export default class Proxy extends Router {
    constructor (hostname, port1, port2) {
        super();

        this.openSessions = {};

        this.server1Info = createServerInfo(hostname, port1, port2);
        this.server2Info = createServerInfo(hostname, port2, port1);
        this.server1     = http.createServer((req, res) => this._onRequest(req, res, this.server1Info));
        this.server2     = http.createServer((req, res) => this._onRequest(req, res, this.server2Info));

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
        var handler = socket => {
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

        this.POST('/ie9-file-reader-shim', ie9FileReaderShim);
        this.POST('/messaging', (req, res, serverInfo) => this._onServiceMessage(req, res, serverInfo));
        this.GET('/task.js', (req, res, serverInfo) => this._onTaskScriptRequest(req, res, serverInfo, false));
        this.GET('/iframe-task.js', (req, res, serverInfo) => this._onTaskScriptRequest(req, res, serverInfo, true));
    }

    async _onServiceMessage (req, res, serverInfo) {
        var body    = await fetchBody(req);
        var msg     = parseServiceMsg(body);
        var session = msg && this.openSessions[msg.sessionId];

        if (session) {
            try {
                var result = await session.handleServiceMessage(msg, serverInfo);

                respondWithJSON(res, result || '');
            }
            catch (err) {
                respond500(res, err.toString());
            }
        }
        else
            respond500(res, 'Session is not opened in proxy');
    }

    _onTaskScriptRequest (req, res, serverInfo, isIframe) {
        var referer     = req.headers['referer'];
        var refererDest = referer && urlUtils.parseProxyUrl(referer);
        var session     = refererDest && this.openSessions[refererDest.sessionId];

        if (session) {
            res.setHeader('content-type', 'application/x-javascript');
            preventCaching(res);
            res.end(session.getTaskScript(referer, refererDest.destUrl, serverInfo, isIframe, true));
        }
        else
            respond500(res);
    }

    _onRequest (req, res, serverInfo) {
        // NOTE: Not a service request, execute the proxy pipeline.
        if (!this._route(req, res, serverInfo))
            runRequestPipeline(req, res, serverInfo, this.openSessions);
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

    openSession (url, session, proxyUrl) {
        session.proxy                 = this;
        this.openSessions[session.id] = session;

        if (proxyUrl !== void 0)
            session.setExternalProxySettings(proxyUrl);

        return urlUtils.getProxyUrl(url, {
            proxyHostname: this.server1Info.hostname,
            proxyPort:     this.server1Info.port,
            sessionId:     session.id
        });
    }

    closeSession (session) {
        session.proxy = null;
        delete this.openSessions[session.id];
    }
}
