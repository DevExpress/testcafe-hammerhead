'use strict';

const Promise                              = require('pinkie');
const fs                                   = require('fs');
const os                                   = require('os');
const http                                 = require('http');
const urlLib                               = require('url');
const request                              = require('request');
const path                                 = require('path');
const net                                  = require('net');
const expect                               = require('chai').expect;
const express                              = require('express');
const read                                 = require('read-file-relative').readSync;
const createSelfSignedHttpsServer          = require('self-signed-https');
const getFreePort                          = require('endpoint-utils').getFreePort;
const WebSocket                            = require('ws');
const XHR_HEADERS                          = require('../../lib/request-pipeline/xhr/headers');
const AUTHORIZATION                        = require('../../lib/request-pipeline/xhr/authorization');
const SAME_ORIGIN_CHECK_FAILED_STATUS_CODE = require('../../lib/request-pipeline/xhr/same-origin-policy').SAME_ORIGIN_CHECK_FAILED_STATUS_CODE;
const Proxy                                = require('../../lib/proxy');
const Session                              = require('../../lib/session');
const DestinationRequest                   = require('../../lib/request-pipeline/destination-request');
const RequestPipelineContext               = require('../../lib/request-pipeline/context');
const requestAgent                         = require('../../lib/request-pipeline/destination-request/agent');
const scriptHeader                         = require('../../lib/processing/script/header');
const urlUtils                             = require('../../lib/utils/url');

const EMPTY_PAGE = '<html></html>';

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

function getFileProtocolUrl (filePath) {
    return 'file:///' + path.resolve(__dirname, filePath).replace(/\\/g, '/');
}

