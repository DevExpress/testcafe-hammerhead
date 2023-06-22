const url                                    = require('url');
const { expect }                             = require('chai');
const ResponseMock                           = require('../../lib/request-pipeline/request-hooks/response-mock');
const RequestFilterRule                      = require('../../lib/request-pipeline/request-hooks/request-filter-rule');
const RequestEvent                           = require('../../lib/request-pipeline/request-hooks/events/request-event');
const ConfigureResponseEventOptions          = require('../../lib/request-pipeline/request-hooks/events/configure-response-event-options');
const requestIsMatchRule                     = require('../../lib/request-pipeline/request-hooks/request-is-match-rule');
const { noop }                               = require('lodash');
const getMockResponse                        = require('../../lib/request-pipeline/request-hooks/response-mock/get-response');
const { RequestInfo }                        = require('../../lib/request-pipeline/request-hooks/events/info');
const RequestPipelineRequestHookEventFactory = require('../../lib/request-pipeline/request-hooks/events/factory');
const RequestOptions                         = require('../../lib/request-pipeline/request-options');

const requestInfoMock = {
    url:     'http://example.com/',
    method:  'post',
    isAjax:  true,
    body:    '{ test: true }',
    headers: {
        'content-type': 'application/json',
    },
};

describe('ResponseMock', () => {
    describe('Header names should be lowercased', () => {
        it('"Headers" parameter', async () => {
            const body     = '<html><body><h1>Test</h1></body></html>';
            const mock     = new ResponseMock(body, 200, { 'Access-Control-Allow-Origin': '*' });
            const response = await getMockResponse(mock);

            expect(response.headers['access-control-allow-origin']).eql('*');
        });

        it('Respond function', async () => {
            const mock = new ResponseMock((req, res) => {
                res.headers['Access-Control-Allow-Origin'] = '*';
            });

            const response = await getMockResponse(mock);

            expect(response.headers['access-control-allow-origin']).eql('*');
        });
    });

    describe('Validation', () => {
        it('Body', () => {
            expect(() => {
                ['', {}, noop, null, void 0].forEach(body => new ResponseMock(body));
            }).to.not.throw;
            expect(() => {
                [1, true].forEach(item => new ResponseMock(item));
            }).to.throw;
        });

        it('StatusCode', () => {
            expect(() => {
                [void 0, 200].forEach(statusCode => new ResponseMock('test', statusCode));
            }).to.not.throw;
            expect(() => {
                [-1, Infinity, 99, 1000, false].forEach(statusCode => new ResponseMock('test', statusCode));
            }).to.throw;
        });

        it('Headers', () => {
            expect(() => {
                [true, 1].forEach(headers => new ResponseMock('test', 200, headers));
            }).to.throw;
            expect(() => {
                [void 0, {}].forEach(headers => new ResponseMock('test', 200, headers));
            }).to.not.throw;
        });
    });

    describe('Response types', () => {
        it('JSON', async () => {
            const data     = { test: 1 };
            const mock     = new ResponseMock(data);
            const response = await getMockResponse(mock);

            expect(mock.isPredicate).eql(false);
            expect(response.headers['content-type']).eql('application/json');
            expect(response.statusCode).eql(200);
            expect(response.read().toString()).eql(JSON.stringify(data));
        });

        it('HTML page', async () => {
            const html     = '<html><body><h1>Test</h1></body></html>';
            const mock     = new ResponseMock(html);
            const response = await getMockResponse(mock);

            expect(response.headers['content-type']).to.include('text/html');
            expect(response.statusCode).eql(200);
            expect(response.read().toString()).eql(html);
        });

        it('Binary data', async () => {
            const binaryData = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01]);
            const mock       = new ResponseMock(binaryData);
            const response   = await getMockResponse(mock);

            expect(response.statusCode).eql(200);
            expect(response.read()).eql(binaryData);
        });

        it('Empty HTML page', async () => {
            const mock     = new ResponseMock();
            const response = await getMockResponse(mock);

            expect(response.headers['content-type']).to.include('text/html');
            expect(response.statusCode).eql(200);
            expect(response.read().toString()).eql('<html><body></body></html>');
        });

        it('Custom status code', async () => {
            const mock     = new ResponseMock(null, 204);
            const response = await getMockResponse(mock);

            expect(response.headers['content-type']).to.include('text/html');
            expect(response.statusCode).eql(204);
            expect(response.read()).to.be.null;
        });

        it('Custom headers', async () => {
            const script   = 'var t = 10';
            const mock     = new ResponseMock(script, 200, { 'content-type': 'application/javascript' });
            const response = await getMockResponse(mock);

            expect(mock.isPredicate).eql(false);
            expect(response.headers['content-type']).eql('application/javascript');
            expect(response.statusCode).eql(200);
            expect(response.read().toString()).eql(script);
        });

        it('Respond function', async () => {
            const mock = new ResponseMock((req, res) => {
                res.headers['x-calculated-header-name'] = 'calculated-value';
                res.statusCode                          = 555;

                const parsedUrl = url.parse(req.path, true);

                res.setBody('calculated body' + parsedUrl.query['param']);
            });

            const reqOptions = {
                protocol: 'http:',
                host:     'example.com',
                path:     '/index.html?param=3',
            };

            mock.setRequestOptions(reqOptions);

            const response = await getMockResponse(mock);

            expect(response.setBody).to.be.indefined;
            expect(response.headers['content-type']).to.include('text/html');
            expect(response.statusCode).eql(555);
            expect(response.headers['x-calculated-header-name']).eql('calculated-value');
            expect(response.read().toString()).eql('calculated body3');
        });

        it('Async respond function', async () => {
            const bodyPromise = new Promise((resolve) => {
                setTimeout(() => {
                    resolve('body');
                }, 1000);
            });

            const mock = new ResponseMock(async (req, res) => {
                const body = await bodyPromise;

                res.setBody(body);
            });

            const response = await getMockResponse(mock);

            expect(mock.isPredicate).eql(true);
            expect(response.read().toString()).eql('body');
        });

        it('Custom status code via respond function', async () => {
            const mock = new ResponseMock((req, res) => {
                res.statusCode = '200';
            });

            const response = await getMockResponse(mock);

            expect(response.statusCode).eql(200);
        });
    });

    it('.from', () => {
        expect(ResponseMock.from()).eql(null);

        const mock = ResponseMock.from({
            body:       'text',
            statusCode: 200,
            headers:    { 'header': 'value' },
        });

        expect(mock).be.instanceOf(ResponseMock);
        expect(mock.body).eql('text');
        expect(mock.statusCode).eql(200);
        expect(mock.headers).eql({ 'header': 'value' });
    });
});

