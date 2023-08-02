const fs                    = require('fs');
const https                 = require('https');
const request               = require('request-promise-native');
const { expect }            = require('chai');
const express               = require('express');
const debug                 = require('debug');
const read                  = require('read-file-relative').readSync;
const selfSignedCertificate = require('openssl-self-signed-certificate');
const BUILTIN_HEADERS       = require('../../../lib/request-pipeline/builtin-header-names');
const StateSnaphot          = require('../../../lib/session/state-snapshot');
const RequestFilterRule     = require('../../../lib/request-pipeline/request-hooks/request-filter-rule');
const { gzip }              = require('../../../lib/utils/promisified-functions');
const urlUtils              = require('../../../lib/utils/url');
const { processScript }     = require('../../../lib/processing/script');
const DestinationRequest    = require('../../../lib/request-pipeline/destination-request');
const headersUtils          = require('../../../lib/utils/headers');
const {
    createDestinationServer,
    createSession,
    createAndStartProxy,
    compareCode,
    getFileProtocolUrl,
    getBasicProxyUrl,
    normalizeNewLine,
    replaceLastAccessedTime,
} = require('../common/utils');

const {
    PAGE_ACCEPT_HEADER,
    CROSS_DOMAIN_SERVER_PORT,
    EMPTY_PAGE_MARKUP,
} = require('../common/constants');

const Credentials = urlUtils.Credentials;

const ENSURE_URL_TRAILING_SLASH_TEST_CASES = [
    {
        url:                   'http://example.com',
        shoudAddTrailingSlash: true,
    },
    {
        url:                   'https://localhost:8080',
        shoudAddTrailingSlash: true,
    },
    {
        url:                   'about:blank',
        shoudAddTrailingSlash: false,
    },
    {
        url:                   'http://example.com/page.html',
        shoudAddTrailingSlash: false,
    },
    {
        url:                   'file://localhost/etc/fstab', // Unix file URI scheme
        shoudAddTrailingSlash: false,
    },
    {
        url:                   'file:///etc/fstab', // Unix file URI scheme
        shoudAddTrailingSlash: false,
    },
    {
        url:                   'file://localhost/c:/WINDOWS/clock.avi', // Windows file URI scheme
        shoudAddTrailingSlash: false,
    },
    {
        url:                   'file:///c:/WINDOWS/clock.avi', // Windows file URI scheme
        shoudAddTrailingSlash: false,
    },
];

