const http                    = require('http');
const https                   = require('https');
const urlLib                  = require('url');
const net                     = require('net');
const request                 = require('request-promise-native');
const { expect }              = require('chai');
const selfSignedCertificate   = require('openssl-self-signed-certificate');
const Session                 = require('../../lib/session');
const { createAndStartProxy } = require('./common/utils');

const sockets = [];

function startSocketsCollecting (server) {
    server.on('connection', socket => {
        sockets.push(socket);
        socket.on('close', () => sockets.splice(sockets.indexOf(socket), 1));
    });
}

function closeSockets () {
    sockets.forEach(socket => socket.destroy());
}

function formatAuthHeader (auth) {
    return 'Basic ' + Buffer.from(auth).toString('base64');
}

describe('External proxy', () => {
    let httpServer  = null;
    let httpsServer = null;
    let proxyServer = null;
    let proxyLogs   = null;

    let proxyServerAuthorizationFail = false;

    let proxy   = null;
    let session = null;

    before(() => {
        session = new Session();

        session.getAuthCredentials = () => null;
        session.handleFileDownload = () => void 0;
        session.handleAttachment   = () => void 0;

        proxy = createAndStartProxy();

        httpServer  = http.createServer((req, res) => res.end(req.url)).listen(2000);
        httpsServer = https.createServer({
            key:  selfSignedCertificate.key,
            cert: selfSignedCertificate.cert,
        }, (req, res) => res.end(req.url)).listen(2001);

        proxyServer = http
            .createServer((req, res) => {
                proxyLogs.push({
                    url:  req.url,
                    auth: req.headers['proxy-authorization'],
                });

                if (proxyServerAuthorizationFail) {
                    res.writeHead(407, {});
                    res.end();
                    return;
                }

                const reqOptions = urlLib.parse(req.url);

                reqOptions.method  = req.method;
                reqOptions.headers = req.headers;

                const serverReq = http.request(reqOptions, serverRes => {
                    res.writeHead(serverRes.statusCode, serverRes.headers);
                    serverRes.pipe(res);
                });

                req.pipe(serverReq);
            })
            .on('connect', (req, clientSocket, head) => {
                proxyLogs.push({
                    url:  req.url,
                    auth: req.headers['proxy-authorization'],
                });

                if (proxyServerAuthorizationFail) {
                    clientSocket.write('HTTP/1.1 407 Proxy Authentication Required\r\n' +
                                       'Proxy-agent: Node.js-Proxy\r\n' +
                                       '\r\n');
                    return;
                }

                const serverUrl    = urlLib.parse('http://' + req.url);
                const serverSocket = net.connect(serverUrl.port, serverUrl.hostname, () => {
                    clientSocket.write('HTTP/1.1 200 Connection Established\r\n' +
                                       'Proxy-agent: Node.js-Proxy\r\n' +
                                       '\r\n');
                    serverSocket.write(head);
                    serverSocket.pipe(clientSocket);
                    clientSocket.pipe(serverSocket);
                });
            })
            .listen(2002);

        startSocketsCollecting(httpServer);
        startSocketsCollecting(httpsServer);
        startSocketsCollecting(proxyServer);
    });

    beforeEach(() => {
        proxyLogs = [];
    });

    after(() => {
        proxyServer.close();
        httpServer.close();
        httpsServer.close();
        proxy.close();
        closeSockets();
    });

    it('Should set up a settings correctly', () => {
        session.setExternalProxySettings(null);
        expect(session.externalProxySettings).eql(null);

        session.setExternalProxySettings(234);
        expect(session.externalProxySettings).eql(null);

        const url         = 'admin:admin@127.0.0.1:2002';
        const bypassRules = ['localhost'];

        session.setExternalProxySettings({ url, bypassRules });

        expect(session.externalProxySettings).eql({
            host:        '127.0.0.1:2002',
            hostname:    '127.0.0.1',
            port:        '2002',
            proxyAuth:   'admin:admin',
            authHeader:  formatAuthHeader('admin:admin'),
            bypassRules: ['localhost'],
        });

        session.setExternalProxySettings('127.0.0.1');
        expect(session.externalProxySettings).eql({
            host:     '127.0.0.1',
            hostname: '127.0.0.1',
        });

        session.setExternalProxySettings('login:pass@127.0.0.1');
        expect(session.externalProxySettings).eql({
            host:       '127.0.0.1',
            hostname:   '127.0.0.1',
            proxyAuth:  'login:pass',
            authHeader: formatAuthHeader('login:pass'),
        });

        session.setExternalProxySettings('127.0.0.1:1920');
        expect(session.externalProxySettings).eql({
            host:     '127.0.0.1:1920',
            hostname: '127.0.0.1',
            port:     '1920',
        });
    });

    it('Should send the http request through the proxy', () => {
        session.setExternalProxySettings('127.0.0.1:2002');

        const proxyUrl = proxy.openSession('http://127.0.0.1:2000/path', session);

        return request(proxyUrl)
            .then(body => {
                expect(body).eql('/path');
                expect(proxyLogs.length).eql(1);
                expect(proxyLogs[0].url).eql('http://127.0.0.1:2000/path');
                expect(proxyLogs[0].auth).to.be.undefined;
            });
    });

    it('Should send the https request through the proxy', () => {
        session.setExternalProxySettings('127.0.0.1:2002');

        const proxyUrl = proxy.openSession('https://127.0.0.1:2001/path', session);

        return request(proxyUrl)
            .then(body => {
                expect(body).eql('/path');
                expect(proxyLogs.length).eql(1);
                expect(proxyLogs[0].url).eql('127.0.0.1:2001');
                expect(proxyLogs[0].auth).to.be.undefined;
            });
    });

    it('Should send the http request through the proxy with auth', () => {
        const proxyUrl = proxy.openSession('http://127.0.0.1:2000/path', session, 'login:pass@127.0.0.1:2002');

        return request(proxyUrl)
            .then(body => {
                expect(body).eql('/path');
                expect(proxyLogs.length).eql(1);
                expect(proxyLogs[0].url).eql('http://127.0.0.1:2000/path');
                expect(proxyLogs[0].auth).eql(formatAuthHeader('login:pass'));
            });
    });

    it('Should send the https request through the proxy with auth', () => {
        const proxyUrl = proxy.openSession('https://127.0.0.1:2001/path', session, 'login:pass@127.0.0.1:2002');

        return request(proxyUrl)
            .then(body => {
                expect(body).eql('/path');
                expect(proxyLogs.length).eql(1);
                expect(proxyLogs[0].url).eql('127.0.0.1:2001');
                expect(proxyLogs[0].auth).eql(formatAuthHeader('login:pass'));
            });
    });

    it('Should raise the tunneling error', done => {
        session.handlePageError = (ctx, err) => {

            expect(err).eql('Cannot establish a tunnel to <a href="127.0.0.1:2055">127.0.0.1:2055</a>.' +
                            ' The proxy may be unresponsive or unable to handle HTTPS connections.');
            ctx.res.end();
            done();
        };

        const proxyUrl = proxy.openSession('https://127.0.0.1:2001/path', session, '127.0.0.1:2055');

        request({
            url:     proxyUrl,
            headers: {
                accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*!/!*;q=0.8',
            },
        });
    });

    it('Should raise the proxy connection error', done => {
        session.handlePageError = (ctx, err) => {
            expect(err).eql('Failed to connect to the proxy host at <a href="127.0.0.1:2055">127.0.0.1:2055</a>.');
            ctx.res.end();
            done();
        };

        const proxyUrl = proxy.openSession('http://127.0.0.1:2000/path', session, 'x:y@127.0.0.1:2055');

        request({
            url:     proxyUrl,
            headers: {
                accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*!/!*;q=0.8',
            },
        });
    });

    it('Should raise the error for non-authorized proxy', done => {
        proxyServerAuthorizationFail = true;

        session.handlePageError = (ctx, err) => {
            expect(err).eql('Failed to authorize to the proxy at <a href="127.0.0.1:2002">127.0.0.1:2002</a>.');
            ctx.res.end();
            proxyServerAuthorizationFail = false;
            done();
        };

        const proxyUrl = proxy.openSession('http://127.0.0.1:2000/path', session, 'login:passwd@127.0.0.1:2002');

        request({
            url:     proxyUrl,
            headers: {
                accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*!/!*;q=0.8',
            },
        });
    });

    it('Should raise the error for non-authorized tunneling proxy', done => {
        proxyServerAuthorizationFail = true;

        session.handlePageError = (ctx, err) => {
            expect(err).eql('Failed to authorize to the proxy at <a href="127.0.0.1:2002">127.0.0.1:2002</a>.');
            ctx.res.end();
            proxyServerAuthorizationFail = false;
            done();
        };

        const proxyUrl = proxy.openSession('https://127.0.0.1:2001/path', session, 'login:passwd@127.0.0.1:2002');

        request({
            url:     proxyUrl,
            headers: {
                accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*!/!*;q=0.8',
            },
        });
    });

    describe('Should handle proxy bypass requests', () => {
        it('http', () => {
            session.setExternalProxySettings({ url: '127.0.0.1:2002', bypassRules: ['127.0.0.1:2000'] });

            const proxyUrl = proxy.openSession('http://127.0.0.1:2000/path', session);

            return request(proxyUrl)
                .then(body => {
                    expect(body).eql('/path');
                    expect(proxyLogs.length).eql(0);
                    expect(session.externalProxySettings).eql({
                        host:        '127.0.0.1:2002',
                        hostname:    '127.0.0.1',
                        port:        '2002',
                        bypassRules: ['127.0.0.1:2000'],
                    });
                });
        });

        it('https', () => {
            session.setExternalProxySettings({ url: '127.0.0.1:2002', bypassRules: ['127.0.0.1:2001'] });

            const proxyUrl = proxy.openSession('https://127.0.0.1:2001/path', session);

            return request(proxyUrl)
                .then(body => {
                    expect(body).eql('/path');
                    expect(proxyLogs.length).eql(0);
                    expect(session.externalProxySettings).eql({
                        host:        '127.0.0.1:2002',
                        hostname:    '127.0.0.1',
                        port:        '2002',
                        bypassRules: ['127.0.0.1:2001'],
                    });
                });
        });
    });
});