describe('RequestFilterRule', () => {
    it('Argument types', () => {
        let hook = new RequestFilterRule('http://example.com');

        expect(hook.isPredicate).eql(false);
        expect(hook.options.url).eql('http://example.com');
        expect(hook.options.method).to.be.undefined;
        expect(hook.options.isAjax).to.be.undefined;
        expect(hook.toString()).eql('{ url: "http://example.com" }');

        hook = new RequestFilterRule(/example.com/);
        expect(hook.options.url).eql(/example.com/);
        expect(hook.options.method).to.be.undefined;
        expect(hook.options.isAjax).to.be.undefined;
        expect(hook.toString()).eql('{ url: /example.com/ }');

        hook = new RequestFilterRule({ url: 'http://example.com', method: 'GET', isAjax: false });

        expect(hook.options.url).eql('http://example.com');
        expect(hook.options.method).eql('get');
        expect(hook.options.isAjax).eql(false);
        expect(hook.toString()).eql('{ url: "http://example.com", method: "get" }');

        const filterFn = () => false;

        hook = new RequestFilterRule(filterFn);

        expect(hook.isPredicate).eql(true);
        expect(hook.options).eql(filterFn);
        expect(hook.toString()).eql('{ <predicate> }');
    });

    it('.isANY', () => {
        expect(RequestFilterRule.isANY()).to.be.false;
        expect(RequestFilterRule.isANY(true)).to.be.false;
        expect(RequestFilterRule.isANY(RequestFilterRule.ANY)).to.be.true;
        expect(RequestFilterRule.isANY(new RequestFilterRule('https://example.com'))).to.be.false;
    });

    describe('from', () => {
        const ruleInit = 'https://example.com';
        const rule1    = new RequestFilterRule(ruleInit);
        const rule2    = new RequestFilterRule(ruleInit);
        const rule3    = { id: '1', url: ruleInit };
        const rule4    = { id: '4', options: () => 123 };
        const rule5    = { id: '5', options: { url: 'https://example.com', method: 'POST' } };

        const ruleLikeObject = {
            id:      '1',
            options: {
                url:    'http://dummy.com',
                method: void 0,
                isAjax: void 0,
            },
        };

        it('.from', () => {
            expect(RequestFilterRule.from()).eql(null);

            const rule2Instance = RequestFilterRule.from(rule2);
            const rule4Instance = RequestFilterRule.from(rule4);

            expect(rule2Instance.id).eql(rule2.id);
            expect(rule4Instance.id).eql(rule4.id);
            expect(rule4Instance.options()).eql(123);

            const rule3Instance = RequestFilterRule.from(rule3);

            expect(rule3Instance.id).eql(rule3.id);

            const rule5Instance = RequestFilterRule.from(rule5);

            expect(rule5Instance.id).eql('5');
            expect(rule5Instance.options).eql({
                url:    'https://example.com',
                method: 'post',
                isAjax: void 0,
            });
        });

        it('.fromArray', () => {
            expect(RequestFilterRule.fromArray()).eql([]);
            expect(RequestFilterRule.fromArray(rule1)).eql([rule1]);

            const rules = RequestFilterRule.fromArray([rule1, rule2, rule3, rule4, ruleInit, ruleLikeObject]);

            expect(rules.length).eql(6);

            rules.forEach(rule => {
                expect(rule).to.be.an.instanceOf(RequestFilterRule);
            });
        });
    });
});

