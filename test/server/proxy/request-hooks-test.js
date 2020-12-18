const fs                = require('fs');
const ResponseMock      = require('../../../lib/request-pipeline/request-hooks/response-mock');
const RequestFilterRule = require('../../../lib/request-pipeline/request-hooks/request-filter-rule');
const { expect }        = require('chai');
const request           = require('request-promise-native');

const {
    TEST_OBJ,
    PAGE_ACCEPT_HEADER
} = require('../common/constants');

const SAME_ORIGIN_CHECK_FAILED_STATUS_CODE = require('../../../lib/request-pipeline/xhr/same-origin-check-failed-status-code');
const INTERNAL_HEADERS                     = require('../../../lib/request-pipeline/internal-header-names');
const { noop }                             = require('lodash');

const {
    createSession,
    createProxy,
    compareCode,
    normalizeNewLine,
    createDestinationServer
} = require('../common/utils');

describe('Request Hooks', () => {
    let session    = null;
    let proxy      = null;
    let destServer = null;

    before(() => {
        const sameDomainDestinationServer = createDestinationServer();
        const { app }                     = sameDomainDestinationServer;

        destServer = sameDomainDestinationServer.server;

        app.get('/page', (req, res) => {
            res.setHeader('content-type', 'text/html');
            res.end(fs.readFileSync('test/server/data/page/src.html').toString());
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
                    'boolProp': !!(i % 2)
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
                'content-length':   0
            });
            res.end();
        });
    });

    after(() => {
        destServer.close();
    });

    beforeEach(() => {
        session = createSession();
        proxy   = createProxy();
    });

    afterEach(() => {
        proxy.close();
    });

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
