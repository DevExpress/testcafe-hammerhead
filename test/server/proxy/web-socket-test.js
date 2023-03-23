const WebSocket             = require('ws');
const selfSignedCertificate = require('openssl-self-signed-certificate');
const https                 = require('https');
const { getFreePort }       = require('endpoint-utils');

const {
    createDestinationServer,
    getBasicProxyUrl,
    createSession,
    createAndStartProxy,
} = require('../common/utils');

const promisifyEvent = require('promisify-event');
const { expect }     = require('chai');

describe('WebSocket', () => {
    let session     = null;
    let destServer  = null;
    let proxy       = null;
    let httpsServer = null;
    let wsServer    = null;
    let wssServer   = null;

    function getProxyUrl (url, resourceType, reqOrigin, credentials, isCrossDomain, currentSession = session) {
        return getBasicProxyUrl(url, resourceType, reqOrigin, credentials, isCrossDomain, currentSession);
    }

    before(() => {
        const sameDomainDestinationServer = createDestinationServer();

        destServer = sameDomainDestinationServer.server;

        httpsServer = https.createServer({
            key:  selfSignedCertificate.key,
            cert: selfSignedCertificate.cert,
        }, () => void 0).listen(2001);
        wsServer    = new WebSocket.Server({
            server: destServer,
            path:   '/web-socket',
        });
        wssServer   = new WebSocket.Server({
            server: httpsServer,
            path:   '/secure-web-socket',
        });

        const wsConnectionHandler = (ws, req) => {
            ws.on('message', msg => {
                if (msg === 'get origin header')
                    ws.send(req.headers['origin']);
                else if (msg === 'get cookie header')
                    ws.send(req.headers['cookie']);
                else
                    ws.send(msg);
            });
        };

        wsServer.on('connection', wsConnectionHandler);
        wssServer.on('connection', wsConnectionHandler);
    });

    after(() => {
        destServer.close();
        wsServer.close();
        wssServer.close();
        httpsServer.close();
    });

    beforeEach(() => {
        session = createSession();
        proxy   = createAndStartProxy();
    });

    afterEach(() => {
        proxy.close();
    });

    const askSocket = (ws, msg) => new Promise(resolve => {
        ws.once('message', resolve);
        ws.send(msg);
    });

    it('Should proxy WebSocket', () => {
        const url = getProxyUrl('http://127.0.0.1:2000/web-socket', { isWebSocket: true }, 'http://example.com');

        proxy.openSession('http://127.0.0.1:2000/', session);
        session.cookies.setByServer('http://127.0.0.1:2000', 'key=value');

        const ws = new WebSocket(url, { origin: 'http://example.com' });

        return new Promise(resolve => ws.on('open', resolve))
            .then(() => askSocket(ws, 'get origin header'))
            .then(msg => {
                expect(msg).eql('http://example.com');

                return askSocket(ws, 'get cookie header');
            })
            .then(msg => {
                expect(msg).eql('key=value');

                return askSocket(ws, 'echo');
            })
            .then(msg => {
                expect(msg).eql('echo');

                const wsCloseEventPromise = promisifyEvent(ws, 'close');

                ws.close();

                return wsCloseEventPromise;
            });
    });

    it('Should proxy secure WebSocket', () => {
        const url = getProxyUrl('https://127.0.0.1:2001/secure-web-socket', { isWebSocket: true }, 'http://example.com');

        proxy.openSession('https://127.0.0.1:2001/', session);

        const ws = new WebSocket(url, { origin: 'http://example.com' });

        return new Promise(resolve => ws.on('open', resolve))
            .then(() => askSocket(ws, 'get origin header'))
            .then(msg => {
                expect(msg).eql('http://example.com');

                const wsCloseEventPromise = promisifyEvent(ws, 'close');

                ws.close();

                return wsCloseEventPromise;
            });
    });

    it('Should not throws an proxy error when server is not available', done => {
        const url = getProxyUrl('http://127.0.0.1:2003/ws', { isWebSocket: true },
            encodeURIComponent('http://example.com'));

        proxy.openSession('http://127.0.0.1:2003/', session);

        const ws = new WebSocket(url);

        ws.on('error', err => expect(err.message).eql('socket hang up'));
        ws.on('close', () => done());
    });

    it('Should close webSocket from server side', done => {
        getFreePort()
            .then(port => {
                const url = getProxyUrl('http://127.0.0.1:' + port, { isWebSocket: true });

                proxy.openSession('http://127.0.0.1:2000/', session);

                const wsTemporaryServer = new WebSocket.Server({ port }, () => {
                    const ws = new WebSocket(url);

                    ws.on('close', code => {
                        expect(code).eql(1013);
                        wsTemporaryServer.close(done);
                    });
                });

                wsTemporaryServer.on('connection', ws => ws.close(1013));
            });
    });

    it('Should send/receive message', done => {
        getFreePort()
            .then(port => {
                const url = getProxyUrl('http://localhost:' + port, { isWebSocket: true });

                proxy.openSession('http://127.0.0.1:2000/', session);

                const wsTemporaryServer = new WebSocket.Server({ port: port }, () => {
                    const ws = new WebSocket(url);

                    ws.on('message', message => {
                        expect(message).eql('foobar');
                        wsTemporaryServer.close(done);
                    });
                });

                wsTemporaryServer.on('connection', ws => ws.send('foobar'));
            });
    });

    it('Should not call the "handlePageError" method even if a request has the "text/html" accept', done => {
        const url = getProxyUrl('http://127.0.0.1:2003/ws', { isWebSocket: true },
            encodeURIComponent('http://example.com'));

        proxy.openSession('http://127.0.0.1:2003/', session);

        const ws = new WebSocket(url, { headers: { 'accept': 'text/html' } });

        const timeout = setTimeout(() => {
            expect(true).eql(true);
            done();
        }, 2000);

        session.handlePageError = () => {
            expect(false).eql(true);
            clearTimeout(timeout);
            done();
        };

        ws.on('error', err => expect(err.message).eql('socket hang up'));
    });
});