describe('Request is match rule', async () => {
    describe('Rule initializer', async () => {
        async function isMatchRule (ruleInit) {
            return requestIsMatchRule(new RequestFilterRule(ruleInit), requestInfoMock);
        }

        it('string', async () => {
            expect(await isMatchRule('http://example.com')).to.be.true;
            expect(await isMatchRule('http://example.com/')).to.be.true;
            expect(await isMatchRule('http://example.com/index')).to.be.false;
            expect(await isMatchRule('https://example.com')).to.be.false;
        });

        it('RegExp', async () => {
            expect(await isMatchRule(/example.com/)).to.be.true;
            expect(await isMatchRule(/example1.com/)).to.be.false;
        });

        it('Object', async () => {
            expect(await isMatchRule({
                url:    'http://example.com',
                method: 'Post',
            })).to.be.true;

            expect(await isMatchRule({
                url:    123,
                method: 'Post',
            })).to.be.false;

            expect(await isMatchRule({ method: 'get' })).to.be.false;

            expect(await isMatchRule({ method: 1 })).to.be.false;

            expect(await isMatchRule({
                url:    'http://example.com',
                method: 'Post',
                isAjax: false,
            })).to.be.false;

            expect(await isMatchRule({
                url:    'http://example.com',
                method: 'Post',
                isAjax: true,
            })).to.be.true;

            expect(await isMatchRule({
                url:    'http://example.com',
                method: 'Post',
                isAjax: 'test',
            })).to.be.false;
        });

        it('Predicate', async () => {
            expect(await isMatchRule(() => {})).to.be.false;

            expect(await isMatchRule(request => {
                return request.url === 'wrong_url';
            })).to.be.false;

            expect(await isMatchRule(request => {
                return request.url === 'http://example.com/' &&
                       request.method === 'post' &&
                       request.isAjax &&
                       request.body === '{ test: true }' &&
                       request.headers['content-type'] === 'application/json';
            })).to.be.true;

            expect(await isMatchRule(async request => {
                const resultPromise = new Promise(resolve => {
                    setTimeout(() => {
                        resolve(request.url === 'http://example.com/');
                    }, 100);
                });

                return resultPromise;
            })).to.be.true;
        });
    });

    it('RequestFilterRule.ANY', async () => {
        expect(await requestIsMatchRule(RequestFilterRule.ANY, { url: 'https://example.com' })).to.be.true;
        expect(await requestIsMatchRule(RequestFilterRule.ANY, { url: 'https://example.com/index.html' })).to.be.true;
        expect(await requestIsMatchRule(RequestFilterRule.ANY, { url: 'file://user/bin/data' })).to.be.true;
    });
});

