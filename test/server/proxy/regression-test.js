const fs                     = require('fs');
const http                   = require('http');
const semver                 = require('semver');
const { EventEmitter }       = require('events');
const { expect }             = require('chai');
const urlLib                 = require('url');
const net                    = require('net');
const { noop }               = require('lodash');
const { getFreePort }        = require('endpoint-utils');
const request                = require('request-promise-native');
const DestinationRequest     = require('../../../lib/request-pipeline/destination-request');
const RequestPipelineContext = require('../../../lib/request-pipeline/context');
const scriptHeader           = require('../../../lib/processing/script/header');
const resourceProcessor      = require('../../../lib/processing/resources');
const BUILTIN_HEADERS        = require('../../../lib/request-pipeline/builtin-header-names');
const { gzip }               = require('../../../lib/utils/promisified-functions');
const urlUtils               = require('../../../lib/utils/url');
const headersUtils           = require('../../../lib/utils/headers');
const RequestOptions         = require('../../../lib/request-pipeline/request-options');

const {
    createSession,
    createAndStartProxy,
    compareCode,
    getBasicProxyUrl,
    createDestinationServer,
} = require('../common/utils');

const Credentials = urlUtils.Credentials;

const {
    PAGE_ACCEPT_HEADER,
    PROXY_HOSTNAME,
    CROSS_DOMAIN_SERVER_PORT,
    EMPTY_PAGE_MARKUP,
} = require('../common/constants');

let longResponseSocket = null;

