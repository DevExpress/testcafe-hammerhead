const fs                = require('fs');
const WebSocket         = require('ws');
const { noop }          = require('lodash');
const ResponseMock      = require('../../../lib/request-pipeline/request-hooks/response-mock');
const RequestFilterRule = require('../../../lib/request-pipeline/request-hooks/request-filter-rule');
const { expect }        = require('chai');
const request           = require('request-promise-native');
const urlUtils          = require('../../../lib/utils/url');
const promisifyEvent    = require('promisify-event');

const {
    TEST_OBJ,
    PAGE_ACCEPT_HEADER,
} = require('../common/constants');

const {
    createSession,
    createAndStartProxy,
    compareCode,
    normalizeNewLine,
    getBasicProxyUrl,
    createDestinationServer,
} = require('../common/utils');

const ConfigureResponseEventOptions = require('../../../lib/request-pipeline/request-hooks/events/configure-response-event-options');
const RequestEventNames             = require('../../../lib/request-pipeline/request-hooks/events/names');

const Credentials = urlUtils.Credentials;

describe('Request Hooks', () => {
    let session    = null;
    let proxy      = null;
    let destServer = null;
    let wsServer   = null;

    function getProxyUrl (url, resourceType, reqOrigin, credentials, isCrossDomain, currentSession = session) {
        return getBasicProxyUrl(url, resourceType, reqOrigin, credentials, isCrossDomain, currentSession);
    }

    before(() => {
        const sameDomainDestinationServer = createDestinationServer();
        const { app }                     = sameDomainDestinationServer;

        destServer = sameDomainDestinationServer.server;
        wsServer   = new WebSocket.Server({
            server: destServer,
            path:   '/web-socket',
        });

        app.get('/page', (req, res) => {
            res.setHeader('content-type', 'text/html');
            res.end(fs.readFileSync('test/server/data/page/src.html').toString());
        });

        app.get('/page-with-img', (req, res) => {
            res.setHeader('content-type', 'text/html');
            res.end(fs.readFileSync('test/server/data/page-with-img/src.html').toString());
        });

        app.get('/script', (req, res) => {
            res.setHeader('content-type', 'application/javascript; charset=utf-8');
            res.set('sourcemap', '/src.js.map');
            res.end(fs.readFileSync('test/server/data/script/src.js').toString());
        });

        app.get('/json', (req, res) => {
            res.json(TEST_OBJ);
        });

        app.get('/page/plain-text', (req, res) => {
            res.set('content-encoding', 'gzip');
            res.setHeader('content-type', 'text/html; charset=utf-8');
            res.end('42');
        });

        app.get('/large-json', (req, res) => {
            const result = {};
            const COUNT_ITEMS = 3000;

            for (let i = 0; i < COUNT_ITEMS; i++) {
                const item = {
                    'strProp':  'strProp' + i,
                    'intProp':  i,
                    'boolProp': !!(i % 2),
                };

                result[i] = item;
            }

            res.json(result);
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

        app.post('/echo-custom-request-headers-in-response-headers', (req, res) => {
            Object.keys(req.headers).forEach(headerName => {
                if (headerName.startsWith('x-header-'))
                    res.setHeader(headerName, req.headers[headerName]);
            });

            res.end();
        });
    });

    after(() => {
        destServer.close();
        wsServer.close();
    });

    beforeEach(() => {
        session = createSession();
        proxy   = createAndStartProxy();
    });

    afterEach(() => {
        proxy.close();
    });

    describe('Handle session request events', () => {
        it('Processed resource', async () => {
            let requestEventIsRaised           = false;
            let configureResponseEventIsRaised = false;
            let responseEventIsRaised          = false;

            const url                      = 'http://127.0.0.1:2000/script';
            const rule                     = new RequestFilterRule(url);
            const resourceContent          = fs.readFileSync('test/server/data/script/src.js').toString();
            const processedResourceContent = fs.readFileSync('test/server/data/script/expected.js').toString();

            await session.requestHookEventProvider.addRequestEventListeners(rule, {
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
                },
            });

            const options = {
                url:     proxy.openSession(url, session),
                headers: {
                    'content-type': 'application/javascript; charset=utf-8',
                },
            };

            const body = await request(options);

            expect(body).eql(processedResourceContent);
            expect(requestEventIsRaised, 'requestEventIsRaised').to.be.true;
            expect(configureResponseEventIsRaised, 'configureResponseEventIsRaised').to.be.true;
            expect(responseEventIsRaised, 'responseEventIsRaised').to.be.true;

            await session.requestHookEventProvider.removeRequestEventListeners(rule);
        });

        it('Non-processed resource', async () => {
            let requestEventIsRaised           = false;
            let configureResponseEventIsRaised = false;
            let responseEventIsRaised          = false;

            const url  = 'http://127.0.0.1:2000/json';
            const rule = new RequestFilterRule(url);

            await session.requestHookEventProvider.addRequestEventListeners(rule, {
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
                },
            });

            const options = {
                url:     proxy.openSession(url, session),
                json:    true,
                headers: {
                    'test-header': 'testValue',
                },
            };

            const body = await request(options);

            expect(body).to.deep.eql(TEST_OBJ);
            expect(requestEventIsRaised, 'requestEventIsRaised').to.be.true;
            expect(configureResponseEventIsRaised, 'configureResponseEventIsRaised').to.be.true;
            expect(responseEventIsRaised, 'responseEventIsRaised').to.be.true;

            await session.requestHookEventProvider.removeRequestEventListeners(rule);
        });

        it('Ajax request', async () => {
            let requestEventIsRaised           = false;
            let configureResponseEventIsRaised = false;
            let responseEventIsRaised          = false;

            const rule = new RequestFilterRule('http://127.0.0.1:2000/page/plain-text');

            await session.requestHookEventProvider.addRequestEventListeners(rule, {
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
                            expect(e.statusCode).eql(200);
                            expect(e.isSameOriginPolicyFailed).to.be.true;

                            responseEventIsRaised = true;

                            resolve();
                        }, 100);
                    });
                },
            });

            const options = {
                url: getProxyUrl('http://127.0.0.1:2000/page/plain-text', { isAjax: true },
                    'http://example.com', Credentials.sameOrigin, true),

                resolveWithFullResponse: true,
            };

            proxy.openSession('http://example.com', session);

            const res = await request(options);

            expect(res.statusCode).eql(200);
            expect(requestEventIsRaised).to.be.true;
            expect(configureResponseEventIsRaised).to.be.true;
            expect(responseEventIsRaised).to.be.true;

            await session.requestHookEventProvider.removeRequestEventListeners(rule);
        });

        it('Several rules for one request', async () => {
            const requestUrl = 'http://127.0.0.1:2000/page/plain-text';
            const rules      = [new RequestFilterRule(requestUrl), new RequestFilterRule(requestUrl), new RequestFilterRule(requestUrl)];

            let countOnResponseEvents = 0;

            await Promise.all(rules.map(rule => {
                return session.requestHookEventProvider.addRequestEventListeners(rule, {
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
                    },
                });
            }));

            const options = {
                url:                     proxy.openSession(requestUrl, session),
                resolveWithFullResponse: true,
                headers:                 {
                    referer: proxy.openSession('http://example.com', session),
                },
            };

            await request(options);

            expect(countOnResponseEvents).eql(3);

            await Promise.all(rules.map(rule => session.requestHookEventProvider.removeRequestEventListeners(rule)));
        });

        it('Pipe a large response (TC-GH-2725)', async () => {
            const url           = 'http://127.0.0.1:2000/large-json';
            const rule          = new RequestFilterRule(url);
            let responseWasSent = false;

            await session.requestHookEventProvider.addRequestEventListeners(rule, {
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
                },
            });

            const options = {
                url:  proxy.openSession(url, session),
                json: true,
            };

            const body = await request(options);

            expect(body).not.empty;
            expect(responseWasSent).eql(true);

            await session.requestHookEventProvider.removeRequestEventListeners(rule);
        });

        it('Not modified resource', async () => {
            let requestEventIsRaised           = false;
            let configureResponseEventIsRaised = false;
            let responseEventIsRaised          = false;

            const url  = 'http://127.0.0.1:2000/304';
            const rule = new RequestFilterRule(url);

            await session.requestHookEventProvider.addRequestEventListeners(rule, {
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
                },
            });

            const options = {
                url:     proxy.openSession(url, session),
                headers: {
                    'content-type':      'application/javascript; charset=utf-8',
                    'if-modified-since': 'Thu, 01 Aug 2013 18:31:48 GMT',
                },
            };

            return request(options)
                .then(() => {
                    expect.fail('Request should raise an "304" error');
                })
                .catch(() => {
                    expect(requestEventIsRaised, 'requestEventIsRaised').to.be.true;
                    expect(configureResponseEventIsRaised, 'configureResponseEventIsRaised').to.be.true;
                    expect(responseEventIsRaised, 'responseEventIsRaised').to.be.true;

                    return session.requestHookEventProvider.removeRequestEventListeners(rule);
                });
        });

        it('Should handle errors inside the request event handlers', async () => {
            const url                  = 'http://127.0.0.1:2000/script';
            const rule                 = new RequestFilterRule(url);
            const collectedErrorEvents = [];

            await session.requestHookEventProvider.addRequestEventListeners(rule, {
                onRequest: () => {
                    throw new Error('inside onRequest');
                },

                onConfigureResponse: () => {
                    throw new Error('inside onConfigureResponse');
                },

                onResponse: () => {
                    throw new Error('inside onResponse');
                },
            }, e => {
                collectedErrorEvents.push(e);
            });

            const options = {
                url:     proxy.openSession(url, session),
                headers: {
                    'content-type': 'application/javascript; charset=utf-8',
                },
            };

            await request(options);

            expect(collectedErrorEvents.length).eql(3);
            expect(collectedErrorEvents[0].error.message).eql('inside onRequest');
            expect(collectedErrorEvents[0].methodName).eql('onRequest');
            expect(collectedErrorEvents[1].error.message).eql('inside onConfigureResponse');
            expect(collectedErrorEvents[1].methodName).eql('onConfigureResponse');
            expect(collectedErrorEvents[2].error.message).eql('inside onResponse');
            expect(collectedErrorEvents[2].methodName).eql('onResponse');

            await session.requestHookEventProvider.removeRequestEventListeners(rule);
        });

        it('WebSocket request', async () => {
            let requestEventIsRaised           = false;
            let configureResponseEventIsRaised = false;
            let responseEventIsRaised          = false;

            const rule = new RequestFilterRule('ws://127.0.0.1:2000/web-socket');

            await session.requestHookEventProvider.addRequestEventListeners(rule, {
                onRequest: e => {
                    return new Promise(resolve => {
                        setTimeout(() => {
                            expect(e.isAjax).to.be.false;
                            expect(e._requestInfo.url).eql('ws://127.0.0.1:2000/web-socket');

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

                onResponse: () => {
                    return new Promise(resolve => {
                        setTimeout(() => {
                            responseEventIsRaised = true;

                            resolve();
                        }, 100);
                    });
                },
            });

            proxy.openSession('http://example.com', session);

            const proxyUrl = getProxyUrl('http://127.0.0.1:2000/web-socket', { isWebSocket: true }, 'http://example.com');
            const ws       = new WebSocket(proxyUrl, { origin: 'http://example.com' });

            return new Promise(resolve => ws.on('open', resolve))
                .then(() => {
                    expect(requestEventIsRaised).to.be.true;
                    expect(configureResponseEventIsRaised).to.be.false;
                    expect(responseEventIsRaised).to.be.false;

                    const wsCloseEventPromise = promisifyEvent(ws, 'close');

                    ws.close();

                    return wsCloseEventPromise;
                });
        });

        it('about:blank referer (GH-2607)', async () => {
            let requestHeaders;

            const rule = new RequestFilterRule('http://127.0.0.1:2000/script');

            await session.requestHookEventProvider.addRequestEventListeners(rule, {
                onRequest: e => {
                    requestHeaders = e._requestInfo.headers;
                },
            });

            const options = {
                url:     getProxyUrl('http://127.0.0.1:2000/script', { isScript: true }),
                headers: { referer: getProxyUrl('about:blank') },

                resolveWithFullResponse: true,
            };

            proxy.openSession('http://example.com', session);

            const res = await request(options);

            expect(res.statusCode).eql(200);
            expect(requestHeaders).to.not.have.property('referer');

            await session.requestHookEventProvider.removeRequestEventListeners(rule);
        });
    });

    describe('Response mock', () => {
        it('Basic', async () => {
            const url           = 'http://dummy_page.com';
            const mock          = new ResponseMock();
            const rule          = new RequestFilterRule(url);
            const processedHtml = fs.readFileSync('test/server/data/empty-page/expected.html').toString();

            await session.requestHookEventProvider.addRequestEventListeners(rule, {
                onRequest: e => {
                    return new Promise(resolve => {
                        setTimeout(async () => {
                            await e.setMock(mock);

                            resolve();
                        }, 100);
                    });
                },
            });

            const options = {
                url:     proxy.openSession(url, session),
                headers: {
                    accept: PAGE_ACCEPT_HEADER,
                },
            };

            const body = await request(options);

            compareCode(body, processedHtml);

            await session.requestHookEventProvider.removeRequestEventListeners(rule);
        });

        it('Should allow to mock response without body (page)', async () => {
            const url  = 'http://dummy_page.com';
            const mock = new ResponseMock(null, 204);
            const rule = new RequestFilterRule(url);

            await session.requestHookEventProvider.addRequestEventListeners(rule, {
                onRequest: e => {
                    return new Promise(resolve => {
                        setTimeout(async () => {
                            await e.setMock(mock);

                            resolve();
                        }, 100);
                    });
                },
            });

            const options = {
                url:                     proxy.openSession(url, session),
                resolveWithFullResponse: true,
                headers:                 {
                    accept: PAGE_ACCEPT_HEADER,
                },
            };

            const res      = await request(options);
            const expected = fs.readFileSync('test/server/data/empty-page/expected.html').toString();

            compareCode(res.body, expected);
            expect(res.statusCode).eql(200);

            await session.requestHookEventProvider.removeRequestEventListeners(rule);
        });

        it('Should allow to mock a large response', async () => {
            const url           = 'http://example.com/get';
            const largeResponse = '1234567890'.repeat(1000000);
            const mock          = new ResponseMock(largeResponse);
            const rule          = new RequestFilterRule(url);

            await session.requestHookEventProvider.addRequestEventListeners(rule, {
                onRequest: e => {
                    return new Promise(resolve => {
                        setTimeout(async () => {
                            await e.setMock(mock);

                            resolve();
                        }, 100);
                    });
                },
            });

            const options = {
                url:     getProxyUrl(url, { isAjax: true }, void 0, Credentials.sameOrigin),
                headers: { accept: PAGE_ACCEPT_HEADER },
            };

            proxy.openSession('http://example.com', session);

            const body = await request(options);

            expect(body).eql(largeResponse);

            await session.requestHookEventProvider.removeRequestEventListeners(rule);
        });

        it("Should handle error in the 'ResponseMock'", async () => {
            const url              = 'http://dummy_page.com';
            let collectedErrorData = null;
            const rule             = new RequestFilterRule(url);

            const mock = new ResponseMock(() => {
                throw new Error('Error in the mock');
            });

            await session.requestHookEventProvider.addRequestEventListeners(rule, {
                onRequest: e => {
                    return new Promise(resolve => {
                        setTimeout(async () => {
                            await e.setMock(mock);

                            resolve();
                        }, 100);
                    });
                },
            }, errorData => {
                collectedErrorData = errorData;
            });

            const options = {
                url:     proxy.openSession(url, session),
                headers: {
                    accept: PAGE_ACCEPT_HEADER,
                },
            };

            return request(options)
                .catch(() => {
                    expect(collectedErrorData.error).to.be.an.instanceof(Error);
                    expect(collectedErrorData.error.message).to.eql('Error in the mock');
                    expect(collectedErrorData.methodName).eql(RequestEventNames.onResponse);

                    return session.requestHookEventProvider.removeRequestEventListeners(rule);
                });
        });

        it("Should not raise an error for the 'ResponseMock' with 500 status code (TC-GH-7213)", async () => {
            const url  = 'http://dummy_page.com';
            const rule = new RequestFilterRule(url);
            const mock = new ResponseMock('', 500);

            let collectedErrorData = null;

            await session.requestHookEventProvider.addRequestEventListeners(rule, {
                onRequest: e => {
                    return new Promise(resolve => {
                        setTimeout(async () => {
                            await e.setMock(mock);

                            resolve();
                        }, 100);
                    });
                },
            }, errorData => {
                collectedErrorData = errorData;
            });

            const options = {
                url:     proxy.openSession(url, session),
                headers: {
                    accept: PAGE_ACCEPT_HEADER,
                },
            };

            return request(options)
                .catch(() => {
                    expect(collectedErrorData).to.be.null;

                    return session.requestHookEventProvider.removeRequestEventListeners(rule);
                });
        });
    });

    it('Should allow to set request options', async () => {
        const rule = new RequestFilterRule('http://127.0.0.1:2000/page');

        await session.requestHookEventProvider.addRequestEventListeners(rule, {
            onRequest: e => {
                return new Promise(resolve => {
                    setTimeout(() => {
                        e.requestOptions.path = '/script';

                        resolve();
                    }, 100);
                });
            },
        });

        const options = {
            url: proxy.openSession('http://127.0.0.1:2000/page', session),
        };

        const body     = await request(options);
        const expected = fs.readFileSync('test/server/data/script/expected.js').toString();

        expect(normalizeNewLine(body)).eql(normalizeNewLine(expected));

        await session.requestHookEventProvider.removeRequestEventListeners(rule);
    });

    it('should proxy images if there are registered request filter rules', async () => {
        const url = 'http://127.0.0.1:2000/page-with-img';
        const rule = new RequestFilterRule(url);

        await session.requestHookEventProvider.addRequestEventListeners(rule, {
            onRequest: noop,
        });

        session.id = 'sessionId';

        const options = {
            url:     proxy.openSession(url, session),
            headers: {
                accept: PAGE_ACCEPT_HEADER,
            },
        };

        const body     = await request(options);
        const expected = fs.readFileSync('test/server/data/page-with-img/expected.html').toString();

        compareCode(body, expected);

        await session.requestHookEventProvider.removeRequestEventListeners(rule);
    });

    it('Should allow to modify response headers', async () => {
        const rule = new RequestFilterRule('http://127.0.0.1:2000/page');

        await session.requestHookEventProvider.addRequestEventListeners(rule, {
            onConfigureResponse: e => {
                return new Promise(resolve => {
                    setTimeout(async () => {
                        await e.setHeader('My-Custom-Header', 'My Custom value');
                        await e.removeHeader('Content-Type');

                        resolve();
                    }, 100);
                });
            },
        });

        const options = {
            url:                     proxy.openSession('http://127.0.0.1:2000/page', session),
            resolveWithFullResponse: true,
        };

        const response = await request(options);

        expect(response.headers['my-custom-header']).eql('My Custom value');
        expect(response.headers).to.not.have.property('content-type');

        await session.requestHookEventProvider.removeRequestEventListeners(rule);
    });

    it('Should pass `forceProxySrcForImage` option in task script', () => {
        session.getPayloadScript       = async () => 'PayloadScript';
        session.getIframePayloadScript = async () => 'IframePayloadScript';

        const rule = RequestFilterRule.ANY;

        const getShouldProxyAllImagesValue = function (text) {
            const result = text.match(/forceProxySrcForImage\s*:\s*(false|true)/);

            return result[1] === 'true';
        };

        function testShouldProxyImageOptionValue (expectedValue) {
            const options = {
                url:     'http://localhost:1836/task.js',
                headers: {
                    referer: proxy.openSession('http://example.com', session),
                },
            };

            return request(options)
                .then(body => {
                    const actualShouldProxyAllImages = getShouldProxyAllImagesValue(body);

                    expect(actualShouldProxyAllImages).eql(expectedValue);
                });
        }

        return testShouldProxyImageOptionValue(false)
            .then(() => {
                return session.requestHookEventProvider.addRequestEventListeners(rule, {
                    onRequest:           noop,
                    onConfigureResponse: noop,
                    onResponse:          noop,
                });
            })
            .then(() => {
                return testShouldProxyImageOptionValue(true);
            })
            .then(() => {
                return session.requestHookEventProvider.removeRequestEventListeners(rule);
            })
            .then(() => {
                return testShouldProxyImageOptionValue(false);
            });
    });

    describe('Should allow specifying the configure request data', () => {
        it('Options', async () => {
            let responseEventIsRaised      = false;
            let configureResponseEventId   = null;
            const url                      = 'http://127.0.0.1:2000/script';
            const rule                     = new RequestFilterRule(url);
            const opts                     = new ConfigureResponseEventOptions(true, true);
            const resourceContent          = fs.readFileSync('test/server/data/script/src.js').toString();
            const processedResourceContent = fs.readFileSync('test/server/data/script/expected.js').toString();

            await session.requestHookEventProvider.addRequestEventListeners(rule, {
                onConfigureResponse: async e => {
                    configureResponseEventId = e.id;

                    await session.setConfigureResponseEventOptions(configureResponseEventId, opts);
                },

                onResponse: e => {
                    expect(e.statusCode).eql(200);
                    expect(e.headers).to.include({ 'content-type': 'application/javascript; charset=utf-8' });
                    expect(e.body.toString()).eql(resourceContent);

                    responseEventIsRaised = true;
                },
            });

            const options = {
                url:     proxy.openSession(url, session),
                headers: {
                    'content-type': 'application/javascript; charset=utf-8',
                },
            };

            const body = await request(options);

            expect(body).eql(processedResourceContent);
            expect(responseEventIsRaised, 'responseEventIsRaised').to.be.true;

            session.removeConfigureResponseEventData(configureResponseEventId);
            await session.requestHookEventProvider.removeRequestEventListeners(rule);
        });

        it('setHeader', async () => {
            let responseEventIsRaised      = false;
            let configureResponseEventId   = null;
            const url                      = 'http://127.0.0.1:2000/echo-custom-request-headers-in-response-headers';
            const rule                     = new RequestFilterRule(url);

            const options = {
                url:     proxy.openSession(url, session),
                method:  'POST',
                headers: {
                    'x-header-1': 'value-1',
                },

                resolveWithFullResponse: true,
            };

            await session.requestHookEventProvider.addRequestEventListeners(rule, {
                onConfigureResponse: async e => {
                    configureResponseEventId = e.id;

                    await session.setHeaderOnConfigureResponseEvent(configureResponseEventId, 'x-header-1', 'another-value');
                    await session.setHeaderOnConfigureResponseEvent(configureResponseEventId, 'x-header-2', 'value-2');
                },

                onResponse: e => {
                    expect(e.statusCode).eql(200);

                    responseEventIsRaised = true;
                },
            });

            const res = await request(options);

            expect(res.headers)
                .to.have.property('x-header-1')
                .that.equals('another-value');

            expect(res.headers)
                .to.have.property('x-header-2')
                .that.equals('value-2');

            expect(responseEventIsRaised, 'responseEventIsRaised').to.be.true;

            session.removeConfigureResponseEventData(configureResponseEventId);
            await session.requestHookEventProvider.removeRequestEventListeners(rule);
        });

        it('removeHeader', async () => {
            let responseEventIsRaised      = false;
            let configureResponseEventId   = null;
            const url                      = 'http://127.0.0.1:2000/echo-custom-request-headers-in-response-headers';
            const rule                     = new RequestFilterRule(url);

            const options = {
                url:     proxy.openSession(url, session),
                method:  'POST',
                headers: {
                    'x-header-1': 'value-1',
                    'x-header-2': 'value-2',
                    'x-header-3': 'value-3',
                },

                resolveWithFullResponse: true,
            };

            await session.requestHookEventProvider.addRequestEventListeners(rule, {
                onConfigureResponse: async e => {
                    configureResponseEventId = e.id;

                    await session.removeHeaderOnConfigureResponseEvent(configureResponseEventId, 'x-header-1');
                    await session.removeHeaderOnConfigureResponseEvent(configureResponseEventId, 'x-header-2');
                },

                onResponse: e => {
                    expect(e.statusCode).eql(200);

                    responseEventIsRaised = true;
                },
            });

            const res = await request(options);

            expect(res.headers).to.not.have.property('x-header-1');
            expect(res.headers).to.not.have.property('x-header-2');
            expect(responseEventIsRaised, 'responseEventIsRaised').to.be.true;

            expect(res.headers)
                .to.have.property('x-header-3')
                .that.equals('value-3');

            session.removeConfigureResponseEventData(configureResponseEventId);
            await session.requestHookEventProvider.removeRequestEventListeners(rule);
        });
    });
});