it('Default configure options for onResponseEvent', () => {
    expect(ConfigureResponseEventOptions.DEFAULT.includeBody).eql(false);
    expect(ConfigureResponseEventOptions.DEFAULT.includeHeaders).eql(false);
});

describe('ConfigureResponseEvent', () => {
    const ruleMock = {};

    const contextMock = {
        destRes: {
            headers: {
                'my-header': 'value',
            },
        },
    };

    let configureResponseEvent = null;
    let clonedContextMock      = null;

    beforeEach(() => {
        clonedContextMock = Object.assign({}, contextMock);

        const eventFactory = new RequestPipelineRequestHookEventFactory(clonedContextMock);

        configureResponseEvent = eventFactory.createConfigureResponseEvent(ruleMock);
    });

    it('Remove header', async () => {
        await configureResponseEvent.removeHeader('My-Header');

        expect(clonedContextMock.destRes.headers).to.not.have.property('my-header');
    });

    it('Set header', async () => {
        await configureResponseEvent.setHeader('another-header', 'another-value');

        expect(clonedContextMock.destRes.headers)
            .to.have.property('another-header')
            .that.equals('another-value');
    });
});

it('RequestInfo.getUserAgent', () => {
    expect(RequestInfo.getUserAgent({ 'user-agent': 'chrome' })).eql('chrome');
    expect(RequestInfo.getUserAgent({ 'User-Agent': 'chrome' })).eql('chrome');
});

it('Track changes for RequestOptions', () => {
    const requestOptions = new RequestOptions({
        url:      'http://example.com',
        host:     'example.com',
        hostname: 'example.com',
        protocol: 'http:',
        path:     '/',
        method:   'GET',
        headers:  {
            'user-agent': 'chrome',
        },
    }, true);

    requestOptions.path = '/script';
    requestOptions.path = '/script';

    expect(requestOptions._changedUrlProperties).eql([{
        name:  'path',
        value: '/script',
    }]);

    requestOptions.headers['user-agent'] = 'firefox';
    requestOptions.headers['user-agent'] = 'firefox';
    requestOptions.headers['x-custom-header'] = 'value';
    delete requestOptions.headers['user-agent'];
    delete requestOptions.headers['user-agent'];

    expect(requestOptions._changedHeaders).eql([{
        name:  'user-agent',
        value: 'firefox',
    }, {
        name:  'x-custom-header',
        value: 'value',
    }]);

    expect(requestOptions._removedHeaders).eql(['user-agent']);
});

it('RequestEvent: synchronize changes with reqOpts', () => {
    const headers = {
        'user-agent':      'chrome',
        'x-custom-header': 'value',
    };

    const requestOptions = new RequestOptions({
        url:      'http://example.com',
        host:     'example.com',
        hostname: 'example.com',
        protocol: 'http:',
        path:     '/',
        method:   'GET',
        headers,
    }, true);

    const requestInfo = new RequestInfo({
        headers: Object.assign({}, headers),
    });

    const requestEvent = new RequestEvent({
        requestFilterRule: RequestFilterRule.ANY,
        _requestInfo:      requestInfo,
        reqOpts:           requestOptions,
        setMockFn:         noop,
    });

    requestOptions.headers['user-agent'] = 'firefox';

    delete requestOptions.headers['x-custom-header'];

    expect(requestEvent._requestInfo.headers).eql({
        'user-agent': 'firefox',
    });
});
