const fs                                   = require('fs');
const os                                   = require('os');
const http                                 = require('http');
const https                                = require('https');
const EventEmitter                         = require('events').EventEmitter;
const urlLib                               = require('url');
const request                              = require('request-promise-native');
const path                                 = require('path');
const net                                  = require('net');
const { expect }                           = require('chai');
const express                              = require('express');
const read                                 = require('read-file-relative').readSync;
const selfSignedCertificate                = require('openssl-self-signed-certificate');
const { getFreePort }                      = require('endpoint-utils');
const WebSocket                            = require('ws');
const { noop }                             = require('lodash');
const isWindows                            = require('os-family').win;
const promisifyEvent                       = require('promisify-event');
const semver                               = require('semver');
const INTERNAL_HEADERS                     = require('../../lib/request-pipeline/internal-header-names');
const SAME_ORIGIN_CHECK_FAILED_STATUS_CODE = require('../../lib/request-pipeline/xhr/same-origin-check-failed-status-code');
const Proxy                                = require('../../lib/proxy');
const Session                              = require('../../lib/session');
const StateSnaphot                         = require('../../lib/session/state-snapshot');
const ResponseMock                         = require('../../lib/request-pipeline/request-hooks/response-mock');
const RequestFilterRule                    = require('../../lib/request-pipeline/request-hooks/request-filter-rule');
const DestinationRequest                   = require('../../lib/request-pipeline/destination-request');
const RequestPipelineContext               = require('../../lib/request-pipeline/context');
const scriptHeader                         = require('../../lib/processing/script/header');
const resourceProcessor                    = require('../../lib/processing/resources/');
const { gzip }                             = require('../../lib/utils/promisified-functions');
const urlUtils                             = require('../../lib/utils/url');
const Asar                                 = require('../../lib/utils/asar');

const EMPTY_PAGE_MARKUP = '<html></html>';
const TEST_OBJ          = {
    prop1: 'value1',
    prop2: 'value2'
};

const ENSURE_URL_TRAILING_SLASH_TEST_CASES = [
    {
        url:                   'http://example.com',
        shoudAddTrailingSlash: true
    },
    {
        url:                   'https://localhost:8080',
        shoudAddTrailingSlash: true
    },
    {
        url:                   'about:blank',
        shoudAddTrailingSlash: false
    },
    {
        url:                   'http://example.com/page.html',
        shoudAddTrailingSlash: false
    },
    {
        url:                   'file://localhost/etc/fstab', // Unix file URI scheme
        shoudAddTrailingSlash: false
    },
    {
        url:                   'file:///etc/fstab', // Unix file URI scheme
        shoudAddTrailingSlash: false
    },
    {
        url:                   'file://localhost/c:/WINDOWS/clock.avi', // Windows file URI scheme
        shoudAddTrailingSlash: false
    },
    {
        url:                   'file:///c:/WINDOWS/clock.avi', // Windows file URI scheme
        shoudAddTrailingSlash: false
    }
];

const PAGE_ACCEPT_HEADER = 'text/html,application/xhtml+xml,application/xml;q=0.9,*!/!*;q=0.8';

const PROXY_HOSTNAME = '127.0.0.1';

let longResponseSocket = null;

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
    code1 = normalizeCode(code1);
    code2 = normalizeCode(code2);

    expect(code1).eql(code2);
}

function newLineReplacer (content) {
    return Buffer.from(content.toString().replace(/\r\n|\n/gm, '\r\n'));
}

function getFileProtocolUrl (filePath) {
    return 'file:' + (isWindows ? '///' : '//') + path.resolve(__dirname, filePath).replace(/\\/g, '/');
}

function replaceLastAccessedTime (cookie) {
    return cookie.replace(/[a-z0-9]+=/, '%lastAccessed%=');
}

