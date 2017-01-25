var Promise                              = require('pinkie');
var fs                                   = require('fs');
var os                                   = require('os');
var http                                 = require('http');
var urlLib                               = require('url');
var request                              = require('request');
var path                                 = require('path');
var expect                               = require('chai').expect;
var express                              = require('express');
var read                                 = require('read-file-relative').readSync;
var createSelfSignedHttpsServer          = require('self-signed-https');
var getFreePort                          = require('endpoint-utils').getFreePort;
var COMMAND                              = require('../../lib/session/command');
var XHR_HEADERS                          = require('../../lib/request-pipeline/xhr/headers');
var SAME_ORIGIN_CHECK_FAILED_STATUS_CODE = require('../../lib/request-pipeline/xhr/same-origin-policy').SAME_ORIGIN_CHECK_FAILED_STATUS_CODE;
var Proxy                                = require('../../lib/proxy');
var Session                              = require('../../lib/session');
var DestinationRequest                   = require('../../lib/request-pipeline/destination-request');
var RequestPipelineContext               = require('../../lib/request-pipeline/context');
var requestAgent                         = require('../../lib/request-pipeline/destination-request/agent');
var scriptHeader                         = require('../../lib/processing/script/header').HEADER;
var urlUtils                             = require('../../lib/utils/url');

var EMPTY_PAGE = '<html></html>';

function trim (str) {
    return str.replace(/^\s+|\s+$/g, '');
}

function normalizeNewLine (str) {
    return str.replace(/\r\n/g, '\n');
}