describe('Proxy', () => {
    let destServer        = null;
    let crossDomainServer = null;
    let proxy             = null;
    let session           = null;

    before(() => {
        const app = express();

        app.post('/', (req, res) => {
            let data = '';

            req.on('data', chunk => {
                data += chunk.toString();
            });
            req.on('end', () => res.end(data));
        });

        app.get('/304', (req, res) => {
            res.status(304);
            res.set({
                'content-type':     req.headers['x-content-type'],
                'content-encoding': 'gzip',
                'content-length':   0
            });
            res.end();
        });

        app.get('/', (req, res) => res.end(req.url));

        app.get('/cookie/set-and-redirect', (req, res) => {
            res.statusCode = 302;

            res.set('set-cookie', 'Test=value; Path=/cookie');
            res.set('set-cookie', 'Test2=' + new Array(350).join('(big cookie)'));
            res.set('set-cookie', 'value without key');
            res.set('location', '/cookie/echo');

            res.end();
        });

        app.get('/cookie/set1', (req, res) => {
            res.set('set-cookie', 'Set1_1=value1');
            res.set('set-cookie', 'Set1_2=value2');

            res.end();
        });

        app.get('/cookie/set2', (req, res) => {
            res.set('set-cookie', 'Set2_1=value1');
            res.set('set-cookie', 'Set2_2=value2');

            res.end();
        });

        app.get('/cookie/echo', (req, res) => {
            res.end('%% ' + req.headers['cookie'] + ' %%');
        });

        app.get('/page', (req, res) => {
            res.set('content-type', 'text/html');
            res.end(fs.readFileSync('test/server/data/page/src.html').toString());
        });

        app.get('/html-import-page', (req, res) => {
            res.set('content-type', 'text/html');
            res.end(fs.readFileSync('test/server/data/html-import-page/src.html').toString());
        });

        app.get('/html-import-page-in-iframe', (req, res) => {
            res.set('content-type', 'text/html');
            res.end(fs.readFileSync('test/server/data/html-import-page/src-iframe.html').toString());
        });

        app.get('/page-with-frameset', (req, res) => {
            res.set('content-type', 'text/html');
            res.end(fs.readFileSync('test/server/data/page-with-frameset/src.html').toString());
        });

        app.get('/script', (req, res) => {
            res.set('content-type', 'application/javascript; charset=utf-8');
            res.set('sourcemap', '/src.js.map');
            res.end(fs.readFileSync('test/server/data/script/src.js').toString());
        });

        app.get('/stylesheet', (req, res) => {
            res.end(fs.readFileSync('test/server/data/stylesheet/src.css').toString());
        });

        app.get('/manifest', (req, res) => {
            res.set('content-type', 'text/cache-manifest');
            res.end(fs.readFileSync('test/server/data/manifest/src.manifest')).toString();
        });

        app.get('/xhr-origin/allow-any', (req, res) => {
            res.set('access-control-allow-origin', '*');
            res.end('42');
        });

        app.get('/xhr-origin/allow-provided', (req, res) => {
            res.set('access-control-allow-origin', req.headers['x-allow-origin']);
            res.end('42');
        });

        app.get('/page/plain-text', (req, res) => {
            res.set('content-encoding', 'gzip');
            res.set('content-type', 'text/html; charset=utf-8');
            res.end('42');
        });

        app.get('/download', (req, res) => {
            res.set('content-disposition', 'attachment;filename=DevExpressTestCafe-15.1.2.exe');
            res.end(EMPTY_PAGE);

        });

        app.options('/preflight', (req, res) => res.end('42'));

        app.get('/with-auth', (req, res) => {
            const authHeader = req.headers['authorization'];

            if (authHeader) {
                const expectedAuthCredentials = 'testUsername:testPassword';
                const expectedAuthHeader      = 'Basic ' + new Buffer(expectedAuthCredentials).toString('base64');

                if (authHeader === expectedAuthHeader) {
                    res.end('42');
                    return;
                }
            }

            res.status(401);
            res.set('www-authenticate', 'Basic');
            res.end();
        });

        app.get('/B234325,GH-284/reply-with-origin', (req, res) => {
            res.set('access-control-allow-origin', 'http://example.com');
            res.end(req.headers['origin']);
        });

        app.get('/GH-1059/reply-with-origin', (req, res) => {
            res.set('access-control-allow-origin', 'http://example.com');
            res.set('access-control-allow-credentials', 'true');
            res.end(req.headers['origin']);
        });

        app.get('/Q557255/page-without-content-type', (req, res) => {
            res.set('content-encoding', 'gzip');
            res.end('42');
        });

        app.get('/T232505/is-cookie-header-sent', (req, res) => {
            const headerSent = req.headers['cookie'] !== void 0;

            res.end(headerSent.toString());
        });

        app.get('/T224541/hang-forever', () => {
            // Just hang forever...
        });

        app.get('/B239430/empty-page', (req, res) => {
            res.set('content-type', 'text/html; charset=utf-8');
            res.end();
        });

        app.get('/GH-306/empty-resource', (req, res) => {
            res.set({
                'content-type':   req.headers['x-resource-type'],
                'content-length': 0
            });
            res.status(204);
            res.end();
        });

        app.get('/T239167/send-location', (req, res) => {
            res.writeHead(200, { 'location': 'http://127.0.0.1:2000/\u0410\u0411' });
            res._send('');
            res.end();
        });

        app.get('/GH-390/redirect-302-with-body', (req, res) => {
            res.writeHead(302, {
                'content-type': 'text/plain',
                'location':     'http://127.0.0.1:2002/'
            });

            res.write('body');

            setTimeout(res.end.bind(res), 1000);
        });

        app.post('/upload-info', (req, res) => {
            const chunks = [];

            req.on('data', chunk => chunks.push(chunk));
            req.on('end', () => res.end(Buffer.concat(chunks).toString()));
        });

        app.get('/echo-headers', (req, res) => res.end(JSON.stringify(req.headers)));

        app.get('/empty-response', (req, res) => {
            for (const header in req.headers)
                res.set(header, req.headers[header]);

            res.end();
        });

        app.get('/wait/:ms', (req, res) => {
            setTimeout(() => res.end('text'), req.params.ms);
        });

        app.get('/GH-1014/pdf-content-type', (req, res) => {
            res.set('content-type', 'content-type');
            res.end('pdf');
        });

        app.get('/GH-1014/empty-page-without-content-type/', (req, res) => res.end(''));

        app.get('/x-frame-options/:value', (req, res) => {
            const value = req.params.value;

            res.setHeader('x-frame-options', value);
            res.end('42');
        });

        app.get('/download-script', (req, res) => {
            res.setHeader('content-disposition', 'attachment; filename="f.txt"');
            res.setHeader('content-type', 'text/javascript; charset=UTF-8');
            res.end('const i = 42;');
        });

        app.get('/redirect/:url', (req, res) => {
            res.writeHead(200, { location: decodeURIComponent(req.params.url) });
            res.end();
        });

        app.get('/referrer-policy', (req, res) => {
            res.setHeader('referrer-policy', 'no-referrer');
            res.end('42');
        });

        app.get('/refresh-header/:url', (req, res) => {
            res.setHeader('refresh', '0;url=' + decodeURIComponent(req.params.url));
            res.end('42');
        });

        destServer = app.listen(2000);

        const crossDomainApp = express();

        crossDomainApp.get('/without-access-control-allow-origin-header', (req, res) => {
            res.set('content-type', 'text/html');
            res.end(EMPTY_PAGE);
        });

        crossDomainApp.get('/echo-headers', (req, res) => {
            res.setHeader('access-control-allow-origin', '*');

            res.json(req.headers);
        });

        crossDomainApp.get('/echo-headers-with-credentials', (req, res) => {
            res.setHeader('access-control-allow-origin', 'http://127.0.0.1:2000');
            res.setHeader('access-control-allow-credentials', 'true');

            res.json(req.headers);
        });

        crossDomainServer = crossDomainApp.listen(2002);
    });

    after(() => {
        destServer.close();
        crossDomainServer.close();
    });

    beforeEach(() => {
        session = new Session();

        session.getAuthCredentials = () => null;
        session.handleFileDownload = () => void 0;

        proxy = new Proxy('127.0.0.1', 1836, 1837);
    });

    afterEach(() => {
        proxy.close();
        requestAgent.resetKeepAliveConnections();
    });

    describe('Session', () => {
        it('Should pass DNS errors to session', done => {
            session.handlePageError = (ctx, err) => {
                expect(err).eql('Failed to find a DNS-record for the resource at <a href="http://www.some-unresolvable.url">http://www.some-unresolvable.url</a>.');
                ctx.res.end();
                done();
                return true;
            };

            const options = {
                url:     proxy.openSession('http://www.some-unresolvable.url', session),
                headers: {
                    accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*!/!*;q=0.8'
                }
            };

            request(options);
        });

        it('Should pass protocol DNS errors for existing host to session', done => {
            session.handlePageError = (ctx, err) => {
                expect(err).eql('Failed to find a DNS-record for the resource at <a href="https://127.0.0.1:2000">https://127.0.0.1:2000</a>.');
                ctx.res.end();
                done();
                return true;
            };

            const options = {
                url:     proxy.openSession('https://127.0.0.1:2000', session),
                headers: {
                    accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*!/!*;q=0.8'
                }
            };

            request(options);
        });

        it('Should pass service message processing to session', done => {
            const options = {
                method: 'POST',
                url:    'http://localhost:1836/messaging',
                body:   JSON.stringify({
                    cmd:       'ServiceTestCmd',
                    data:      '42',
                    sessionId: session.id
                })
            };

            proxy.openSession('http://example.com', session);

            session['ServiceTestCmd'] = (msg, serverInfo) => {
                expect(serverInfo).to.be.an('object');
                return 'answer: ' + msg.data;
            };

            request(options, (err, res, body) => {
                expect(JSON.parse(body)).eql('answer: 42');
                done();
            });
        });

        it('Should render task script', () => {
            function testTaskScriptRequest (url, scriptBody) {
                return new Promise((resolve) => {
                    const options = {
                        url:     url,
                        headers: {
                            referer: proxy.openSession('http://example.com', session)
                        }
                    };

                    request(options, (err, res, body) => {
                        expect(body).contains(scriptBody);
                        expect(res.headers['content-type']).eql('application/x-javascript');
                        expect(res.headers['cache-control']).eql('no-cache, no-store, must-revalidate');
                        expect(res.headers['pragma']).eql('no-cache');
                        resolve();
                    });
                });
            }

            session._getPayloadScript       = () => 'PayloadScript';
            session._getIframePayloadScript = () => 'IframePayloadScript';

            return Promise.all([
                testTaskScriptRequest('http://localhost:1836/task.js', 'PayloadScript'),
                testTaskScriptRequest('http://localhost:1836/iframe-task.js', 'IframePayloadScript')
            ]);
        });

        it('Should convert origin host and protocol to lower case', () => {
            // BUG: GH-1
            const proxiedUrl = proxy.openSession('hTtp://ExaMple.Com:123/paTh/Image?Name=Value&#Hash', session);

            expect(proxiedUrl).to.have.string('http://example.com:123/paTh/Image?Name=Value&#Hash');
        });

        it('Should handle special pages', () => {
            const specialPageProxyUrls   = urlUtils.SPECIAL_PAGES.map(url => proxy.openSession(url, session));
            const testSpecialPageRequest = url => {
                return new Promise(resolve => {
                    const options = {
                        url:     url,
                        headers: {
                            accept: 'text/html'
                        }
                    };

                    request(options, (err, res, body) => {
                        expect(body).to.not.empty;
                        resolve();
                    });
                });
            };

            return Promise.all(specialPageProxyUrls.map(testSpecialPageRequest));
        });
    });

    describe('Cookies', () => {
        it('Should process SET_COOKIE service message', done => {
            const options = {
                method: 'POST',
                url:    'http://localhost:1836/cookie-sync',
                body:   JSON.stringify({
                    sessionId: session.id,
                    queue:     [
                        {
                            url:    proxy.openSession('http://example.com', session),
                            cookie: 'Test1=Data1'
                        },
                        {
                            url:    proxy.openSession('http://example.com', session),
                            cookie: 'Test2=Data2'
                        }
                    ]
                })
            };

            request(options, (err, res, body) => {
                expect(body).eql('');
                expect(res.statusCode).eql(204);
                expect(session.cookies.getClientString('http://example.com')).eql('Test1=Data1; Test2=Data2');

                done();
            });
        });

        it('Should handle "Cookie" and "Set-Cookie" headers', done => {
            const options = {
                url:            proxy.openSession('http://127.0.0.1:2000/cookie/set-and-redirect', session),
                followRedirect: true
            };

            request(options, (err, res, body) => {
                expect(body).eql('%% Test=value; value without key %%');
                done();
            });
        });
    });

    describe('XHR same-origin policy', () => {
        it('Should restrict requests from other domain', done => {
            const options = {
                url:     proxy.openSession('http://127.0.0.1:2000/page/plain-text', session),
                headers: {
                    referer: proxy.openSession('http://example.com', session)
                }
            };

            options.headers[XHR_HEADERS.requestMarker] = 'true';

            request(options, (err, res, body) => {
                expect(res.statusCode).eql(SAME_ORIGIN_CHECK_FAILED_STATUS_CODE);
                expect(body).to.be.empty;
                done();
            });
        });

        it('Should restrict requests from file protocol to some domain', done => {
            const options = {
                url:     proxy.openSession('http://127.0.0.1:2000/page/plain-text', session),
                headers: {
                    referer: proxy.openSession('file:///path/page.html', session)
                }
            };

            options.headers[XHR_HEADERS.requestMarker] = 'true';
            options.headers[XHR_HEADERS.corsSupported] = 'true';

            request(options, (err, res, body) => {
                expect(res.statusCode).eql(SAME_ORIGIN_CHECK_FAILED_STATUS_CODE);
                expect(body).to.be.empty;
                done();
            });
        });

        it('Should restrict requests between file urls', done => {
            const options = {
                url:     proxy.openSession(getFileProtocolUrl('./data/stylesheet/src.css'), session),
                headers: {
                    referer: proxy.openSession('file:///path/page.html', session)
                }
            };

            options.headers[XHR_HEADERS.requestMarker] = 'true';
            options.headers[XHR_HEADERS.corsSupported] = 'true';

            request(options, (err, res, body) => {
                expect(res.statusCode).eql(SAME_ORIGIN_CHECK_FAILED_STATUS_CODE);
                expect(body).to.be.empty;
                done();
            });
        });

        it('Should restrict preflight requests from other domain', done => {
            const options = {
                method:  'OPTIONS',
                url:     proxy.openSession('http://127.0.0.1:2000/preflight', session),
                headers: {
                    referer: proxy.openSession('http://example.com', session)
                }
            };

            options.headers[XHR_HEADERS.requestMarker] = 'true';

            request(options, (err, res, body) => {
                expect(res.statusCode).eql(SAME_ORIGIN_CHECK_FAILED_STATUS_CODE);
                expect(body).to.be.empty;
                done();
            });
        });

        it('Should allow preflight requests from other domain if CORS is enabled', done => {
            const options = {
                method:  'OPTIONS',
                url:     proxy.openSession('http://127.0.0.1:2000/preflight', session),
                headers: {
                    referer: proxy.openSession('http://example.com', session)
                }
            };

            options.headers[XHR_HEADERS.requestMarker] = 'true';
            options.headers[XHR_HEADERS.corsSupported] = 'true';

            request(options, (err, res, body) => {
                expect(res.statusCode).eql(200);
                expect(body).eql('42');
                done();
            });
        });

        it('Should allow requests from other domain if CORS is enabled and allowed origin is wildcard ', done => {
            const options = {
                url:     proxy.openSession('http://127.0.0.1:2000/xhr-origin/allow-any', session),
                headers: {
                    referer: proxy.openSession('http://example.com', session)
                }
            };

            options.headers[XHR_HEADERS.requestMarker] = 'true';
            options.headers[XHR_HEADERS.corsSupported] = 'true';

            request(options, (err, res, body) => {
                expect(res.statusCode).eql(200);
                expect(body).eql('42');
                done();
            });
        });

        it('Should allow requests from other domain if CORS is enabled and origin is allowed', done => {
            const options = {
                url:     proxy.openSession('http://127.0.0.1:2000/xhr-origin/allow-provided', session),
                headers: {
                    referer:          proxy.openSession('http://example.com', session),
                    'x-allow-origin': 'http://example.com'
                }
            };

            options.headers[XHR_HEADERS.requestMarker] = 'true';
            options.headers[XHR_HEADERS.corsSupported] = 'true';

            request(options, (err, res, body) => {
                expect(res.statusCode).eql(200);
                expect(body).eql('42');
                done();
            });
        });

        it('Should allow requests from other domain if it is "not modified" (GH-617)', done => {
            const options = {
                url:     proxy.openSession('http://127.0.0.1:2000/304', session),
                headers: {
                    referer:             proxy.openSession('http://example.com', session),
                    'if-modified-since': 'Thu, 01 Aug 2013 18:31:48 GMT'
                }
            };

            options.headers[XHR_HEADERS.requestMarker] = 'true';

            request(options, (err, res) => {
                expect(res.statusCode).eql(304);
                done();
            });
        });
    });

    describe('Fetch', () => {
        describe('Credential modes', () => {
            describe('Omit', () => {
                it('Should omit cookie and pass authorization headers for same-domain request', done => {
                    session.cookies.setByClient('http://127.0.0.1:2000', 'key=value');

                    const options = {
                        url:     proxy.openSession('http://127.0.0.1:2000/echo-headers', session),
                        headers: {
                            referer:       proxy.openSession('http://127.0.0.1:2000', session),
                            cookie:        'key=value',
                            authorization: 'value'
                        }
                    };

                    options.headers[XHR_HEADERS.fetchRequestCredentials] = 'omit';

                    request(options, (err, res, body) => {
                        const requestHeaders = JSON.parse(body);

                        expect(requestHeaders.cookie).to.be.undefined;
                        expect(requestHeaders.authorization).eql('value');

                        done();
                    });
                });

                it('Should omit cookie and pass authorization headers for cross-domain request', done => {
                    session.cookies.setByClient('http://127.0.0.1:2000', 'key=value');

                    const options = {
                        url:     proxy.openSession('http://127.0.0.1:2002/echo-headers', session),
                        headers: {
                            referer:       proxy.openSession('http://127.0.0.1:2000', session),
                            cookie:        'key=value',
                            authorization: 'value'
                        }
                    };

                    options.headers[XHR_HEADERS.fetchRequestCredentials] = 'omit';

                    request(options, (err, res, body) => {
                        const requestHeaders = JSON.parse(body);

                        expect(requestHeaders.cookie).to.be.undefined;
                        expect(requestHeaders.authorization).eql('value');

                        done();
                    });
                });
            });

            describe('Same-origin', () => {
                it('Should pass cookie and pass authorization headers for same-domain request', done => {
                    session.cookies.setByClient('http://127.0.0.1:2000', 'key=value');

                    const options = {
                        url:     proxy.openSession('http://127.0.0.1:2000/echo-headers', session),
                        headers: {
                            referer:       proxy.openSession('http://127.0.0.1:2000', session),
                            cookie:        'key=value',
                            authorization: 'value'
                        }
                    };

                    options.headers[XHR_HEADERS.fetchRequestCredentials] = 'same-origin';

                    request(options, (err, res, body) => {
                        const requestHeaders = JSON.parse(body);

                        expect(requestHeaders.cookie).eql('key=value');
                        expect(requestHeaders.authorization).eql('value');

                        done();
                    });
                });

                it('Should omit cookie and pass authorization headers for cross-domain request', done => {
                    session.cookies.setByClient('http://127.0.0.1:2000', 'key=value');

                    const options = {
                        url:     proxy.openSession('http://127.0.0.1:2002/echo-headers', session),
                        headers: {
                            referer:       proxy.openSession('http://127.0.0.1:2000', session),
                            cookie:        'key=value',
                            authorization: 'value'
                        }
                    };

                    options.headers[XHR_HEADERS.fetchRequestCredentials] = 'same-origin';

                    request(options, (err, res, body) => {
                        const requestHeaders = JSON.parse(body);

                        expect(requestHeaders.cookie).to.be.undefined;
                        expect(requestHeaders.authorization).eql('value');

                        done();
                    });
                });
            });

            describe('Include', () => {
                it('Should pass cookie and authorization headers for same-domain request', done => {
                    session.cookies.setByClient('http://127.0.0.1:2000', 'key=value');

                    const options = {
                        url:     proxy.openSession('http://127.0.0.1:2000/echo-headers', session),
                        headers: {
                            referer:       proxy.openSession('http://127.0.0.1:2000', session),
                            cookie:        'key=value',
                            authorization: 'value'
                        }
                    };

                    options.headers[XHR_HEADERS.fetchRequestCredentials] = 'include';

                    request(options, (err, res, body) => {
                        const requestHeaders = JSON.parse(body);

                        expect(requestHeaders.cookie).eql('key=value');
                        expect(requestHeaders.authorization).eql('value');

                        done();
                    });
                });

                it('Should pass cookie and authorization headers for cross-domain request', done => {
                    session.cookies.setByClient('http://127.0.0.1:2000', 'key=value');

                    const options = {
                        url:     proxy.openSession('http://127.0.0.1:2002/echo-headers-with-credentials', session),
                        headers: {
                            referer:       proxy.openSession('http://127.0.0.1:2000', session),
                            cookie:        'key=value',
                            authorization: 'value'
                        }
                    };

                    options.headers[XHR_HEADERS.fetchRequestCredentials] = 'include';

                    request(options, (err, res, body) => {
                        const requestHeaders = JSON.parse(body);

                        expect(requestHeaders.cookie).eql('key=value');
                        expect(requestHeaders.authorization).eql('value');

                        done();
                    });
                });
            });
        });
    });

    describe('Content processing', () => {
        it('Should process pages', done => {
            session.id = 'sessionId';
            session.injectable.scripts.push('/script1.js');
            session.injectable.scripts.push('/script2.js');
            session.injectable.styles.push('/styles1.css');
            session.injectable.styles.push('/styles2.css');

            session.useStateSnapshot({
                cookies:  null,
                storages: {
                    localStorage:   '[["key1"],[" \' \\" \\\\ \\n \\t \\b \\f "]]',
                    sessionStorage: '[["key2"],["value"]]'
                }
            });

            const options = {
                url:     proxy.openSession('http://127.0.0.1:2000/page', session),
                headers: {
                    accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*!/!*;q=0.8'
                }
            };

            request(options, (err, res, body) => {
                const expected = fs.readFileSync('test/server/data/page/expected.html').toString();

                compareCode(body, expected);
                done();
            });
        });

        it('Should process html import pages', done => {
            session.id = 'sessionId';
            session.injectable.scripts.push('/script1.js');
            session.injectable.scripts.push('/script2.js');
            session.injectable.styles.push('/styles1.css');
            session.injectable.styles.push('/styles2.css');

            proxy.openSession('http://127.0.0.1:2000/', session);

            const options = {
                url: urlUtils.getProxyUrl('http://127.0.0.1:2000/html-import-page', {
                    proxyHostname: '127.0.0.1',
                    proxyPort:     1836,
                    sessionId:     session.id,
                    resourceType:  urlUtils.getResourceTypeString({ isHtmlImport: true })
                }),

                headers: {
                    accept: '*/*'
                }
            };

            request(options, (err, res, body) => {
                const expected = fs.readFileSync('test/server/data/html-import-page/expected.html').toString();

                compareCode(body, expected);
                done();
            });
        });

        it('Should process html import pages in iframe', done => {
            session.id = 'sessionId';

            proxy.openSession('http://127.0.0.1:2000/', session);

            const options = {
                url: urlUtils.getProxyUrl('http://127.0.0.1:2000/html-import-page-in-iframe', {
                    proxyHostname: '127.0.0.1',
                    proxyPort:     1836,
                    sessionId:     session.id,
                    resourceType:  urlUtils.getResourceTypeString({ isHtmlImport: true, isIframe: true })
                }),

                headers: {
                    accept: '*/*'
                }
            };

            request(options, (err, res, body) => {
                const expected = fs.readFileSync('test/server/data/html-import-page/expected-iframe.html').toString();

                compareCode(body, expected);
                done();
            });
        });


        it('Should not process XHR page requests', done => {
            const options = {
                url:     proxy.openSession('http://127.0.0.1:2000/page', session),
                headers: {
                    accept:  'text/html,application/xhtml+xml,application/xml;q=0.9,*!/!*;q=0.8',
                    referer: proxy.openSession('http://127.0.0.1:2000/', session)
                }
            };

            options.headers[XHR_HEADERS.requestMarker] = 'true';

            request(options, (err, res, body) => {
                const expected = fs.readFileSync('test/server/data/page/src.html').toString();

                compareCode(body, expected);
                done();
            });
        });

        it('Should not process Fetch page requests', done => {
            const options = {
                url:     proxy.openSession('http://127.0.0.1:2000/page', session),
                headers: {
                    accept:  'text/html,application/xhtml+xml,application/xml;q=0.9,*!/!*;q=0.8',
                    referer: proxy.openSession('http://127.0.0.1:2000/', session)
                }
            };

            options.headers[XHR_HEADERS.fetchRequestCredentials] = 'omit';

            request(options, (err, res, body) => {
                const expected = fs.readFileSync('test/server/data/page/src.html').toString();

                compareCode(body, expected);
                done();
            });
        });

        it('Should process scripts', done => {
            session.id = 1337;

            request(proxy.openSession('http://127.0.0.1:2000/script', session), (err, res, body) => {
                const expected = fs.readFileSync('test/server/data/script/expected.js').toString();

                expect(normalizeNewLine(body)).eql(normalizeNewLine(expected));
                done();
            });
        });

        it('Should process manifests', done => {
            session.id = 'sessionId';

            request(proxy.openSession('http://127.0.0.1:2000/manifest', session), (err, res, body) => {
                const expected = fs.readFileSync('test/server/data/manifest/expected.manifest').toString();

                compareCode(body, expected);
                done();
            });
        });

        it('Should process stylesheets', done => {
            session.id = 'sessionId';

            const options = {
                url:     proxy.openSession('http://127.0.0.1:2000/stylesheet', session),
                headers: {
                    accept: 'text/css'
                }
            };

            request(options, (err, res, body) => {
                const expected = fs.readFileSync('test/server/data/stylesheet/expected.css').toString();

                compareCode(body, expected);
                done();
            });
        });

        it('Should process upload info', done => {
            const src      = newLineReplacer(fs.readFileSync('test/server/data/upload/src.formdata'));
            const expected = newLineReplacer(fs.readFileSync('test/server/data/upload/expected.formdata'));

            const options = {
                url:     proxy.openSession('http://127.0.0.1:2000/upload-info', session),
                method:  'POST',
                body:    src,
                headers: {
                    'content-type': 'multipart/form-data; boundary=separator',
                    'accept':       'text/plain;q=0.9,*!/!*;q=0.8'
                }
            };

            request(options, (err, res, body) => {
                expect(body).eql(expected.toString());
                done();
            });
        });

        it('Should not process file download', done => {
            const options = {
                url:     proxy.openSession('http://127.0.0.1:2000/download', session),
                method:  'GET',
                headers: {
                    accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*!/!*;q=0.8'
                }
            };

            request(options, (err, res, body) => {
                expect(body).eql(EMPTY_PAGE);
                done();
            });
        });

        it('Should not process "not modified" resources (GH-817)', () => {
            const mimeTypes = ['text/cache-manifest', 'text/css', 'text/html', 'text/javascript'];

            return Promise.all(mimeTypes.map((mimeType, index) => {
                return new Promise(resolve => {
                    const options = {
                        url:     proxy.openSession('http://127.0.0.1:2000/304', session),
                        headers: {
                            'x-content-type': mimeType
                        }
                    };

                    if (index % 2)
                        options.headers['if-modified-since'] = 'Thu, 01 Aug 2013 18:31:48 GMT';
                    else
                        options.headers['if-none-match'] = '42dc7c04442557f8937f89ecdc993077';

                    request(options, (err, res, body) => {
                        expect(body).eql('');
                        expect(res.statusCode).eql(304);
                        expect(res.headers['content-length']).eql('0');
                        resolve();
                    });
                });
            }));
        });
    });

    describe('Shadow UI', () => {
        it('Should process shadow ui stylesheet', done => {
            const src      = read('/data/shadow-ui-stylesheet/src.css').toString();
            const expected = read('/data/shadow-ui-stylesheet/expected.css').toString();

            proxy.GET('/testcafe-ui-styles.css', {
                contentType:          'text/css',
                content:              src,
                isShadowUIStylesheet: true
            });

            request('http://127.0.0.1:1836/testcafe-ui-styles.css', (err, res, body) => {
                expect(body.replace(/\r\n|\n/g, '')).equal(expected.replace(/\r\n|\n/g, ''));

                done();
            });
        });
    });

    describe('HTTPS', () => {
        let httpsServer = null;

        before(() => {
            const httpsApp = express();

            httpsApp.get('/answer', (req, res) => res.send('42'));

            httpsServer = createSelfSignedHttpsServer(httpsApp).listen(2001);
        });

        after(() => httpsServer.close());

        it('Should proxy unauthorized HTTPS pages', done => {
            const url = proxy.openSession('https://127.0.0.1:2001/answer', session);

            request(url, (err, res, body) => {
                expect(body).eql('42');
                done();
            });
        });
    });

    describe('file:// protocol', () => {
        it('Should process page and ignore search string', done => {
            session.id = 'sessionId';
            session.injectable.scripts.push('/script1.js');
            session.injectable.scripts.push('/script2.js');
            session.injectable.styles.push('/styles1.css');
            session.injectable.styles.push('/styles2.css');

            session.useStateSnapshot({
                cookies:  null,
                storages: {
                    localStorage:   '[["key1"],[" \' \\" \\\\ \\n \\t \\b \\f "]]',
                    sessionStorage: '[["key2"],["value"]]'
                }
            });

            const options = {
                url: proxy.openSession(getFileProtocolUrl('./data/page/src.html') + '?a=1&b=3', session),

                headers: {
                    accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*!/!*;q=0.8'
                }
            };

            request(options, (err, res, body) => {
                // NOTE: The host property is empty in url with file: protocol.
                // The expected.html template is used for both tests with http: and file: protocol.
                const expected = fs.readFileSync('test/server/data/page/expected.html').toString()
                    .replace(/(hammerhead\|storage-wrapper\|sessionId\|)127\.0\.0\.1:2000/g, '$1');

                compareCode(body, expected);
                done();
            });
        });

        it('Should process stylesheets', done => {
            session.id = 'sessionId';

            const options = {
                url:     proxy.openSession(getFileProtocolUrl('./data/stylesheet/src.css'), session),
                headers: {
                    accept: 'text/css,*/*;q=0.1'
                }
            };

            request(options, (err, res, body) => {
                const expected = fs.readFileSync('test/server/data/stylesheet/expected.css').toString();

                compareCode(body, expected);
                done();
            });
        });

        it('Should process page with absolute urls', done => {
            session.id = 'sessionId';

            const filePostfix = os.platform() === 'win32' ? 'win' : 'nix';
            const fileUrl     = getFileProtocolUrl('./data/page-with-file-protocol/src-' + filePostfix + '.html');

            const options = {
                url:     proxy.openSession(fileUrl, session),
                headers: {
                    accept: 'text/html,*/*;q=0.1'
                }
            };

            request(options, (err, res, body) => {
                const expected = fs.readFileSync('test/server/data/page-with-file-protocol/expected-' + filePostfix +
                                                 '.html').toString();

                compareCode(body, expected);
                done();
            });
        });

        if (os.platform() === 'win32') {
            it('Should process page with non-conforming Windows url', done => {
                session.id = 'sessionId';

                const fileUrl = 'file://' + path.join(__dirname, '/data/page-with-file-protocol/src-win.html');

                const options = {
                    url:     proxy.openSession(fileUrl, session),
                    headers: {
                        accept: 'text/html,*/*;q=0.1'
                    }
                };

                request(options, (err, res, body) => {
                    const expected = fs.readFileSync('test/server/data/page-with-file-protocol/expected-win.html').toString();

                    compareCode(body, expected);
                    done();
                });
            });
        }

        it('Should set the correct content-type header', done => {
            session.id = 'sessionId';

            const options = {
                url:     proxy.openSession(getFileProtocolUrl('./data/images/icons.svg'), session),
                headers: {
                    accept: 'image/webp,image/*,*/*;q=0.8'
                }
            };

            request(options, (err, res) => {
                expect(res.headers['content-type']).eql('image/svg+xml');
                done();
            });
        });

        it('Should pass an error to the session if target is a directory', done => {
            const url = getFileProtocolUrl('./data');

            session.id = 'sessionId';

            session.handlePageError = (ctx, err) => {
                expect(err).contains([
                    'Failed to read a file at <a href="' + url + '">' + url + '</a> because of the error:',
                    '',
                    'EISDIR'
                ].join('\n'));

                ctx.res.end();
                done();
                return true;
            };

            const options = {
                url:     proxy.openSession(url, session),
                headers: {
                    accept: 'text/html,*/*;q=0.1'
                }
            };

            request(options);
        });

        it('Should pass an error to the session if target does not exist', done => {
            const url = getFileProtocolUrl('./data/non-exist-file');

            session.id = 'sessionId';

            session.handlePageError = (ctx, err) => {
                expect(err).contains([
                    'Failed to read a file at <a href="' + url + '">' + url + '</a> because of the error:',
                    '',
                    'ENOENT'
                ].join('\n'));

                ctx.res.end();
                done();
                return true;
            };

            const options = {
                url:     proxy.openSession(url, session),
                headers: {
                    accept: 'text/html,*/*;q=0.1'
                }
            };

            request(options);
        });
    });

    describe('State switching', () => {
        function makeRequest (url, opts) {
            opts = opts || { isPage: true };

            const options = {
                url: urlUtils.getProxyUrl(url, {
                    proxyHostname: '127.0.0.1',
                    proxyPort:     1836,
                    sessionId:     session.id,
                    resourceType:  opts.resourceType
                }),

                headers: {
                    accept: opts.isPage ? 'text/html,application/xhtml+xml,application/xml;q=0.9,*!/!*;q=0.8' : '*/*'
                }
            };

            return new Promise((resolve, reject) => {
                request(options, (err, res, body) => {
                    if (err)
                        reject(err);
                    else
                        resolve(body);
                });
            });
        }

        function forEachSequentially (arr, fn) {
            return arr.reduce((promise, item) => {
                return promise.then(() => {
                    return fn(item);
                });
            }, Promise.resolve());
        }

        it('Should switch states', () => {
            const testCases = [
                {
                    state:    null,
                    urls:     ['http://127.0.0.1:2000/cookie/set1'],
                    expected: 'Set1_1=value1; Set1_2=value2'
                },
                {
                    state:    null,
                    urls:     ['http://127.0.0.1:2000/cookie/set2'],
                    expected: 'Set2_1=value1; Set2_2=value2'
                },
                {
                    state:    null,
                    urls:     ['http://127.0.0.1:2000/cookie/set1', 'http://127.0.0.1:2000/cookie/set2'],
                    expected: 'Set1_1=value1; Set1_2=value2; Set2_1=value1; Set2_2=value2'
                }
            ];

            function initializeState (testCase) {
                session.useStateSnapshot(null);

                return forEachSequentially(testCase.urls, makeRequest).then(() => {
                    testCase.state = session.getStateSnapshot();
                });
            }

            function assertState (testCase) {
                session.useStateSnapshot(testCase.state);

                return makeRequest('http://127.0.0.1:2000/cookie/echo').then(body => {
                    expect(body).contains('%% ' + testCase.expected + ' %%');
                });
            }

            proxy.openSession('http://127.0.0.1:2000/', session);

            return Promise.resolve()
                .then(() => {
                    return forEachSequentially(testCases, initializeState);
                })
                .then(() => {
                    return forEachSequentially(testCases, assertState);
                });
        });

        it('Should switch state only on page requests', () => {
            proxy.openSession('http://127.0.0.1:2000/', session);

            let state = null;

            return makeRequest('http://127.0.0.1:2000/cookie/set1')
                .then(() => {
                    state = session.getStateSnapshot();

                    session.useStateSnapshot(null);
                })

                // Try request empty state with non-page and page requests
                .then(() => {
                    return makeRequest('http://127.0.0.1:2000/cookie/echo', { isPage: false });
                })
                .then(body => {
                    expect(body).contains('%% Set1_1=value1; Set1_2=value2 %%');
                })
                .then(() => {
                    return makeRequest('http://127.0.0.1:2000/cookie/echo', { isPage: true, resourceType: 'i' });
                })
                .then(body => {
                    expect(body).contains('%% Set1_1=value1; Set1_2=value2 %%');
                })
                .then(() => {
                    return makeRequest('http://127.0.0.1:2000/cookie/echo', { isPage: true, resourceType: 'h' });
                })
                .then(body => {
                    expect(body).contains('%% Set1_1=value1; Set1_2=value2 %%');
                })
                .then(() => {
                    return makeRequest('http://127.0.0.1:2000/cookie/echo', { isPage: true });
                })
                .then(body => {
                    expect(body).not.contains('%% Set1_1=value1; Set1_2=value2 %%');
                })

                .then(() => {
                    session.useStateSnapshot(state);
                })

                // Try request Set1 state with non-page and page requests
                .then(() => {
                    return makeRequest('http://127.0.0.1:2000/cookie/echo', { isPage: false });
                })
                .then(body => {
                    expect(body).not.contains('%% Set1_1=value1; Set1_2=value2 %%');
                })
                .then(() => {
                    return makeRequest('http://127.0.0.1:2000/cookie/echo', { isPage: true, resourceType: 'i' });
                })
                .then(body => {
                    expect(body).not.contains('%% Set1_1=value1; Set1_2=value2 %%');
                })
                .then(() => {
                    return makeRequest('http://127.0.0.1:2000/cookie/echo', { isPage: true, resourceType: 'h' });
                })
                .then(body => {
                    expect(body).not.contains('%% Set1_1=value1; Set1_2=value2 %%');
                })
                .then(() => {
                    return makeRequest('http://127.0.0.1:2000/cookie/echo', { isPage: true });
                })
                .then(body => {
                    expect(body).contains('%% Set1_1=value1; Set1_2=value2 %%');
                });
        });

        it('Should skip cache headers if state snapshot is applied', done => {
            const options = {
                url:     proxy.openSession('http://127.0.0.1:2000/echo-headers', session),
                headers: {
                    accept:              'text/html,application/xhtml+xml,application/xml;q=0.9,*!/!*;q=0.8',
                    'if-modified-since': 'Mon, 17 Jul 2017 14:56:15 GMT',
                    'if-none-match':     'W/"1322-15d510cbdf8"'
                }
            };

            session.useStateSnapshot(null);

            request(options, (err, res, body) => {
                expect(body).not.contains('if-modified-since');
                expect(body).not.contains('if-none-match');
                done();
            });
        });
    });

    describe('WebSocket', () => {
        let httpsServer = null;
        let wsServer    = null;
        let wssServer   = null;

        before(() => {
            httpsServer = createSelfSignedHttpsServer(() => {
            }).listen(2001);
            wsServer    = new WebSocket.Server({
                server: destServer,
                path:   '/web-socket'
            });
            wssServer   = new WebSocket.Server({
                server: httpsServer,
                path:   '/secire-web-socket'
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
            wsServer.close();
            wssServer.close();
            httpsServer.close();
        });

        const askSocket = (ws, msg) => {
            return new Promise(resolve => {
                ws.once('message', resolve);
                ws.send(msg);
            });
        };

        it('Should proxy WebSocket', () => {
            const url = urlUtils.getProxyUrl('http://127.0.0.1:2000/web-socket', {
                proxyHostname: '127.0.0.1',
                proxyPort:     1836,
                sessionId:     session.id,
                resourceType:  urlUtils.getResourceTypeString({ isWebSocket: true }),
                reqOrigin:     encodeURIComponent('http://example.com')
            });

            proxy.openSession('http://127.0.0.1:2000/', session);
            session.cookies.setByClient('http://127.0.0.1:2000', 'key=value');

            const ws = new WebSocket(url, { origin: 'http://some.domain.url' });

            return new Promise(resolve => {
                ws.on('open', resolve);
            })
                .then(() => {
                    return askSocket(ws, 'get origin header');
                })
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

                    ws.close();
                });
        });

        it('Should proxy secure WebSocket', () => {
            const url = urlUtils.getProxyUrl('https://127.0.0.1:2001/secire-web-socket', {
                proxyHostname: '127.0.0.1',
                proxyPort:     1836,
                sessionId:     session.id,
                resourceType:  urlUtils.getResourceTypeString({ isWebSocket: true }),
                reqOrigin:     encodeURIComponent('http://example.com')
            });

            proxy.openSession('https://127.0.0.1:2001/', session);

            const ws = new WebSocket(url, { origin: 'http://some.domain.url' });

            return new Promise(resolve => {
                ws.on('open', resolve);
            })
                .then(() => {
                    return askSocket(ws, 'get origin header');
                })
                .then(msg => {
                    expect(msg).eql('http://example.com');

                    ws.close();
                });
        });

        it('Should not throws an proxy error when server is not available', (done) => {
            const url = urlUtils.getProxyUrl('http://127.0.0.1:2003/ws', {
                proxyHostname: '127.0.0.1',
                proxyPort:     1836,
                sessionId:     session.id,
                resourceType:  urlUtils.getResourceTypeString({ isWebSocket: true }),
                reqOrigin:     encodeURIComponent('http://example.com')
            });

            proxy.openSession('http://127.0.0.1:2003/', session);

            const ws = new WebSocket(url);

            ws.on('error', err => {
                expect(err.message).eql('socket hang up');
            });

            ws.on('close', () => {
                done();
            });
        });

        it('Should close webSocket from server side', function (done) {
            getFreePort()
                .then(port => {
                    const url = urlUtils.getProxyUrl('http://127.0.0.1:' + port, {
                        proxyHostname: '127.0.0.1',
                        proxyPort:     1836,
                        sessionId:     session.id,
                        resourceType:  urlUtils.getResourceTypeString({ isWebSocket: true })
                    });

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

        it('Should exposes number of bytes received', function (done) {
            getFreePort()
                .then(port => {
                    const url = urlUtils.getProxyUrl('http://localhost:' + port, {
                        proxyHostname: '127.0.0.1',
                        proxyPort:     1836,
                        sessionId:     session.id,
                        resourceType:  urlUtils.getResourceTypeString({ isWebSocket: true })
                    });

                    proxy.openSession('http://127.0.0.1:2000/', session);

                    const wsTemporaryServer = new WebSocket.Server({ port: port }, () => {
                        const ws = new WebSocket(url);

                        ws.on('message', () => {
                            expect(ws.bytesReceived).eql(8);
                            wsTemporaryServer.close(done);
                        });
                    });

                    wsTemporaryServer.on('connection', ws => ws.send('foobar'));
                });
        });
    });

    describe('Regression', () => {
        it('Should force "Origin" header for the same-domain requests (B234325)', done => {
            const options = {
                url:     proxy.openSession('http://127.0.0.1:2000/B234325,GH-284/reply-with-origin', session),
                headers: {
                    referer: proxy.openSession('http://example.com', session)
                }
            };

            options.headers[XHR_HEADERS.requestMarker] = 'true';
            options.headers[XHR_HEADERS.corsSupported] = 'true';

            request(options, (err, res, body) => {
                expect(body).eql('http://example.com');
                done();
            });
        });

        it('Should force "Origin" header for the cross-domain "fetch" requests (GH-1059)', done => {
            const options = {
                url:     proxy.openSession('http://127.0.0.1:2000/GH-1059/reply-with-origin', session),
                headers: {
                    referer: proxy.openSession('http://example.com', session)
                }
            };

            options.headers[XHR_HEADERS.fetchRequestCredentials] = 'include';

            request(options, (err, res, body) => {
                expect(body).eql('http://example.com');
                done();
            });
        });

        it('Should not send "Cookie" header if there are no cookies for the given URL (T232505)', done => {
            const url = proxy.openSession('http://127.0.0.1:2000/T232505/is-cookie-header-sent', session);

            request(url, (err, res, body) => {
                expect(JSON.parse(body)).to.be.false;
                done();
            });
        });

        it('Should raise error on request timeout (T224541)', done => {
            const savedReqTimeout = DestinationRequest.TIMEOUT;

            DestinationRequest.TIMEOUT = 200;

            session.handlePageError = (ctx, err) => {
                expect(err).eql('Failed to complete a request to <a href="http://127.0.0.1:2000/T224541/hang-forever">' +
                                'http://127.0.0.1:2000/T224541/hang-forever</a> within the timeout period. ' +
                                'The problem may be related to local machine\'s network or firewall settings, server outage, ' +
                                'or network problems that make the server inaccessible.');
                ctx.res.end();
                DestinationRequest.TIMEOUT = savedReqTimeout;
                done();
                return true;
            };

            const options = {
                url:     proxy.openSession('http://127.0.0.1:2000/T224541/hang-forever', session),
                headers: {
                    accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*!/!*;q=0.8'
                }
            };

            request(options);
        });

        it('Should use a special timeout for xhr requests (GH-347)', done => {
            const savedReqTimeout    = DestinationRequest.TIMEOUT;
            const savedXhrReqTimeout = DestinationRequest.XHR_TIMEOUT;

            DestinationRequest.TIMEOUT     = 100;
            DestinationRequest.XHR_TIMEOUT = 200;

            const options = {
                url:     proxy.openSession('http://127.0.0.1:2000/T224541/hang-forever', session),
                headers: {
                    accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*!/!*;q=0.8'
                }
            };

            options.headers[XHR_HEADERS.requestMarker] = 'true';

            const requestTime = Date.now();

            request(options, (err, res) => {
                const responseTime = Date.now();

                expect(res.statusCode).eql(500);
                expect(responseTime - requestTime).above(DestinationRequest.XHR_TIMEOUT);

                DestinationRequest.TIMEOUT     = savedReqTimeout;
                DestinationRequest.XHR_TIMEOUT = savedXhrReqTimeout;
                done();
            });
        });

        // NOTE: Requires fix in node.js.
        it.skip('Should not encode cyrillic symbols in header (T239167, GH-nodejs/io.js#1693)', done => {
            const url              = proxy.openSession('http://127.0.0.1:2000/T239167/send-location', session);
            const expectedLocation = proxy.openSession('http://127.0.0.1:2000/\u0410\u0411', session);

            request(url, (err, res) => {
                expect(res.headers['location']).eql(expectedLocation);
                done();
            });
        });

        it('Should process empty pages (B239430)', done => {
            const options = {
                url:     proxy.openSession('http://127.0.0.1:2000/B239430/empty-page', session),
                headers: {
                    accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*!/!*;q=0.8'
                }
            };

            request(options, (err, res, body) => {
                const expected = fs.readFileSync('test/server/data/empty-page/expected.html').toString();

                compareCode(body, expected);
                done();
            });
        });

        it('Should process pages with status 204 and return status 200 instead (GH-306)', done => {
            const options = {
                url:     proxy.openSession('http://127.0.0.1:2000/GH-306/empty-resource', session),
                headers: {
                    accept:            'text/html,application/xhtml+xml,application/xml;q=0.9,*!/!*;q=0.8',
                    'x-resource-type': 'text/html; charset=utf-8'
                }
            };

            request(options, (err, res, body) => {
                const expected = fs.readFileSync('test/server/data/empty-page/expected.html').toString();

                compareCode(body, expected);
                expect(res.statusCode).eql(200);
                expect(res.headers['content-length']).eql(body.length.toString());

                done();
            });
        });

        it('Should not process script with the html "accept" header as a page', done => {
            const url     = proxy.openSession('http://127.0.0.1:2000/script', session);
            const options = {
                url:     url.replace(/^(.*?\/\/.*?\/.*?)(\/.*)$/, '$1!script$2'),
                headers: {
                    accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*!/!*;q=0.8'
                }
            };

            request(options, (err, res, body) => {
                expect(res.statusCode).eql(200);
                expect(body).to.contain(scriptHeader.SCRIPT_PROCESSING_START_COMMENT);

                done();
            });
        });

        it('Should not process assets with status 204 (GH-306)', () => {
            function testSourceWithStatus204 (mimeType) {
                return new Promise(resolve => {
                    const options = {
                        url:     proxy.openSession('http://127.0.0.1:2000/GH-306/empty-resource', session),
                        headers: {
                            'x-resource-type': mimeType
                        }
                    };

                    request(options, (err, res, body) => {
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

        it('Should transform the "Origin" header for requests without the "Referer" header correctly (GH-284)', done => {
            const options = {
                url:     proxy.openSession('http://127.0.0.1:2000/B234325,GH-284/reply-with-origin', session),
                headers: { origin: 'http://127.0.0.1:1836' }
            };

            options.headers[XHR_HEADERS.origin]        = 'http://example.com';
            options.headers[XHR_HEADERS.requestMarker] = 'true';
            options.headers[XHR_HEADERS.corsSupported] = 'true';

            request(options, (err, res, body) => {
                expect(body).eql('http://example.com');

                done();
            });
        });

        it('Should return 204 status code instead of 200 for the empty form submission response (GH-373)', done => {
            const url     = proxy.openSession('http://127.0.0.1:2000/GH-306/empty-resource', session);
            const options = {
                url:     url.replace(session.id, session.id + '!f'),
                headers: {
                    accept:            'text/html,application/xhtml+xml,application/xml;q=0.9,*!/!*;q=0.8',
                    'x-resource-type': 'text/html; charset=utf-8'
                }
            };

            request(options, (err, res) => {
                expect(res.statusCode).eql(204);
                done();
            });
        });

        it('Should pass ECONNREFUSED error to session (GH-446)', done => {
            getFreePort()
                .then(port => {
                    const host = 'http://127.0.0.1:' + port;

                    session.handlePageError = (ctx, err) => {
                        expect(err).eql('Failed to find a DNS-record for the resource at <a href="' + host + '">' +
                                        host + '</a>.');
                        ctx.res.end();
                        done();
                        return true;
                    };

                    const options = {
                        url:     proxy.openSession(host, session),
                        headers: {
                            accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*!/!*;q=0.8'
                        }
                    };

                    request(options);
                });
        });

        it('Should send a response without waiting for the end of the destination response and without processing its body (GH-390)', done => {
            const url           = proxy.openSession('http://127.0.0.1:2000/GH-390/redirect-302-with-body', session);
            const opts          = urlLib.parse(url);
            const startTestTime = process.hrtime();
            const getTimeInMs   = hrtimeMark => {
                return hrtimeMark[0] * 1000 + hrtimeMark[1] / 1000000;
            };

            opts.method = 'GET';

            http.request(opts)
                .on('response', res => {
                    const responseStartInMs = getTimeInMs(process.hrtime(startTestTime));

                    expect(responseStartInMs < 100).to.be.true;

                    const chunks = [];

                    res.on('data', chunk => chunks.push(chunk));

                    res.on('end', () => {
                        const responseEndInMs             = getTimeInMs(process.hrtime(startTestTime));
                        // NOTE: Only in node 0.10 response 'end' event can happen earlier than 1000 ms
                        const responseEndThresholdTimeout = 20;

                        expect(responseEndInMs + responseEndThresholdTimeout > 1000).to.be.true;
                        expect(chunks.join('')).equal('body');

                        done();
                    });
                })
                .end();
        });

        it('Should close with error if destination server doesn`t provide Access-Control-Allow-Origin header for cross-domain requests', done => {
            const options = {
                url:     proxy.openSession('http://127.0.0.1:2002/without-access-control-allow-origin-header', session),
                headers: {
                    referer: proxy.openSession('http://example.com', session)
                }
            };

            options.headers[XHR_HEADERS.requestMarker] = 'true';
            options.headers[XHR_HEADERS.corsSupported] = 'true';

            request(options, (err, res) => {
                expect(res.statusCode).eql(SAME_ORIGIN_CHECK_FAILED_STATUS_CODE);
                done();
            });
        });

        it('Should not send cookie and authorization headers to the cross-domain destination server for the xhr request without credentials (GH-545)', done => {
            session.cookies.setByClient('http://example.com', 'key=value');

            const options = {
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

            request(options, (err, res, body) => {
                const requestHeaders = JSON.parse(body);

                expect(requestHeaders.cookie).to.be.undefined;
                expect(requestHeaders.authorization).to.be.undefined;
                expect(requestHeaders['authentication-info']).to.be.undefined;
                expect(requestHeaders['proxy-authenticate']).to.be.undefined;
                expect(requestHeaders['proxy-authorization']).to.be.undefined;

                done();
            });
        });

        it('Should remove hammerhead xhr headers before sending a request to the destination server', done => {
            const options = {
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

            request(options, (err, res, body) => {
                const requestHeaders = JSON.parse(body);

                expect(requestHeaders[XHR_HEADERS.requestMarker]).to.be.undefined;
                expect(requestHeaders[XHR_HEADERS.corsSupported]).to.be.undefined;
                expect(requestHeaders[XHR_HEADERS.withCredentials]).to.be.undefined;
                expect(requestHeaders[XHR_HEADERS.origin]).to.be.undefined;
                expect(requestHeaders[XHR_HEADERS.fetchRequestCredentials]).to.be.undefined;

                done();
            });
        });

        it('Should remove hammerhead xhr headers before sending a request to the destination server', done => {
            const options = {
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

            request(options, (err, res, body) => {
                const requestHeaders = JSON.parse(body);

                expect(requestHeaders[XHR_HEADERS.requestMarker]).to.be.undefined;
                expect(requestHeaders[XHR_HEADERS.corsSupported]).to.be.undefined;
                expect(requestHeaders[XHR_HEADERS.withCredentials]).to.be.undefined;
                expect(requestHeaders[XHR_HEADERS.origin]).to.be.undefined;
                expect(requestHeaders[XHR_HEADERS.fetchRequestCredentials]).to.be.undefined;

                done();
            });
        });

        it('Should add a leading slash to the pathname part of url (GH-608)', done => {
            const options = {
                url: proxy.openSession('http://127.0.0.1:2000?key=value', session)
            };

            request(options, (err, res, body) => {
                expect(body).eql('/?key=value');
                done();
            });
        });

        it('Should omit default ports from destination request and `referrer` header urls (GH-738)', () => {
            const testCases              = [
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
            const req                    = {
                headers: {
                    accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*!/!*;q=0.8'
                }
            };
            const requestPipelineContext = new RequestPipelineContext(req, {}, {});

            for (let i = 0; i < testCases.length; i++) {
                requestPipelineContext.req.url = proxy.openSession(testCases[i].url, session);
                if (testCases[i].referer)
                    requestPipelineContext.req.headers.referer = proxy.openSession(testCases[i].referer, session);

                requestPipelineContext.dispatch(proxy.openSessions);

                expect(requestPipelineContext.dest.host).eql(testCases[i].expectedHost);
                expect(requestPipelineContext.dest.port).eql(testCases[i].expectedPort);
            }
        });

        it('Should not send destination request for special pages (GH-796)', done => {
            let rejectionReason = null;

            const options = {
                url: proxy.openSession('about:blank', session),

                headers: {
                    accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*!/!*;q=0.8'
                }
            };

            process.once('unhandledRejection', reason => {
                rejectionReason = reason;
            });

            request(options, () => {
                expect(rejectionReason).to.be.null;
                done();
            });
        });

        it('Should handle `about:blank` requests for resources that doesn`t require processing (GH-796)', done => {
            const options = {
                url: proxy.openSession('about:blank', session),

                headers: {
                    accept: 'application/font'
                }
            };

            request(options, (err, res, body) => {
                expect(body).eql('');
                done();
            });
        });

        describe('Should not change a response body if it is empty (GH-762)', () => {
            it('script', done => {
                const options = {
                    url:     proxy.openSession('http://127.0.0.1:2000/empty-response', session),
                    headers: {
                        'content-type': 'application/javascript; charset=utf-8'
                    }
                };

                request(options, (err, res, body) => {
                    expect(body).is.empty;
                    done();
                });
            });

            it('style', done => {
                const options = {
                    url:     proxy.openSession('http://127.0.0.1:2000/empty-response', session),
                    headers: {
                        'content-type': 'text/css'
                    }
                };

                request(options, (err, res, body) => {
                    expect(body).is.empty;
                    done();
                });
            });
        });

        it('Should abort destination request after fatal error (GH-937)', done => {
            const savedReqTimeout    = DestinationRequest.TIMEOUT;
            let fatalErrorEventCount = 0;

            DestinationRequest.TIMEOUT = 100;

            const destReq = new DestinationRequest({
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

            destReq.on('error', () => {
            });
            destReq.on('fatalError', () => {
                fatalErrorEventCount++;
            });

            setTimeout(() => {
                destReq._onError({ message: 'ECONNREFUSED' });
            }, 50);

            setTimeout(() => {
                DestinationRequest.TIMEOUT = savedReqTimeout;

                expect(fatalErrorEventCount).eql(1);
                done();
            }, 150);
        });

        it('Should process the top "frameset" element like the "body" element (GH-1009)', done => {
            session.id = 'sessionId';
            session.injectable.scripts.push('/script1.js');
            session.injectable.scripts.push('/script2.js');

            const options = {
                url:     proxy.openSession('http://127.0.0.1:2000/page-with-frameset', session),
                headers: {
                    accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*!/!*;q=0.8'
                }
            };

            request(options, (err, res, body) => {
                const expected = fs.readFileSync('test/server/data/page-with-frameset/expected.html').toString();

                compareCode(body, expected);
                done();
            });
        });

        it('Should not process a page with the non-page content-type header (GH-1014)', done => {
            session.id = 'sessionId';

            const options = {
                url:     proxy.openSession('http://127.0.0.1:2000/GH-1014/pdf-content-type', session),
                headers: {
                    accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*!/!*;q=0.8'
                }
            };

            request(options, (err, res, body) => {
                compareCode(body, 'pdf');
                done();
            });
        });

        it('Should process a page without the content-type header (GH-1014)', done => {
            session.id = 'sessionId';

            const options = {
                url:     proxy.openSession('http://127.0.0.1:2000/GH-1014/empty-page-without-content-type/', session),
                headers: {
                    accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*!/!*;q=0.8'
                }
            };

            request(options, (err, res, body) => {
                expect(body).is.not.empty;
                done();
            });
        });

        it('Should pass authorization headers which are defined by client for cross-domain request without credentials (GH-1016)', done => {
            const options = {
                url:     proxy.openSession('http://127.0.0.1:2002/echo-headers-with-credentials', session),
                headers: {
                    'authorization':       AUTHORIZATION.valuePrefix + 'authorization',
                    'authentication-info': AUTHORIZATION.valuePrefix + 'authentication-info',
                    'proxy-authenticate':  'proxy-authenticate',
                    'proxy-authorization': 'proxy-authorization',
                    referer:               proxy.openSession('http://127.0.0.1:2000', session)
                }
            };

            options.headers[XHR_HEADERS.requestMarker] = 'true';
            options.headers[XHR_HEADERS.corsSupported] = 'true';

            request(options, (err, res, body) => {
                const requestHeaders = JSON.parse(body);

                expect(requestHeaders['authorization']).eql('authorization');
                expect(requestHeaders['authentication-info']).eql('authentication-info');
                expect(requestHeaders['proxy-authenticate']).to.be.undefined;
                expect(requestHeaders['proxy-authorization']).to.be.undefined;

                done();
            });
        });

        it('Should procees "x-frame-options" header (GH-1017)', () => {
            const getIframeProxyUrl            = url => {
                return urlUtils.getProxyUrl(url, {
                    proxyHostname: '127.0.0.1',
                    proxyPort:     1836,
                    sessionId:     session.id,
                    resourceType:  urlUtils.getResourceTypeString({ isIframe: true })
                });
            };
            const getCrossDomainIframeProxyUrl = url => {
                return urlUtils.getProxyUrl(url, {
                    proxyHostname: '127.0.0.1',
                    proxyPort:     1837,
                    sessionId:     session.id,
                    resourceType:  urlUtils.getResourceTypeString({ isIframe: true })
                });
            };

            proxy.openSession('http://127.0.0.1:2000/', session);

            const testCases = [
                {
                    url:                 proxy.openSession('http://127.0.0.1:2000/x-frame-options/DENY', session),
                    expectedHeaderValue: 'DENY'
                },
                {
                    url:                 proxy.openSession('http://127.0.0.1:2000/x-frame-options/SAMEORIGIN', session),
                    expectedHeaderValue: 'SAMEORIGIN'
                },
                {
                    url:                 proxy.openSession('http://127.0.0.1:2000/x-frame-options/ALLOW-FROM%20https%3A%2F%2Fexample.com', session),
                    expectedHeaderValue: 'ALLOW-FROM ' + proxy.openSession('https://example.com', session)
                },
                {
                    url:                 proxy.openSession('http://127.0.0.1:2000/x-frame-options/ALLOW-FROM%20http%3A%2F%2F127.0.0.1%3A2000%2Fpage', session),
                    expectedHeaderValue: 'ALLOW-FROM ' + proxy.openSession('http://127.0.0.1:2000/page', session)
                },
                {
                    url:                 getIframeProxyUrl('http://127.0.0.1:2000/x-frame-options/ALLOW-FROM%20https%3A%2F%2Fexample.com'),
                    expectedHeaderValue: 'ALLOW-FROM ' + getCrossDomainIframeProxyUrl('https://example.com')
                },
                {
                    url:                 getIframeProxyUrl('http://127.0.0.1:2000/x-frame-options/ALLOW-FROM%20http%3A%2F%2F127.0.0.1%3A2000'),
                    expectedHeaderValue: 'ALLOW-FROM ' + getIframeProxyUrl('http://127.0.0.1:2000')
                }
            ];


            const testRequest = function (testCase) {
                return new Promise(resolve => {
                    const options = {
                        url: testCase.url
                    };

                    request(options, (err, req) => {
                        expect(req.headers['x-frame-options']).eql(testCase.expectedHeaderValue);

                        resolve();
                    });
                });
            };

            return Promise.all(testCases.map(testRequest));
        });

        it('Should not raise file download if resource is fetched by setting script src (GH-1062)', done => {
            const getScriptProxyUrl        = function (url) {
                return urlUtils.getProxyUrl(url, {
                    proxyHostname: '127.0.0.1',
                    proxyPort:     1836,
                    sessionId:     session.id,
                    resourceType:  urlUtils.getResourceTypeString({ isScript: true })
                });
            };
            const options                  = {
                url:     getScriptProxyUrl('http://127.0.0.1:2000/download-script'),
                referer: proxy.openSession('http://127.0.0.1:2000', session)
            };
            const storedHandleFileDownload = session.handleFileDownload;
            let handleFileDownloadIsRaised = false;

            session.handleFileDownload = () => {
                handleFileDownloadIsRaised = true;
            };

            proxy.openSession('http://127.0.0.1:2000/', session);

            request(options, (err, res, body) => {
                expect(body).contains(scriptHeader.SCRIPT_PROCESSING_START_COMMENT);
                expect(handleFileDownloadIsRaised).to.be.false;
                session.handleFileDownload = storedHandleFileDownload;

                done();
            });
        });

        it('Should destroy a destination connection after a proxy connection was closed (GH-1106)', done => {
            let destConnectionClosed = false;
            const simpleServer       = http.createServer((req, res) => {
                res.writeHead(200, { 'content-type': 'text/event-stream; charset=utf-8' });
                res.write('\n');

                req.on('close', () => {
                    expect(destConnectionClosed).to.be.false;
                    destConnectionClosed = true;
                    simpleServer.close();
                    done();
                });
            }).listen(2222);

            proxy.openSession('http://127.0.0.1:2222/', session);

            const url      = 'http://127.0.0.1:2222/';
            const proxyUrl = urlUtils.getProxyUrl(url, {
                proxyHostname: '127.0.0.1',
                proxyPort:     1836,
                sessionId:     session.id,
                resourceType:  urlUtils.getResourceTypeString({ isEventSource: true })
            });

            const req = http.request(urlLib.parse(proxyUrl));

            req.end();

            setTimeout(() => {
                expect(destConnectionClosed).to.be.false;
                req.destroy();
            }, 400);
        });

        it('Should omit a "sourcemap" header from response (GH-1052)', done => {
            const options = {
                url:     proxy.openSession('http://127.0.0.1:2000/script', session),
                headers: {
                    'content-type': 'application/javascript; charset=utf-8'
                }
            };

            request(options, (err, res) => {
                expect(res.headers['sourcemap']).is.undefined;
                done();
            });
        });

        it('Should calculate a valid port for redirect in iframe (GH-1191)', () => {
            proxy.openSession('http://127.0.0.1:2000/', session);

            function testRedirectRequest (opts) {
                return new Promise(resolve => {
                    const options = {
                        url: urlUtils.getProxyUrl('http://127.0.0.1:2000/redirect/' +
                                                  encodeURIComponent(opts.redirectLocation),
                            {
                                proxyHostname: '127.0.0.1',
                                proxyPort:     1836,
                                sessionId:     session.id,
                                resourceType:  urlUtils.getResourceTypeString({ isIframe: true })
                            }),

                        headers: {
                            referer: urlUtils.getProxyUrl(opts.referer, {
                                proxyHostname: '127.0.0.1',
                                proxyPort:     1836,
                                sessionId:     session.id
                            })
                        }
                    };

                    request(options, (err, res) => {
                        const proxyPort = urlUtils.parseProxyUrl(res.headers['location']).proxy.port;

                        expect(proxyPort).eql(opts.expectedProxyPort);
                        resolve();
                    });
                });
            }

            return Promise.all([
                testRedirectRequest({
                    redirectLocation:  'http://127.0.0.1:2001/',
                    referer:           'http://127.0.0.1:2002/',
                    expectedProxyPort: '1836'
                }),
                testRedirectRequest({
                    redirectLocation:  'http://127.0.0.1:2000/',
                    referer:           'http://127.0.0.1:2000/',
                    expectedProxyPort: '1836'
                }),
                testRedirectRequest({
                    redirectLocation:  'http://127.0.0.1:2001/',
                    referer:           'http://127.0.0.1:2001/',
                    expectedProxyPort: '1837'
                }),
                testRedirectRequest({
                    redirectLocation:  'http://127.0.0.1:2001/',
                    referer:           'http://127.0.0.1:2000/',
                    expectedProxyPort: '1837'
                })
            ]);
        });

        it('Should process a "referrer-policy" header (GH-1195)', done => {
            const options = {
                url:     proxy.openSession('http://127.0.0.1:2000/referrer-policy', session),
                headers: {
                    accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*!/!*;q=0.8'
                }
            };

            request(options, (err, res) => {
                expect(res.headers['referrer-policy']).eql('unsafe-url');
                done();
            });
        });

        it('Should transform a "Refresh" header (GH-1354)', () => {
            function testRefreshHeader (url, baseUrl) {
                return new Promise(resolve => {
                    const options = {
                        url: proxy.openSession('http://127.0.0.1:2000/refresh-header/' +
                                               encodeURIComponent(url), session),

                        headers: {
                            accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*!/!*;q=0.8'
                        }
                    };

                    request(options, (err, res) => {
                        if (baseUrl)
                            url = urlLib.resolve(baseUrl, url);

                        const expectedValue = '0;url=' + proxy.openSession(url, session);

                        expect(res.headers['refresh']).eql(expectedValue);
                        resolve();
                    });
                });
            }

            return Promise.all([
                testRefreshHeader('/index.html', 'http://127.0.0.1:2000'),
                testRefreshHeader('http://example.com/index.html')
            ]);
        });

        it('Should close a proxy connection if a connection to destination server hang up (GH-1384)', () => {
            const agent        = new http.Agent({
                keepAlive:      true,
                keepAliveMsecs: 10000
            });
            let mainPageSocket = null;
            let reqOptions     = null;
            let error          = null;

            const server = net.createServer(socket => {
                socket.on('data', data => {
                    const url = data.toString().match(/GET ([\s\S]+) HTTP/)[1];

                    if (url === '/') {
                        mainPageSocket = socket;

                        socket.setKeepAlive(true, 10000);
                        socket.write([
                            'HTTP/1.1 302 Object Moved',
                            'Location: /redirect',
                            'Content-Length: 0',
                            '',
                            ''
                        ].join('\r\n'));
                    }
                    else if (url === '/redirect') {
                        if (mainPageSocket) {
                            expect(mainPageSocket).eql(socket);
                            mainPageSocket.end();

                            mainPageSocket = null;
                        }
                        else {
                            socket.write([
                                'HTTP/1.1 200 Ok',
                                'Content-Length: 5',
                                '',
                                'Hello'
                            ].join('\r\n'));
                        }
                    }
                });
            });

            function sendRequest (options) {
                return new Promise((resolve, reject) => {
                    const req = http.request(options, res => {
                        const chunks = [];

                        res.on('data', chunk => chunks.push(chunk));
                        res.on('end', () => resolve(Buffer.concat(chunks).toString()));
                    });

                    req.on('error', reject);
                    req.end();
                });
            }

            session.handlePageError = (ctx, err) => {
                error = err;
            };

            return getFreePort()
                .then(port => new Promise(resolve => server.listen(port, resolve.bind(null, port))))
                .then(port => {
                    const proxyUrl = proxy.openSession(`http://127.0.0.1:${port}/`, session);

                    reqOptions = Object.assign(urlLib.parse(proxyUrl), {
                        method:  'GET',
                        agent:   agent,
                        headers: { accept: 'text/html' }
                    });

                    return sendRequest(reqOptions);
                })
                .then(body => {
                    expect(body).eql('');

                    reqOptions.path += 'redirect';

                    return sendRequest(reqOptions);
                })
                .catch(err => {
                    expect(err.toString()).eql('Error: socket hang up');

                    return sendRequest(reqOptions);
                })
                .then(body => {
                    expect(body).include('Hello');
                    expect(error).to.be.null;
                    server.close();
                });
        });
    });
});