describe('Proxy', () => {
    let destServer        = null;
    let crossDomainServer = null;
    let proxy             = null;
    let session           = null;
    let sslOptions        = null;

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

        app.get('/cookie-server-sync/:cookies', (req, res) => {
            res
                .set('set-cookie', decodeURIComponent(req.params.cookies))
                .end();
        });

        app.get('/cookie/set-and-redirect', (req, res) => {
            res.statusCode = 302;

            res.setHeader('Set-Cookie', [
                'Test=value; Path=/cookie',
                'Test2=' + new Array(350).join('(big cookie)'),
                'value without key'
            ]);
            res.set('location', '/cookie/echo');

            res.end();
        });

        app.get('/cookie/set-cookie-cors', (req, res) => {
            res
                .set('set-cookie', 'cookie-for=example; path=/')
                .set('access-control-allow-origin', 'http://example.com')
                .set('access-control-allow-credentials', 'false')
                .end();
        });

        app.get('/cookie/set1', (req, res) => {
            res.cookie('Set1_1', 'value1');
            res.cookie('Set1_2', 'value2');

            res.end();
        });

        app.get('/cookie/set2', (req, res) => {
            res.cookie('Set2_1', 'value1');
            res.cookie('Set2_2', 'value2');

            res.end();
        });

        app.get('/cookie/echo', (req, res) => {
            res.end('%% ' + req.headers['cookie'] + ' %%');
        });

        app.get('/page', (req, res) => {
            res.setHeader('content-type', 'text/html');
            res.end(fs.readFileSync('test/server/data/page/src.html').toString());
        });

        app.get('/page-with-custom-client-script', (req, res) => {
            res.setHeader('content-type', 'text/html');
            res.end(fs.readFileSync('test/server/data/page-with-custom-client-script/src.html').toString());
        });

        app.get('/html-import-page', (req, res) => {
            res.setHeader('content-type', 'text/html');
            res.end(fs.readFileSync('test/server/data/html-import-page/src.html').toString());
        });

        app.get('/html-import-page-in-iframe', (req, res) => {
            res.setHeader('content-type', 'text/html');
            res.end(fs.readFileSync('test/server/data/html-import-page/src-iframe.html').toString());
        });

        app.get('/page-with-frameset', (req, res) => {
            res.setHeader('content-type', 'text/html');
            res.end(fs.readFileSync('test/server/data/page-with-frameset/src.html').toString());
        });

        app.get('/script', (req, res) => {
            res.setHeader('content-type', 'application/javascript; charset=utf-8');
            res.set('sourcemap', '/src.js.map');
            res.end(fs.readFileSync('test/server/data/script/src.js').toString());
        });

        app.get('/stylesheet', (req, res) => {
            res.end(fs.readFileSync('test/server/data/stylesheet/src.css').toString());
        });

        app.get('/manifest', (req, res) => {
            res.setHeader('content-type', 'text/cache-manifest');
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
            res.setHeader('content-type', 'text/html; charset=utf-8');
            res.end('42');
        });

        app.get('/download', (req, res) => {
            res.set('content-disposition', 'attachment;filename=DevExpressTestCafe-15.1.2.exe');
            res.end(EMPTY_PAGE_MARKUP);

        });

        app.options('/preflight', (req, res) => res.end('42'));

        app.get('/authenticate', (req, res) => {
            res
                .status(401)
                .set('www-authenticate', 'Basic realm="Login"')
                .set('proxy-authenticate', 'Digital realm="Login"')
                .end();
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
            res.setHeader('content-type', 'text/html; charset=utf-8');
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

        app.get('/echo-raw-headers-names', (req, res) => {
            const rawHeadersNames = req.rawHeaders.filter((str, index) => !(index & 1));

            res.end(JSON.stringify(rawHeadersNames));
        });

        app.get('/empty-response', (req, res) => {
            for (const header in req.headers)
                res.set(header, req.headers[header]);

            res.end();
        });

        app.get('/wait/:ms', (req, res) => {
            setTimeout(() => res.end('text'), req.params.ms);
        });

        app.get('/GH-1014/pdf-content-type', (req, res) => {
            res.setHeader('content-type', 'content-type');
            res.end('pdf');
        });

        app.get('/GH-1014/empty-page-without-content-type/', (req, res) => res.end(''));

        app.get('/GH-1666', (req, res) => {
            res
                .set('content-type', 'text/html')
                .set('content-security-policy', 'frame-ancestors http:')
                .set('x-frame-options', 'deny')
                .send('');
        });

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
            res
                .status(302)
                .set('location', decodeURIComponent(req.params.url))
                .end();
        });

        app.get('/redirect-with-status/:statusCode', (req, res) => {
            res
                .status(+req.params.statusCode)
                .set('location', 'http://localhost/')
                .end();
        });

        app.get('/referrer-policy', (req, res) => {
            res.setHeader('referrer-policy', 'no-referrer');
            res.end('42');
        });

        app.get('/refresh-header/:url', (req, res) => {
            res.setHeader('refresh', '0;url=' + decodeURIComponent(req.params.url));
            res.end('42');
        });

        app.get('/json', (req, res) => {
            res.json(TEST_OBJ);
        });

        app.get('/large-json', (req, res) => {
            const result = {};
            const COUNT_ITEMS = 3000;

            for (let i = 0; i < COUNT_ITEMS; i++) {
                const item = {
                    'strProp':  'strProp' + i,
                    'intProp':  i,
                    'boolProp': !!(i % 2)
                };

                result[i] = item;
            }

            res.json(result);
        });

        app.get('/GH-1915', (req, res) => {
            gzip('<h1>Compressible response content.</h1>')
                .then(data => {
                    res
                        .status(200)
                        .set('content-type', 'text/html')
                        .set('content-encoding', 'gzip')
                        .end(data.slice(0, data.length - 8));
                });
        });

        app.get('/long-response', (req, res) => {
            let bodyPartCount = 5;
            const writeBody = () => {
                res.write('this is body part');

                if (--bodyPartCount)
                    setTimeout(writeBody, 1000);
                else
                    res.end();
            };

            longResponseSocket = res.socket;

            res.status(200);
            writeBody();
        });

        app.get('/script-with-import-statement', (req, res) => {
            res
                .status(200)
                .set('content-type', 'text/javascript')
                .end('import m from "module-name";');
        });

        destServer = app.listen(2000);

        const crossDomainApp = express();

        crossDomainApp.get('/without-access-control-allow-origin-header', (req, res) => {
            res.setHeader('content-type', 'text/html');
            res.end(EMPTY_PAGE_MARKUP);
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

        app.get('/link-prefetch-header', (req, res) => {
            res.setHeader('link', '<http://some.url.com>; rel=prefetch');
            res.end('42');
        });

        crossDomainServer = crossDomainApp.listen(2002);
    });

    after(() => {
        destServer.close();
        crossDomainServer.close();
    });

    beforeEach(() => {
        session = new Session();

        session.windowId = '12345';

        session.getAuthCredentials = () => null;
        session.handleFileDownload = () => void 0;

        proxy = new Proxy(PROXY_HOSTNAME, 1836, 1837, { ssl: sslOptions });
    });

    afterEach(() => {
        proxy.close();
    });

    describe('Session', () => {
        it('Should ensure a trailing slash on openSession() (GH-1426)', () => {
            function getExpectedProxyUrl (testCase) {
                const proxiedUrl = urlUtils.getProxyUrl(testCase.url, {
                    proxyHostname: PROXY_HOSTNAME,
                    proxyPort:     1836,
                    sessionId:     session.id,
                    windowId:      session.windowId
                });

                return proxiedUrl + (testCase.shoudAddTrailingSlash ? '/' : '');
            }

            function testAddingTrailingSlash (testCases) {
                testCases.forEach(function (testCase) {
                    const actualUrl = proxy.openSession(testCase.url, session);

                    expect(actualUrl).eql(getExpectedProxyUrl(testCase));
                });
            }

            testAddingTrailingSlash(ENSURE_URL_TRAILING_SLASH_TEST_CASES);
        });

        it('Should omit default port on openSession()', () => {
            const PORT_RE = /:([0-9][0-9]*)/;

            function getExpectedProxyUrl (url, shouldOmitPort) {
                url = shouldOmitPort ? url.replace(PORT_RE, '') : url;

                return urlUtils.getProxyUrl(url, {
                    proxyHostname: PROXY_HOSTNAME,
                    proxyPort:     1836,
                    sessionId:     session.id,
                    windowId:      session.windowId
                });
            }

            function testUrl (url, shouldOmitPort) {
                const actualUrl = proxy.openSession(url, session);

                expect(actualUrl).eql(getExpectedProxyUrl(url, shouldOmitPort));
            }

            function testDefaultPortOmitting (protocol, defaultPort, defaultPortForAnotherProtocol) {
                testUrl(protocol + '//localhost:' + defaultPort + '/', true);
                testUrl(protocol + '//127.0.0.1:' + defaultPort + '/', true);
                testUrl(protocol + '//example.com:' + defaultPort + '/', true);
                testUrl(protocol + '//example.com:' + defaultPort + '/page.html', true);
                testUrl(protocol + '//localhost:' + defaultPortForAnotherProtocol + '/', false);
                testUrl(protocol + '//localhost:2343/', false);
            }

            testDefaultPortOmitting('http:', '80', '443');
            testDefaultPortOmitting('https:', '443', '80');
        });

        it('Should pass DNS errors to session', done => {
            session.handlePageError = (ctx, err) => {
                expect(err).eql('Failed to find a DNS-record for the resource at <a href="http://www.some-unresolvable.url/">http://www.some-unresolvable.url/</a>.');
                ctx.res.end();
                done();
                return true;
            };

            const options = {
                url:     proxy.openSession('http://www.some-unresolvable.url', session),
                headers: {
                    accept: PAGE_ACCEPT_HEADER
                }
            };

            request(options);
        });

        it('Should pass protocol DNS errors for existing host to session', done => {
            session.handlePageError = (ctx, err) => {
                expect(err).eql('Failed to find a DNS-record for the resource at <a href="https://127.0.0.1:2000/">https://127.0.0.1:2000/</a>.');
                ctx.res.end();
                done();
                return true;
            };

            const options = {
                url:     proxy.openSession('https://127.0.0.1:2000', session),
                headers: {
                    accept: PAGE_ACCEPT_HEADER
                }
            };

            request(options);
        });

        it('Should pass service message processing to session', () => {
            const options = {
                method: 'POST',
                url:    'http://localhost:1836/messaging',
                json:   true,
                body:   {
                    cmd:       'ServiceTestCmd',
                    data:      '42',
                    sessionId: session.id
                }
            };

            proxy.openSession('http://example.com', session);

            session['ServiceTestCmd'] = (msg, serverInfo) => {
                expect(serverInfo).to.be.an('object');
                return 'answer: ' + msg.data;
            };

            return request(options)
                .then(parsedBody => {
                    expect(parsedBody).eql('answer: 42');
                });
        });

        describe('Task script', () => {
            it('Regular', () => {
                function testTaskScriptRequest (url, scriptBody) {
                    const options = {
                        headers: {
                            referer: proxy.openSession('http://example.com', session)
                        },

                        url:                     url,
                        resolveWithFullResponse: true
                    };

                    return request(options)
                        .then(res => {
                            expect(res.body).contains(scriptBody);
                            expect(res.headers['content-type']).eql('application/x-javascript');
                            expect(res.headers['cache-control']).eql('no-cache, no-store, must-revalidate');
                            expect(res.headers['pragma']).eql('no-cache');
                        });
                }

                session._getPayloadScript       = () => 'PayloadScript';
                session._getIframePayloadScript = () => 'IframePayloadScript';

                return Promise.all([
                    testTaskScriptRequest('http://localhost:1836/task.js', 'PayloadScript'),
                    testTaskScriptRequest('http://localhost:1836/iframe-task.js', 'IframePayloadScript')
                ]);
            });

            it('Error', () => {
                const options = {
                    headers: {
                        referer: proxy.openSession('http://example.com', {})
                    },

                    url: 'http://localhost:1836/task.js',
                };

                return request(options)
                    .then(() => {
                        throw new Error('Should throw an error.');
                    })
                    .catch(err => {
                        expect(err.message).eql('500 - "Session is not opened in proxy"');
                    });
            });
        });

        it('Should convert origin host and protocol to lower case', () => {
            // BUG: GH-1
            const proxiedUrl = proxy.openSession('hTtp://ExaMple.Com:123/paTh/Image?Name=Value&#Hash', session);

            expect(proxiedUrl).to.have.string('http://example.com:123/paTh/Image?Name=Value&#Hash');
        });

        it('Should handle special pages', () => {
            const specialPageProxyUrls   = urlUtils.SPECIAL_PAGES.map(url => proxy.openSession(url, session));
            const testSpecialPageRequest = url => {
                const options = {
                    url:     url,
                    headers: {
                        accept:  'text/html',
                        headers: { accept: PAGE_ACCEPT_HEADER }
                    }
                };

                return request(options)
                    .then(body => {
                        expect(body).to.not.empty;
                    });
            };

            return Promise.all(specialPageProxyUrls.map(testSpecialPageRequest));
        });

        it('Should set up the prevent caching headers', () => {
            session.disablePageCaching = true;

            const options = {
                headers: {
                    referer: proxy.openSession('http://example.com', session),
                    accept:  PAGE_ACCEPT_HEADER,
                    etag:    '<value>',
                    expires: 'date'
                },

                url:                     proxy.openSession('http://127.0.0.1:2000/page/', session),
                resolveWithFullResponse: true
            };

            return request(options)
                .then(res => {
                    expect(res.headers['cache-control']).eql('no-cache, no-store, must-revalidate');
                    expect(res.headers['pragma']).eql('no-cache');
                    expect('etag' in res.headers).to.be.false;
                    expect('expires' in res.headers).to.be.false;

                    session.disablePageCaching = false;
                });
        });

        it('Should correctly cache scripts that contain session id in the import statement', () => {
            const getUrlFromBodyReqExp = /[\S\s]+import m from\s+"([^"]+)[\S\s]+/g;
            const someSession          = new Session();

            someSession.id                 = 'dIonisses';
            someSession.windowId           = '54321';
            someSession.getAuthCredentials = () => null;
            someSession.handleFileDownload = () => void 0;

            let scriptProxyUrl = urlUtils.getProxyUrl('http://localhost:2000/script-with-import-statement', {
                proxyHostname: PROXY_HOSTNAME,
                proxyPort:     1836,
                sessionId:     someSession.id,
                windowId:      someSession.windowId,
                resourceType:  urlUtils.getResourceTypeString({ isScript: true })
            });

            proxy.openSession('http://localhost:2000/', someSession);

            return request(scriptProxyUrl)
                .then(body => {
                    const importUrl = body.replace(getUrlFromBodyReqExp, '$1');

                    expect(importUrl).eql('http://127.0.0.1:1836/dIonisses*54321!s!utf-8/http://localhost:2000/module-name');


                    session.id     = 'sessionId';
                    scriptProxyUrl = urlUtils.getProxyUrl('http://localhost:2000/script-with-import-statement', {
                        proxyHostname: PROXY_HOSTNAME,
                        proxyPort:     1836,
                        sessionId:     session.id,
                        windowId:      session.windowId,
                        resourceType:  urlUtils.getResourceTypeString({ isScript: true })
                    });

                    proxy.closeSession(someSession);
                    proxy.openSession('http://localhost:2000/', session);

                    return request(scriptProxyUrl);
                })
                .then(body => {
                    const importUrl = body.replace(getUrlFromBodyReqExp, '$1');

                    expect(importUrl).eql('http://127.0.0.1:1836/sessionId*12345!s!utf-8/http://localhost:2000/module-name');
                });
        });
    });

    describe('Cookies', () => {
        it('Should handle "Cookie" and "Set-Cookie" headers', () => {
            const options = {
                url:            proxy.openSession('http://127.0.0.1:2000/cookie/set-and-redirect', session),
                followRedirect: true
            };

            return request(options)
                .then(body => {
                    expect(body).eql('%% Test=value; value without key %%');
                });
        });

        it('Should ignore invalid cookies', () => {
            session.cookies.setByServer('http://example.com', [
                'test1=test1',
                'test2=te\u0001st2',
                'test3=te\x02st3'
            ]);

            expect(session.cookies.getClientString('http://example.com')).eql('test1=test1');
        });

        describe('Server synchronization with client', () => {
            it('Should generate cookie for synchronization', function () {
                const cookie  = encodeURIComponent('aaa=111;path=/path');
                const options = {
                    url: proxy.openSession('http://127.0.0.1:2000/cookie-server-sync/' + cookie, session),

                    resolveWithFullResponse: true,
                    simple:                  false
                };

                return request(options)
                    .then(res => {
                        expect(replaceLastAccessedTime(res.headers['set-cookie'][0]))
                            .eql(`s|${session.id}|aaa|127.0.0.1|%2Fpath||%lastAccessed%=111;path=/`);
                    });
            });

            it('Should generate cookie for synchronization for iframe', function () {
                const cookie  = encodeURIComponent('aaa=111;path=/path');
                const options = {
                    url: urlUtils.getProxyUrl('http://127.0.0.1:2000/cookie-server-sync/' + cookie, {
                        proxyHostname: PROXY_HOSTNAME,
                        proxyPort:     1836,
                        sessionId:     session.id,
                        resourceType:  urlUtils.getResourceTypeString({ isIframe: true })
                    }),

                    headers:                 { accept: 'text/html' },
                    resolveWithFullResponse: true,
                    simple:                  false
                };

                proxy.openSession('http://127.0.0.1:2000/', session);

                return request(options)
                    .then(res => {
                        expect(replaceLastAccessedTime(res.headers['set-cookie'][0]))
                            .eql(`s|${session.id}|aaa|127.0.0.1|%2Fpath||%lastAccessed%=111;path=/`);
                    });
            });

            it('Should remove obsolete synchronization cookie', function () {
                const obsoleteTime = (new Date().getTime() - 1000).toString(36);
                const cookie       = encodeURIComponent('bbb=321;path=/');
                const options      = {
                    url:     proxy.openSession('http://127.0.0.1:2000/cookie-server-sync/' + cookie, session),
                    headers: {
                        cookie: [
                            `s|${session.id}|aaa|127.0.0.1|%2F||123456788=temp`,
                            `s|${session.id}|aaa|127.0.0.1|%2F||123456789=test`,
                            `s|${session.id}|bbb|127.0.0.1|%2F||${obsoleteTime}=321`
                        ].join('; ')
                    },

                    resolveWithFullResponse: true,
                    simple:                  false
                };

                return request(options)
                    .then(res => {
                        expect(res.headers['set-cookie'][0])
                            .eql(`s|${session.id}|aaa|127.0.0.1|%2F||123456788=;path=/;expires=Thu, 01 Jan 1970 00:00:01 GMT`);
                        expect(res.headers['set-cookie'][1])
                            .eql(`s|${session.id}|bbb|127.0.0.1|%2F||${obsoleteTime}=;path=/;expires=Thu, 01 Jan 1970 00:00:01 GMT`);
                        expect(replaceLastAccessedTime(res.headers['set-cookie'][2]))
                            .eql(`s|${session.id}|bbb|127.0.0.1|%2F||%lastAccessed%=321;path=/`);
                    });
            });

            it('Should skip httpOnly cookie', function () {
                const cookie  = encodeURIComponent('ccc=123;httpOnly');
                const options = {
                    url: proxy.openSession('http://127.0.0.1:2000/cookie-server-sync/' + cookie, session),

                    resolveWithFullResponse: true,
                    simple:                  false
                };

                return request(options)
                    .then(res => {
                        expect(res.headers['set-cookie']).eql(void 0);
                    });
            });
        });

        describe('Client synchronization with server', () => {
            it('Should process cookie with localhost domain', () => {
                const options = {
                    url:     proxy.openSession('http://127.0.0.1:2000/cookie/echo', session),
                    headers: {
                        cookie: `c|${session.id}|Test1|127.0.0.1|%2F||1fdkm5ln1=Data1; ` +
                                `c|${session.id}|Test2|localhost|%2F||1fdkm5ln1=Data2`
                    }
                };

                return request(options)
                    .then(body => {
                        expect(body).eql('%% Test1=Data1 %%');
                        expect(session.cookies.getClientString('http://127.0.0.1/')).eql('Test1=Data1');
                        expect(session.cookies.getClientString('http://localhost/')).eql('Test2=Data2');
                    });
            });

            it('Should remove sync cookie from client if it contains only the client flag (without the window flag)', () => {
                const options = {
                    url:     proxy.openSession('http://127.0.0.1:2000/cookie/echo', session),
                    headers: {
                        cookie: `c|${session.id}|Test1|127.0.0.1|%2F||1fdkm5ln1=Data1; ` +
                                `cw|${session.id}|Test2|127.0.0.1|%2F||1fdkm5ln1=Data2`
                    },

                    resolveWithFullResponse: true
                };

                return request(options)
                    .then(res => {
                        expect(res.body).eql('%% Test1=Data1; Test2=Data2 %%');
                        expect(res.headers['set-cookie'].length).eql(1);
                        expect(res.headers['set-cookie'][0])
                            .eql(`c|${session.id}|Test1|127.0.0.1|%2F||1fdkm5ln1=;path=/;expires=Thu, 01 Jan 1970 00:00:01 GMT`);
                        expect(session.cookies.getClientString('http://127.0.0.1:12354/')).eql('Test1=Data1; Test2=Data2');
                    });
            });

            it('Should consider the path parameter', () => {
                const options = {
                    url:     proxy.openSession('http://127.0.0.1:2000/cookie/echo', session),
                    headers: {
                        cookie: `c|${session.id}|Test1|example.com|%2Fcookie||1fdkm5ln1=Data1; ` +
                                `c|${session.id}|Test2|example.com|%2Fpath||1fdkm5ln1=Data2; ` +
                                `c|${session.id}|Test3|example.com|%2F||1fdkm5ln1=Data3`
                    }
                };

                return request(options)
                    .then(() => {
                        expect(session.cookies.getClientString('http://example.com/')).eql('Test3=Data3');
                        expect(session.cookies.getClientString('http://example.com/cookie')).eql('Test1=Data1; Test3=Data3');
                        expect(session.cookies.getClientString('http://example.com/path')).eql('Test2=Data2; Test3=Data3');
                    });
            });
        });
    });

    describe('Headers', () => {
        it('Should omit a "link" header from response (https://github.com/DevExpress/testcafe/issues/2528)', () => {
            const options = {
                url:                     proxy.openSession('http://127.0.0.1:2000/link-prefetch-header', session),
                resolveWithFullResponse: true
            };

            return request(options)
                .then(res => {
                    expect(res.headers['link']).is.undefined;
                });
        });

        it('Should process the `www-authenticate` header', () => {
            const options = {
                url:                     proxy.openSession('http://127.0.0.1:2000/authenticate', session),
                resolveWithFullResponse: true,
                simple:                  false
            };

            return request(options)
                .then(res => {
                    expect(res.headers['www-authenticate']).is.undefined;
                    expect(res.headers['proxy-authenticate']).is.undefined;
                    expect(res.headers[INTERNAL_HEADERS.wwwAuthenticate]).eql('Basic realm="Login"');
                    expect(res.headers[INTERNAL_HEADERS.proxyAuthenticate]).eql('Digital realm="Login"');
                });
        });

        describe('Location header', () => {
            it('Should ensure a trailing slash on location header (GH-1426)', () => {
                function getExpectedProxyUrl (testCase) {
                    const proxiedUrl = urlUtils.getProxyUrl(testCase.url, {
                        proxyHostname: PROXY_HOSTNAME,
                        proxyPort:     1836,
                        sessionId:     session.id,
                        windowId:      session.windowId
                    });

                    return proxiedUrl + (testCase.shoudAddTrailingSlash ? '/' : '');
                }

                const testLocationHeaderValue = testCase => {
                    const proxiedUrl = proxy.openSession(testCase.url, session);
                    const encodedUrl = encodeURIComponent(proxiedUrl);
                    const options    = {
                        url: 'http://127.0.0.1:2000/redirect/' + encodedUrl,

                        resolveWithFullResponse: true,
                        followRedirect:          false,
                        simple:                  false,
                    };

                    return request(options)
                        .then(res => {
                            expect(res.headers['location']).eql(getExpectedProxyUrl(testCase));
                        });
                };

                return Promise.all(ENSURE_URL_TRAILING_SLASH_TEST_CASES.map(testLocationHeaderValue));
            });

            it('Should omit the default port on location header', () => {
                const PORT_RE = /:([0-9][0-9]*)/;

                function getExpectedProxyUrl (url, shouldOmitPort) {
                    url = shouldOmitPort ? url.replace(PORT_RE, '') : url;

                    return urlUtils.getProxyUrl(url, {
                        proxyHostname: PROXY_HOSTNAME,
                        proxyPort:     1836,
                        sessionId:     session.id,
                        windowId:      session.windowId
                    });
                }

                function testUrl (url, shouldOmitPort) {
                    const proxiedUrl = proxy.openSession(url, session);
                    const encodedUrl = encodeURIComponent(proxiedUrl);
                    const options    = {
                        url: 'http://127.0.0.1:2000/redirect/' + encodedUrl,

                        resolveWithFullResponse: true,
                        followRedirect:          false,
                        simple:                  false
                    };

                    return request(options)
                        .then(res => {
                            expect(res.headers['location']).eql(getExpectedProxyUrl(url, shouldOmitPort));
                        });
                }

                function testDefaultPortOmitting (protocol, defaultPort, defaultPortForAnotherProtocol) {
                    return Promise.all([
                        testUrl(protocol + '//localhost:' + defaultPort + '/', true),
                        testUrl(protocol + '//127.0.0.1:' + defaultPort + '/', true),
                        testUrl(protocol + '//example.com:' + defaultPort + '/', true),
                        testUrl(protocol + '//example.com:' + defaultPort + '/page.html', true),
                        testUrl(protocol + '//localhost:' + defaultPortForAnotherProtocol + '/', false),
                        testUrl(protocol + '//localhost:2343/', false)
                    ]);
                }

                return Promise.all([
                    testDefaultPortOmitting('http:', '80', '443'),
                    testDefaultPortOmitting('https:', '443', '80')
                ]);
            });
        });
    });

    describe('XHR same-origin policy', () => {
        it('Should restrict requests from other domain', () => {
            const options = {
                url:                     proxy.openSession('http://127.0.0.1:2000/page/plain-text', session),
                resolveWithFullResponse: true,
                headers:                 {
                    referer:                        proxy.openSession('http://example.com', session),
                    [INTERNAL_HEADERS.credentials]: 'same-origin'
                }
            };

            return request(options)
                .then(res => {
                    expect(res.statusCode).eql(SAME_ORIGIN_CHECK_FAILED_STATUS_CODE);
                    expect(res.body).to.be.empty;
                });
        });

        it('Should restrict requests from file protocol to some domain', () => {
            const options = {
                url:                     proxy.openSession('http://127.0.0.1:2000/page/plain-text', session),
                resolveWithFullResponse: true,
                headers:                 {
                    referer:                        proxy.openSession('file:///path/page.html', session),
                    [INTERNAL_HEADERS.credentials]: 'same-origin'
                }
            };

            return request(options)
                .then(res => {
                    expect(res.statusCode).eql(SAME_ORIGIN_CHECK_FAILED_STATUS_CODE);
                    expect(res.body).to.be.empty;
                });
        });

        it('Should restrict requests between file urls', () => {
            const options = {
                url:                     proxy.openSession(getFileProtocolUrl('./data/stylesheet/src.css'), session),
                resolveWithFullResponse: true,
                headers:                 {
                    referer:                        proxy.openSession('file:///path/page.html', session),
                    [INTERNAL_HEADERS.credentials]: 'same-origin'
                }
            };

            return request(options)
                .then(res => {
                    expect(res.statusCode).eql(SAME_ORIGIN_CHECK_FAILED_STATUS_CODE);
                    expect(res.body).to.be.empty;
                });
        });

        it('Should allow preflight requests from other domain', () => {
            const options = {
                method:                  'OPTIONS',
                url:                     proxy.openSession('http://127.0.0.1:2000/preflight', session),
                resolveWithFullResponse: true,
                headers:                 {
                    referer:                        proxy.openSession('http://example.com', session),
                    [INTERNAL_HEADERS.credentials]: 'same-origin'
                }
            };

            return request(options)
                .then(res => {
                    expect(res.statusCode).eql(200);
                    expect(res.body).eql('42');
                });
        });

        it('Should allow requests from other domain if CORS is enabled and allowed origin is wildcard ', () => {
            const options = {
                url:                     proxy.openSession('http://127.0.0.1:2000/xhr-origin/allow-any', session),
                resolveWithFullResponse: true,
                headers:                 {
                    referer:                        proxy.openSession('http://example.com', session),
                    [INTERNAL_HEADERS.credentials]: 'same-origin'
                }
            };

            return request(options)
                .then(res => {
                    expect(res.statusCode).eql(200);
                    expect(res.body).eql('42');
                });
        });

        it('Should allow requests from other domain if CORS is enabled and origin is allowed', () => {
            const options = {
                url:                     proxy.openSession('http://127.0.0.1:2000/xhr-origin/allow-provided', session),
                resolveWithFullResponse: true,
                headers:                 {
                    referer:                        proxy.openSession('http://example.com', session),
                    'x-allow-origin':               'http://example.com',
                    [INTERNAL_HEADERS.credentials]: 'same-origin'
                }
            };

            return request(options)
                .then(res => {
                    expect(res.statusCode).eql(200);
                    expect(res.body).eql('42');
                });
        });

        it('Should allow requests from other domain if it is "not modified" (GH-617)', () => {
            const options = {
                url:                     proxy.openSession('http://127.0.0.1:2000/304', session),
                resolveWithFullResponse: true,
                headers:                 {
                    referer:                        proxy.openSession('http://example.com', session),
                    'if-modified-since':            'Thu, 01 Aug 2013 18:31:48 GMT',
                    [INTERNAL_HEADERS.credentials]: 'same-origin'
                }
            };

            return request(options)
                .then(() => {
                    expect.fail('Request should raise an "304" error');
                })
                .catch(err => {
                    expect(err.statusCode).eql(304);
                });
        });

        it('Should apply "set-cookie" header if the credentials check is passed but request is restricted (GH-2166)', () => {
            const options = {
                url:                     proxy.openSession('http://127.0.0.1:2000/cookie-server-sync/key=value;%20path=%2F', session),
                resolveWithFullResponse: true,
                headers:                 {
                    referer:                        proxy.openSession('http://example.com', session),
                    [INTERNAL_HEADERS.credentials]: 'include',
                    [INTERNAL_HEADERS.origin]:      'http://example.com'
                }
            };

            return request(options)
                .then(res => {
                    expect(res.statusCode).eql(SAME_ORIGIN_CHECK_FAILED_STATUS_CODE);
                    expect(replaceLastAccessedTime(res.headers['set-cookie'][0]))
                        .eql(`s|${session.id}|key|127.0.0.1|%2F||%lastAccessed%=value;path=/`);
                    expect(session.cookies.getClientString('http://127.0.0.1:2000')).eql('key=value');
                });
        });

        it('Should not apply "set-cookie" header if the credentials check is not passed (GH-2166)', () => {
            const options = {
                url:                     proxy.openSession('http://127.0.0.1:2000/cookie/set-cookie-cors', session),
                resolveWithFullResponse: true,
                headers:                 {
                    referer:                        proxy.openSession('http://example.com', session),
                    [INTERNAL_HEADERS.credentials]: 'same-origin',
                    [INTERNAL_HEADERS.origin]:      'http://example.com'
                }
            };

            return request(options)
                .then(res => {
                    expect(res.statusCode).eql(200);
                    expect(res.headers['set-cookie']).to.be.empty;
                    expect(session.cookies.getClientString('http://127.0.0.1:2000')).to.be.empty;
                });
        });
    });

    describe('Fetch', () => {
        describe('Credential modes', () => {
            describe('Omit', () => {
                it('Should omit cookie and authorization header for same-domain request', () => {
                    session.cookies.setByServer('http://127.0.0.1:2000', 'key=value');

                    const options = {
                        url:     proxy.openSession('http://127.0.0.1:2000/echo-headers', session),
                        json:    true,
                        headers: {
                            referer:                        proxy.openSession('http://127.0.0.1:2000', session),
                            authorization:                  'value',
                            [INTERNAL_HEADERS.credentials]: 'omit'
                        }
                    };

                    return request(options)
                        .then(parsedBody => {
                            expect(parsedBody.cookie).to.be.undefined;
                            expect(parsedBody.authorization).to.be.undefined;
                        });
                });

                it('Should omit cookie and authorization header for cross-domain request', () => {
                    session.cookies.setByServer('http://127.0.0.1:2000', 'key=value');

                    const options = {
                        url:     proxy.openSession('http://127.0.0.1:2002/echo-headers', session),
                        json:    true,
                        headers: {
                            referer:                        proxy.openSession('http://127.0.0.1:2000', session),
                            authorization:                  'value',
                            [INTERNAL_HEADERS.credentials]: 'omit'
                        }
                    };

                    return request(options)
                        .then(parsedBody => {
                            expect(parsedBody.cookie).to.be.undefined;
                            expect(parsedBody.authorization).to.be.undefined;
                        });
                });
            });

            describe('Same-origin', () => {
                it('Should pass cookie and pass authorization headers for same-domain request', () => {
                    session.cookies.setByServer('http://127.0.0.1:2000', 'key=value');

                    const options = {
                        url:     proxy.openSession('http://127.0.0.1:2000/echo-headers', session),
                        json:    true,
                        headers: {
                            referer:                        proxy.openSession('http://127.0.0.1:2000', session),
                            authorization:                  'value',
                            [INTERNAL_HEADERS.credentials]: 'same-origin'
                        }
                    };

                    return request(options)
                        .then(parsedBody => {
                            expect(parsedBody.cookie).eql('key=value');
                            expect(parsedBody.authorization).eql('value');
                        });
                });

                it('Should omit cookie and authorization header for cross-domain request', () => {
                    session.cookies.setByServer('http://127.0.0.1:2000', 'key=value');

                    const options = {
                        url:     proxy.openSession('http://127.0.0.1:2002/echo-headers', session),
                        json:    true,
                        headers: {
                            referer:                        proxy.openSession('http://127.0.0.1:2000', session),
                            authorization:                  'value',
                            [INTERNAL_HEADERS.credentials]: 'same-origin'
                        }
                    };

                    return request(options)
                        .then(parsedBody => {
                            expect(parsedBody.cookie).to.be.undefined;
                            expect(parsedBody.authorization).to.be.undefined;
                        });
                });
            });

            describe('Include', () => {
                it('Should pass cookie and authorization headers for same-domain request', () => {
                    session.cookies.setByServer('http://127.0.0.1:2000', 'key=value');

                    const options = {
                        url:     proxy.openSession('http://127.0.0.1:2000/echo-headers', session),
                        json:    true,
                        headers: {
                            referer:                        proxy.openSession('http://127.0.0.1:2000', session),
                            authorization:                  'value',
                            [INTERNAL_HEADERS.credentials]: 'include'
                        }
                    };

                    return request(options)
                        .then(parsedBody => {
                            expect(parsedBody.cookie).eql('key=value');
                            expect(parsedBody.authorization).eql('value');
                        });
                });

                it('Should pass cookie and authorization headers for cross-domain request', () => {
                    session.cookies.setByServer('http://127.0.0.1:2000', 'key=value');

                    const options = {
                        url:     proxy.openSession('http://127.0.0.1:2002/echo-headers-with-credentials', session),
                        json:    true,
                        headers: {
                            referer:                        proxy.openSession('http://127.0.0.1:2000', session),
                            authorization:                  'value',
                            [INTERNAL_HEADERS.credentials]: 'include'
                        }
                    };

                    return request(options)
                        .then(parsedBody => {
                            expect(parsedBody.cookie).eql('key=value');
                            expect(parsedBody.authorization).eql('value');
                        });
                });
            });
        });

        it('Should respond with error if an error is occurred on attempting to connect with destination server', () => {
            const options = {
                url:     proxy.openSession('https://127.0.0.1:2000/', session),
                headers: { [INTERNAL_HEADERS.credentials]: 'omit' }
            };

            return request(options)
                .then(() => {
                    expect.fail('Request should raise an error');
                })
                .catch(err => {
                    expect(err.toString()).include('socket hang up');
                });
        });
    });

    describe('Content processing', () => {
        it('Should process pages', () => {
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
                    accept: PAGE_ACCEPT_HEADER
                }
            };

            return request(options)
                .then(body => {
                    const expected = fs.readFileSync('test/server/data/page/expected.html').toString();

                    compareCode(body, expected);
                });
        });

        it('Should process html import pages', () => {
            session.id = 'sessionId';
            session.injectable.scripts.push('/script1.js');
            session.injectable.scripts.push('/script2.js');
            session.injectable.styles.push('/styles1.css');
            session.injectable.styles.push('/styles2.css');

            proxy.openSession('http://127.0.0.1:2000/', session);

            const options = {
                url: urlUtils.getProxyUrl('http://127.0.0.1:2000/html-import-page', {
                    proxyHostname: PROXY_HOSTNAME,
                    proxyPort:     1836,
                    sessionId:     session.id,
                    resourceType:  urlUtils.getResourceTypeString({ isHtmlImport: true })
                }),

                headers: {
                    accept: '*/*'
                }
            };

            return request(options)
                .then(body => {
                    const expected = fs.readFileSync('test/server/data/html-import-page/expected.html').toString();

                    compareCode(body, expected);
                });
        });

        it('Should process html import pages in iframe', () => {
            session.id = 'sessionId';

            proxy.openSession('http://127.0.0.1:2000/', session);

            const options = {
                url: urlUtils.getProxyUrl('http://127.0.0.1:2000/html-import-page-in-iframe', {
                    proxyHostname: PROXY_HOSTNAME,
                    proxyPort:     1836,
                    sessionId:     session.id,
                    resourceType:  urlUtils.getResourceTypeString({ isHtmlImport: true, isIframe: true })
                }),

                headers: {
                    accept: '*/*'
                }
            };

            return request(options)
                .then(body => {
                    const expected = fs.readFileSync('test/server/data/html-import-page/expected-iframe.html').toString();

                    compareCode(body, expected);
                });
        });

        it('Should not process XHR page requests', () => {
            const options = {
                url:     proxy.openSession('http://127.0.0.1:2000/page', session),
                headers: {
                    accept:                         PAGE_ACCEPT_HEADER,
                    referer:                        proxy.openSession('http://127.0.0.1:2000/', session),
                    [INTERNAL_HEADERS.credentials]: 'same-origin'
                }
            };

            return request(options)
                .then(body => {
                    const expected = fs.readFileSync('test/server/data/page/src.html').toString();

                    compareCode(body, expected);
                });
        });

        it('Should not process Fetch page requests', () => {
            const options = {
                url:     proxy.openSession('http://127.0.0.1:2000/page', session),
                headers: {
                    accept:                         'text/html,application/xhtml+xml,application/xml',
                    referer:                        proxy.openSession('http://127.0.0.1:2000/', session),
                    [INTERNAL_HEADERS.credentials]: 'omit'
                }
            };

            return request(options)
                .then(body => {
                    const expected = fs.readFileSync('test/server/data/page/src.html').toString();

                    compareCode(body, expected);
                });
        });

        it('Should process scripts', () => {
            session.id = 'sessionId';

            return request(proxy.openSession('http://127.0.0.1:2000/script', session))
                .then(body => {
                    const expected = fs.readFileSync('test/server/data/script/expected.js').toString();

                    expect(normalizeNewLine(body)).eql(normalizeNewLine(expected));
                });
        });

        it('Should process manifests', () => {
            session.id = 'sessionId';

            return request(proxy.openSession('http://127.0.0.1:2000/manifest', session))
                .then(body => {
                    const expected = fs.readFileSync('test/server/data/manifest/expected.manifest').toString();

                    compareCode(body, expected);
                });
        });

        it('Should process stylesheets', () => {
            session.id = 'sessionId';

            const options = {
                url:     proxy.openSession('http://127.0.0.1:2000/stylesheet', session),
                headers: {
                    accept: 'text/css'
                }
            };

            return request(options)
                .then(body => {
                    const expected = fs.readFileSync('test/server/data/stylesheet/expected.css').toString();

                    compareCode(body, expected);
                });
        });

        it('Should process upload info', () => {
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

            return request(options)
                .then(body => {
                    expect(body).eql(expected.toString());
                });
        });

        it('Should not process file download', () => {
            const options = {
                url:     proxy.openSession('http://127.0.0.1:2000/download', session),
                method:  'GET',
                headers: {
                    accept: PAGE_ACCEPT_HEADER
                }
            };

            return request(options)
                .then(body => {
                    expect(body).eql(EMPTY_PAGE_MARKUP);
                });
        });

        it('Should not process "not modified" resources (GH-817)', () => {
            const mimeTypes = ['text/cache-manifest', 'text/css', 'text/html', 'text/javascript'];

            return Promise.all(mimeTypes.map((mimeType, index) => {
                const options = {
                    url:                     proxy.openSession('http://127.0.0.1:2000/304', session),
                    resolveWithFullResponse: true,
                    headers:                 {
                        'x-content-type': mimeType
                    }
                };

                if (index % 2)
                    options.headers['if-modified-since'] = 'Thu, 01 Aug 2013 18:31:48 GMT';
                else
                    options.headers['if-none-match'] = '42dc7c04442557f8937f89ecdc993077';

                return request(options)
                    .then(() => {
                        expect.fail('Request should raise an "304" error');
                    })
                    .catch(err => {
                        expect(err.response.body).eql('');
                        expect(err.statusCode).eql(304);
                        expect(err.response.headers['content-length']).eql('0');
                    });

            }));
        });

        it('Should append custom user scripts to the page', () => {
            session.injectable.userScripts.push(
                { url: '/custom-user-script-1', page: RequestFilterRule.ANY },
                { url: '/custom-user-script-2', page: new RequestFilterRule(new RegExp('/page-with-custom-client-script')) },
                { url: '/custom-user-script-3', page: new RequestFilterRule('/another-page') }
            );

            const options = {
                url:     proxy.openSession('http://127.0.0.1:2000/page-with-custom-client-script', session),
                headers: {
                    accept: PAGE_ACCEPT_HEADER
                }
            };

            return request(options)
                .then(body => {
                    const expected = fs.readFileSync('test/server/data/page-with-custom-client-script/expected.html').toString();

                    compareCode(body, expected);
                });
        });
    });

    describe('Shadow UI', () => {
        it('Should process shadow ui stylesheet', () => {
            const src      = read('/data/shadow-ui-stylesheet/src.css').toString();
            const expected = read('/data/shadow-ui-stylesheet/expected.css').toString();

            proxy.GET('/testcafe-ui-styles.css', {
                contentType:          'text/css',
                content:              src,
                isShadowUIStylesheet: true
            });

            return request('http://127.0.0.1:1836/testcafe-ui-styles.css')
                .then(body => {
                    expect(body.replace(/\r\n|\n/g, '')).equal(expected.replace(/\r\n|\n/g, ''));
                });
        });
    });

    describe('HTTPS', () => {
        let httpsServer = null;

        before(() => {
            const httpsApp = express();

            httpsApp.get('/answer', (req, res) => res.send('42'));

            httpsServer = https.createServer({
                key:                selfSignedCertificate.key,
                cert:               selfSignedCertificate.cert,
                requestCert:        false,
                rejectUnauthorized: false,
                ciphers:            '-ALL:ECDHE-RSA-AES128-SHA256',
                ecdhCurve:          'secp384r1'
            }, httpsApp).listen(2001);
        });

        after(() => httpsServer.close());

        it('Should proxy unauthorized HTTPS pages', () => {
            const url = proxy.openSession('https://127.0.0.1:2001/answer', session);

            return request(url)
                .then(body => {
                    expect(body).eql('42');
                });
        });
    });

    describe('file:// protocol', () => {
        it('Should process page and ignore search string', () => {
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
                    accept: PAGE_ACCEPT_HEADER
                }
            };

            return request(options)
                .then(body => {
                    // NOTE: The host property is empty in url with file: protocol.
                    // The expected.html template is used for both tests with http: and file: protocol.
                    const expected = fs.readFileSync('test/server/data/page/expected.html').toString()
                        .replace(/(hammerhead\|storage-wrapper\|sessionId\|)127\.0\.0\.1:2000/g, '$1');

                    compareCode(body, expected);
                });
        });

        it('Should process stylesheets', () => {
            session.id = 'sessionId';

            const options = {
                url:     proxy.openSession(getFileProtocolUrl('./data/stylesheet/src.css'), session),
                headers: {
                    accept: 'text/css,*/*;q=0.1'
                }
            };

            return request(options)
                .then(body => {
                    const expected = fs.readFileSync('test/server/data/stylesheet/expected.css').toString();

                    compareCode(body, expected);
                });
        });

        it('Should process page with absolute urls', () => {
            session.id = 'sessionId';

            const filePostfix = os.platform() === 'win32' ? 'win' : 'nix';
            const fileUrl     = getFileProtocolUrl('./data/page-with-file-protocol/src-' + filePostfix + '.html');

            const options = {
                url:     proxy.openSession(fileUrl, session),
                headers: {
                    accept: 'text/html,*/*;q=0.1'
                }
            };

            return request(options)
                .then(body => {
                    const filePath = 'test/server/data/page-with-file-protocol/expected-' + filePostfix + '.html';
                    const expected = fs.readFileSync(filePath).toString();

                    compareCode(body, expected);
                });
        });

        if (os.platform() === 'win32') {
            it('Should process page with non-conforming Windows url', () => {
                session.id = 'sessionId';

                const fileUrl = 'file://' + path.join(__dirname, '/data/page-with-file-protocol/src-win.html');

                const options = {
                    url:     proxy.openSession(fileUrl, session),
                    headers: {
                        accept: 'text/html,*/*;q=0.1'
                    }
                };

                return request(options)
                    .then(body => {
                        const expected = fs.readFileSync('test/server/data/page-with-file-protocol/expected-win.html').toString();

                        compareCode(body, expected);
                    });
            });
        }

        it('Should set the correct content-type header', () => {
            session.id = 'sessionId';

            const options = {
                url:                     proxy.openSession(getFileProtocolUrl('./data/images/icons.svg'), session),
                resolveWithFullResponse: true,
                headers:                 {
                    accept: 'image/webp,image/*,*/*;q=0.8'
                }
            };

            return request(options)
                .then(res => {
                    expect(res.headers['content-type']).eql('image/svg+xml');
                });
        });

        it('Should pass an error to the session if target is a directory', done => {
            const url = getFileProtocolUrl('./data');

            session.id = 'sessionId';

            session.handlePageError = (ctx, err) => {
                expect(err).contains([
                    'Failed to read a file at <a href="' + url + '">' + url + '</a> because of the error:',
                    '',
                    'The target of the operation is not a file'
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

        it('Should pass an error to the session if target (a file in an "asar" archive) does not exist (GH-2033)', done => {
            const url      = getFileProtocolUrl('./data/file-in-asar-archive/directory-looks-like-archive.asar/app.asar/non-existent-dir/non-existent-file.txt');
            const archive  = path.resolve(__dirname, './data/file-in-asar-archive/directory-looks-like-archive.asar/app.asar').replace(/\\/g, '/');
            const fileName = 'non-existent-dir/non-existent-file.txt';

            session.id = 'sessionId';

            session.handlePageError = (ctx, err) => {
                expect(err).contains([
                    'Failed to read a file at <a href="' + url + '">' + url + '</a> because of the error:',
                    '',
                    'Cannot find the "' + fileName + '" file in the "' + archive + '" archive.'
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

        it('Should resolve an "asar" archive file and set the correct "content-type" header (GH-2033)', () => {
            session.id = 'sessionId';

            const fileUrl = getFileProtocolUrl('./data/file-in-asar-archive/directory-looks-like-archive.asar/app.asar/folder-in-asar-archive/another-folder/src.txt');

            const options = {
                url:                     proxy.openSession(fileUrl, session),
                resolveWithFullResponse: true,
                headers:                 {
                    accept: '*/*'
                }
            };

            return request(options)
                .then(res => {
                    expect(res.headers['content-type']).eql('text/plain');
                    expect(res.body).eql('asar archive file: src.txt');
                });
        });
    });

    describe('Asar', () => {
        it('isAsar (GH-2033)', () => {
            const asar = new Asar();

            const filePath            = path.resolve(__dirname, './data/file-in-asar-archive/directory-looks-like-archive.asar/app.asar/folder-in-asar-archive/another-folder/src.txt').replace(/\\/g, '/');
            const expectedArchivePath = filePath.replace('/folder-in-asar-archive/another-folder/src.txt', '');

            const nonExistPath        = path.resolve(__dirname, './data/file-in-asar-archive/directory-looks-like-archive.asar/non-exist-app.asar/non-exist-file.txt').replace(/\\/g, '/');
            const nonExistArchivePath = nonExistPath.replace('/non-exist-file.txt', '');

            asar._archivePaths.add(nonExistArchivePath);

            expect(asar._archivePaths.size).eql(1);

            return asar.isAsar(nonExistPath)
                .then(result => {
                    expect(result).eql(false);
                    expect(asar._archivePaths.size).eql(0);

                    return asar.isAsar(filePath);
                })
                .then(result => {
                    expect(result).eql(true);
                    expect(asar._archivePaths.size).eql(1);
                    expect(asar._archivePaths.has(expectedArchivePath)).eql(true);
                });
        });
    });

    describe('State switching', () => {
        function makeRequest (url, opts) {
            opts = opts || { isPage: true };

            const options = {
                url: urlUtils.getProxyUrl(url, {
                    proxyHostname: PROXY_HOSTNAME,
                    proxyPort:     1836,
                    sessionId:     session.id,
                    resourceType:  opts.resourceType
                }),

                headers: {
                    accept: opts.isPage ? PAGE_ACCEPT_HEADER : '*/*'
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
                session.useStateSnapshot(StateSnaphot.empty());

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

                    session.useStateSnapshot(StateSnaphot.empty());
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

        it('Should skip cache headers if state snapshot is applied', () => {
            const options = {
                url:     proxy.openSession('http://127.0.0.1:2000/echo-headers', session),
                headers: {
                    accept:              PAGE_ACCEPT_HEADER,
                    'if-modified-since': 'Mon, 17 Jul 2017 14:56:15 GMT',
                    'if-none-match':     'W/"1322-15d510cbdf8"'
                }
            };

            session.useStateSnapshot(StateSnaphot.empty());

            return request(options)
                .then(body => {
                    expect(body).not.contains('if-modified-since');
                    expect(body).not.contains('if-none-match');
                });
        });
    });

    describe('WebSocket', () => {
        let httpsServer = null;
        let wsServer    = null;
        let wssServer   = null;

        before(() => {
            httpsServer = https.createServer({
                key:  selfSignedCertificate.key,
                cert: selfSignedCertificate.cert
            }, () => void 0).listen(2001);
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
                proxyHostname: PROXY_HOSTNAME,
                proxyPort:     1836,
                sessionId:     session.id,
                resourceType:  urlUtils.getResourceTypeString({ isWebSocket: true }),
                reqOrigin:     encodeURIComponent('http://example.com')
            });

            proxy.openSession('http://127.0.0.1:2000/', session);
            session.cookies.setByServer('http://127.0.0.1:2000', 'key=value');

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

                    const wsCloseEventPromise = promisifyEvent(ws, 'close');

                    ws.close();

                    return wsCloseEventPromise;
                });
        });

        it('Should proxy secure WebSocket', () => {
            const url = urlUtils.getProxyUrl('https://127.0.0.1:2001/secire-web-socket', {
                proxyHostname: PROXY_HOSTNAME,
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

                    const wsCloseEventPromise = promisifyEvent(ws, 'close');

                    ws.close();

                    return wsCloseEventPromise;
                });
        });

        it('Should not throws an proxy error when server is not available', done => {
            const url = urlUtils.getProxyUrl('http://127.0.0.1:2003/ws', {
                proxyHostname: PROXY_HOSTNAME,
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

        it('Should close webSocket from server side', done => {
            getFreePort()
                .then(port => {
                    const url = urlUtils.getProxyUrl('http://127.0.0.1:' + port, {
                        proxyHostname: PROXY_HOSTNAME,
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

        it('Should send/receive message', done => {
            getFreePort()
                .then(port => {
                    const url = urlUtils.getProxyUrl('http://localhost:' + port, {
                        proxyHostname: PROXY_HOSTNAME,
                        proxyPort:     1836,
                        sessionId:     session.id,
                        resourceType:  urlUtils.getResourceTypeString({ isWebSocket: true })
                    });

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
            const url = urlUtils.getProxyUrl('http://127.0.0.1:2003/ws', {
                proxyHostname: PROXY_HOSTNAME,
                proxyPort:     1836,
                sessionId:     session.id,
                resourceType:  urlUtils.getResourceTypeString({ isWebSocket: true }),
                reqOrigin:     encodeURIComponent('http://example.com')
            });

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

            ws.on('error', err => {
                expect(err.message).eql('socket hang up');
            });
        });
    });

    describe('Request Hooks', () => {
        describe('Handle session request events', () => {
            it('Processed resource', () => {
                let requestEventIsRaised           = false;
                let configureResponseEventIsRaised = false;
                let responseEventIsRaised          = false;

                const url                      = 'http://127.0.0.1:2000/script';
                const rule                     = new RequestFilterRule(url);
                const resourceContent          = fs.readFileSync('test/server/data/script/src.js').toString();
                const processedResourceContent = fs.readFileSync('test/server/data/script/expected.js').toString();

                session.addRequestEventListeners(rule, {
                    onRequest: e => {
                        return new Promise(resolve => {
                            setTimeout(() => {
                                expect(e.isAjax).to.be.false;

                                expect(e._requestInfo.url).eql(url);
                                expect(e._requestInfo.method).eql('get');
                                expect(e._requestInfo.requestId).to.be.not.empty;
                                expect(e._requestInfo.sessionId).to.be.not.empty;
                                expect(e._requestInfo.body.length).eql(0);
                                expect(e._requestInfo.headers).to.include({ 'content-type': 'application/javascript; charset=utf-8' });

                                requestEventIsRaised = true;

                                resolve();
                            }, 100);
                        });
                    },

                    onConfigureResponse: e => {
                        return new Promise(resolve => {
                            setTimeout(() => {
                                configureResponseEventIsRaised = true;

                                e.opts.includeHeaders = true;
                                e.opts.includeBody    = true;

                                resolve();
                            }, 100);
                        });
                    },

                    onResponse: e => {
                        return new Promise(resolve => {
                            setTimeout(() => {
                                expect(e.statusCode).eql(200);
                                expect(e.headers).to.include({ 'content-type': 'application/javascript; charset=utf-8' });
                                expect(e.body.toString()).eql(resourceContent);

                                responseEventIsRaised = true;

                                resolve();
                            }, 100);
                        });
                    }
                });

                const options = {
                    url:     proxy.openSession(url, session),
                    headers: {
                        'content-type': 'application/javascript; charset=utf-8'
                    }
                };

                return request(options)
                    .then(body => {
                        expect(body).eql(processedResourceContent);
                        expect(requestEventIsRaised, 'requestEventIsRaised').to.be.true;
                        expect(configureResponseEventIsRaised, 'configureResponseEventIsRaised').to.be.true;
                        expect(responseEventIsRaised, 'responseEventIsRaised').to.be.true;

                        session.removeRequestEventListeners(rule);
                    });
            });

            it('Non-processed resource', () => {
                let requestEventIsRaised           = false;
                let configureResponseEventIsRaised = false;
                let responseEventIsRaised          = false;

                const url  = 'http://127.0.0.1:2000/json';
                const rule = new RequestFilterRule(url);

                session.addRequestEventListeners(rule, {
                    onRequest: e => {
                        return new Promise(resolve => {
                            setTimeout(() => {
                                expect(e.isAjax).to.be.false;

                                expect(e._requestInfo.url).eql('http://127.0.0.1:2000/json');
                                expect(e._requestInfo.method).eql('get');
                                expect(e._requestInfo.requestId).to.be.not.empty;
                                expect(e._requestInfo.sessionId).to.be.not.empty;
                                expect(e._requestInfo.body.length).eql(0);
                                expect(e._requestInfo.headers).include({ 'test-header': 'testValue' });

                                requestEventIsRaised = true;

                                resolve();
                            }, 100);
                        });
                    },

                    onConfigureResponse: e => {
                        return new Promise(resolve => {
                            setTimeout(() => {
                                e.opts.includeBody    = true;
                                e.opts.includeHeaders = true;

                                configureResponseEventIsRaised = true;

                                resolve();
                            }, 100);
                        });
                    },

                    onResponse: e => {
                        return new Promise(resolve => {
                            setTimeout(() => {
                                expect(e.statusCode).eql(200);
                                expect(JSON.parse(e.body.toString())).to.deep.eql(TEST_OBJ);
                                expect(e.headers).include({ 'content-type': 'application/json; charset=utf-8' });

                                responseEventIsRaised = true;

                                resolve();
                            }, 100);
                        });
                    }
                });

                const options = {
                    url:     proxy.openSession(url, session),
                    json:    true,
                    headers: {
                        'test-header': 'testValue'
                    }
                };

                return request(options)
                    .then(body => {
                        expect(body).to.deep.eql(TEST_OBJ);
                        expect(requestEventIsRaised, 'requestEventIsRaised').to.be.true;
                        expect(configureResponseEventIsRaised, 'configureResponseEventIsRaised').to.be.true;
                        expect(responseEventIsRaised, 'responseEventIsRaised').to.be.true;

                        session.removeRequestEventListeners(rule);
                    });
            });

            it('Ajax request', () => {
                let requestEventIsRaised          = false;
                let configureResponseEventIsRaised = false;
                let responseEventIsRaised          = false;

                const rule = new RequestFilterRule('http://127.0.0.1:2000/page/plain-text');

                session.addRequestEventListeners(rule, {
                    onRequest: e => {
                        return new Promise(resolve => {
                            setTimeout(() => {
                                expect(e.isAjax).to.be.true;

                                requestEventIsRaised = true;

                                resolve();
                            }, 100);
                        });
                    },

                    onConfigureResponse: () => {
                        return new Promise(resolve => {
                            setTimeout(() => {
                                configureResponseEventIsRaised = true;

                                resolve();
                            }, 100);
                        });
                    },

                    onResponse: e => {
                        return new Promise(resolve => {
                            setTimeout(() => {
                                expect(e.statusCode).eql(SAME_ORIGIN_CHECK_FAILED_STATUS_CODE);

                                responseEventIsRaised = true;

                                resolve();
                            }, 100);
                        });
                    }
                });

                const options = {
                    url:                     proxy.openSession('http://127.0.0.1:2000/page/plain-text', session),
                    resolveWithFullResponse: true,
                    headers:                 {
                        referer:                        proxy.openSession('http://example.com', session),
                        [INTERNAL_HEADERS.credentials]: 'same-origin'
                    }
                };

                return request(options)
                    .then(res => {
                        expect(res.statusCode).eql(SAME_ORIGIN_CHECK_FAILED_STATUS_CODE);
                        expect(requestEventIsRaised).to.be.true;
                        expect(configureResponseEventIsRaised).to.be.true;
                        expect(responseEventIsRaised).to.be.true;

                        session.removeRequestEventListeners(rule);
                    });
            });

            it('Several rules for one request', () => {
                const requestUrl = 'http://127.0.0.1:2000/page/plain-text';
                const rules      = [new RequestFilterRule(requestUrl), new RequestFilterRule(requestUrl), new RequestFilterRule(requestUrl)];

                let countOnResponseEvents = 0;

                rules.forEach(rule => {
                    session.addRequestEventListeners(rule, {
                        onRequest:           noop,
                        onConfigureResponse: noop,
                        onResponse:          e => {
                            return new Promise(resolve => {
                                setTimeout(() => {
                                    expect(e.body).to.be.undefined;
                                    expect(e.headers).to.be.undefined;
                                    expect(e.statusCode).eql(200);

                                    countOnResponseEvents++;

                                    resolve();
                                }, 100);
                            });
                        }
                    });
                });

                const options = {
                    url:                     proxy.openSession(requestUrl, session),
                    resolveWithFullResponse: true,
                    headers:                 {
                        referer: proxy.openSession('http://example.com', session)
                    }
                };

                return request(options)
                    .then(() => {
                        expect(countOnResponseEvents).eql(3);
                        rules.forEach(rule => session.removeRequestEventListeners(rule));
                    });
            });

            it('Pipe a large response (TC-GH-2725)', () => {
                const url           = 'http://127.0.0.1:2000/large-json';
                const rule          = new RequestFilterRule(url);
                let responseWasSent = false;

                session.addRequestEventListeners(rule, {
                    onConfigureResponse: e => {
                        return new Promise(resolve => {
                            setTimeout(() => {
                                e.opts.includeBody = true;

                                resolve();
                            }, 100);
                        });
                    },

                    onResponse: () => {
                        return new Promise(resolve => {
                            setTimeout(() => {
                                responseWasSent = true;

                                resolve();
                            }, 100);
                        });
                    }
                });

                const options = {
                    url:  proxy.openSession(url, session),
                    json: true
                };

                return request(options)
                    .then(body => {
                        expect(body).not.empty;
                        expect(responseWasSent).eql(true);

                        session.removeRequestEventListeners(rule);
                    });
            });

            it('Not modified resource', () => {
                let requestEventIsRaised           = false;
                let configureResponseEventIsRaised = false;
                let responseEventIsRaised          = false;

                const url  = 'http://127.0.0.1:2000/304';
                const rule = new RequestFilterRule(url);

                session.addRequestEventListeners(rule, {
                    onRequest: () => {
                        return new Promise(resolve => {
                            setTimeout(() => {
                                requestEventIsRaised = true;

                                resolve();
                            }, 100);
                        });
                    },

                    onConfigureResponse: e => {
                        return new Promise(resolve => {
                            setTimeout(() => {
                                configureResponseEventIsRaised = true;

                                e.opts.includeHeaders = true;
                                e.opts.includeBody    = true;

                                resolve();
                            }, 100);
                        });
                    },

                    onResponse: e => {
                        return new Promise(resolve => {
                            setTimeout(() => {
                                expect(e.statusCode).eql(304);

                                responseEventIsRaised = true;

                                resolve();
                            }, 100);
                        });
                    }
                });

                const options = {
                    url:     proxy.openSession(url, session),
                    headers: {
                        'content-type':      'application/javascript; charset=utf-8',
                        'if-modified-since': 'Thu, 01 Aug 2013 18:31:48 GMT'
                    }
                };

                return request(options)
                    .then(() => {
                        expect.fail('Request should raise an "304" error');
                    })
                    .catch(() => {
                        expect(requestEventIsRaised, 'requestEventIsRaised').to.be.true;
                        expect(configureResponseEventIsRaised, 'configureResponseEventIsRaised').to.be.true;
                        expect(responseEventIsRaised, 'responseEventIsRaised').to.be.true;

                        session.removeRequestEventListeners(rule);
                    });
            });

            it('Should handle errors inside the request event handlers', () => {
                const url                  = 'http://127.0.0.1:2000/script';
                const rule                 = new RequestFilterRule(url);
                const collectedErrorEvents = [];

                session.addRequestEventListeners(rule, {
                    onRequest: () => {
                        throw new Error('inside onRequest');
                    },

                    onConfigureResponse: () => {
                        throw new Error('inside onConfigureResponse');
                    },

                    onResponse: () => {
                        throw new Error('inside onResponse');
                    }
                }, e => {
                    collectedErrorEvents.push(e);
                });

                const options = {
                    url:     proxy.openSession(url, session),
                    headers: {
                        'content-type': 'application/javascript; charset=utf-8'
                    }
                };

                return request(options)
                    .then(() => {
                        expect(collectedErrorEvents.length).eql(3);
                        expect(collectedErrorEvents[0].error.message).eql('inside onRequest');
                        expect(collectedErrorEvents[0].methodName).eql('onRequest');
                        expect(collectedErrorEvents[1].error.message).eql('inside onConfigureResponse');
                        expect(collectedErrorEvents[1].methodName).eql('onConfigureResponse');
                        expect(collectedErrorEvents[2].error.message).eql('inside onResponse');
                        expect(collectedErrorEvents[2].methodName).eql('onResponse');

                        session.removeRequestEventListeners(rule);
                    });
            });
        });

        describe('Response mock', () => {
            it('Basic', () => {
                const url           = 'http://dummy_page.com';
                const mock          = new ResponseMock();
                const rule          = new RequestFilterRule(url);
                const processedHtml = fs.readFileSync('test/server/data/empty-page/expected.html').toString();

                session.addRequestEventListeners(rule, {
                    onRequest: e => {
                        return new Promise(resolve => {
                            setTimeout(() => {
                                e.setMock(mock);

                                resolve();
                            }, 100);
                        });
                    }
                });

                const options = {
                    url:     proxy.openSession(url, session),
                    headers: {
                        accept: PAGE_ACCEPT_HEADER
                    }
                };

                return request(options)
                    .then(body => {
                        compareCode(body, processedHtml);

                        session.removeRequestEventListeners(rule);
                    });
            });

            it('Should allow to mock response without body (page)', () => {
                const url  = 'http://dummy_page.com';
                const mock = new ResponseMock(null, 204);
                const rule = new RequestFilterRule(url);

                session.addRequestEventListeners(rule, {
                    onRequest: e => {
                        return new Promise(resolve => {
                            setTimeout(() => {
                                e.setMock(mock);

                                resolve();
                            }, 100);
                        });
                    }
                });

                const options = {
                    url:                     proxy.openSession(url, session),
                    resolveWithFullResponse: true,
                    headers:                 {
                        accept: PAGE_ACCEPT_HEADER
                    }
                };

                return request(options)
                    .then(res => {
                        const expected = fs.readFileSync('test/server/data/empty-page/expected.html').toString();

                        compareCode(res.body, expected);
                        expect(res.statusCode).eql(200);

                        session.removeRequestEventListeners(rule);
                    });
            });

            it('Should allow to mock a large response', () => {
                const url           = 'http://example.com/get';
                const largeResponse = '1234567890'.repeat(1000000);
                const mock          = new ResponseMock(largeResponse);
                const rule          = new RequestFilterRule(url);

                session.addRequestEventListeners(rule, {
                    onRequest: e => {
                        return new Promise(resolve => {
                            setTimeout(() => {
                                e.setMock(mock);

                                resolve();
                            }, 100);
                        });
                    }
                });

                const options = {
                    url:     proxy.openSession(url, session),
                    headers: {
                        accept:                         PAGE_ACCEPT_HEADER,
                        referer:                        proxy.openSession('http://example.com', session),
                        [INTERNAL_HEADERS.credentials]: 'same-origin'
                    }
                };

                return request(options)
                    .then(body => {
                        expect(body).eql(largeResponse);

                        session.removeRequestEventListeners(rule);
                    });
            });


        });

        it('Should allow to set request options', () => {
            const rule = new RequestFilterRule('http://127.0.0.1:2000/page');

            session.addRequestEventListeners(rule, {
                onRequest: e => {
                    return new Promise(resolve => {
                        setTimeout(() => {
                            e.requestOptions.path = '/script';

                            resolve();
                        }, 100);
                    });
                }
            });

            const options = {
                url: proxy.openSession('http://127.0.0.1:2000/page', session)
            };

            return request(options)
                .then(body => {
                    const expected = fs.readFileSync('test/server/data/script/expected.js').toString();

                    expect(normalizeNewLine(body)).eql(normalizeNewLine(expected));

                    session.removeRequestEventListeners(rule);
                });
        });

        it('Should allow to modify response headers', () => {
            const rule = new RequestFilterRule('http://127.0.0.1:2000/page');

            session.addRequestEventListeners(rule, {
                onConfigureResponse: e => {
                    return new Promise(resolve => {
                        setTimeout(() => {
                            e.setHeader('My-Custom-Header', 'My Custom value');
                            e.removeHeader('Content-Type');

                            resolve();
                        }, 100);
                    });
                }
            });

            const options = {
                url:                     proxy.openSession('http://127.0.0.1:2000/page', session),
                resolveWithFullResponse: true
            };

            return request(options)
                .then(response => {
                    expect(response.headers['my-custom-header']).eql('My Custom value');
                    expect(response.headers).to.not.have.property('content-type');

                    session.removeRequestEventListeners(rule);
                });
        });

        it('Should pass `forceProxySrcForImage` option in task script', () => {
            session._getPayloadScript       = () => 'PayloadScript';
            session._getIframePayloadScript = () => 'IframePayloadScript';

            const rule = RequestFilterRule.ANY;

            const getShouldProxyAllImagesValue = function (text) {
                const result = text.match(/forceProxySrcForImage\s*:\s*(false|true)/);

                return result[1] === 'true';
            };

            function testShouldProxyImageOptionValue (expectedValue) {
                const options = {
                    url:     'http://localhost:1836/task.js',
                    headers: {
                        referer: proxy.openSession('http://example.com', session)
                    }
                };

                return request(options)
                    .then(body => {
                        const actualShouldProxyAllImages = getShouldProxyAllImagesValue(body);

                        expect(actualShouldProxyAllImages).eql(expectedValue);
                    });
            }

            return testShouldProxyImageOptionValue(false)
                .then(() => {
                    session.addRequestEventListeners(rule, {
                        onRequest:           noop,
                        onConfigureResponse: noop,
                        onResponse:          noop
                    });

                    return testShouldProxyImageOptionValue(true);
                })
                .then(() => {
                    session.removeRequestEventListeners(rule);

                    return testShouldProxyImageOptionValue(false);
                });
        });
    });

    describe('https proxy', () => {
        before(() => {
            sslOptions = {
                key:  selfSignedCertificate.key,
                cert: selfSignedCertificate.cert
            };
        });

        after(() => {
            sslOptions = null;
        });

        it('Should process pages', () => {
            session.id = 'sessionId';
            session.injectable.scripts.push('/script1.js');
            session.injectable.scripts.push('/script2.js');
            session.injectable.styles.push('/styles1.css');
            session.injectable.styles.push('/styles2.css');

            const options = {
                url:     proxy.openSession('http://127.0.0.1:2000/page', session),
                headers: {
                    accept: PAGE_ACCEPT_HEADER
                },
                rejectUnauthorized: false
            };

            expect(options.url).eql('https://127.0.0.1:1836/sessionId*12345/http://127.0.0.1:2000/page');

            return request(options)
                .then(body => {
                    const expected = fs.readFileSync('test/server/data/page/expected-https.html').toString();

                    compareCode(body, expected);
                });
        });
    });

    describe('Regression', () => {
        it('Should force "Origin" header for the same-domain requests (B234325)', () => {
            const options = {
                url:     proxy.openSession('http://127.0.0.1:2000/B234325,GH-284/reply-with-origin', session),
                headers: {
                    referer:                        proxy.openSession('http://example.com', session),
                    [INTERNAL_HEADERS.credentials]: 'same-origin'
                }
            };

            return request(options)
                .then(body => {
                    expect(body).eql('http://example.com');
                });
        });

        it('Should force "Origin" header for the cross-domain "fetch" requests (GH-1059)', () => {
            const options = {
                url:     proxy.openSession('http://127.0.0.1:2000/GH-1059/reply-with-origin', session),
                headers: {
                    referer:                        proxy.openSession('http://example.com', session),
                    [INTERNAL_HEADERS.credentials]: 'include'
                }
            };

            return request(options)
                .then(body => {
                    expect(body).eql('http://example.com');
                });
        });

        it('Should not send "Cookie" header if there are no cookies for the given URL (T232505)', () => {
            const options = {
                url:  proxy.openSession('http://127.0.0.1:2000/T232505/is-cookie-header-sent', session),
                json: true
            };

            return request(options)
                .then(parsedBody => {
                    expect(parsedBody).to.be.false;
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
                    accept: PAGE_ACCEPT_HEADER
                }
            };

            request(options);
        });

        it('Should use a special timeout for xhr requests (GH-347)', () => {
            const savedReqTimeout    = DestinationRequest.TIMEOUT;
            const savedXhrReqTimeout = DestinationRequest.AJAX_TIMEOUT;

            DestinationRequest.TIMEOUT     = 100;
            DestinationRequest.AJAX_TIMEOUT = 200;

            const options = {
                url:     proxy.openSession('http://127.0.0.1:2000/T224541/hang-forever', session),
                headers: {
                    accept:                         'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    [INTERNAL_HEADERS.credentials]: 'same-origin'
                }
            };

            const requestTime = Date.now();

            return request(options)
                .then(() => {
                    expect.fail('Request should raise an error');
                })
                .catch(err => {
                    const responseTime = Date.now();

                    expect(err.toString()).include('socket hang up');
                    expect(responseTime - requestTime).above(DestinationRequest.AJAX_TIMEOUT);

                    DestinationRequest.TIMEOUT      = savedReqTimeout;
                    DestinationRequest.AJAX_TIMEOUT = savedXhrReqTimeout;
                });
        });

        it('Should process empty pages (B239430)', () => {
            const options = {
                url:     proxy.openSession('http://127.0.0.1:2000/B239430/empty-page', session),
                headers: {
                    accept: PAGE_ACCEPT_HEADER
                }
            };

            return request(options)
                .then(body => {
                    const expected = fs.readFileSync('test/server/data/empty-page/expected.html').toString();

                    compareCode(body, expected);
                });
        });

        it('Should process pages with status 204 and return status 200 instead (GH-306)', () => {
            const options = {
                url:                     proxy.openSession('http://127.0.0.1:2000/GH-306/empty-resource', session),
                resolveWithFullResponse: true,
                headers:                 {
                    accept:            PAGE_ACCEPT_HEADER,
                    'x-resource-type': 'text/html; charset=utf-8'
                }
            };

            return request(options)
                .then(res => {
                    const expected = fs.readFileSync('test/server/data/empty-page/expected.html').toString();

                    compareCode(res.body, expected);
                    expect(res.statusCode).eql(200);
                    expect(res.headers['content-length']).eql(res.body.length.toString());
                });
        });

        it('Should not process script with the html "accept" header as a page', () => {
            const url     = proxy.openSession('http://127.0.0.1:2000/script', session);
            const options = {
                url:                     url.replace(/^(.*?\/\/.*?\/.*?)(\/.*)$/, '$1!script$2'),
                resolveWithFullResponse: true,
                headers:                 {
                    accept: PAGE_ACCEPT_HEADER
                }
            };

            return request(options)
                .then(res => {
                    expect(res.statusCode).eql(200);
                    expect(res.body).to.contain(scriptHeader.SCRIPT_PROCESSING_START_COMMENT);
                });
        });

        it('Should not process assets with status 204 (GH-306)', () => {
            function testSourceWithStatus204 (mimeType) {
                const options = {
                    url:                     proxy.openSession('http://127.0.0.1:2000/GH-306/empty-resource', session),
                    resolveWithFullResponse: true,
                    headers:                 {
                        'x-resource-type': mimeType
                    }
                };

                return request(options)
                    .then(res => {
                        expect(res.body).eql('');
                        expect(res.statusCode).eql(204);
                    });
            }

            return Promise.all([
                testSourceWithStatus204('application/javascript'),
                testSourceWithStatus204('text/cache-manifest'),
                testSourceWithStatus204('text/css')
            ]);
        });

        it('Should transform the "Origin" header for requests without the "Referer" header correctly (GH-284)', () => {
            const options = {
                url:     proxy.openSession('http://127.0.0.1:2000/B234325,GH-284/reply-with-origin', session),
                headers: {
                    origin:                         'http://127.0.0.1:1836',
                    [INTERNAL_HEADERS.origin]:      'http://example.com',
                    [INTERNAL_HEADERS.credentials]: 'same-origin'
                }
            };

            return request(options)
                .then(body => {
                    expect(body).eql('http://example.com');
                });
        });

        it('Should return 204 status code instead of 200 for the empty form submission response (GH-373)', () => {
            const url     = proxy.openSession('http://127.0.0.1:2000/GH-306/empty-resource', session);
            const options = {
                url:                     url.replace(session.id, session.id + '!f'),
                resolveWithFullResponse: true,
                headers:                 {
                    accept:            PAGE_ACCEPT_HEADER,
                    'x-resource-type': 'text/html; charset=utf-8'
                }
            };

            return request(options)
                .then(res => {
                    expect(res.statusCode).eql(204);
                });
        });

        it('Should pass ECONNREFUSED error to session (GH-446)', done => {
            getFreePort()
                .then(port => {
                    const host = 'http://127.0.0.1:' + port;

                    session.handlePageError = (ctx, err) => {
                        expect(err).eql('Failed to find a DNS-record for the resource at <a href="' + host + '/' +
                                        '">' + host + '/' + '</a>.');
                        ctx.res.end();
                        done();
                        return true;
                    };

                    const options = {
                        url:     proxy.openSession(host, session),
                        headers: {
                            accept: PAGE_ACCEPT_HEADER
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

        it('Should close with error if destination server doesn`t provide Access-Control-Allow-Origin header for cross-domain requests', () => {
            const options = {
                url:                     proxy.openSession('http://127.0.0.1:2002/without-access-control-allow-origin-header', session),
                resolveWithFullResponse: true,
                headers:                 {
                    referer:                        proxy.openSession('http://example.com', session),
                    [INTERNAL_HEADERS.credentials]: 'same-origin'
                }
            };

            return request(options)
                .then(res => {
                    expect(res.statusCode).eql(SAME_ORIGIN_CHECK_FAILED_STATUS_CODE);
                });
        });

        it('Should not send cookie and authorization headers to the cross-domain destination server for the xhr request without credentials (GH-545)', () => {
            session.cookies.setByServer('http://example.com', 'key=value');

            const options = {
                url:     proxy.openSession('http://127.0.0.1:2002/echo-headers', session),
                json:    true,
                headers: {
                    referer:                        proxy.openSession('http://example.com', session),
                    authorization:                  'value',
                    'proxy-authorization':          'value',
                    [INTERNAL_HEADERS.credentials]: 'same-origin'
                }
            };

            return request(options)
                .then(parsedBody => {
                    expect(parsedBody.cookie).to.be.undefined;
                    expect(parsedBody.authorization).to.be.undefined;
                    expect(parsedBody['proxy-authorization']).to.be.undefined;
                });
        });

        it('Should remove hammerhead xhr headers before sending a request to the destination server', () => {
            const options = {
                url:     proxy.openSession('http://127.0.0.1:2002/echo-headers-with-credentials', session),
                json:    true,
                headers: {
                    referer:                        proxy.openSession('http://127.0.0.1:2000', session),
                    [INTERNAL_HEADERS.credentials]: 'include',
                    [INTERNAL_HEADERS.origin]:      'origin_value'
                }
            };

            return request(options)
                .then(parsedBody => {
                    expect(parsedBody[INTERNAL_HEADERS.credentials]).to.be.undefined;
                    expect(parsedBody[INTERNAL_HEADERS.origin]).to.be.undefined;
                });
        });

        it('Should add a leading slash to the pathname part of url (GH-608)', () => {
            const options = {
                url: proxy.openSession('http://127.0.0.1:2000?key=value', session)
            };

            return request(options)
                .then(body => {
                    expect(body).eql('/?key=value');
                });
        });

        it('Should omit default ports from destination request and `referrer` header urls (GH-738)', () => {
            const testCases              = [
                {
                    url:             'http://example.com:80',
                    expectedHost:    'example.com',
                    expectedPort:    '',
                    referer:         'http://1.example.com:80',
                    expectedReferer: 'http://1.example.com',
                },
                {
                    url:             'http://example.com:8080',
                    expectedHost:    'example.com:8080',
                    expectedPort:    '8080',
                    referer:         'http://1.example.com:8080',
                    expectedReferer: 'http://1.example.com:8080',
                },
                {
                    url:             'https://example.com:443',
                    expectedHost:    'example.com',
                    expectedPort:    '',
                    referer:         'https://1.example.com:443',
                    expectedReferer: 'https://1.example.com',
                },
                {
                    url:             'https://example.com:44344',
                    expectedHost:    'example.com:44344',
                    expectedPort:    '44344',
                    referer:         'https://1.example.com:44344',
                    expectedReferer: 'https://1.example.com:44344',
                }
            ];
            const req = {
                headers: {
                    accept: PAGE_ACCEPT_HEADER
                }
            };
            const ctx = new RequestPipelineContext(req, {}, {});

            proxy.openSession('about:blank', session);

            for (const testCase of testCases) {
                ctx.req.url = urlUtils.getProxyUrl(testCase.url, {
                    proxyHostname: PROXY_HOSTNAME,
                    proxyPort:     1836,
                    sessionId:     session.id,
                });

                if (testCase.referer) {
                    ctx.req.headers.referer = urlUtils.getProxyUrl(testCase.referer, {
                        proxyHostname: PROXY_HOSTNAME,
                        proxyPort:     1836,
                        sessionId:     session.id,
                    });
                }

                ctx.dispatch(proxy.openSessions);

                expect(ctx.dest.host).eql(testCase.expectedHost);
                expect(ctx.dest.port).eql(testCase.expectedPort);
                expect(ctx.dest.referer).eql(testCase.expectedReferer);
            }
        });

        it('Should not send destination request for special pages (GH-796)', () => {
            let rejectionReason = null;

            const options = {
                url: proxy.openSession('about:blank', session),

                headers: {
                    accept: PAGE_ACCEPT_HEADER
                }
            };

            process.once('unhandledRejection', reason => {
                rejectionReason = reason;
            });

            return request(options)
                .then(() => {
                    expect(rejectionReason).to.be.null;
                });
        });

        it('Should handle `about:blank` requests for resources that doesn`t require processing (GH-796)', () => {
            const options = {
                url: proxy.openSession('about:blank', session),

                headers: {
                    accept: 'application/font'
                }
            };

            return request(options)
                .then(body => {
                    expect(body).eql('');
                });
        });

        it('Should not raise the error on dispatching a service url', () => {
            const req = {
                url:     `http://${PROXY_HOSTNAME}/browser/connect`,
                headers: { accept: PAGE_ACCEPT_HEADER }
            };

            const ctx = new RequestPipelineContext(req, {}, {});

            expect(ctx.dispatch(proxy.openSessions)).eql(false);
        });

        describe('Should not change a response body if it is empty (GH-762)', () => {
            it('script', () => {
                const options = {
                    url:     proxy.openSession('http://127.0.0.1:2000/empty-response', session),
                    headers: {
                        'content-type': 'application/javascript; charset=utf-8'
                    }
                };

                return request(options)
                    .then(body => {
                        expect(body).is.empty;
                    });
            });

            it('style', () => {
                const options = {
                    url:     proxy.openSession('http://127.0.0.1:2000/empty-response', session),
                    headers: {
                        'content-type': 'text/css'
                    }
                };

                return request(options)
                    .then(body => {
                        expect(body).is.empty;
                    });
            });
        });

        it('Should abort destination request after fatal error (GH-937)', done => {
            const savedReqTimeout    = DestinationRequest.TIMEOUT;
            let fatalErrorEventCount = 0;

            DestinationRequest.TIMEOUT = 100;

            const destReq = new DestinationRequest({
                url:        'http://127.0.0.1:2000/wait/150',
                protocol:   'http:',
                hostname:   PROXY_HOSTNAME,
                host:       '127.0.0.1:2000',
                port:       2000,
                path:       '/wait/150',
                method:     'GET',
                body:       Buffer.alloc(0),
                isAjax:     false,
                headers:    {},
                rawHeaders: []
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

        it('Should process the top "frameset" element like the "body" element (GH-1009)', () => {
            session.id = 'sessionId';
            session.injectable.scripts.push('/script1.js');
            session.injectable.scripts.push('/script2.js');

            const options = {
                url:     proxy.openSession('http://127.0.0.1:2000/page-with-frameset', session),
                headers: {
                    accept: PAGE_ACCEPT_HEADER
                }
            };

            return request(options)
                .then(body => {
                    const expected = fs.readFileSync('test/server/data/page-with-frameset/expected.html').toString();

                    compareCode(body, expected);
                });
        });

        it('Should not process a page with the non-page content-type header (GH-1014)', () => {
            session.id = 'sessionId';

            const options = {
                url:     proxy.openSession('http://127.0.0.1:2000/GH-1014/pdf-content-type', session),
                headers: {
                    accept: PAGE_ACCEPT_HEADER
                }
            };

            return request(options)
                .then(body => {
                    compareCode(body, 'pdf');
                });
        });

        it('Should process a page without the content-type header (GH-1014)', () => {
            session.id = 'sessionId';

            const options = {
                url:     proxy.openSession('http://127.0.0.1:2000/GH-1014/empty-page-without-content-type/', session),
                headers: {
                    accept: PAGE_ACCEPT_HEADER
                }
            };

            return request(options)
                .then(body => {
                    expect(body).is.not.empty;
                });
        });

        it('Should pass authorization headers which are defined by client for cross-domain request without credentials (GH-1016)', () => {
            const options1 = {
                url:     proxy.openSession('http://127.0.0.1:2002/echo-headers-with-credentials', session),
                json:    true,
                headers: {
                    authorization:         'Basic origin==',
                    'proxy-authorization': 'Digital origin=='
                }
            };

            const options2 = {
                url:     proxy.openSession('http://127.0.0.1:2002/echo-headers-with-credentials', session),
                json:    true,
                headers: {
                    [INTERNAL_HEADERS.authorization]:      'Basic 1243==',
                    [INTERNAL_HEADERS.proxyAuthorization]: 'Digital 423=='
                }
            };

            return Promise.all([
                request(options1)
                    .then(parsedBody => {
                        expect(parsedBody['authorization']).eql('Basic origin==');
                        expect(parsedBody['proxy-authorization']).eql('Digital origin==');
                        expect(parsedBody[INTERNAL_HEADERS.authorization]).to.be.undefined;
                        expect(parsedBody[INTERNAL_HEADERS.proxyAuthorization]).to.be.undefined;
                    }),
                request(options2)
                    .then(parsedBody => {
                        expect(parsedBody['authorization']).eql('Basic 1243==');
                        expect(parsedBody['proxy-authorization']).eql('Digital 423==');
                        expect(parsedBody[INTERNAL_HEADERS.authorization]).to.be.undefined;
                        expect(parsedBody[INTERNAL_HEADERS.proxyAuthorization]).to.be.undefined;
                    })
            ]);
        });

        it('Should procees "x-frame-options" header (GH-1017)', () => {
            const getIframeProxyUrl            = url => {
                return urlUtils.getProxyUrl(url, {
                    proxyHostname: PROXY_HOSTNAME,
                    proxyPort:     1836,
                    sessionId:     session.id,
                    resourceType:  urlUtils.getResourceTypeString({ isIframe: true })
                });
            };
            const getCrossDomainIframeProxyUrl = url => {
                return urlUtils.getProxyUrl(url, {
                    proxyHostname: PROXY_HOSTNAME,
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
                    expectedHeaderValue: 'ALLOW-FROM ' +
                                         proxy.openSession('https://example.com', session).replace(urlUtils.TRAILING_SLASH_RE, '')
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
                const options = {
                    url:                     testCase.url,
                    resolveWithFullResponse: true
                };

                return request(options)
                    .then(res => {
                        expect(res.headers['x-frame-options']).equal(testCase.expectedHeaderValue);
                    });
            };

            return Promise.all(testCases.map(testRequest));
        });

        it('Should not raise file download if resource is fetched by setting script src (GH-1062)', () => {
            const getScriptProxyUrl        = function (url) {
                return urlUtils.getProxyUrl(url, {
                    proxyHostname: PROXY_HOSTNAME,
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

            return request(options)
                .then(body => {
                    expect(body).contains(scriptHeader.SCRIPT_PROCESSING_START_COMMENT);
                    expect(handleFileDownloadIsRaised).to.be.false;
                    session.handleFileDownload = storedHandleFileDownload;
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
                proxyHostname: PROXY_HOSTNAME,
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

        it('Should omit a "sourcemap" header from response (GH-1052)', () => {
            const options = {
                url:                     proxy.openSession('http://127.0.0.1:2000/script', session),
                resolveWithFullResponse: true,
                headers:                 {
                    'content-type': 'application/javascript; charset=utf-8'
                }
            };

            return request(options)
                .then(res => {
                    expect(res.headers['sourcemap']).is.undefined;
                });
        });

        it('Should calculate a valid port for redirect in iframe (GH-1191)', () => {
            proxy.openSession('http://127.0.0.1:2000/', session);

            function testRedirectRequest (opts) {
                const encodedUrl = encodeURIComponent(opts.redirectLocation);
                const options    = {
                    url: urlUtils.getProxyUrl('http://127.0.0.1:2000/redirect/' + encodedUrl, {
                        proxyHostname: PROXY_HOSTNAME,
                        proxyPort:     1836,
                        sessionId:     session.id,
                        resourceType:  urlUtils.getResourceTypeString({ isIframe: true })
                    }),

                    resolveWithFullResponse: true,
                    followRedirect:          false,
                    simple:                  false,
                    headers:                 {
                        referer: urlUtils.getProxyUrl(opts.referer, {
                            proxyHostname: PROXY_HOSTNAME,
                            proxyPort:     1836,
                            sessionId:     session.id
                        })
                    }
                };

                return request(options)
                    .then(res => {
                        const proxyPort = urlUtils.parseProxyUrl(res.headers['location']).proxy.port;

                        expect(proxyPort).eql(opts.expectedProxyPort);
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

        it('Should process a "referrer-policy" header (GH-1195)', () => {
            const options = {
                url:                     proxy.openSession('http://127.0.0.1:2000/referrer-policy', session),
                resolveWithFullResponse: true,
                headers:                 {
                    accept: PAGE_ACCEPT_HEADER
                }
            };

            return request(options)
                .then(res => {
                    expect(res.headers['referrer-policy']).eql('unsafe-url');
                });
        });

        it('Should transform a "Refresh" header (GH-1354)', () => {
            function testRefreshHeader (url, baseUrl) {
                const options = {
                    url: proxy.openSession('http://127.0.0.1:2000/refresh-header/' +
                                           encodeURIComponent(url), session),

                    resolveWithFullResponse: true,
                    headers:                 {
                        accept: PAGE_ACCEPT_HEADER
                    }
                };

                return request(options)
                    .then(res => {
                        if (baseUrl)
                            url = urlLib.resolve(baseUrl, url);

                        const expectedValue = '0;url=' + proxy.openSession(url, session);

                        expect(res.headers['refresh']).eql(expectedValue);
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

        it('Should not hung if an error is raised in resource processor', () => {
            const options         = {
                url:                     proxy.openSession('http://127.0.0.1:2000/script', session),
                resolveWithFullResponse: true,
                headers:                 {
                    'content-type': 'application/javascript; charset=utf-8'
                }
            };
            const storedProcessFn = resourceProcessor.process;

            resourceProcessor.process = () => {
                throw new Error('test error message');
            };

            return request(options)
                .then(() => {
                    expect.fail('Request should raise an error');
                })
                .catch(err => {
                    expect(err.statusCode).eql(500);
                    expect(err.response.body).to.include('test error message');

                    resourceProcessor.process = storedProcessFn;
                });
        });

        it('Should process the location header only for redirect requests', () => {
            proxy.openSession('http://127.0.0.1:2000/', session);

            function testRedirectRequestStatusCode (statusCode, shouldProcessLocation) {
                const options = {
                    url: proxy.openSession('http://127.0.0.1:2000/redirect-with-status/' + statusCode, session),

                    resolveWithFullResponse: true,
                    followRedirect:          false,
                    simple:                  false
                };

                return request(options)
                    .then(res => {
                        const parsedUrl = urlUtils.parseProxyUrl(res.headers['location']);

                        expect(!!parsedUrl).eql(shouldProcessLocation);
                    });
            }

            return Promise.all([
                testRedirectRequestStatusCode(301, true),
                testRedirectRequestStatusCode(302, true),
                testRedirectRequestStatusCode(303, true),
                testRedirectRequestStatusCode(307, true),
                testRedirectRequestStatusCode(308, true),
                testRedirectRequestStatusCode(200, false),
                testRedirectRequestStatusCode(201, false),
                testRedirectRequestStatusCode(202, false)
            ]);
        });

        if (semver.lt(process.version, '13.0.0')) {
            it('Should not pipe the request with the 304 status code (Not Modified) (GH-1602)', () => {
                const server = net.createServer(socket => {
                    socket.on('data', () => {
                        socket.write([
                            'HTTP/1.1 304 Not Modified',
                            'Content-Length: 5',
                            '',
                            ''
                        ].join('\r\n'));
                    });
                });

                return getFreePort()
                    .then(port => new Promise(resolve => server.listen(port, () => resolve(port))))
                    .then(port => new Promise((resolve, reject) => {
                        const proxyUrl   = proxy.openSession(`http://127.0.0.1:${port}/`, session);
                        const reqOptions = Object.assign(urlLib.parse(proxyUrl), {
                            method:  'GET',
                            headers: { 'if-none-match': 'NQQ6Iyi1ttEATRNQs+U9yQ==' }
                        });

                        const req = http.request(reqOptions, res => {
                            const chunks = [];

                            res.on('data', chunk => chunks.push(chunk));
                            res.on('end', () => resolve({ res, body: Buffer.concat(chunks).toString() }));
                        });

                        req.on('error', reject);
                        req.setTimeout(1500, () => reject('timeout'));
                        req.end();
                    }))
                    .then(({ res, body }) => {
                        expect(res.statusCode).eql(304);
                        expect(res.headers['content-length']).eql('5');
                        expect(body).eql('');
                        server.close();
                    });
            });
        }

        it('Should not change request headers to lowercase (GH-1380)', () => {
            const options = {
                url:     proxy.openSession('http://127.0.0.1:2000/echo-raw-headers-names', session),
                json:    true,
                headers: {
                    'if-none-match':    'NQQ6Iyi1ttEATRNQs+U9yQ==',
                    'X-Requested-With': 'XMLHttpRequest',
                    'ConTEnt-tyPE':     'application/json'
                }
            };

            return request(options)
                .then(rawHeadersNames => {
                    expect(rawHeadersNames).to.include.members(['if-none-match', 'X-Requested-With', 'ConTEnt-tyPE']);
                });
        });

        it('Should skip the "x-frame-options" header if request has the CSP header and it contains "frame-ancestors" option (GH-1666)', () => {
            const options = {
                url:                     proxy.openSession('http://127.0.0.1:2000/GH-1666', session),
                resolveWithFullResponse: true,
                simple:                  false
            };

            return request(options)
                .then((res) => {
                    expect(res.headers).to.not.have.property('x-frame-options');
                    expect(res.headers).to.not.have.property('content-security-policy');
                    expect(res.headers).to.have.property('content-type');
                });
        });

        it('More lenient gzip decompression (GH-1915)', () => {
            const options = {
                url:     proxy.openSession('http://127.0.0.1:2000/GH-1915', session),
                gzip:    true,
                headers: { accept: 'text/html' }
            };

            session.handlePageError = (ctx, err) => expect(err).eql(null);

            return request(options)
                .then(body => {
                    expect(body).contains('<h1>Compressible response content.</h1>');
                });
        });

        it('Should destroy unnecessary sockets to a destination server (GH-2149)', (done) => {
            const proxyUrl = proxy.openSession('http://127.0.0.1:2000/long-response', session);

            http.get(proxyUrl, (res) => {
                res.on('data', d => {
                    expect(d.toString()).eql('this is body part');
                    res.destroy();

                    setTimeout(() => {
                        expect(longResponseSocket.destroyed).eql(true);
                        done();
                    }, 3000);
                });
            });
        });

        it('Should respond with an error when destination server emits an error', () => {
            const url               = 'http://127.0.0.1:2000/error-emulation';
            const storedHttpRequest = http.request;
            const options           = {
                url:                     proxy.openSession(url, session),
                resolveWithFullResponse: true,
                simple:                  false
            };

            http.request = function (opts, callback) {
                if (opts.url === url) {
                    const mock = new EventEmitter();

                    mock.setTimeout = mock.write = mock.end = noop;

                    setTimeout(() => mock.emit('error', new Error('Emulation of error!')), 500);

                    return mock;
                }

                return storedHttpRequest(opts, callback);
            };

            return request(options)
                .then(res => {
                    http.request = storedHttpRequest;

                    expect(res.statusCode).eql(500);
                    expect(res.body).eql('Failed to perform a request to the resource at ' +
                                         '<a href="http://127.0.0.1:2000/error-emulation">' +
                                         'http://127.0.0.1:2000/error-emulation</a> ' +
                                         'because of an error.\nError: Emulation of error!');
                });
        });

        it('Should not emit error after a destination response is ended', () => {
            const nativeOnResponse = DestinationRequest.prototype._onResponse;
            let hasPageError       = false;

            DestinationRequest.prototype._onResponse = function (res) {
                res.once('end', () => setTimeout(() => this._onError(new Error()), 50));

                nativeOnResponse.apply(this, arguments);
                DestinationRequest.prototype._onResponse = nativeOnResponse;
            };

            const options = {
                url:     proxy.openSession('http://127.0.0.1:2000/', session),
                headers: { accept: PAGE_ACCEPT_HEADER }
            };

            session.handlePageError = () => {
                hasPageError = true;
            };

            return request(options)
                .then(() => new Promise(resolve => setTimeout(resolve, 2000)))
                .then(() => expect(hasPageError).to.be.false);
        });
    });
});