describe('Regression', () => {
    let session           = null;
    let proxy             = null;
    let destServer        = null;
    let crossDomainServer = null;

    function getProxyUrl (url, resourceType, reqOrigin, credentials, isCrossDomain, currentSession = session) {
        return getBasicProxyUrl(url, resourceType, reqOrigin, credentials, isCrossDomain, currentSession);
    }

    function setupSameDomainServer () {
        const sameDomainDestinationServer = createDestinationServer();
        const { app }                     = sameDomainDestinationServer;

        destServer = sameDomainDestinationServer.server;

        app.get('/', (req, res) => res.end(req.url));

        app.get('/B234325,GH-284/reply-with-origin', (req, res) => {
            res.set('access-control-allow-origin', 'http://example.com');
            res.end(req.headers['origin']);
        });

        app.get('/GH-1059/reply-with-origin', (req, res) => {
            res.set('access-control-allow-origin', 'http://example.com');
            res.set('access-control-allow-credentials', 'true');
            res.end(req.headers['origin']);
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
                'content-length': 0,
            });
            res.status(204);
            res.end();
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

        app.get('/script', (req, res) => {
            res.setHeader('content-type', 'application/javascript; charset=utf-8');
            res.set('sourcemap', '/src.js.map');
            res.end(fs.readFileSync('test/server/data/script/src.js').toString());
        });

        app.get('/GH-390/redirect-302-with-body', (req, res) => {
            res.writeHead(302, {
                'content-type': 'text/plain',
                'location':     'http://127.0.0.1:2002/',
            });

            res.write('body');

            setTimeout(res.end.bind(res), 1000);
        });

        app.get('/empty-response', (req, res) => {
            for (const header in req.headers)
                res.set(header, req.headers[header]);

            res.end();
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

        app.get('/page-with-frameset', (req, res) => {
            res.setHeader('content-type', 'text/html');
            res.end(fs.readFileSync('test/server/data/page-with-frameset/src.html').toString());
        });

        app.get('/GH-1014/pdf-content-type', (req, res) => {
            res.setHeader('content-type', 'content-type');
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
            res
                .status(302)
                .set('location', decodeURIComponent(req.params.url))
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

        app.get('/redirect-with-status/:statusCode', (req, res) => {
            res
                .status(+req.params.statusCode)
                .set('location', 'http://localhost/')
                .end();
        });

        app.get('/echo-raw-headers-names', (req, res) => {
            const rawHeadersNames = req.rawHeaders.filter((str, index) => !(index & 1));

            res.end(JSON.stringify(rawHeadersNames));
        });
    }

    function setupCrossDomainServer () {
        const crossDomainDestinationServer = createDestinationServer(CROSS_DOMAIN_SERVER_PORT);
        const { app: crossDomainApp }      = crossDomainDestinationServer;

        crossDomainServer = crossDomainDestinationServer.server;

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

    it('Should not send "Cookie" header if there are no cookies for the given URL (T232505)', () => {
        const options = {
            url:  proxy.openSession('http://127.0.0.1:2000/T232505/is-cookie-header-sent', session),
            json: true,
        };

        return request(options)
            .then(parsedBody => {
                expect(parsedBody).to.be.false;
            });
    });

    it('Should raise error on request timeout (T224541)', done => {
        session.options.requestTimeout = {};

        const savedReqTimeout = session.options.requestTimeout.page;

        session.options.requestTimeout.page = 200;

        session.handlePageError = (ctx, err) => {
            expect(err).eql('Failed to complete a request to <a href="http://127.0.0.1:2000/T224541/hang-forever">' +
                'http://127.0.0.1:2000/T224541/hang-forever</a> within the timeout period. ' +
                'The problem may be related to local machine\'s network or firewall settings, server outage, ' +
                'or network problems that make the server inaccessible.');

            ctx.res.end();

            session.options.requestTimeout.page = savedReqTimeout;

            done();

            return true;
        };

        const options = {
            url:     proxy.openSession('http://127.0.0.1:2000/T224541/hang-forever', session),
            headers: {
                accept: PAGE_ACCEPT_HEADER,
            },
        };

        request(options);
    });

    it('Should use a special timeout for xhr requests (GH-347)', () => {
        session.options.requestTimeout = {};

        const savedReqTimeout    = session.options.requestTimeout.page;
        const savedXhrReqTimeout = session.options.requestTimeout.ajax;

        session.options.requestTimeout.page = 100;
        session.options.requestTimeout.ajax = 200;

        const options = {
            url: getProxyUrl('http://127.0.0.1:2000/T224541/hang-forever',
                { isAjax: true }, void 0, Credentials.sameOrigin),
            headers: { accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' },
        };

        proxy.openSession('http://127.0.0.1:2000/', session);

        const requestTime = Date.now();

        return request(options)
            .then(() => {
                expect.fail('Request should raise an error');
            })
            .catch(err => {
                const responseTime = Date.now();

                expect(err.toString()).include('socket hang up');
                expect(responseTime - requestTime).above(session.options.requestTimeout.ajax);

                session.options.requestTimeout.page = savedReqTimeout;
                session.options.requestTimeout.ajax = savedXhrReqTimeout;
            });
    });

    it('Should process empty pages (B239430)', () => {
        const options = {
            url:     proxy.openSession('http://127.0.0.1:2000/B239430/empty-page', session),
            headers: {
                accept: PAGE_ACCEPT_HEADER,
            },
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
                'x-resource-type': 'text/html; charset=utf-8',
            },
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
                accept: PAGE_ACCEPT_HEADER,
            },
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
                    'x-resource-type': mimeType,
                },
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
            testSourceWithStatus204('text/css'),
        ]);
    });

    it('Should transform the "Origin" header for requests without the "Referer" header correctly (GH-284)', () => {
        const options = {
            url: getProxyUrl('http://127.0.0.1:2000/B234325,GH-284/reply-with-origin',
                { isAjax: true }, 'http://example.com', Credentials.sameOrigin, true),
            headers: { origin: 'http://127.0.0.1:1836' },
        };

        proxy.openSession('http://127.0.0.1:2000', session);

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
                'x-resource-type': 'text/html; charset=utf-8',
            },
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
                    expect(err).eql(`Failed to find a DNS-record for the resource at <a href="${host}/">${host}/</a>.`);

                    ctx.res.end();
                    done();

                    return true;
                };

                const options = {
                    url:     proxy.openSession(host, session),
                    headers: {
                        accept: PAGE_ACCEPT_HEADER,
                    },
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
            url: getProxyUrl('http://127.0.0.1:2002/without-access-control-allow-origin-header',
                { isAjax: true }, 'http://example.com', Credentials.sameOrigin, true),

            resolveWithFullResponse: true,
        };

        proxy.openSession('http://example.com', session);

        return request(options)
            .then(res => {
                expect(res.statusCode).eql(200);
                expect(res.headers[BUILTIN_HEADERS.accessControlAllowOrigin]).to.be.empty;
            });
    });

    it('Should not send cookie headers to the cross-domain destination server for the xhr request without credentials (GH-545)', () => {
        session.cookies.setByServer('http://example.com', 'key=value');

        const options = {
            url: getProxyUrl('http://127.0.0.1:2002/echo-headers', { isAjax: true },
                'http://example.com', Credentials.sameOrigin, true),
            json: true,
        };

        proxy.openSession('http://example.com', session);

        return request(options)
            .then(parsedBody => {
                expect(parsedBody.cookie).to.be.undefined;
            });
    });

    it('Should add a leading slash to the pathname part of url (GH-608)', () => {
        return request(proxy.openSession('http://127.0.0.1:2000?key=value', session))
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
            },
        ];
        const req = {
            headers: {
                accept: PAGE_ACCEPT_HEADER,
            },
        };
        const ctx = new RequestPipelineContext(req, {}, {});

        proxy.openSession('about:blank', session);

        for (const testCase of testCases) {
            ctx.req.url = getProxyUrl(testCase.url);

            if (testCase.referer)
                ctx.req.headers.referer = getProxyUrl(testCase.referer);

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
                accept: PAGE_ACCEPT_HEADER,
            },
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
                accept: 'application/font',
            },
        };

        return request(options)
            .then(body => {
                expect(body).eql('');
            });
    });

    it('Should not raise the error on dispatching a service url', () => {
        const req = {
            url:     `http://${PROXY_HOSTNAME}/browser/connect`,
            headers: { accept: PAGE_ACCEPT_HEADER },
        };

        const ctx = new RequestPipelineContext(req, {}, {});

        expect(ctx.dispatch(proxy.openSessions)).eql(false);
    });

    describe('Should not change a response body if it is empty (GH-762)', () => {
        it('script', () => {
            const options = {
                url:     proxy.openSession('http://127.0.0.1:2000/empty-response', session),
                headers: {
                    'content-type': 'application/javascript; charset=utf-8',
                },
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
                    'content-type': 'text/css',
                },
            };

            return request(options)
                .then(body => {
                    expect(body).is.empty;
                });
        });
    });

    it('Should abort destination request after fatal error (GH-937)', done => {
        let fatalErrorEventCount = 0;

        const requestOptions = RequestOptions.createFrom({
            dest: {
                url:      'http://127.0.0.1:2000/wait/150',
                protocol: 'http:',
                hostname: PROXY_HOSTNAME,
                host:     '127.0.0.1:2000',
                port:     2000,
                path:     '/wait/150',
                method:   'GET',
            },
            req: {
                headers:    {},
                rawHeaders: [],
            },
            reqBody: Buffer.alloc(0),
            isAjax:  false,
            session: {
                getAuthCredentials: noop,
                isHttp2Disabled:    () => false,

                options: {
                    requestTimeout: { page: 100 },
                },
                cookies: {
                    getHeader: noop,
                },
            },
        });

        const destReq = new DestinationRequest(requestOptions, false);

        destReq.on('error', noop);
        destReq.on('fatalError', () => {
            fatalErrorEventCount++;
        });

        setTimeout(() => {
            destReq._onError({ message: 'ECONNREFUSED' });
        }, 50);

        setTimeout(() => {
            expect(fatalErrorEventCount).eql(1);

            done();
        }, 150);
    });

    it('Should process the top "frameset" element like the "body" element (GH-1009)', () => {
        session.id = 'sessionId';
        session.injectable.scripts.push('/script1.js', '/script2.js');

        const options = {
            url:     proxy.openSession('http://127.0.0.1:2000/page-with-frameset', session),
            headers: {
                accept: PAGE_ACCEPT_HEADER,
            },
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
                accept: PAGE_ACCEPT_HEADER,
            },
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
                accept: PAGE_ACCEPT_HEADER,
            },
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
                'proxy-authorization': 'Digital origin==',
            },
        };

        const options2 = {
            url:     proxy.openSession('http://127.0.0.1:2002/echo-headers-with-credentials', session),
            json:    true,
            headers: {
                authorization:         headersUtils.addAuthorizationPrefix('Basic 1243=='),
                'proxy-authorization': headersUtils.addAuthorizationPrefix('Digital 423=='),
            },
        };

        return Promise.all([
            request(options1)
                .then(parsedBody => {
                    expect(parsedBody['authorization']).to.be.undefined;
                    expect(parsedBody['proxy-authorization']).to.be.undefined;
                }),
            request(options2)
                .then(parsedBody => {
                    expect(parsedBody['authorization']).eql('Basic 1243==');
                    expect(parsedBody['proxy-authorization']).eql('Digital 423==');
                }),
        ]);
    });

    it('Should process "x-frame-options" header (GH-1017)', () => {
        const getIframeProxyUrl            = url => getProxyUrl(url, { isIframe: true });
        const getCrossDomainIframeProxyUrl = url => getProxyUrl(url, { isIframe: true }, 'http://127.0.0.1:2000', void 0, true);

        proxy.openSession('http://127.0.0.1:2000/', session);

        const testCases = [
            {
                url:                 proxy.openSession('http://127.0.0.1:2000/x-frame-options/DENY', session),
                expectedHeaderValue: 'DENY',
            },
            {
                url:                 proxy.openSession('http://127.0.0.1:2000/x-frame-options/SAMEORIGIN', session),
                expectedHeaderValue: 'SAMEORIGIN',
            },
            {
                url:                 proxy.openSession('http://127.0.0.1:2000/x-frame-options/ALLOW-FROM%20https%3A%2F%2Fexample.com', session),
                expectedHeaderValue: 'ALLOW-FROM ' +
                    proxy.openSession('https://example.com', session).replace(urlUtils.TRAILING_SLASH_RE, ''),
            },
            {
                url:                 proxy.openSession('http://127.0.0.1:2000/x-frame-options/ALLOW-FROM%20http%3A%2F%2F127.0.0.1%3A2000%2Fpage', session),
                expectedHeaderValue: 'ALLOW-FROM ' + proxy.openSession('http://127.0.0.1:2000/page', session),
            },
            {
                url:                 getIframeProxyUrl('http://127.0.0.1:2000/x-frame-options/ALLOW-FROM%20https%3A%2F%2Fexample.com'),
                expectedHeaderValue: 'ALLOW-FROM ' + getCrossDomainIframeProxyUrl('https://example.com'),
            },
            {
                url:                 getIframeProxyUrl('http://127.0.0.1:2000/x-frame-options/ALLOW-FROM%20http%3A%2F%2F127.0.0.1%3A2000'),
                expectedHeaderValue: 'ALLOW-FROM ' + getIframeProxyUrl('http://127.0.0.1:2000'),
            },
        ];


        const testRequest = function (testCase) {
            const options = {
                url:                     testCase.url,
                resolveWithFullResponse: true,
            };

            return request(options)
                .then(res => {
                    expect(res.headers['x-frame-options']).equal(testCase.expectedHeaderValue);
                });
        };

        return Promise.all(testCases.map(testRequest));
    });

    it('Should not raise file download if resource is fetched by setting script src (GH-1062)', () => {
        const options                  = {
            url:     getProxyUrl('http://127.0.0.1:2000/download-script', { isScript: true }),
            referer: proxy.openSession('http://127.0.0.1:2000', session),
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

        const proxyUrl = getProxyUrl('http://127.0.0.1:2222/', { isEventSource: true });
        const req      = http.request(urlLib.parse(proxyUrl));

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
                'content-type': 'application/javascript; charset=utf-8',
            },
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
                url: getProxyUrl('http://127.0.0.1:2000/redirect/' + encodedUrl, { isIframe: true }),

                resolveWithFullResponse: true,
                followRedirect:          false,
                simple:                  false,
                headers:                 {
                    referer: getProxyUrl(opts.referer),
                },
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
                expectedProxyPort: '1836',
            }),
            testRedirectRequest({
                redirectLocation:  'http://127.0.0.1:2000/',
                referer:           'http://127.0.0.1:2000/',
                expectedProxyPort: '1836',
            }),
            testRedirectRequest({
                redirectLocation:  'http://127.0.0.1:2001/',
                referer:           'http://127.0.0.1:2001/',
                expectedProxyPort: '1837',
            }),
            testRedirectRequest({
                redirectLocation:  'http://127.0.0.1:2001/',
                referer:           'http://127.0.0.1:2000/',
                expectedProxyPort: '1837',
            }),
        ]);
    });

    it('Should process a "referrer-policy" header (GH-1195)', () => {
        const options = {
            url:                     proxy.openSession('http://127.0.0.1:2000/referrer-policy', session),
            resolveWithFullResponse: true,
            headers:                 {
                accept: PAGE_ACCEPT_HEADER,
            },
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
                    accept: PAGE_ACCEPT_HEADER,
                },
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
            testRefreshHeader('http://example.com/index.html'),
        ]);
    });

    it('Should close a proxy connection if a connection to destination server hang up (GH-1384)', () => {
        const agent        = new http.Agent({
            keepAlive:      true,
            keepAliveMsecs: 10000,
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
                        '',
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
                            'Hello',
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
                    headers: { accept: 'text/html' },
                });

                return sendRequest(reqOptions);
            })
            .then(body => {
                expect(body).eql('');

                reqOptions.path     += 'redirect';
                reqOptions.pathname += 'redirect';

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
                'content-type': 'application/javascript; charset=utf-8',
            },
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
                simple:                  false,
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
            testRedirectRequestStatusCode(202, false),
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
                        '',
                    ].join('\r\n'));
                });
            });

            return getFreePort()
                .then(port => new Promise(resolve => server.listen(port, () => resolve(port))))
                .then(port => new Promise((resolve, reject) => {
                    const proxyUrl   = proxy.openSession(`http://127.0.0.1:${port}/`, session);
                    const reqOptions = Object.assign(urlLib.parse(proxyUrl), {
                        method:  'GET',
                        headers: { 'if-none-match': 'NQQ6Iyi1ttEATRNQs+U9yQ==' },
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
                'ConTEnt-tyPE':     'application/json',
            },
        };

        return request(options)
            .then(rawHeadersNames => {
                expect(rawHeadersNames).to.include.members(['if-none-match', 'X-Requested-With', 'ConTEnt-tyPE']);
            });
    });

    it('Should not change the Cookie request headers to lowercase (GH-2382)', () => {
        const options = {
            url: getProxyUrl('http://127.0.0.1:2000/echo-raw-headers-names',
                { isAjax: true }, void 0, Credentials.sameOrigin),
            json:    true,
            headers: { Referer: getProxyUrl('http://127.0.0.1:2000/') },
        };

        proxy.openSession('http://127.0.0.1:2002/', session);
        session.cookies.setByServer('http://127.0.0.1:2002/', ['test=test']);

        return request(options)
            .then(rawHeadersNames => {
                expect(rawHeadersNames).to.include.members(['Referer', 'Cookie']);

                delete options.headers.Referer;
                options.headers.referer = getProxyUrl('http://127.0.0.1:2000/');

                return request(options);
            })
            .then(rawHeadersNames => expect(rawHeadersNames).to.include.members(['referer', 'cookie']));
    });

    it('Should skip the "x-frame-options" header if request has the CSP header and it contains "frame-ancestors" option (GH-1666)', () => {
        const options = {
            url:    proxy.openSession('http://127.0.0.1:2000/GH-1666', session),
            simple: false,

            resolveWithFullResponse: true,
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
            headers: { accept: 'text/html' },
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

    it('Should not emit error after a destination response is ended (GH-2315)', () => {
        const nativeOnResponse = DestinationRequest.prototype._onResponse;
        let hasPageError       = false;

        DestinationRequest.prototype._onResponse = function (res) {
            res.once('end', () => setTimeout(() => this._onError(new Error()), 50));

            nativeOnResponse.apply(this, arguments);
            DestinationRequest.prototype._onResponse = nativeOnResponse;
        };

        const options = {
            url:     proxy.openSession('http://127.0.0.1:2000/', session),
            headers: { accept: PAGE_ACCEPT_HEADER },
        };

        session.handlePageError = () => {
            hasPageError = true;
        };

        return request(options)
            .then(() => new Promise(resolve => setTimeout(resolve, 2000)))
            .then(() => expect(hasPageError).to.be.false);
    });

    it('Should not emit error after a destination response is ended (304 status case) (GH-2315)', () => {
        const nativeOnResponse = DestinationRequest.prototype._onResponse;
        let hasPageError       = false;

        DestinationRequest.prototype._onResponse = function () {
            nativeOnResponse.apply(this, arguments);
            this._onError(new Error());
            DestinationRequest.prototype._onResponse = nativeOnResponse;
        };

        const options = {
            url:                     proxy.openSession('http://127.0.0.1:2000/304', session),
            resolveWithFullResponse: true,
            headers:                 {
                'if-modified-since': 'Thu, 01 Aug 2013 18:31:48 GMT',
                accept:              PAGE_ACCEPT_HEADER,
            },
        };

        session.handlePageError = () => {
            hasPageError = true;
        };

        return request(options)
            .then(() => {
                expect.fail('Request should raise an "304" error');
            })
            .catch(err => {
                expect(err.statusCode).eql(304);
            })
            .then(() => new Promise(resolve => setTimeout(resolve, 2000)))
            .then(() => expect(hasPageError).to.be.false);
    });

    describe('Should respond with an error when destination server emits an error', () => {
        let storedHttpRequest = null;

        beforeEach(() => {
            storedHttpRequest = http.request;
        });

        afterEach(() => {
            http.request = storedHttpRequest;
        });

        function mockRequest (url, error) {
            return function (opts, callback) {
                if (opts.url === url) {
                    const mock = new EventEmitter();

                    mock.setTimeout = mock.write = mock.end = noop;

                    setTimeout(() => mock.emit('error', error.code ? error : new Error(error.message)), 500);

                    return mock;
                }

                return storedHttpRequest(opts, callback);
            };
        }

        it('Generic error', () => {
            const url               = 'http://127.0.0.1:2000/error-emulation';
            const options           = {
                url:                     proxy.openSession(url, session),
                resolveWithFullResponse: true,
                simple:                  false,
            };

            http.request = mockRequest(url, { message: 'Emulation of error!' });

            return request(options)
                .then(res => {
                    expect(res.statusCode).eql(500);
                    expect(res.body).eql('Failed to perform a request to the resource at ' +
                        '<a href="http://127.0.0.1:2000/error-emulation">' +
                        'http://127.0.0.1:2000/error-emulation</a> ' +
                        'because of an error.\nError: Emulation of error!');
                });
        });

        it('Header overflow error', () => {
            const url               = 'http://127.0.0.1:2000/error-header-overflow';
            const options           = {
                url:                     proxy.openSession(url, session),
                resolveWithFullResponse: true,
                simple:                  false,
                headers:                 {
                    'header-name': 'header-value',
                },
            };

            http.request = mockRequest(url, {
                code:      'HPE_HEADER_OVERFLOW',
                rawPacket: Buffer.from('info\r\nheaders\r\n\r\nbody'),
            });

            return request(options)
                .then(res => {
                    expect(res.statusCode).eql(500);
                    expect(res.body).eql('Failed to perform a request to the resource at ' +
                        '<a href="http://127.0.0.1:2000/error-header-overflow">' +
                        'http://127.0.0.1:2000/error-header-overflow</a> because of an error.\n' +
                        'The request header\'s size is 7 bytes which exceeds ' +
                        'the set limit.\nIt causes an internal Node.js error on parsing this header.\n' +
                        'To fix the problem, you need to add the \'--max-http-header-size=...\' flag ' +
                        'to the \'NODE_OPTIONS\' environment variable:\n\nmacOS, Linux (bash, zsh)\nexport ' +
                        'NODE_OPTIONS=\'--max-http-header-size=14\'\n\nWindows (powershell)\n' +
                        '$env:NODE_OPTIONS=\'--max-http-header-size=14\'\n\nWindows (cmd)\nset ' +
                        'NODE_OPTIONS="--max-http-header-size=14"\n\nand then start your tests.');
                });
        });

        it('Invalid header char error', () => {
            const url               = 'http://127.0.0.1:2000/error-invalid-char';
            const options           = {
                url:                     proxy.openSession(url, session),
                resolveWithFullResponse: true,
                simple:                  false,
            };

            let allASCIIChars = '';

            for (let i = 0; i < 128; i++)
                allASCIIChars += String.fromCharCode(i);

            const headerName = allASCIIChars.slice(0, ':'.charCodeAt(0)) + allASCIIChars.slice(':'.charCodeAt(0) + 1);
            const headerBody = allASCIIChars;

            http.request = mockRequest(url, {
                code:      'HPE_INVALID_HEADER_TOKEN',
                rawPacket: Buffer.from(`info\r\n${headerName}:${headerBody}\r\n\r\nbody`),
            });

            return request(options)
                .then(res => {
                    expect(res.statusCode).eql(500);
                    expect(res.body).eql('Failed to perform a request to the resource at ' +
                        '<a href="http://127.0.0.1:2000/error-invalid-char">' +
                        'http://127.0.0.1:2000/error-invalid-char</a> because of an error.\n' +
                        'The request contains a header that doesn\'t comply with the ' +
                        'specification <a href="https://tools.ietf.org/html/rfc7230#section-3.2.4">' +
                        'https://tools.ietf.org/html/rfc7230#section-3.2.4</a>.\nIt causes an internal ' +
                        'Node.js error on parsing this header.\n\nInvalid characters:\n' +
                        `Character with code "0" in header "${headerName}" name at index 0\n` +
                        `Character with code "1" in header "${headerName}" name at index 1\n` +
                        `Character with code "2" in header "${headerName}" name at index 2\n` +
                        `Character with code "3" in header "${headerName}" name at index 3\n` +
                        `Character with code "4" in header "${headerName}" name at index 4\n` +
                        `Character with code "5" in header "${headerName}" name at index 5\n` +
                        `Character with code "6" in header "${headerName}" name at index 6\n` +
                        `Character with code "7" in header "${headerName}" name at index 7\n` +
                        `Character with code "8" in header "${headerName}" name at index 8\n` +
                        `Character with code "9" in header "${headerName}" name at index 9\n` +
                        `Character with code "10" in header "${headerName}" name at index 10\n` +
                        `Character with code "11" in header "${headerName}" name at index 11\n` +
                        `Character with code "12" in header "${headerName}" name at index 12\n` +
                        `Character with code "13" in header "${headerName}" name at index 13\n` +
                        `Character with code "14" in header "${headerName}" name at index 14\n` +
                        `Character with code "15" in header "${headerName}" name at index 15\n` +
                        `Character with code "16" in header "${headerName}" name at index 16\n` +
                        `Character with code "17" in header "${headerName}" name at index 17\n` +
                        `Character with code "18" in header "${headerName}" name at index 18\n` +
                        `Character with code "19" in header "${headerName}" name at index 19\n` +
                        `Character with code "20" in header "${headerName}" name at index 20\n` +
                        `Character with code "21" in header "${headerName}" name at index 21\n` +
                        `Character with code "22" in header "${headerName}" name at index 22\n` +
                        `Character with code "23" in header "${headerName}" name at index 23\n` +
                        `Character with code "24" in header "${headerName}" name at index 24\n` +
                        `Character with code "25" in header "${headerName}" name at index 25\n` +
                        `Character with code "26" in header "${headerName}" name at index 26\n` +
                        `Character with code "27" in header "${headerName}" name at index 27\n` +
                        `Character with code "28" in header "${headerName}" name at index 28\n` +
                        `Character with code "29" in header "${headerName}" name at index 29\n` +
                        `Character with code "30" in header "${headerName}" name at index 30\n` +
                        `Character with code "31" in header "${headerName}" name at index 31\n` +
                        `Character with code "32" in header "${headerName}" name at index 32\n` +
                        `Character with code "127" in header "${headerName}" name at index 126\n` +
                        `Character with code "10" in header "${headerName}" body at index 10\n` +
                        `Character with code "13" in header "${headerName}" body at index 13\n` +
                        '\nTo fix the problem, you can add the \'--insecure-http-parser\' flag ' +
                        'to the \'NODE_OPTIONS\' environment variable:\n\n' +
                        'macOS, Linux (bash, zsh)\nexport NODE_OPTIONS=\'--insecure-http-parser\'\n\n' +
                        'Windows (powershell)\n$env:NODE_OPTIONS=\'--insecure-http-parser\'\n\n' +
                        'Windows (cmd)\nset NODE_OPTIONS="--insecure-http-parser"\n\n' +
                        'and then start your tests.');
                });
        });
    });

    it('Should copy the ajax request descriptor for the location header', () => {
        const options = {
            url: getProxyUrl('http://127.0.0.1:2000/redirect-with-status/302', { isAjax: true },
                'http://example.com', Credentials.omit, true),

            resolveWithFullResponse: true,
            followRedirect:          false,
            simple:                  false,
        };

        proxy.openSession('http://127.0.0.1:2000/', session);
        session.id = 'sid';

        return request(options)
            .then(res => {
                expect(res.headers.location).eql('http://127.0.0.1:1837/sid*12345!a!2!example.com/http://localhost/');
            });
    });

    it('Should remove an invalid trailer header (GH-2692)', () => {
        const server = net.createServer(socket => {
            socket.on('data', data => {
                const url = data.toString().match(/GET (.+) HTTP/)[1];

                if (url === '/ok') {
                    socket.end([
                        'HTTP/1.1 200 Ok',
                        'Trailer: baz',
                        'Transfer-Encoding: chunked',
                        '',
                        '0',
                        '',
                        '',
                    ].join('\r\n'));
                }
                else {
                    socket.end([
                        'HTTP/1.1 200 Ok',
                        'Trailer: baz',
                        'Content-Length: 0',
                        '',
                        '',
                    ].join('\r\n'));
                }
            });
        });

        return getFreePort()
            .then(port => new Promise(resolve => server.listen(port, () => resolve(port))))
            .then(port => Promise.all([
                request({ url: proxy.openSession(`http://127.0.0.1:${port}/ok`, session), resolveWithFullResponse: true }),
                request({ url: proxy.openSession(`http://127.0.0.1:${port}/err`, session), resolveWithFullResponse: true }),
            ]))
            .then(([okRes, errRes]) => {
                expect(okRes.headers.trailer).eql('baz');
                expect(okRes.headers['transfer-encoding']).eql('chunked');

                expect(errRes.headers.trailer).eql(void 0);
                expect(errRes.headers['content-length']).eql('0');
            })
            .then(() => new Promise(resolve => server.close(() => resolve())));
    });

    it('Should set referer during the task (GH-6295)', () => {
        const url = 'http://localhost:1836/task.js';

        session.getPayloadScript       = async () => 'PayloadScript';
        session.getIframePayloadScript = async () => 'IframePayloadScript';

        const options = {
            headers: {
                referer: proxy.openSession('http://example.com', session),
            },

            url:                     url,
            resolveWithFullResponse: true,
        };

        return request(options)
            .then(() => {
                expect(session.options.referer).eql(getProxyUrl('http://example.com/'),);
            });
    });

    it('Should use `referrer` from the session options if it is not existed in request (GH-6295)', () => {
        const req        = {
            url:     getProxyUrl('http://example.com/'),
            headers: {
                accept: PAGE_ACCEPT_HEADER,
            },
        };
        const ctx        = new RequestPipelineContext(req, {}, {});
        const sessionUrl = 'https://example-session.com/';

        proxy.openSession(sessionUrl, session);

        session.options.referer = getProxyUrl(sessionUrl);

        ctx.dispatch(proxy.openSessions);

        expect(ctx.dest.referer).eql(sessionUrl);
    });

    it('Should not alter referer after the iframe task (GH-7376)', async () => {
        session.getPayloadScript       = async () => 'PayloadScript';
        session.getIframePayloadScript = async () => 'IframePayloadScript';

        const expectedReferer = getProxyUrl('http://example.com/');

        await request({
            headers: {
                referer: proxy.openSession('http://example.com', session),
            },
            url:                     'http://localhost:1836/task.js',
            resolveWithFullResponse: true,
        });

        expect(session.options.referer).eql(expectedReferer);

        await request({
            headers: {
                referer: proxy.openSession('http://iframe.example.com', session),
            },
            url:                     'http://localhost:1836/iframe-task.js',
            resolveWithFullResponse: true,
        });

        expect(session.options.referer).eql(expectedReferer);
    });
});
