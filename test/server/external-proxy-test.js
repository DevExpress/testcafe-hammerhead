var http                        = require('http');
var urlLib                      = require('url');
var net                         = require('net');
var request                     = require('request');
var expect                      = require('chai').expect;
var createSelfSignedHttpsServer = require('self-signed-https');
var Proxy                       = require('../../lib/proxy');
var Session                     = require('../../lib/session');

var sockets = [];

function startSocketsCollecting (server) {
    server.on('connection', function (socket) {
        sockets.push(socket);
        socket.on('close', function () {
            sockets.splice(sockets.indexOf(socket), 1);
        });
    });
}

function closeSockets () {
    sockets.forEach(function (socket) {
        socket.destroy();
    });
}

function formatAuthHeader (auth) {
    return 'Basic ' + new Buffer(auth).toString('base64');
}

describe('External proxy', function () {
    var httpServer  = null;
    var httpsServer = null;
    var proxyServer = null;
    var proxyLogs   = null;

    var proxyServerAuthorizationFail = false;

    var proxy   = null;
    var session = null;

    before(function () {
        session = new Session();

        session.getAuthCredentials = function () {
            return null;
        };

        session.handleFileDownload = function () {
        };

        proxy = new Proxy('127.0.0.1', 1836, 1837);

        httpServer = http.createServer(function (req, res) {
            res.end(req.url);
        }).listen(2000);

        httpsServer = createSelfSignedHttpsServer(function (req, res) {
            res.end(req.url);
        }).listen(2001);

        proxyServer = http
            .createServer(function (req, res) {
                proxyLogs.push({
                    url:  req.url,
                    auth: req.headers['proxy-authorization']
                });

                if (proxyServerAuthorizationFail) {
                    res.writeHead(407, {});
                    res.end();
                    return;
                }

                var reqOptions = urlLib.parse(req.url);

                reqOptions.method  = req.method;
                reqOptions.headers = req.headers;

                var serverReq = http.request(reqOptions, function (serverRes) {
                    res.writeHead(serverRes.statusCode, serverRes.headers);
                    serverRes.pipe(res);
                });

                req.pipe(serverReq);
            })
            .on('connect', function (req, clientSocket, head) {
                proxyLogs.push({
                    url:  req.url,
                    auth: req.headers['proxy-authorization']
                });

                if (proxyServerAuthorizationFail) {
                    clientSocket.write('HTTP/1.1 407 Proxy Authentication Required\r\n' +
                                       'Proxy-agent: Node.js-Proxy\r\n' +
                                       '\r\n');
                    return;
                }

                var serverUrl    = urlLib.parse('http://' + req.url);
                var serverSocket = net.connect(serverUrl.port, serverUrl.hostname, function () {
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

    beforeEach(function () {
        proxyLogs = [];
    });

    after(function () {
        proxyServer.close();
        httpServer.close();
        httpsServer.close();
        proxy.close();
        closeSockets();
    });

    it('Should set up a settings correctly', function () {
        session.setExternalProxySettings(null);
        expect(session.externalProxySettings).eql(null);

        session.setExternalProxySettings(234);
        expect(session.externalProxySettings).eql(null);

        session.setExternalProxySettings('admin:admin@127.0.0.1:2002');
        expect(session.externalProxySettings).eql({
            host:       '127.0.0.1:2002',
            hostname:   '127.0.0.1',
            port:       '2002',
            proxyAuth:  'admin:admin',
            authHeader: formatAuthHeader('admin:admin')
        });

        session.setExternalProxySettings('127.0.0.1');
        expect(session.externalProxySettings).eql({
            host:     '127.0.0.1',
            hostname: '127.0.0.1'
        });

        session.setExternalProxySettings('login:pass@127.0.0.1');
        expect(session.externalProxySettings).eql({
            host:       '127.0.0.1',
            hostname:   '127.0.0.1',
            proxyAuth:  'login:pass',
            authHeader: formatAuthHeader('login:pass')
        });

        session.setExternalProxySettings('127.0.0.1:1920');
        expect(session.externalProxySettings).eql({
            host:     '127.0.0.1:1920',
            hostname: '127.0.0.1',
            port:     '1920'
        });
    });

    it('Should send the http request through the proxy', function (done) {
        session.setExternalProxySettings('127.0.0.1:2002');

        var proxyUrl = proxy.openSession('http://127.0.0.1:2000/path', session);

        request(proxyUrl, function (err, res, body) {
            expect(body).eql('/path');
            expect(proxyLogs.length).eql(1);
            expect(proxyLogs[0].url).eql('http://127.0.0.1:2000/path');
            expect(proxyLogs[0].auth).to.be.undefined;
            done();
        });
    });

    it('Should send the https request through the proxy', function (done) {
        session.setExternalProxySettings('127.0.0.1:2002');

        var proxyUrl = proxy.openSession('https://127.0.0.1:2001/path', session);

        request(proxyUrl, function (err, res, body) {
            expect(body).eql('/path');
            expect(proxyLogs.length).eql(1);
            expect(proxyLogs[0].url).eql('127.0.0.1:2001');
            expect(proxyLogs[0].auth).to.be.undefined;
            done();
        });
    });

    it('Should send the http request through the proxy with auth', function (done) {
        var proxyUrl = proxy.openSession('http://127.0.0.1:2000/path', session, 'login:pass@127.0.0.1:2002');

        request(proxyUrl, function (err, res, body) {
            expect(body).eql('/path');
            expect(proxyLogs.length).eql(1);
            expect(proxyLogs[0].url).eql('http://127.0.0.1:2000/path');
            expect(proxyLogs[0].auth).eql(formatAuthHeader('login:pass'));
            done();
        });
    });

    it('Should send the https request through the proxy with auth', function (done) {
        var proxyUrl = proxy.openSession('https://127.0.0.1:2001/path', session, 'login:pass@127.0.0.1:2002');

        request(proxyUrl, function (err, res, body) {
            expect(body).eql('/path');
            expect(proxyLogs.length).eql(1);
            expect(proxyLogs[0].url).eql('127.0.0.1:2001');
            expect(proxyLogs[0].auth).eql(formatAuthHeader('login:pass'));
            done();
        });
    });

    it('Should raise the tunneling error', function (done) {
        session.handlePageError = function (ctx, err) {
            expect(err).eql('Failed to connect to the proxy. Cannot establish tunneling connection to the host at <a href="127.0.0.1:2055">127.0.0.1:2055</a>.');
            ctx.res.end();
            done();
        };

        var proxyUrl = proxy.openSession('https://127.0.0.1:2001/path', session, '127.0.0.1:2055');

        request({
            url:     proxyUrl,
            headers: {
                accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*!/!*;q=0.8'
            }
        });
    });

    it('Should raise the proxy connection error', function (done) {
        session.handlePageError = function (ctx, err) {
            expect(err).eql('Failed to connect to the proxy host at <a href="127.0.0.1:2055">127.0.0.1:2055</a>.');
            ctx.res.end();
            done();
        };

        var proxyUrl = proxy.openSession('http://127.0.0.1:2000/path', session, 'x:y@127.0.0.1:2055');

        request({
            url:     proxyUrl,
            headers: {
                accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*!/!*;q=0.8'
            }
        });
    });

    it('Should raise the error for non-authorized proxy', function (done) {
        proxyServerAuthorizationFail = true;

        session.handlePageError = function (ctx, err) {
            expect(err).eql('Failed to authorize to the proxy at <a href="127.0.0.1:2002">127.0.0.1:2002</a>.');
            ctx.res.end();
            proxyServerAuthorizationFail = false;
            done();
        };

        var proxyUrl = proxy.openSession('http://127.0.0.1:2000/path', session, 'login:passwd@127.0.0.1:2002');

        request({
            url:     proxyUrl,
            headers: {
                accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*!/!*;q=0.8'
            }
        });
    });

    it('Should raise the error for non-authorized tunneling proxy', function (done) {
        proxyServerAuthorizationFail = true;

        session.handlePageError = function (ctx, err) {
            expect(err).eql('Failed to authorize to the proxy at <a href="127.0.0.1:2002">127.0.0.1:2002</a>.');
            ctx.res.end();
            proxyServerAuthorizationFail = false;
            done();
        };

        var proxyUrl = proxy.openSession('https://127.0.0.1:2001/path', session, 'login:passwd@127.0.0.1:2002');

        request({
            url:     proxyUrl,
            headers: {
                accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*!/!*;q=0.8'
            }
        });
    });
});