describe('Proxy', () => {
    let destServer        = null;
    let crossDomainServer = null;
    let proxy             = null;
    let session           = null;

    function getProxyUrl (url, resourceType, reqOrigin, credentials, isCrossDomain, currentSession = session) {
        return getBasicProxyUrl(url, resourceType, reqOrigin, credentials, isCrossDomain, currentSession);
    }

    function setupSameDomainServer () {
        const sameDomainDestinationServer = createDestinationServer();
        const { app }                     = sameDomainDestinationServer;

        destServer = sameDomainDestinationServer.server;

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
                'content-length':   0,
            });
            res.end();
        });

        app.get('/', (req, res) => res.destroy());

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
                'value without key',
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

        app.get('/script', (req, res) => {
            res.setHeader('content-type', 'application/javascript; charset=utf-8');
            res.set('sourcemap', '/src.js.map');
            res.end(fs.readFileSync('test/server/data/script/src.js').toString());
        });

        app.get('/service-worker', (req, res) => {
            res
                .set('content-type', 'application/javascript; charset=utf-8')
                .end(fs.readFileSync('test/server/data/service-worker/src.js').toString());
        });

        app.get('/service-worker-allowed', (req, res) => {
            res
                .set('content-type', 'application/javascript; charset=utf-8')
                .set('service-worker-allowed', '/path/')
                .end(fs.readFileSync('test/server/data/service-worker/src-with-header.js').toString());
        });

        app.get('/stylesheet', (req, res) => {
            res.end(fs.readFileSync('test/server/data/stylesheet/src.css').toString());
        });

        app.get('/stylesheet-with-many-spaces', (req, res) => {
            let cssWithManySpaces = '.c{border:1px solid #ffffff;color:#000000}';

            cssWithManySpaces += ' '.repeat(400000);
            cssWithManySpaces += '.c1{border:1px solid #ffffff;color:#000000}';

            res.end(cssWithManySpaces);
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

        app.options('/preflight', (req, res) => res
            .status(204)
            .set(BUILTIN_HEADERS.accessControlAllowOrigin, 'http://example.com')
            .set(BUILTIN_HEADERS.accessControlAllowCredentials, 'false')
            .set('Access-Control-Allow-Methods', 'POST, GET, OPTIONS, DELETE')
            .send());

        app.get('/authenticate', (req, res) => {
            res
                .status(401)
                .set('www-authenticate', 'Basic realm="Login"')
                .set('proxy-authenticate', 'Digital realm="Login"')
                .end();
        });

        app.get('/Q557255/page-without-content-type', (req, res) => {
            res.set('content-encoding', 'gzip');
            res.end('42');
        });

        app.get('/T239167/send-location', (req, res) => {
            res.writeHead(200, { 'location': 'http://127.0.0.1:2000/\u0410\u0411' });
            res._send('');
            res.end();
        });

        app.post('/upload-info', (req, res) => {
            const chunks = [];

            req.on('data', chunk => chunks.push(chunk));
            req.on('end', () => res.end(Buffer.concat(chunks).toString()));
        });

        app.get('/echo-headers', (req, res) => res.end(JSON.stringify(req.headers)));

        app.get('/wait/:ms', (req, res) => {
            setTimeout(() => res.end('text'), req.params.ms);
        });

        app.get('/GH-1666', (req, res) => {
            res
                .set('content-type', 'text/html')
                .set('content-security-policy', 'frame-ancestors http:')
                .set('x-frame-options', 'deny')
                .send('');
        });

        app.get('/redirect/:url', (req, res) => {
            res
                .status(302)
                .set('location', decodeURIComponent(req.params.url))
                .end();
        });

        app.get('/script-with-import-statement', (req, res) => {
            res
                .status(200)
                .set('content-type', 'text/javascript')
                .end('import m from "module-name";');
        });

        app.get('/link-prefetch-header', (req, res) => {
            res.setHeader('link', '<http://some.url.com>; rel=prefetch');
            res.end('42');
        });

        app.get('/content-encoding-upper-case', (req, res) => {
            gzip('// Compressed GZIP')
                .then(data => {
                    res
                        .status(200)
                        .set('content-type', 'application/javascript')
                        .set('content-encoding', 'GZIP')
                        .end(data);
                });
        });
    }

    function setupCrossDomainServer () {
        const crossDomainDestinationServer = createDestinationServer(CROSS_DOMAIN_SERVER_PORT);
        const { app: crossDomainApp }      = crossDomainDestinationServer;

        crossDomainServer = crossDomainDestinationServer.server;

        crossDomainApp.get('/echo-headers', (req, res) => {
            res.setHeader('access-control-allow-origin', '*');

            res.json(req.headers);
        });

        crossDomainApp.get('/echo-headers-with-credentials', (req, res) => {
            res.setHeader('access-control-allow-origin', 'http://127.0.0.1:2000');
            res.setHeader('access-control-allow-credentials', 'true');

            res.json(req.headers);
        });
    }

    before(() => {
        setupSameDomainServer();
        setupCrossDomainServer();
    });

    after(() => {
        destServer.close();
        crossDomainServer.close();
    });

    beforeEach(() => {
        session = createSession();
        proxy   = createAndStartProxy();
    });

    afterEach(() => {
        proxy.close();
    });

    describe('Session', () => {
        it('Should ensure a trailing slash on openSession() (GH-1426)', () => {
            function getExpectedProxyUrl (testCase) {
                const proxiedUrl = getProxyUrl(testCase.url);

                return proxiedUrl + (testCase.shoudAddTrailingSlash ? '/' : '');
            }

            function testAddingTrailingSlash (testCases) {
                testCases.forEach(testCase => {
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

                return getProxyUrl(url);
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
            const UNRESOLVABLE_URL = 'http://www.some-unresolvable.url/';

            session.handlePageError = (ctx, err) => {
                expect(err).eql(`Failed to find a DNS-record for the resource at <a href="${UNRESOLVABLE_URL}">${UNRESOLVABLE_URL}</a>.`);

                ctx.res.end();
                done();

                return true;
            };

            const options = {
                url:     proxy.openSession(UNRESOLVABLE_URL, session),
                headers: {
                    accept: PAGE_ACCEPT_HEADER,
                },
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
                    accept: PAGE_ACCEPT_HEADER,
                },
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
                    sessionId: session.id,
                },
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

        it('Should handle undefined/wrong-type error correctly', () => {
            debug.enable('testcafe:hammerhead:service-message');

            const srderrWrite = process.stderr.write;
            let log           = '';

            process.stderr.write = msg => {
                log += msg;
            };

            const options = {
                method: 'POST',
                url:    'http://localhost:1836/messaging',
                json:   true,
                body:   {
                    cmd:       'ServiceTestCmd',
                    data:      '42',
                    sessionId: session.id,
                },
            };

            proxy.openSession('http://example.com', session);

            session['ServiceTestCmd'] = () => {
                throw 1;
            };

            return request(options)
                .then(() => {
                    throw new Error('unexpected error');
                })
                .catch(err => {
                    process.stderr.write = srderrWrite;

                    debug.disable();

                    expect(err.message).eql('500 - 1');
                    expect(log).contains('The "1" error of the "number" type was passed. Make sure that service message handlers throw errors of the Error type.');
                });
        });

        describe('Task script', () => {
            it('Regular', () => {
                function testTaskScriptRequest (url, scriptBody) {
                    const options = {
                        headers: {
                            referer: proxy.openSession('http://example.com', session),
                        },

                        url:                     url,
                        resolveWithFullResponse: true,
                    };

                    return request(options)
                        .then(res => {
                            expect(res.body).contains(scriptBody);
                            expect(res.headers['content-type']).eql('application/x-javascript');
                            expect(res.headers['cache-control']).eql('no-cache, no-store, must-revalidate');
                            expect(res.headers['pragma']).eql('no-cache');
                        });
                }

                session.getPayloadScript       = async () => 'PayloadScript';
                session.getIframePayloadScript = async () => 'IframePayloadScript';

                return Promise.all([
                    testTaskScriptRequest('http://localhost:1836/task.js', 'PayloadScript'),
                    testTaskScriptRequest('http://localhost:1836/iframe-task.js', 'IframePayloadScript'),
                ]);
            });

            it('Error', () => {
                const sessionMock = {
                    options: { windowId: 'dummy' },
                };

                const options = {
                    headers: {
                        referer: proxy.openSession('http://example.com', sessionMock),
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
                        headers: { accept: PAGE_ACCEPT_HEADER },
                    },
                };

                return request(options)
                    .then(body => {
                        expect(body).to.not.empty;
                    });
            };

            return Promise.all(specialPageProxyUrls.map(testSpecialPageRequest));
        });

        it('Should set up the prevent caching headers', () => {
            session.options.disablePageCaching = true;

            const options = {
                headers: {
                    referer: proxy.openSession('http://example.com', session),
                    accept:  PAGE_ACCEPT_HEADER,
                    etag:    '<value>',
                    expires: 'date',
                },

                url:                     proxy.openSession('http://127.0.0.1:2000/page/', session),
                resolveWithFullResponse: true,
            };

            return request(options)
                .then(res => {
                    expect(res.headers['cache-control']).eql('no-cache, no-store, must-revalidate');
                    expect(res.headers['pragma']).eql('no-cache');
                    expect('etag' in res.headers).to.be.false;
                    expect('expires' in res.headers).to.be.false;

                    session.options.disablePageCaching = false;
                });
        });

        it('Should correctly cache scripts that contain session id in the import statement', () => {
            const getUrlFromBodyReqExp = /[\S\s]+import m from\s+"([^"]+)[\S\s]+/g;

            const someSession = createSession({ windowId: '54321' });

            someSession.id = 'dIonisses';

            let scriptProxyUrl = getProxyUrl('http://localhost:2000/script-with-import-statement',
                { isScript: true }, void 0, void 0, false, someSession);

            proxy.openSession('http://localhost:2000/', someSession);

            return request(scriptProxyUrl)
                .then(body => {
                    const importUrl = body.replace(getUrlFromBodyReqExp, '$1');

                    expect(importUrl).eql('http://127.0.0.1:1836/dIonisses*54321!s!utf-8/http://localhost:2000/module-name');


                    session.id     = 'sessionId';
                    scriptProxyUrl = getProxyUrl('http://localhost:2000/script-with-import-statement', { isScript: true });

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

    describe('DestinationRequest', () => {
        class MockDestinationRequest extends DestinationRequest {
            _send () {}
        }

        it('Should calculate the effective request timeouts', () => {
            const sessionWithDefaultParameters = new MockDestinationRequest({});

            expect(sessionWithDefaultParameters.timeout).eql(25000);

            const sessionWithDefaultParametersIsAjax = new MockDestinationRequest({ isAjax: true });

            expect(sessionWithDefaultParametersIsAjax.timeout).eql(120000);

            const sessionWithSpecifiedPageTimeout = new MockDestinationRequest({
                requestTimeout: { page: 100 },
            });

            expect(sessionWithSpecifiedPageTimeout.timeout).eql(100);

            const sessionWithSpecifiedPageTimeoutIsAjax = new MockDestinationRequest({
                requestTimeout: { page: 100 },
                isAjax:         true,
            });

            expect(sessionWithSpecifiedPageTimeoutIsAjax.timeout).eql(120000);

            const sessionWithSpecifiedBothTimeouts = new MockDestinationRequest({
                requestTimeout: { page: 100, ajax: 200 },
            });

            expect(sessionWithSpecifiedBothTimeouts.timeout).eql(100);

            const sessionWithSpecifiedBothTimeoutsIsAjax = new MockDestinationRequest({
                requestTimeout: { page: 100, ajax: 200 },
                isAjax:         true,
            });

            expect(sessionWithSpecifiedBothTimeoutsIsAjax.timeout).eql(200);

            const sessionWithUndefinedTimeouts = new MockDestinationRequest({
                requestTimeout: {
                    page: void 0,
                    ajax: void 0,
                },
            });

            expect(sessionWithUndefinedTimeouts.timeout).eql(25000);

            const sessionWithUndefinedTimeoutsIsAjax = new MockDestinationRequest({
                requestTimeout: {
                    page: void 0,
                    ajax: void 0,
                },
                isAjax: true,
            });

            expect(sessionWithUndefinedTimeoutsIsAjax.timeout).eql(120000);
        });
    });

    describe('Cookies', () => {
        it('Should handle "Cookie" and "Set-Cookie" headers', () => {
            const options = {
                url:            proxy.openSession('http://127.0.0.1:2000/cookie/set-and-redirect', session),
                followRedirect: true,
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
                'test3=te\x02st3',
            ]);

            expect(session.cookies.getClientString('http://example.com')).eql('test1=test1');
        });

        describe('Server synchronization with client', () => {
            it('Should generate cookie for synchronization', function () {
                const cookie  = encodeURIComponent('aaa=111;path=/path');
                const options = {
                    url: proxy.openSession('http://127.0.0.1:2000/cookie-server-sync/' + cookie, session),

                    resolveWithFullResponse: true,
                    simple:                  false,
                };

                return request(options)
                    .then(res => {
                        expect(replaceLastAccessedTime(res.headers['set-cookie'][0]))
                            .eql(`s|${session.id}|aaa|127.0.0.1|%2Fpath||%lastAccessed%|=111;path=/`);
                    });
            });

            it('Should generate cookie for synchronization for iframe', function () {
                const cookie  = encodeURIComponent('aaa=111;path=/path');
                const options = {
                    url: getProxyUrl('http://127.0.0.1:2000/cookie-server-sync/' + cookie, { isIframe: true }),

                    headers:                 { accept: 'text/html' },
                    resolveWithFullResponse: true,
                    simple:                  false,
                };

                proxy.openSession('http://127.0.0.1:2000/', session);

                return request(options)
                    .then(res => {
                        expect(replaceLastAccessedTime(res.headers['set-cookie'][0]))
                            .eql(`s|${session.id}|aaa|127.0.0.1|%2Fpath||%lastAccessed%|=111;path=/`);
                    });
            });

            it('Should remove obsolete synchronization cookie', function () {
                const obsoleteTime = (new Date().getTime() - 1000).toString(36);
                const cookie       = encodeURIComponent('bbb=321;path=/');
                const options      = {
                    url:     proxy.openSession('http://127.0.0.1:2000/cookie-server-sync/' + cookie, session),
                    headers: {
                        cookie: [
                            `s|${session.id}|aaa|127.0.0.1|%2F||123456788|=temp`,
                            `s|${session.id}|aaa|127.0.0.1|%2F||123456789|=test`,
                            `s|${session.id}|bbb|127.0.0.1|%2F||${obsoleteTime}|=321`,
                        ].join('; '),
                    },

                    resolveWithFullResponse: true,
                    simple:                  false,
                };

                return request(options)
                    .then(res => {
                        expect(res.headers['set-cookie'][0])
                            .eql(`s|${session.id}|aaa|127.0.0.1|%2F||123456788|=;path=/;expires=Thu, 01 Jan 1970 00:00:01 GMT`);
                        expect(res.headers['set-cookie'][1])
                            .eql(`s|${session.id}|bbb|127.0.0.1|%2F||${obsoleteTime}|=;path=/;expires=Thu, 01 Jan 1970 00:00:01 GMT`);
                        expect(replaceLastAccessedTime(res.headers['set-cookie'][2]))
                            .eql(`s|${session.id}|bbb|127.0.0.1|%2F||%lastAccessed%|=321;path=/`);
                    });
            });

            it('Should skip httpOnly cookie', function () {
                const cookie  = encodeURIComponent('ccc=123;httpOnly');
                const options = {
                    url: proxy.openSession('http://127.0.0.1:2000/cookie-server-sync/' + cookie, session),

                    resolveWithFullResponse: true,
                    simple:                  false,
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
                        cookie: `c|${session.id}|Test1|127.0.0.1|%2F||1fdkm5ln1|=Data1; ` +
                                `c|${session.id}|Test2|localhost|%2F||1fdkm5ln1|=Data2`,
                    },
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
                        cookie: `c|${session.id}|Test1|127.0.0.1|%2F||1fdkm5ln1|=Data1; ` +
                                `cw|${session.id}|Test2|127.0.0.1|%2F||1fdkm5ln1|=Data2`,
                    },

                    resolveWithFullResponse: true,
                };

                return request(options)
                    .then(res => {
                        expect(res.body).eql('%% Test1=Data1; Test2=Data2 %%');
                        expect(res.headers['set-cookie'].length).eql(1);
                        expect(res.headers['set-cookie'][0])
                            .eql(`c|${session.id}|Test1|127.0.0.1|%2F||1fdkm5ln1|=;path=/;expires=Thu, 01 Jan 1970 00:00:01 GMT`);
                        expect(session.cookies.getClientString('http://127.0.0.1:12354/')).eql('Test1=Data1; Test2=Data2');
                    });
            });

            it('Should consider the path parameter', () => {
                const options = {
                    url:     proxy.openSession('http://127.0.0.1:2000/cookie/echo', session),
                    headers: {
                        cookie: `c|${session.id}|Test1|example.com|%2Fcookie||1fdkm5ln1|=Data1; ` +
                                `c|${session.id}|Test2|example.com|%2Fpath||1fdkm5ln1|=Data2; ` +
                                `c|${session.id}|Test3|example.com|%2F||1fdkm5ln1|=Data3`,
                    },
                };

                return request(options)
                    .then(() => {
                        expect(session.cookies.getClientString('http://example.com/')).eql('Test3=Data3');
                        expect(session.cookies.getClientString('http://example.com/cookie')).eql('Test1=Data1; Test3=Data3');
                        expect(session.cookies.getClientString('http://example.com/path')).eql('Test2=Data2; Test3=Data3');
                    });
            });
        });

        it('Should put cookies to the request and remove from store', () => {
            const options = {
                method: 'POST',
                url:    'http://localhost:1836/messaging',
                json:   true,
                body:   {
                    cmd:       'ServiceTestCmd',
                    data:      '42',
                    sessionId: session.id,
                },
            };

            proxy.openSession('https://example.com', session);

            session.cookies.setCookies([{
                name:   'Test',
                value:  'Data',
                domain: 'example.com',
                path:   '/',
            }]);

            expect(session.cookies._pendingSyncCookies.length).eql(1);

            session['ServiceTestCmd'] = (msg, serverInfo) => {
                expect(serverInfo).to.be.an('object');
                return 'answer: ' + msg.data;
            };

            return request(options)
                .then(() => {
                    expect(session.cookies._pendingSyncCookies.length).eql(0);
                    expect(session.cookies.getClientString('https://example.com/')).eql('Test=Data');
                });
        });
    });

    describe('Headers', () => {
        it('Should omit a "link" header from response (https://github.com/DevExpress/testcafe/issues/2528)', () => {
            const options = {
                url:                     proxy.openSession('http://127.0.0.1:2000/link-prefetch-header', session),
                resolveWithFullResponse: true,
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
                simple:                  false,
            };

            return request(options)
                .then(res => {
                    expect(res.headers['www-authenticate']).eql(headersUtils.addAuthenticatePrefix('Basic realm="Login"'));
                    expect(res.headers['proxy-authenticate']).eql(headersUtils.addAuthenticatePrefix('Digital realm="Login"'));
                });
        });

        describe('Location header', () => {
            it('Should ensure a trailing slash on location header (GH-1426)', () => {
                function getExpectedProxyUrl (testCase) {
                    const proxiedUrl = getProxyUrl(testCase.url);

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

                    return getProxyUrl(url);
                }

                function testUrl (url, shouldOmitPort) {
                    const proxiedUrl = proxy.openSession(url, session);
                    const encodedUrl = encodeURIComponent(proxiedUrl);
                    const options    = {
                        url: 'http://127.0.0.1:2000/redirect/' + encodedUrl,

                        resolveWithFullResponse: true,
                        followRedirect:          false,
                        simple:                  false,
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
                        testUrl(protocol + '//localhost:2343/', false),
                    ]);
                }

                return Promise.all([
                    testDefaultPortOmitting('http:', '80', '443'),
                    testDefaultPortOmitting('https:', '443', '80'),
                ]);
            });
        });
    });

    describe('XHR same-origin policy', () => {
        it('Should restrict requests from other domain', () => {
            const options = {
                url: getProxyUrl('http://127.0.0.1:2000/page/plain-text', { isAjax: true },
                    'http://example.com', Credentials.sameOrigin, true),

                resolveWithFullResponse: true,
            };

            proxy.openSession('http://example.com/', session);

            return request(options)
                .then(res => {
                    expect(res.statusCode).eql(200);
                    expect(res.headers[BUILTIN_HEADERS.accessControlAllowOrigin]).to.be.empty;
                });
        });

        it('Should restrict requests from file protocol to some domain', () => {
            const options = {
                url: getProxyUrl('http://127.0.0.1:2000/page/plain-text', { isAjax: true },
                    'null', Credentials.sameOrigin, true),

                resolveWithFullResponse: true,
            };

            proxy.openSession('file:///path/page.html', session);

            return request(options)
                .then(res => {
                    expect(res.statusCode).eql(200);
                    expect(res.headers[BUILTIN_HEADERS.accessControlAllowOrigin]).to.be.empty;
                });
        });

        it('Should restrict requests between file urls', () => {
            const options = {
                url: getProxyUrl(getFileProtocolUrl('../data/stylesheet/src.css'), { isAjax: true },
                    'null', Credentials.sameOrigin, true),

                resolveWithFullResponse: true,
            };

            proxy.openSession('file:///path/page.html', session);

            return request(options)
                .then(res => {
                    expect(res.statusCode).eql(200);
                    expect(res.headers[BUILTIN_HEADERS.accessControlAllowOrigin]).to.be.empty;
                });
        });

        it('Should allow preflight requests from other domain', () => {
            const options = {
                method: 'OPTIONS',
                url:    getProxyUrl('http://127.0.0.1:2000/preflight', { isAjax: true },
                    'http://example.com', Credentials.sameOrigin, true),

                resolveWithFullResponse: true,
            };

            proxy.openSession('http://example.com', session);

            return request(options)
                .then(res => {
                    expect(res.statusCode).eql(204);
                    expect(res.headers[BUILTIN_HEADERS.accessControlAllowOrigin]).eql('http://127.0.0.1:1836');
                    expect(res.headers[BUILTIN_HEADERS.accessControlAllowCredentials]).eql('false');
                    expect(res.headers['access-control-allow-methods']).eql('POST, GET, OPTIONS, DELETE');
                });
        });

        it('Should restrict preflight requests from other domain', () => {
            const options = {
                method: 'OPTIONS',
                url:    getProxyUrl('http://127.0.0.1:2000/preflight', { isAjax: true },
                    'http://example.com', Credentials.include, true),

                resolveWithFullResponse: true,
            };

            proxy.openSession('http://example.com', session);

            return request(options)
                .then(res => {
                    expect(res.statusCode).eql(204);
                    expect(res.headers[BUILTIN_HEADERS.accessControlAllowOrigin]).to.be.empty;
                    expect(res.headers[BUILTIN_HEADERS.accessControlAllowCredentials]).eql('false');
                    expect(res.headers['access-control-allow-methods']).eql('POST, GET, OPTIONS, DELETE');
                });
        });

        it('Should allow requests from other domain if CORS is enabled and allowed origin is wildcard ', () => {
            const options = {
                url: getProxyUrl('http://127.0.0.1:2000/xhr-origin/allow-any', { isAjax: true },
                    'http://example.com', Credentials.sameOrigin, true),

                resolveWithFullResponse: true,
            };

            proxy.openSession('http://example.com', session);

            return request(options)
                .then(res => {
                    expect(res.statusCode).eql(200);
                    expect(res.headers[BUILTIN_HEADERS.accessControlAllowOrigin]).eql('http://127.0.0.1:1836');
                });
        });

        it('Should allow requests from other domain if CORS is enabled and origin is allowed', () => {
            const options = {
                url: getProxyUrl('http://127.0.0.1:2000/xhr-origin/allow-provided', { isAjax: true },
                    'http://example.com', Credentials.sameOrigin, true),
                headers: { 'x-allow-origin': 'http://example.com' },

                resolveWithFullResponse: true,
            };

            proxy.openSession('http://example.com', session);

            return request(options)
                .then(res => {
                    expect(res.statusCode).eql(200);
                    expect(res.headers[BUILTIN_HEADERS.accessControlAllowOrigin]).eql('http://127.0.0.1:1836');
                });
        });

        it('Should allow requests from other domain if it is "not modified" (GH-617)', () => {
            const options = {
                url: getProxyUrl('http://127.0.0.1:2000/304', { isAjax: true },
                    'http://example.com', Credentials.sameOrigin, true),
                headers: { 'if-modified-since': 'Thu, 01 Aug 2013 18:31:48 GMT' },

                resolveWithFullResponse: true,
            };

            proxy.openSession('http://example.com', session);

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
                url: getProxyUrl('http://127.0.0.1:2000/cookie-server-sync/key=value;%20path=%2F', { isAjax: true },
                    'http://example.com', Credentials.include, true),

                resolveWithFullResponse: true,
            };

            proxy.openSession('http://example.com', session);

            return request(options)
                .then(res => {
                    expect(res.statusCode).eql(200);
                    expect(replaceLastAccessedTime(res.headers['set-cookie'][0]))
                        .eql(`s|${session.id}|key|127.0.0.1|%2F||%lastAccessed%|=value;path=/`);
                    expect(res.headers[BUILTIN_HEADERS.accessControlAllowOrigin]).to.be.empty;
                    expect(session.cookies.getClientString('http://127.0.0.1:2000')).eql('key=value');
                });
        });

        it('Should not apply "set-cookie" header if the credentials check is not passed (GH-2166)', () => {
            const options = {
                url: getProxyUrl('http://127.0.0.1:2000/cookie/set-cookie-cors', { isAjax: true },
                    'http://example.com', Credentials.sameOrigin, true),

                resolveWithFullResponse: true,
            };

            proxy.openSession('http://example.com', session);

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
                it('Should omit cookie header for same-domain request', () => {
                    const options = {
                        url: getProxyUrl('http://127.0.0.1:2000/echo-headers',
                            { isAjax: true }, void 0, Credentials.omit),
                        json: true,
                    };

                    proxy.openSession('http://127.0.0.1:2000', session);
                    session.cookies.setByServer('http://127.0.0.1:2000', 'key=value');

                    return request(options)
                        .then(parsedBody => {
                            expect(parsedBody.cookie).to.be.undefined;
                        });
                });

                it('Should omit cookie header for cross-domain request', () => {
                    const options = {
                        url: getProxyUrl('http://127.0.0.1:2002/echo-headers', { isAjax: true },
                            'http://127.0.0.1:2000', Credentials.omit, true),
                        json: true,
                    };

                    proxy.openSession('http://127.0.0.1:2000', session);
                    session.cookies.setByServer('http://127.0.0.1:2000', 'key=value');

                    return request(options)
                        .then(parsedBody => {
                            expect(parsedBody.cookie).to.be.undefined;
                        });
                });
            });

            describe('Same-origin', () => {
                it('Should pass cookie header for same-domain request', () => {
                    const options = {
                        url: getProxyUrl('http://127.0.0.1:2000/echo-headers',
                            { isAjax: true }, void 0, Credentials.sameOrigin),
                        json: true,
                    };

                    proxy.openSession('http://127.0.0.1:2000', session);
                    session.cookies.setByServer('http://127.0.0.1:2000', 'key=value');

                    return request(options)
                        .then(parsedBody => {
                            expect(parsedBody.cookie).eql('key=value');
                        });
                });

                it('Should omit cookie header for cross-domain request', () => {
                    const options = {
                        url: getProxyUrl('http://127.0.0.1:2002/echo-headers', { isAjax: true },
                            'http://127.0.0.1:2000', Credentials.sameOrigin, true),
                        json: true,
                    };

                    proxy.openSession('http://127.0.0.1:2000', session);
                    session.cookies.setByServer('http://127.0.0.1:2000', 'key=value');

                    return request(options)
                        .then(parsedBody => {
                            expect(parsedBody.cookie).to.be.undefined;
                        });
                });
            });

            describe('Include', () => {
                it('Should pass cookie header for same-domain request', () => {
                    const options = {
                        url: getProxyUrl('http://127.0.0.1:2000/echo-headers',
                            { isAjax: true }, void 0, Credentials.include),
                        json: true,
                    };

                    proxy.openSession('http://127.0.0.1:2000', session);
                    session.cookies.setByServer('http://127.0.0.1:2000', 'key=value');

                    return request(options)
                        .then(parsedBody => {
                            expect(parsedBody.cookie).eql('key=value');
                        });
                });

                it('Should pass cookie headers for cross-domain request', () => {
                    const options = {
                        url: getProxyUrl('http://127.0.0.1:2002/echo-headers-with-credentials', { isAjax: true },
                            'http://127.0.0.1:2000', Credentials.include, true),
                        json: true,
                    };

                    proxy.openSession('http://127.0.0.1:2000', session);
                    session.cookies.setByServer('http://127.0.0.1:2000', 'key=value');

                    return request(options)
                        .then(parsedBody => {
                            expect(parsedBody.cookie).eql('key=value');
                        });
                });
            });
        });

        it('Should respond with error if an error is occurred on attempting to connect with destination server', () => {
            const url = getProxyUrl('http://127.0.0.1:2000/', { isAjax: true }, void 0, Credentials.omit);

            proxy.openSession('http://127.0.0.1:2000/', session);

            return request(url)
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
                    sessionStorage: '[["key2"],["value"]]',
                },
            });

            const options = {
                url:     proxy.openSession('http://127.0.0.1:2000/page', session),
                headers: {
                    accept: PAGE_ACCEPT_HEADER,
                },
            };

            return request(options)
                .then(body => {
                    const expected = fs.readFileSync('test/server/data/page/expected.html').toString();

                    compareCode(body, expected);
                });
        });

        it('Should process html import pages', () => {
            session.id               = 'sessionId';
            session.options.windowId = '';

            session.injectable.scripts.push('/script1.js', '/script2.js');
            session.injectable.styles.push('/styles1.css', '/styles2.css');

            proxy.openSession('http://127.0.0.1:2000/', session);

            const options = {
                url: getProxyUrl('http://127.0.0.1:2000/html-import-page', { isHtmlImport: true }),

                headers: {
                    accept: '*/*',
                },
            };

            return request(options)
                .then(body => {
                    const expected = fs.readFileSync('test/server/data/html-import-page/expected.html').toString();

                    compareCode(body, expected);
                });
        });

        it('Should process html import pages in iframe', () => {
            session.id               = 'sessionId';
            session.options.windowId = '';

            proxy.openSession('http://127.0.0.1:2000/', session);

            const options = {
                url: getProxyUrl('http://127.0.0.1:2000/html-import-page-in-iframe', { isHtmlImport: true, isIframe: true }),

                headers: {
                    accept: '*/*',
                },
            };

            return request(options)
                .then(body => {
                    const expected = fs.readFileSync('test/server/data/html-import-page/expected-iframe.html').toString();

                    compareCode(body, expected);
                });
        });

        it('Should not process Ajax page requests', () => {
            const options = {
                url:     getProxyUrl('http://127.0.0.1:2000/page', { isAjax: true }, void 0, Credentials.sameOrigin),
                headers: { accept: PAGE_ACCEPT_HEADER },
            };

            proxy.openSession('http://127.0.0.1:2000/', session);

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
                    accept: 'text/css',
                },
            };

            return request(options)
                .then(body => {
                    const expected = fs.readFileSync('test/server/data/stylesheet/expected.css').toString();

                    compareCode(body, expected);
                });
        });

        it('Should process stylesheets with many spaces in a reasonable time frame (GH-2475)', () => {
            session.id = 'sessionId';

            const options = {
                url:     proxy.openSession('http://127.0.0.1:2000/stylesheet-with-many-spaces', session),
                headers: {
                    accept: 'text/css',
                },
            };

            return request(options)
                .then(() => {
                    expect(true).eql(true);
                });
        }).timeout(1000);

        it('Should process upload info', () => {
            function newLineReplacer (content) {
                return Buffer.from(content.toString().replace(/\r\n|\n/gm, '\r\n'));
            }

            const src      = newLineReplacer(fs.readFileSync('test/server/data/upload/src.formdata'));
            const expected = newLineReplacer(fs.readFileSync('test/server/data/upload/expected.formdata'));

            const options = {
                url:     proxy.openSession('http://127.0.0.1:2000/upload-info', session),
                method:  'POST',
                body:    src,
                headers: {
                    'content-type': 'multipart/form-data; boundary=separator',
                    'accept':       'text/plain;q=0.9,*!/!*;q=0.8',
                },
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
                    accept: PAGE_ACCEPT_HEADER,
                },
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
                        'x-content-type': mimeType,
                    },
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
                { url: '/custom-user-script-3', page: new RequestFilterRule('/another-page') },
            );

            const options = {
                url:     proxy.openSession('http://127.0.0.1:2000/page-with-custom-client-script', session),
                headers: {
                    accept: PAGE_ACCEPT_HEADER,
                },
            };

            return request(options)
                .then(body => {
                    const expected = fs.readFileSync('test/server/data/page-with-custom-client-script/expected.html').toString();

                    compareCode(body, expected);
                });
        });

        it('Should process the `content-encoding` header case insensitive', () => {
            return request({
                url:  proxy.openSession('http://127.0.0.1:2000/content-encoding-upper-case', session),
                gzip: true,
            })
                .then(body => {
                    expect(body).eql(processScript('// Compressed GZIP', true));
                });
        });

        it('Should process service worker without the Service-Worker-Allowed header', () => {
            const proxyUrl = getProxyUrl('http://127.0.0.1:2000/service-worker', { isServiceWorker: true });

            proxy.openSession('http://127.0.0.1:2000/', session);

            return request({ url: proxyUrl, resolveWithFullResponse: true })
                .then(res => {
                    const expected = fs.readFileSync('test/server/data/service-worker/expected.js').toString();

                    expect(normalizeNewLine(res.body)).eql(normalizeNewLine(expected));
                    expect(res.headers['service-worker-allowed']).eql('/');
                });
        });

        it('Should process service worker with the Service-Worker-Allowed header', () => {
            const proxyUrl = getProxyUrl('http://127.0.0.1:2000/service-worker-allowed', { isServiceWorker: true });

            proxy.openSession('http://127.0.0.1:2000/', session);

            return request({ url: proxyUrl, resolveWithFullResponse: true })
                .then(res => {
                    const expected = fs.readFileSync('test/server/data/service-worker/expected-with-header.js').toString();

                    expect(normalizeNewLine(res.body)).eql(normalizeNewLine(expected));
                    expect(res.headers['service-worker-allowed']).eql('/');
                });
        });
    });

    describe('Shadow UI', () => {
        it('Should process shadow ui stylesheet', () => {
            const src      = read('./../data/shadow-ui-stylesheet/src.css').toString();
            const expected = read('./../data/shadow-ui-stylesheet/expected.css').toString();

            proxy.GET('/testcafe-ui-styles.css', {
                contentType:          'text/css',
                content:              src,
                isShadowUIStylesheet: true,
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
                ecdhCurve:          'secp384r1',
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

    describe('State switching', () => {
        function makeRequest (url, isPage = true, resourceType) {
            const options = {
                url:     getProxyUrl(url, resourceType),
                headers: {
                    accept: isPage ? PAGE_ACCEPT_HEADER : '*/*',
                },
            };

            return request(options, (err, res, body) => {
                if (err)
                    throw err;

                return body;
            });
        }

        function forEachSequentially (arr, fn) {
            return arr.reduce((promise, item) => promise.then(() => fn(item)), Promise.resolve());
        }

        it('Should switch states', () => {
            const testCases = [
                {
                    state:    null,
                    urls:     ['http://127.0.0.1:2000/cookie/set1'],
                    expected: 'Set1_1=value1; Set1_2=value2',
                },
                {
                    state:    null,
                    urls:     ['http://127.0.0.1:2000/cookie/set2'],
                    expected: 'Set2_1=value1; Set2_2=value2',
                },
                {
                    state:    null,
                    urls:     ['http://127.0.0.1:2000/cookie/set1', 'http://127.0.0.1:2000/cookie/set2'],
                    expected: 'Set1_1=value1; Set1_2=value2; Set2_1=value1; Set2_2=value2',
                },
            ];

            function initializeState (testCase) {
                session.useStateSnapshot(StateSnaphot.empty());

                return forEachSequentially(testCase.urls, makeRequest)
                    .then(() => {
                        testCase.state = session.getStateSnapshot();
                    });
            }

            function assertState (testCase) {
                session.useStateSnapshot(testCase.state);

                return makeRequest('http://127.0.0.1:2000/cookie/echo')
                    .then(body => {
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
                    return makeRequest('http://127.0.0.1:2000/cookie/echo', false);
                })
                .then(body => {
                    expect(body).contains('%% Set1_1=value1; Set1_2=value2 %%');
                })
                .then(() => {
                    return makeRequest('http://127.0.0.1:2000/cookie/echo', true, { isIframe: true });
                })
                .then(body => {
                    expect(body).contains('%% Set1_1=value1; Set1_2=value2 %%');
                })
                .then(() => {
                    return makeRequest('http://127.0.0.1:2000/cookie/echo', true, { isHtmlImport: true });
                })
                .then(body => {
                    expect(body).contains('%% Set1_1=value1; Set1_2=value2 %%');
                })
                .then(() => {
                    return makeRequest('http://127.0.0.1:2000/cookie/echo');
                })
                .then(body => {
                    expect(body).not.contains('%% Set1_1=value1; Set1_2=value2 %%');
                })

                .then(() => {
                    session.useStateSnapshot(state);
                })

                // Try request Set1 state with non-page and page requests
                .then(() => {
                    return makeRequest('http://127.0.0.1:2000/cookie/echo', false);
                })
                .then(body => {
                    expect(body).not.contains('%% Set1_1=value1; Set1_2=value2 %%');
                })
                .then(() => {
                    return makeRequest('http://127.0.0.1:2000/cookie/echo', true, { isIframe: true });
                })
                .then(body => {
                    expect(body).not.contains('%% Set1_1=value1; Set1_2=value2 %%');
                })
                .then(() => {
                    return makeRequest('http://127.0.0.1:2000/cookie/echo', true, { isHtmlImport: true });
                })
                .then(body => {
                    expect(body).not.contains('%% Set1_1=value1; Set1_2=value2 %%');
                })
                .then(() => {
                    return makeRequest('http://127.0.0.1:2000/cookie/echo');
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
                    'if-none-match':     'W/"1322-15d510cbdf8"',
                },
            };

            session.useStateSnapshot(StateSnaphot.empty());

            return request(options)
                .then(body => {
                    expect(body).not.contains('if-modified-since');
                    expect(body).not.contains('if-none-match');
                });
        });
    });
});