function normalizeCode (code) {
    return trim(code
        .replace(/(\r\n|\n|\r)/gm, ' ')
        .replace(/'/gm, '"')
        .replace(/\s+/gm, ' '));
}

function compareCode (code1, code2) {
    expect(normalizeCode(code1)).eql(normalizeCode(code2));
}

function newLineReplacer (content) {
    return new Buffer(content.toString().replace(/\r\n|\n/gm, '\r\n'));
}

describe('Proxy', function () {
    var destServer        = null;
    var crossDomainServer = null;
    var proxy             = null;
    var session           = null;

    // NOTE: Fixture setup/teardown.
    before(function () {
        var app = express();

        app.post('/', function (req, res) {
            var data = '';

            req.on('data', function (chunk) {
                data += chunk.toString();
            });

            req.on('end', function () {
                res.end(data);
            });
        });

        app.get('/304', function (req, res) {
            res.status(304);
            res.set({
                'content-type':     req.headers['x-content-type'],
                'content-encoding': 'gzip',
                'content-length':   0
            });
            res.end();
        });

        app.get('/', function (req, res) {
            res.end(req.url);
        });

        app.get('/cookie/set-and-redirect', function (req, res) {
            res.statusCode = 302;

            res.set('set-cookie', 'Test=value; Path=/cookie');
            res.set('set-cookie', 'Test2=' + new Array(350).join('(big cookie)'));
            res.set('set-cookie', 'value without key');
            res.set('location', '/cookie/echo');

            res.end();
        });

        app.get('/cookie/echo', function (req, res) {
            res.end(req.headers['cookie']);
        });

        app.get('/page', function (req, res) {
            res.set('content-type', 'text/html');
            res.end(fs.readFileSync('test/server/data/page/src.html').toString());
        });

        app.get('/page-with-frameset', function (req, res) {
            res.set('content-type', 'text/html');
            res.end(fs.readFileSync('test/server/data/page-with-frameset/src.html').toString());
        });

        app.get('/script', function (req, res) {
            res.set('content-type', 'application/javascript; charset=utf-8');
            res.end(fs.readFileSync('test/server/data/script/src.js').toString());
        });

        app.get('/stylesheet', function (req, res) {
            res.end(fs.readFileSync('test/server/data/stylesheet/src.css').toString());
        });

        app.get('/manifest', function (req, res) {
            res.set('content-type', 'text/cache-manifest');
            res.end(fs.readFileSync('test/server/data/manifest/src.manifest')).toString();
        });

        app.get('/xhr-origin/allow-any', function (req, res) {
            res.set('access-control-allow-origin', '*');
            res.end('42');
        });

        app.get('/xhr-origin/allow-provided', function (req, res) {
            res.set('access-control-allow-origin', req.headers['x-allow-origin']);
            res.end('42');
        });

        app.get('/page/plain-text', function (req, res) {
            res.set('content-encoding', 'gzip');
            res.set('content-type', 'text/html; charset=utf-8');
            res.end('42');
        });

        app.get('/download', function (req, res) {
            res.set('content-disposition', 'attachment;filename=DevExpressTestCafe-15.1.2.exe');
            res.end(EMPTY_PAGE);

        });

        app.options('/preflight', function (req, res) {
            res.end('42');
        });

        app.get('/with-auth', function (req, res) {
            var authHeader = req.headers['authorization'];

            if (authHeader) {
                var expectedAuthCredentials = 'testUsername:testPassword';
                var expectedAuthHeader      = 'Basic ' + new Buffer(expectedAuthCredentials).toString('base64');

                if (authHeader === expectedAuthHeader) {
                    res.end('42');
                    return;
                }
            }

            res.status(401);
            res.set('www-authenticate', 'Basic');
            res.end();
        });

        app.get('/B234325,GH-284/reply-with-origin', function (req, res) {
            res.set('access-control-allow-origin', 'http://example.com');
            res.end(req.headers['origin']);
        });

        app.get('/Q557255/page-without-content-type', function (req, res) {
            res.set('content-encoding', 'gzip');
            res.end('42');
        });

        app.get('/T232505/is-cookie-header-sent', function (req, res) {
            var headerSent = req.headers['cookie'] !== void 0;

            res.end(headerSent.toString());
        });

        app.get('/T224541/hang-forever', function () {
            // Just hang forever...
        });

        app.get('/B239430/empty-page', function (req, res) {
            res.set('content-type', 'text/html; charset=utf-8');
            res.end();
        });

        app.get('/GH-306/empty-resource', function (req, res) {
            res.set({
                'content-type':   req.headers['x-resource-type'],
                'content-length': 0
            });
            res.status(204);
            res.end();
        });

        app.get('/T239167/send-location', function (req, res) {
            res.writeHead(200, { 'location': 'http://127.0.0.1:2000/\u0410\u0411' });
            res._send('');
            res.end();
        });

        app.get('/GH-390/redirect-302-with-body', function (req, res) {
            res.writeHead(302, {
                'content-type': 'text/plain',
                'location':     'http://127.0.0.1:2002/'
            });

            res.write('body');

            setTimeout(res.end.bind(res), 1000);
        });

        app.post('/upload-info', function (req, res) {
            var chunks = [];

            req.on('data', function (chunk) {
                chunks.push(chunk);
            });
            req.on('end', function () {
                res.end(Buffer.concat(chunks).toString());
            });
        });

        app.get('/echo-headers', function (req, res) {
            res.json(req.headers);
        });

        app.get('/empty-response', function (req, res) {
            for (var header in req.headers)
                res.set(header, req.headers[header]);

            res.end();
        });

        app.get('/wait/:ms', function (req, res) {
            setTimeout(function () {
                res.end('text');
            }, req.params.ms);
        });

        app.get('/GH-1014/pdf-content-type', function (req, res) {
            res.set('content-type', 'content-type');
            res.end('pdf');
        });

        app.get('/GH-1014/empty-page-without-content-type/', function (req, res) {
            res.end('');
        });

        destServer = app.listen(2000);


        var crossDomainApp = express();

        crossDomainApp.get('/without-access-control-allow-origin-header', function (req, res) {
            res.set('content-type', 'text/html');
            res.end(EMPTY_PAGE);
        });

        crossDomainApp.get('/echo-headers', function (req, res) {
            res.setHeader('access-control-allow-origin', '*');

            res.json(req.headers);
        });

        crossDomainApp.get('/echo-headers-with-credentials', function (req, res) {
            res.setHeader('access-control-allow-origin', 'http://127.0.0.1:2000');
            res.setHeader('access-control-allow-credentials', 'true');

            res.json(req.headers);
        });

        crossDomainServer = crossDomainApp.listen(2002);
    });

    after(function () {
        destServer.close();
        crossDomainServer.close();
    });


    // NOTE: Test setup/teardown.
    beforeEach(function () {
        session = new Session();

        session.getAuthCredentials = function () {
            return null;
        };

        session.handleFileDownload = function () {
        };

        proxy = new Proxy('127.0.0.1', 1836, 1837);
    });

    afterEach(function () {
        proxy.close();
        requestAgent.resetKeepAliveConnections();
    });


    // Tests
    describe('Session', function () {
        it('Should pass DNS errors to session', function (done) {
            session.handlePageError = function (ctx, err) {
                expect(err).eql('Failed to find a DNS-record for the resource at <a href="http://www.some-unresolvable.url">http://www.some-unresolvable.url</a>.');
                ctx.res.end();
                done();
                return true;
            };

            var options = {
                url:     proxy.openSession('http://www.some-unresolvable.url', session),
                headers: {
                    accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*!/!*;q=0.8'
                }
            };

            request(options);
        });

        it('Should pass protocol DNS errors for existing host to session', function (done) {
            session.handlePageError = function (ctx, err) {
                expect(err).eql('Failed to find a DNS-record for the resource at <a href="https://127.0.0.1:2000">https://127.0.0.1:2000</a>.');
                ctx.res.end();
                done();
                return true;
            };

            var options = {
                url:     proxy.openSession('https://127.0.0.1:2000', session),
                headers: {
                    accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*!/!*;q=0.8'
                }
            };

            request(options);
        });

        it('Should pass service message processing to session', function (done) {
            var options = {
                method: 'POST',
                url:    'http://localhost:1836/messaging',
                body:   JSON.stringify({
                    cmd:       'ServiceTestCmd',
                    data:      '42',
                    sessionId: session.id
                })
            };

            proxy.openSession('http://example.com', session);

            session['ServiceTestCmd'] = function (msg, serverInfo) {
                expect(serverInfo).to.be.an('object');
                return 'answer: ' + msg.data;
            };

            request(options, function (err, res, body) {
                expect(JSON.parse(body)).eql('answer: 42');
                done();
            });
        });

        it('Should render task script', function () {
            function testTaskScriptRequest (url, scriptBody) {
                return new Promise(function (resolve) {
                    var options = {
                        url:     url,
                        headers: {
                            referer: proxy.openSession('http://example.com', session)
                        }
                    };

                    request(options, function (err, res, body) {
                        expect(body).contains(scriptBody);
                        expect(res.headers['content-type']).eql('application/x-javascript');
                        expect(res.headers['cache-control']).eql('no-cache, no-store, must-revalidate');
                        expect(res.headers['pragma']).eql('no-cache');
                        resolve();
                    });
                });
            }

            session._getPayloadScript = function () {
                return 'PayloadScript';
            };

            session._getIframePayloadScript = function () {
                return 'IframePayloadScript';
            };

            return Promise.all([
                testTaskScriptRequest('http://localhost:1836/task.js', 'PayloadScript'),
                testTaskScriptRequest('http://localhost:1836/iframe-task.js', 'IframePayloadScript')
            ]);
        });

        it('Should convert origin host and protocol to lower case', function () {
            // BUG: GH-1
            var proxiedUrl = proxy.openSession('hTtp://ExaMple.Com:123/paTh/Image?Name=Value&#Hash', session);

            expect(proxiedUrl).to.have.string('http://example.com:123/paTh/Image?Name=Value&#Hash');
        });

        it('Should handle special pages', function () {
            var specialPageProxyUrls   = urlUtils.SPECIAL_PAGES.map(function (url) {
                return proxy.openSession(url, session);
            });
            var testSpecialPageRequest = function (url) {
                return new Promise(function (resolve) {
                    var options = {
                        url:     url,
                        headers: {
                            accept: 'text/html'
                        }
                    };

                    request(options, function (err, res, body) {
                        expect(body).to.not.empty;
                        resolve();
                    });
                });
            };

            return Promise.all(specialPageProxyUrls.map(testSpecialPageRequest));
        });
    });

    describe('Cookies', function () {
        it('Should process SET_COOKIE service message', function (done) {
            var options = {
                method: 'POST',
                url:    'http://localhost:1836/messaging',
                body:   JSON.stringify({
                    cmd:       COMMAND.setCookie,
                    url:       proxy.openSession('http://example.com', session),
                    cookie:    'Test=Data',
                    sessionId: session.id
                })
            };

            request(options, function (err, res, body) {
                expect(JSON.parse(body)).eql('Test=Data');
                done();
            });
        });

        it('Should handle "Cookie" and "Set-Cookie" headers', function (done) {
            var options = {
                url:            proxy.openSession('http://127.0.0.1:2000/cookie/set-and-redirect', session),
                followRedirect: true
            };

            request(options, function (err, res, body) {
                expect(body).eql('Test=value; value without key');
                done();
            });
        });
    });

    describe('XHR same-origin policy', function () {
        it('Should restrict requests from other domain', function (done) {
            var options = {
                url:     proxy.openSession('http://127.0.0.1:2000/page/plain-text', session),
                headers: {
                    referer: proxy.openSession('http://example.com', session)
                }
            };

            options.headers[XHR_HEADERS.requestMarker] = 'true';

            request(options, function (err, res, body) {
                expect(res.statusCode).eql(SAME_ORIGIN_CHECK_FAILED_STATUS_CODE);
                expect(body).to.be.empty;
                done();
            });
        });

        it('Should restrict preflight requests from other domain', function (done) {
            var options = {
                method:  'OPTIONS',
                url:     proxy.openSession('http://127.0.0.1:2000/preflight', session),
                headers: {
                    referer: proxy.openSession('http://example.com', session)
                }
            };

            options.headers[XHR_HEADERS.requestMarker] = 'true';

            request(options, function (err, res, body) {
                expect(res.statusCode).eql(SAME_ORIGIN_CHECK_FAILED_STATUS_CODE);
                expect(body).to.be.empty;
                done();
            });
        });

        it('Should allow preflight requests from other domain if CORS is enabled', function (done) {
            var options = {
                method:  'OPTIONS',
                url:     proxy.openSession('http://127.0.0.1:2000/preflight', session),
                headers: {
                    referer: proxy.openSession('http://example.com', session)
                }
            };

            options.headers[XHR_HEADERS.requestMarker] = 'true';
            options.headers[XHR_HEADERS.corsSupported] = 'true';

            request(options, function (err, res, body) {
                expect(res.statusCode).eql(200);
                expect(body).eql('42');
                done();
            });
        });

        it('Should allow requests from other domain if CORS is enabled and allowed origin is wildcard ', function (done) {
            var options = {
                url:     proxy.openSession('http://127.0.0.1:2000/xhr-origin/allow-any', session),
                headers: {
                    referer: proxy.openSession('http://example.com', session)
                }
            };

            options.headers[XHR_HEADERS.requestMarker] = 'true';
            options.headers[XHR_HEADERS.corsSupported] = 'true';

            request(options, function (err, res, body) {
                expect(res.statusCode).eql(200);
                expect(body).eql('42');
                done();
            });
        });

        it('Should allow requests from other domain if CORS is enabled and origin is allowed', function (done) {
            var options = {
                url:     proxy.openSession('http://127.0.0.1:2000/xhr-origin/allow-provided', session),
                headers: {
                    referer:          proxy.openSession('http://example.com', session),
                    'x-allow-origin': 'http://example.com'
                }
            };

            options.headers[XHR_HEADERS.requestMarker] = 'true';
            options.headers[XHR_HEADERS.corsSupported] = 'true';

            request(options, function (err, res, body) {
                expect(res.statusCode).eql(200);
                expect(body).eql('42');
                done();
            });
        });

        it('Should allow requests from other domain if it is "not modified" (GH-617)', function (done) {
            var options = {
                url:     proxy.openSession('http://127.0.0.1:2000/304', session),
                headers: {
                    referer:             proxy.openSession('http://example.com', session),
                    'if-modified-since': 'Thu, 01 Aug 2013 18:31:48 GMT'
                }
            };

            options.headers[XHR_HEADERS.requestMarker] = 'true';

            request(options, function (err, res) {
                expect(res.statusCode).eql(304);
                done();
            });
        });
    });

    describe('Fetch', function () {
        describe('Credential modes', function () {
            describe('Omit', function () {
                it('Should omit cookie and pass authorization headers for same-domain request', function (done) {
                    session.cookies.setByClient('http://127.0.0.1:2000', 'key=value');

                    var options = {
                        url:     proxy.openSession('http://127.0.0.1:2000/echo-headers', session),
                        headers: {
                            referer:       proxy.openSession('http://127.0.0.1:2000', session),
                            cookie:        'key=value',
                            authorization: 'value'
                        }
                    };

                    options.headers[XHR_HEADERS.fetchRequestCredentials] = 'omit';

                    request(options, function (err, res, body) {
                        var requestHeaders = JSON.parse(body);

                        expect(requestHeaders.cookie).to.be.undefined;
                        expect(requestHeaders.authorization).eql('value');

                        done();
                    });
                });

                it('Should omit cookie and pass authorization headers for cross-domain request', function (done) {
                    session.cookies.setByClient('http://127.0.0.1:2000', 'key=value');

                    var options = {
                        url:     proxy.openSession('http://127.0.0.1:2002/echo-headers', session),
                        headers: {
                            referer:       proxy.openSession('http://127.0.0.1:2000', session),
                            cookie:        'key=value',
                            authorization: 'value'
                        }
                    };

                    options.headers[XHR_HEADERS.fetchRequestCredentials] = 'omit';

                    request(options, function (err, res, body) {
                        var requestHeaders = JSON.parse(body);

                        expect(requestHeaders.cookie).to.be.undefined;
                        expect(requestHeaders.authorization).eql('value');

                        done();
                    });
                });
            });

            describe('Same-origin', function () {
                it('Should pass cookie and pass authorization headers for same-domain request', function (done) {
                    session.cookies.setByClient('http://127.0.0.1:2000', 'key=value');

                    var options = {
                        url:     proxy.openSession('http://127.0.0.1:2000/echo-headers', session),
                        headers: {
                            referer:       proxy.openSession('http://127.0.0.1:2000', session),
                            cookie:        'key=value',
                            authorization: 'value'
                        }
                    };

                    options.headers[XHR_HEADERS.fetchRequestCredentials] = 'same-origin';

                    request(options, function (err, res, body) {
                        var requestHeaders = JSON.parse(body);

                        expect(requestHeaders.cookie).eql('key=value');
                        expect(requestHeaders.authorization).eql('value');

                        done();
                    });
                });

                it('Should omit cookie and pass authorization headers for cross-domain request', function (done) {
                    session.cookies.setByClient('http://127.0.0.1:2000', 'key=value');

                    var options = {
                        url:     proxy.openSession('http://127.0.0.1:2002/echo-headers', session),
                        headers: {
                            referer:       proxy.openSession('http://127.0.0.1:2000', session),
                            cookie:        'key=value',
                            authorization: 'value'
                        }
                    };

                    options.headers[XHR_HEADERS.fetchRequestCredentials] = 'same-origin';

                    request(options, function (err, res, body) {
                        var requestHeaders = JSON.parse(body);

                        expect(requestHeaders.cookie).to.be.undefined;
                        expect(requestHeaders.authorization).eql('value');

                        done();
                    });
                });
            });

            describe('Include', function () {
                it('Should pass cookie and authorization headers for same-domain request', function (done) {
                    session.cookies.setByClient('http://127.0.0.1:2000', 'key=value');

                    var options = {
                        url:     proxy.openSession('http://127.0.0.1:2000/echo-headers', session),
                        headers: {
                            referer:       proxy.openSession('http://127.0.0.1:2000', session),
                            cookie:        'key=value',
                            authorization: 'value'
                        }
                    };

                    options.headers[XHR_HEADERS.fetchRequestCredentials] = 'include';

                    request(options, function (err, res, body) {
                        var requestHeaders = JSON.parse(body);

                        expect(requestHeaders.cookie).eql('key=value');
                        expect(requestHeaders.authorization).eql('value');

                        done();
                    });
                });

                it('Should pass cookie and authorization headers for cross-domain request', function (done) {
                    session.cookies.setByClient('http://127.0.0.1:2000', 'key=value');

                    var options = {
                        url:     proxy.openSession('http://127.0.0.1:2002/echo-headers-with-credentials', session),
                        headers: {
                            referer:       proxy.openSession('http://127.0.0.1:2000', session),
                            cookie:        'key=value',
                            authorization: 'value'
                        }
                    };

                    options.headers[XHR_HEADERS.fetchRequestCredentials] = 'include';

                    request(options, function (err, res, body) {
                        var requestHeaders = JSON.parse(body);

                        expect(requestHeaders.cookie).eql('key=value');
                        expect(requestHeaders.authorization).eql('value');

                        done();
                    });
                });
            });
        });
    });

    describe('Content processing', function () {
        it('Should process pages', function (done) {
            session.id = 'sessionId';
            session.injectable.scripts.push('/script1.js');
            session.injectable.scripts.push('/script2.js');
            session.injectable.styles.push('/styles1.css');
            session.injectable.styles.push('/styles2.css');

            var options = {
                url:     proxy.openSession('http://127.0.0.1:2000/page', session),
                headers: {
                    accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*!/!*;q=0.8'
                }
            };

            request(options, function (err, res, body) {
                var expected = fs.readFileSync('test/server/data/page/expected.html').toString();

                compareCode(body, expected);
                done();
            });
        });

        it('Should not process XHR page requests', function (done) {
            var options = {
                url:     proxy.openSession('http://127.0.0.1:2000/page', session),
                headers: {
                    accept:  'text/html,application/xhtml+xml,application/xml;q=0.9,*!/!*;q=0.8',
                    referer: proxy.openSession('http://127.0.0.1:2000/', session)
                }
            };

            options.headers[XHR_HEADERS.requestMarker] = 'true';

            request(options, function (err, res, body) {
                var expected = fs.readFileSync('test/server/data/page/src.html').toString();

                compareCode(body, expected);
                done();
            });
        });

        it('Should not process Fetch page requests', function (done) {
            var options = {
                url:     proxy.openSession('http://127.0.0.1:2000/page', session),
                headers: {
                    accept:  'text/html,application/xhtml+xml,application/xml;q=0.9,*!/!*;q=0.8',
                    referer: proxy.openSession('http://127.0.0.1:2000/', session)
                }
            };

            options.headers[XHR_HEADERS.fetchRequestCredentials] = 'omit';

            request(options, function (err, res, body) {
                var expected = fs.readFileSync('test/server/data/page/src.html').toString();

                compareCode(body, expected);
                done();
            });
        });

        it('Should process scripts', function (done) {
            session.id = 1337;

            request(proxy.openSession('http://127.0.0.1:2000/script', session), function (err, res, body) {
                var expected = fs.readFileSync('test/server/data/script/expected.js').toString();

                expect(normalizeNewLine(body)).eql(normalizeNewLine(expected));
                done();
            });
        });

        it('Should process manifests', function (done) {
            session.id = 'sessionId';

            request(proxy.openSession('http://127.0.0.1:2000/manifest', session), function (err, res, body) {
                var expected = fs.readFileSync('test/server/data/manifest/expected.manifest').toString();

                compareCode(body, expected);
                done();
            });
        });

        it('Should process stylesheets', function (done) {
            session.id = 'sessionId';

            var options = {
                url:     proxy.openSession('http://127.0.0.1:2000/stylesheet', session),
                headers: {
                    accept: 'text/css'
                }
            };

            request(options, function (err, res, body) {
                var expected = fs.readFileSync('test/server/data/stylesheet/expected.css').toString();

                compareCode(body, expected);
                done();
            });
        });

        it('Should process upload info', function (done) {
            var src      = newLineReplacer(fs.readFileSync('test/server/data/upload/src.formdata'));
            var expected = newLineReplacer(fs.readFileSync('test/server/data/upload/expected.formdata'));

            var options = {
                url:     proxy.openSession('http://127.0.0.1:2000/upload-info', session),
                method:  'POST',
                body:    src,
                headers: {
                    'content-type': 'multipart/form-data; boundary=separator',
                    'accept':       'text/plain;q=0.9,*!/!*;q=0.8'
                }
            };

            request(options, function (err, res, body) {
                expect(body).eql(expected.toString());
                done();
            });
        });

        it('Should not process file download', function (done) {
            var options = {
                url:     proxy.openSession('http://127.0.0.1:2000/download', session),
                method:  'GET',
                headers: {
                    accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*!/!*;q=0.8'
                }
            };

            request(options, function (err, res, body) {
                expect(body).eql(EMPTY_PAGE);
                done();
            });
        });

        it('Should not process "not modified" resources (GH-817)', function () {
            var mimeTypes = ['text/cache-manifest', 'text/css', 'text/html', 'text/javascript'];

            return Promise.all(mimeTypes.map(function (mimeType, index) {
                return new Promise(function (resolve) {
                    var options = {
                        url:     proxy.openSession('http://127.0.0.1:2000/304', session),
                        headers: {
                            'x-content-type': mimeType
                        }
                    };

                    if (index % 2)
                        options.headers['if-modified-since'] = 'Thu, 01 Aug 2013 18:31:48 GMT';
                    else
                        options.headers['if-none-match'] = '42dc7c04442557f8937f89ecdc993077';

                    request(options, function (err, res, body) {
                        expect(body).eql('');
                        expect(res.statusCode).eql(304);
                        expect(res.headers['content-length']).eql('0');
                        resolve();
                    });
                });
            }));
        });
    });

    describe('Shadow UI', function () {
        it('Should process shadow ui stylesheet', function (done) {
            var src      = read('/data/shadow-ui-stylesheet/src.css').toString();
            var expected = read('/data/shadow-ui-stylesheet/expected.css').toString();

            proxy.GET('/testcafe-ui-styles.css', {
                contentType:          'text/css',
                content:              src,
                isShadowUIStylesheet: true
            });

            request('http://127.0.0.1:1836/testcafe-ui-styles.css', function (err, res, body) {
                expect(body.replace(/\r\n|\n/g, '')).equal(expected.replace(/\r\n|\n/g, ''));

                done();
            });
        });
    });

    describe('HTTPS', function () {
        var httpsServer = null;

        before(function () {
            var httpsApp = express();

            httpsApp.get('/answer', function (req, res) {
                res.send('42');
            });

            httpsServer = createSelfSignedHttpsServer(httpsApp).listen(2001);
        });

        after(function () {
            httpsServer.close();
        });

        it('Should proxy unauthorized HTTPS pages', function (done) {
            var url = proxy.openSession('https://127.0.0.1:2001/answer', session);

            request(url, function (err, res, body) {
                expect(body).eql('42');
                done();
            });
        });
    });

    describe('file protocol', function () {
        var getFileProtocolUrl = function (filePath) {
            return path.resolve(__dirname, filePath).replace(/\\/g, '/');
        };

        it('Should process page and ignore search string', function (done) {
            session.id = 'sessionId';
            session.injectable.scripts.push('/script1.js');
            session.injectable.scripts.push('/script2.js');
            session.injectable.styles.push('/styles1.css');
            session.injectable.styles.push('/styles2.css');

            var options = {
                url: proxy.openSession('file:///' + getFileProtocolUrl('./data/page/src.html') + '?a=1&b=3', session),

                headers: {
                    accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*!/!*;q=0.8'
                }
            };

            request(options, function (err, res, body) {
                var expected = fs.readFileSync('test/server/data/page/expected.html').toString();

                compareCode(body, expected);
                done();
            });
        });

        it('Should process stylesheets', function (done) {
            session.id = 'sessionId';

            var options = {
                url:     proxy.openSession('file:///' + getFileProtocolUrl('./data/stylesheet/src.css'), session),
                headers: {
                    accept: 'text/css,*/*;q=0.1'
                }
            };

            request(options, function (err, res, body) {
                var expected = fs.readFileSync('test/server/data/stylesheet/expected.css').toString();

                compareCode(body, expected);
                done();
            });
        });

        it('Should process page with absolute urls', function (done) {
            session.id = 'sessionId';

            var filePostfix = os.platform() === 'win32' ? 'win' : 'nix';
            var filePath    = getFileProtocolUrl('./data/page-with-file-protocol/src-' + filePostfix + '.html');

            var options = {
                url:     proxy.openSession('file:///' + filePath, session),
                headers: {
                    accept: 'text/html,*/*;q=0.1'
                }
            };

            request(options, function (err, res, body) {
                var expected = fs.readFileSync('test/server/data/page-with-file-protocol/expected-' + filePostfix +
                                               '.html').toString();

                compareCode(body, expected);
                done();
            });
        });
    });

    describe('Regression', function () {
        it('Should force "Origin" header for the same-domain requests (B234325)', function (done) {
            var options = {
                url:     proxy.openSession('http://127.0.0.1:2000/B234325,GH-284/reply-with-origin', session),
                headers: {
                    referer: proxy.openSession('http://example.com', session)
                }
            };

            options.headers[XHR_HEADERS.requestMarker] = 'true';
            options.headers[XHR_HEADERS.corsSupported] = 'true';

            request(options, function (err, res, body) {
                expect(body).eql('http://example.com');
                done();
            });
        });

        it('Should not send "Cookie" header if there are no cookies for the given URL (T232505)', function (done) {
            var url = proxy.openSession('http://127.0.0.1:2000/T232505/is-cookie-header-sent', session);

            request(url, function (err, res, body) {
                expect(JSON.parse(body)).to.be.false;
                done();
            });
        });

        it('Should raise error on request timeout (T224541)', function (done) {
            var savedReqTimeout = DestinationRequest.TIMEOUT;

            DestinationRequest.TIMEOUT = 200;

            session.handlePageError = function (ctx, err) {
                expect(err).eql('Failed to complete a request to <a href="http://127.0.0.1:2000/T224541/hang-forever">' +
                                'http://127.0.0.1:2000/T224541/hang-forever</a> within the timeout period. ' +
                                'The problem may be related to local machine\'s network or firewall settings, server outage, ' +
                                'or network problems that make the server inaccessible.');
                ctx.res.end();
                DestinationRequest.TIMEOUT = savedReqTimeout;
                done();
                return true;
            };

            var options = {
                url:     proxy.openSession('http://127.0.0.1:2000/T224541/hang-forever', session),
                headers: {
                    accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*!/!*;q=0.8'
                }
            };

            request(options);
        });

        it('Should use a special timeout for xhr requests (GH-347)', function (done) {
            var savedReqTimeout    = DestinationRequest.TIMEOUT;
            var savedXhrReqTimeout = DestinationRequest.XHR_TIMEOUT;

            DestinationRequest.TIMEOUT     = 100;
            DestinationRequest.XHR_TIMEOUT = 200;

            var options = {
                url:     proxy.openSession('http://127.0.0.1:2000/T224541/hang-forever', session),
                headers: {
                    accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*!/!*;q=0.8'
                }
            };

            options.headers[XHR_HEADERS.requestMarker] = 'true';

            var requestTime = Date.now();

            request(options, function (err, res) {
                var responseTime = Date.now();

                expect(res.statusCode).eql(500);
                expect(responseTime - requestTime).above(DestinationRequest.XHR_TIMEOUT);

                DestinationRequest.TIMEOUT     = savedReqTimeout;
                DestinationRequest.XHR_TIMEOUT = savedXhrReqTimeout;
                done();
            });
        });

        // NOTE: Requires fix in node.js.
        it.skip('Should not encode cyrillic symbols in header (T239167, GH-nodejs/io.js#1693)', function (done) {
            var url              = proxy.openSession('http://127.0.0.1:2000/T239167/send-location', session);
            var expectedLocation = proxy.openSession('http://127.0.0.1:2000/\u0410\u0411', session);

            request(url, function (err, res) {
                expect(res.headers['location']).eql(expectedLocation);
                done();
            });
        });

        it('Should process empty pages (B239430)', function (done) {
            var options = {
                url:     proxy.openSession('http://127.0.0.1:2000/B239430/empty-page', session),
                headers: {
                    accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*!/!*;q=0.8'
                }
            };

            request(options, function (err, res, body) {
                var expected = fs.readFileSync('test/server/data/empty-page/expected.html').toString();

                compareCode(body, expected);
                done();
            });
        });

        it('Should process pages with status 204 and return status 200 instead (GH-306)', function (done) {
            var options = {
                url:     proxy.openSession('http://127.0.0.1:2000/GH-306/empty-resource', session),
                headers: {
                    accept:            'text/html,application/xhtml+xml,application/xml;q=0.9,*!/!*;q=0.8',
                    'x-resource-type': 'text/html; charset=utf-8'
                }
            };

            request(options, function (err, res, body) {
                var expected = fs.readFileSync('test/server/data/empty-page/expected.html').toString();

                compareCode(body, expected);
                expect(res.statusCode).eql(200);
                expect(res.headers['content-length']).eql(body.length.toString());

                done();
            });
        });

        it('Should not process script with the html "accept" header as a page', function (done) {
            var url     = proxy.openSession('http://127.0.0.1:2000/script', session);
            var options = {
                url:     url.replace(/^(.*?\/\/.*?\/.*?)(\/.*)$/, '$1!script$2'),
                headers: {
                    accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*!/!*;q=0.8'
                }
            };

            request(options, function (err, res, body) {
                expect(res.statusCode).eql(200);
                expect(body).to.contain(scriptHeader);

                done();
            });
        });

        it('Should not process assets with status 204 (GH-306)', function () {
            function testSourceWithStatus204 (mimeType) {
                return new Promise(function (resolve) {
                    var options = {
                        url:     proxy.openSession('http://127.0.0.1:2000/GH-306/empty-resource', session),
                        headers: {
                            'x-resource-type': mimeType
                        }
                    };

                    request(options, function (err, res, body) {
                        expect(body).eql('');
                        expect(res.statusCode).eql(204);
                        resolve();
                    });
                });
            }

            return Promise.all([
                testSourceWithStatus204('application/javascript'),
                testSourceWithStatus204('text/cache-manifest'),
                testSourceWithStatus204('text/css')
            ]);
        });

        it('Should transform the "Origin" header for requests without the "Referer" header correctly (GH-284)', function (done) {
            var options = {
                url:     proxy.openSession('http://127.0.0.1:2000/B234325,GH-284/reply-with-origin', session),
                headers: { origin: 'http://127.0.0.1:1836' }
            };

            options.headers[XHR_HEADERS.origin]        = 'http://example.com';
            options.headers[XHR_HEADERS.requestMarker] = 'true';
            options.headers[XHR_HEADERS.corsSupported] = 'true';

            request(options, function (err, res, body) {
                expect(body).eql('http://example.com');

                done();
            });
        });

        it('Should return 204 status code instead of 200 for the empty form submission response (GH-373)', function (done) {
            var url     = proxy.openSession('http://127.0.0.1:2000/GH-306/empty-resource', session);
            var options = {
                url:     url.replace(session.id, session.id + '!f'),
                headers: {
                    accept:            'text/html,application/xhtml+xml,application/xml;q=0.9,*!/!*;q=0.8',
                    'x-resource-type': 'text/html; charset=utf-8'
                }
            };

            request(options, function (err, res) {
                expect(res.statusCode).eql(204);
                done();
            });
        });

        it('Should pass ECONNREFUSED error to session (GH-446)', function (done) {
            getFreePort()
                .then(function (port) {
                    var host = 'http://127.0.0.1:' + port;

                    session.handlePageError = function (ctx, err) {
                        expect(err).eql('Failed to find a DNS-record for the resource at <a href="' + host + '">' +
                                        host + '</a>.');
                        ctx.res.end();
                        done();
                        return true;
                    };

                    var options = {
                        url:     proxy.openSession(host, session),
                        headers: {
                            accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*!/!*;q=0.8'
                        }
                    };

                    request(options);
                });
        });

        it('Should send a response without waiting for the end of the destination response and without processing its body (GH-390)', function (done) {
            var url           = proxy.openSession('http://127.0.0.1:2000/GH-390/redirect-302-with-body', session);
            var opts          = urlLib.parse(url);
            var startTestTime = Date.now();

            opts.method = 'GET';

            http.request(opts)
                .on('response', function (res) {
                    expect(Date.now() - startTestTime < 100).to.be.true;

                    var chunks = [];

                    res.on('data', function (chunk) {
                        chunks.push(chunk);
                    });

                    res.on('end', function () {
                        expect(Date.now() - startTestTime > 1000).to.be.true;
                        expect(chunks.join('')).equal('body');

                        done();
                    });
                })
                .end();
        });

        it("Should close with error if destination server doesn't provide Access-Control-Allow-Origin header for cross-domain requests", function (done) {
            var options = {
                url:     proxy.openSession('http://127.0.0.1:2002/without-access-control-allow-origin-header', session),
                headers: {
                    referer: proxy.openSession('http://example.com', session)
                }
            };

            options.headers[XHR_HEADERS.requestMarker] = 'true';
            options.headers[XHR_HEADERS.corsSupported] = 'true';

            request(options, function (err, res) {
                expect(res.statusCode).eql(SAME_ORIGIN_CHECK_FAILED_STATUS_CODE);
                done();
            });
        });

        it('Should not send cookie and authorization headers to the cross-domain destination server for the xhr request without credentials (GH-545)', function (done) {
            session.cookies.setByClient('http://example.com', 'key=value');

            var options = {
                url:     proxy.openSession('http://127.0.0.1:2002/echo-headers', session),
                headers: {
                    referer:               proxy.openSession('http://example.com', session),
                    cookie:                'key=value',
                    authorization:         'value',
                    'authentication-info': 'value',
                    'proxy-authenticate':  'value',
                    'proxy-authorization': 'value'
                }
            };

            options.headers[XHR_HEADERS.requestMarker] = true;
            options.headers[XHR_HEADERS.corsSupported] = true;

            request(options, function (err, res, body) {
                var requestHeaders = JSON.parse(body);

                expect(requestHeaders.cookie).to.be.undefined;
                expect(requestHeaders.authorization).to.be.undefined;
                expect(requestHeaders['authentication-info']).to.be.undefined;
                expect(requestHeaders['proxy-authenticate']).to.be.undefined;
                expect(requestHeaders['proxy-authorization']).to.be.undefined;

                done();
            });
        });

        it('Should remove hammerhead xhr headers before sending a request to the destination server', function (done) {
            var options = {
                url:     proxy.openSession('http://127.0.0.1:2002/echo-headers-with-credentials', session),
                headers: {
                    referer: proxy.openSession('http://127.0.0.1:2000', session)
                }
            };

            options.headers[XHR_HEADERS.requestMarker]           = 'true';
            options.headers[XHR_HEADERS.corsSupported]           = 'true';
            options.headers[XHR_HEADERS.withCredentials]         = 'true';
            options.headers[XHR_HEADERS.origin]                  = 'origin_value';
            options.headers[XHR_HEADERS.fetchRequestCredentials] = 'omit';

            request(options, function (err, res, body) {
                var requestHeaders = JSON.parse(body);

                expect(requestHeaders[XHR_HEADERS.requestMarker]).to.be.undefined;
                expect(requestHeaders[XHR_HEADERS.corsSupported]).to.be.undefined;
                expect(requestHeaders[XHR_HEADERS.withCredentials]).to.be.undefined;
                expect(requestHeaders[XHR_HEADERS.origin]).to.be.undefined;
                expect(requestHeaders[XHR_HEADERS.fetchRequestCredentials]).to.be.undefined;

                done();
            });
        });

        it('Should remove hammerhead xhr headers before sending a request to the destination server', function (done) {
            var options = {
                url:     proxy.openSession('http://127.0.0.1:2002/echo-headers-with-credentials', session),
                headers: {
                    referer: proxy.openSession('http://127.0.0.1:2000', session)
                }
            };

            options.headers[XHR_HEADERS.requestMarker]           = 'true';
            options.headers[XHR_HEADERS.corsSupported]           = 'true';
            options.headers[XHR_HEADERS.withCredentials]         = 'true';
            options.headers[XHR_HEADERS.origin]                  = 'origin_value';
            options.headers[XHR_HEADERS.fetchRequestCredentials] = 'omit';

            request(options, function (err, res, body) {
                var requestHeaders = JSON.parse(body);

                expect(requestHeaders[XHR_HEADERS.requestMarker]).to.be.undefined;
                expect(requestHeaders[XHR_HEADERS.corsSupported]).to.be.undefined;
                expect(requestHeaders[XHR_HEADERS.withCredentials]).to.be.undefined;
                expect(requestHeaders[XHR_HEADERS.origin]).to.be.undefined;
                expect(requestHeaders[XHR_HEADERS.fetchRequestCredentials]).to.be.undefined;

                done();
            });
        });

        it('Should add a leading slash to the pathname part of url (GH-608)', function (done) {
            var options = {
                url: proxy.openSession('http://127.0.0.1:2000?key=value', session)
            };

            request(options, function (err, res, body) {
                expect(body).eql('/?key=value');
                done();
            });
        });

        it("Should omit default ports from destination request and 'referrer' header urls (GH-738)", function () {
            var testCases              = [
                {
                    url:          'http://example.com:80',
                    expectedHost: 'example.com',
                    expectedPort: ''
                },
                {
                    url:          'http://example.com:8080',
                    expectedHost: 'example.com:8080',
                    expectedPort: '8080'
                },
                {
                    url:          'https://example.com:443',
                    expectedHost: 'example.com',
                    expectedPort: ''
                },
                {
                    url:          'https://example.com:443443',
                    expectedHost: 'example.com:443443',
                    expectedPort: '443443'
                },
                {
                    url:          '<value>',
                    referer:      'http://example.com:80',
                    expectedHost: 'example.com',
                    expectedPort: ''
                },
                {
                    url:          '<value>',
                    referer:      'http://example.com:8080',
                    expectedHost: 'example.com:8080',
                    expectedPort: '8080'
                },
                {
                    url:          '<value>',
                    referer:      'https://example.com:443',
                    expectedHost: 'example.com',
                    expectedPort: ''
                },
                {
                    url:          '<value>',
                    referer:      'https://example.com:443443',
                    expectedHost: 'example.com:443443',
                    expectedPort: '443443'
                }
            ];
            var req                    = {
                headers: {
                    accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*!/!*;q=0.8'
                }
            };
            var requestPipelineContext = new RequestPipelineContext(req, {}, {});

            for (var i = 0; i < testCases.length; i++) {
                requestPipelineContext.req.url = proxy.openSession(testCases[i].url, session);
                if (testCases[i].referer)
                    requestPipelineContext.req.headers.referer = proxy.openSession(testCases[i].referer, session);

                requestPipelineContext.dispatch(proxy.openSessions);

                expect(requestPipelineContext.dest.host).eql(testCases[i].expectedHost);
                expect(requestPipelineContext.dest.port).eql(testCases[i].expectedPort);
            }
        });

        it('Should not send destination request for special pages (GH-796)', function (done) {
            var rejectionReason = null;

            var options = {
                url: proxy.openSession('about:blank', session),

                headers: {
                    accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*!/!*;q=0.8'
                }
            };

            process.once('unhandledRejection', function (reason) {
                rejectionReason = reason;
            });

            request(options, function () {
                expect(rejectionReason).to.be.null;
                done();
            });
        });

        it("Should handle `about:blank` requests for resources that doesn't require processing (GH-796)", function (done) {
            var options = {
                url: proxy.openSession('about:blank', session),

                headers: {
                    accept: 'application/font'
                }
            };

            request(options, function (err, res, body) {
                expect(body).eql('');
                done();
            });
        });

        describe('Should not change a reponse body if it is empty (GH-762)', function () {
            it('script', function (done) {
                var options = {
                    url:     proxy.openSession('http://127.0.0.1:2000/empty-response', session),
                    headers: {
                        'content-type': 'application/javascript; charset=utf-8'
                    }
                };

                request(options, function (err, res, body) {
                    expect(body).is.empty;
                    done();
                });
            });

            it('style', function (done) {
                var options = {
                    url:     proxy.openSession('http://127.0.0.1:2000/empty-response', session),
                    headers: {
                        'content-type': 'text/css'
                    }
                };

                request(options, function (err, res, body) {
                    expect(body).is.empty;
                    done();
                });
            });
        });

        it('Should abort destination request after fatal error (GH-937)', function (done) {
            var savedReqTimeout      = DestinationRequest.TIMEOUT;
            var fatalErrorEventCount = 0;

            DestinationRequest.TIMEOUT = 100;

            var destReq = new DestinationRequest({
                url:      'http://127.0.0.1:2000/wait/150',
                protocol: 'http:',
                hostname: '127.0.0.1',
                host:     '127.0.0.1:2000',
                port:     2000,
                path:     '/wait/150',
                method:   'GET',
                body:     new Buffer([]),
                isXhr:    false,
                headers:  []
            });

            destReq.on('error', function () {
            });
            destReq.on('fatalError', function () {
                fatalErrorEventCount++;
            });

            setTimeout(function () {
                destReq._onError({ message: 'ECONNREFUSED' });
            }, 50);

            setTimeout(function () {
                DestinationRequest.TIMEOUT = savedReqTimeout;

                expect(fatalErrorEventCount).eql(1);
                done();
            }, 150);
        });

        it('Should process the top "frameset" element like the "body" element (GH-1009)', function (done) {
            session.id = 'sessionId';
            session.injectable.scripts.push('/script1.js');
            session.injectable.scripts.push('/script2.js');

            var options = {
                url:     proxy.openSession('http://127.0.0.1:2000/page-with-frameset', session),
                headers: {
                    accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*!/!*;q=0.8'
                }
            };

            request(options, function (err, res, body) {
                var expected = fs.readFileSync('test/server/data/page-with-frameset/expected.html').toString();

                compareCode(body, expected);
                done();
            });
        });

        it('Should not process a page with the non-page content-type header (GH-1014)', function (done) {
            session.id = 'sessionId';

            var options = {
                url:     proxy.openSession('http://127.0.0.1:2000/GH-1014/pdf-content-type', session),
                headers: {
                    accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*!/!*;q=0.8'
                }
            };

            request(options, function (err, res, body) {
                compareCode(body, 'pdf');
                done();
            });
        });

        it('Should process a page without the content-type header (GH-1014)', function (done) {
            session.id = 'sessionId';

            var options = {
                url:     proxy.openSession('http://127.0.0.1:2000/GH-1014/empty-page-without-content-type/', session),
                headers: {
                    accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*!/!*;q=0.8'
                }
            };

            request(options, function (err, res, body) {
                expect(body).is.not.empty;
                done();
            });
        });
    });
});
