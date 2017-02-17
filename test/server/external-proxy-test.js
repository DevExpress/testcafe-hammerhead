var http                        = require('http');
var urlLib                      = require('url');
var net                         = require('net');
var request                     = require('request');
var path                        = require('path');
var expect                      = require('chai').expect;
var createSelfSignedHttpsServer = require('self-signed-https');
var Proxy                       = require('../../lib/proxy');
var Session                     = require('../../lib/session');


var proxyLogs = null;
var sockets   = [];

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

function onRequest (req, res) {
    var options = urlLib.parse(req.url);

    proxyLogs.push({
        url:  req.url,
        auth: req.headers['proxy-authorization']
    });

    options.method  = req.method;
    options.headers = req.headers;

    var proxyReq = http.request(options);

    proxyReq.on('response', function (proxyRes) {
        proxyRes.on('data', function (chunk) {
            res.write(chunk, 'binary');
        });
        proxyRes.on('end', function () {
            res.end();
        });
        res.writeHead(proxyRes.statusCode, proxyRes.headers);
    });
    req.on('data', function (chunk) {
        proxyReq.write(chunk, 'binary');
    });
    req.on('end', function () {
        proxyReq.end();
    });
}

function onConnect (req, socketReq, head) {
    var parsedUrl = urlLib.parse('http://' + req.url);

    proxyLogs.push({
        url:  req.url,
        auth: req.headers['proxy-authorization']
    });

    var socket = net.connect(parsedUrl.port, parsedUrl.hostname, function () {
        socket.write(head);
        socketReq.write('HTTP/' + req.httpVersion + ' 200 Connection established\r\n\r\n');
    });

    socket
        .on('data', function (chunk) {
            socketReq.write(chunk);
        })
        .on('end', function () {
            socketReq.end();
        })
        .on('error', function () {
            socketReq.write('HTTP/' + req.httpVersion + ' 500 Connection error\r\n\r\n');
            socketReq.end();
        });

    socketReq
        .on('data', function (chunk) {
            socket.write(chunk);
        })
        .on('end', function () {
            socket.end();
        })
        .on('error', function () {
            socket.end();
        });
}

describe('External proxy', function () {
    var httpServer       = null;
    var httpsServer      = null;
    var simpleHttpProxy  = null;
    var simpleHttpsProxy = null;

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

        simpleHttpProxy = http
            .createServer(onRequest)
            .on('connect', onConnect)
            .listen(2002);

        simpleHttpsProxy = createSelfSignedHttpsServer(onRequest)
            .on('connect', onConnect)
            .listen(2003);

        startSocketsCollecting(httpServer);
        startSocketsCollecting(httpsServer);
        startSocketsCollecting(simpleHttpProxy);
        startSocketsCollecting(simpleHttpsProxy);
    });

    beforeEach(function () {
        proxyLogs = [];
    });

    afterEach(function () {
        session.setExternalProxySettings(null);
    });

    after(function () {
        simpleHttpProxy.close();
        simpleHttpsProxy.close();
        httpServer.close();
        httpsServer.close();
        proxy.close();
        closeSockets();
    });

    it('Should set up a settings correctly', function () {
        session.setExternalProxySettings('http://127.0.0.1:2002');
        expect(session.externalProxySettings).eql({
            protocol:    'http:',
            host:        '127.0.0.1:2002',
            hostname:    '127.0.0.1',
            port:        '2002',
            auth:        null,
            ignoreHosts: []
        });

        session.setExternalProxySettings('http://127.0.0.1', ['127.0.0.1:2000']);
        expect(session.externalProxySettings).eql({
            protocol:    'http:',
            host:        '127.0.0.1',
            hostname:    '127.0.0.1',
            port:        null,
            auth:        null,
            ignoreHosts: ['127.0.0.1:2000']
        });

        session.setExternalProxySettings('//127.0.0.1:2002', 25);
        expect(session.externalProxySettings).eql({
            protocol:    'http:',
            host:        '127.0.0.1:2002',
            hostname:    '127.0.0.1',
            port:        '2002',
            auth:        null,
            ignoreHosts: []
        });

        session.setExternalProxySettings('127.0.0.1:2002');
        expect(session.externalProxySettings).eql({
            protocol:    'http:',
            host:        '127.0.0.1:2002',
            hostname:    '127.0.0.1',
            port:        '2002',
            auth:        null,
            ignoreHosts: []
        });

        session.setExternalProxySettings('http://pass:1234@127.0.0.1:2002', [69, null, '127.0.0.1:2000']);
        expect(session.externalProxySettings).eql({
            protocol:    'http:',
            host:        '127.0.0.1:2002',
            hostname:    '127.0.0.1',
            port:        '2002',
            auth:        'pass:1234',
            ignoreHosts: ['127.0.0.1:2000']
        });
    });

    it('Should send request through proxy (http over http)', function (done) {
        session.setExternalProxySettings('http://127.0.0.1:2002');

        var url      = 'http://127.0.0.1:2000/HttpOverHttp';
        var proxyUrl = proxy.openSession(url, session);

        request(proxyUrl, function (err, res, body) {
            expect(body).eql('/HttpOverHttp');
            expect(proxyLogs.length).eql(1);
            expect(proxyLogs[0].url).eql(url);
            expect(proxyLogs[0].auth).to.be.undefined;
            done();
        });
    });

    it('Should send request through proxy (https over http)', function (done) {
        session.setExternalProxySettings('http://127.0.0.1:2002');

        var url      = 'https://127.0.0.1:2001/HttpsOverHttp';
        var proxyUrl = proxy.openSession(url, session);

        request(proxyUrl, function (err, res, body) {
            expect(body).eql('/HttpsOverHttp');
            expect(proxyLogs.length).eql(1);
            expect(proxyLogs[0].url).eql('127.0.0.1:2001');
            expect(proxyLogs[0].auth).to.be.undefined;
            done();
        });
    });

    it('Should send request through proxy (http over https)', function (done) {
        session.setExternalProxySettings('https://127.0.0.1:2003');

        var url      = 'http://127.0.0.1:2000/HttpOverHttps';
        var proxyUrl = proxy.openSession(url, session);

        request(proxyUrl, function (err, res, body) {
            expect(body).eql('/HttpOverHttps');
            expect(proxyLogs.length).eql(1);
            expect(proxyLogs[0].url).eql(url);
            expect(proxyLogs[0].auth).to.be.undefined;
            done();
        });
    });

    it('Should send request through proxy (https over https)', function (done) {
        session.setExternalProxySettings('https://127.0.0.1:2003');

        var url      = 'https://127.0.0.1:2001/';
        var proxyUrl = proxy.openSession(url, session);

        request(proxyUrl, function (err, res, body) {
            expect(body).eql('/');
            expect(proxyLogs.length).eql(1);
            expect(proxyLogs[0].url).eql('127.0.0.1:2001');
            expect(proxyLogs[0].auth).to.be.undefined;
            done();
        });
    });

    it('Should not send request through proxy for file protocol', function (done) {
        session.setExternalProxySettings('http://127.0.0.1:2002');

        var url      = 'file:///' + path.resolve(__dirname, './data/stylesheet/src.css').replace(/\\/g, '/');
        var proxyUrl = proxy.openSession(url, session);

        request(proxyUrl, function () {
            expect(proxyLogs.length).eql(0);
            done();
        });
    });

    it('Should send request through proxy with basic auth', function (done) {
        session.setExternalProxySettings('http://pass:1234@127.0.0.1:2002');

        var url      = 'http://127.0.0.1:2000/';
        var proxyUrl = proxy.openSession(url, session);

        request(proxyUrl, function (err, res, body) {
            expect(body).eql('/');
            expect(proxyLogs.length).eql(1);
            expect(proxyLogs[0].url).eql(url);
            expect(proxyLogs[0].auth).eql('Basic ' + new Buffer('pass:1234').toString('base64'));
            done();
        });
    });

    it('Should ignore hosts from settings', function (done) {
        session.setExternalProxySettings('http://127.0.0.1:2002', ['127.0.0.1:2000']);

        var url      = 'http://127.0.0.1:2000/';
        var proxyUrl = proxy.openSession(url, session);

        request(proxyUrl, function () {
            expect(proxyLogs.length).eql(0);
            done();
        });
    });
});
