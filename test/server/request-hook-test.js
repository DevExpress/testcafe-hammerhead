const url                           = require('url');
const expect                        = require('chai').expect;
const ResponseMock                  = require('../../lib/request-pipeline/request-hooks/response-mock');
const RequestFilterRule             = require('../../lib/request-pipeline/request-hooks/request-filter-rule');
const ConfigureResponseEvent        = require('../../lib/session/events/configure-response-event');
const ConfigureResponseEventOptions = require('../../lib/session/events/configure-response-event-options');
const noop                          = require('lodash').noop;

describe('ResponseMock', () => {
    describe('Header names should be lowercased', () => {
        it('"Headers" parameter', async () => {
            const body     = '<html><body><h1>Test</h1></body></html>';
            const mock     = new ResponseMock(body, 200, { 'Access-Control-Allow-Origin': '*' });
            const response = await mock.getResponse();

            expect(response.headers['access-control-allow-origin']).eql('*');
        });

        it('Respond function', async () => {
            const mock = new ResponseMock((req, res) => {
                res.headers['Access-Control-Allow-Origin'] = '*';
            });

            const response = await mock.getResponse();

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
            const response = await mock.getResponse();

            expect(response.headers['content-type']).eql('application/json');
            expect(response.statusCode).eql(200);
            expect(response.read().toString()).eql(JSON.stringify(data));
        });

        it('HTML page', async () => {
            const html     = '<html><body><h1>Test</h1></body></html>';
            const mock     = new ResponseMock(html);
            const response = await mock.getResponse();

            expect(response.headers['content-type']).to.include('text/html');
            expect(response.statusCode).eql(200);
            expect(response.read().toString()).eql(html);
        });

        it('Binary data', async () => {
            const binaryData = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01]);
            const mock       = new ResponseMock(binaryData);
            const response   = await mock.getResponse();

            expect(response.statusCode).eql(200);
            expect(response.read()).eql(binaryData);
        });

        it('Empty HTML page', async () => {
            const mock     = new ResponseMock();
            const response = await mock.getResponse();

            expect(response.headers['content-type']).to.include('text/html');
            expect(response.statusCode).eql(200);
            expect(response.read().toString()).eql('<html><body></body></html>');
        });

        it('Custom status code', async () => {
            const mock     = new ResponseMock(null, 204);
            const response = await mock.getResponse();

            expect(response.headers['content-type']).to.include('text/html');
            expect(response.statusCode).eql(204);
            expect(response.read()).to.be.null;
        });

        it('Custom headers', async () => {
            const script   = 'var t = 10';
            const mock     = new ResponseMock(script, 200, { 'content-type': 'application/javascript' });
            const response = await mock.getResponse();

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
                path:     '/index.html?param=3'
            };

            mock.setRequestOptions(reqOptions);

            const response = await mock.getResponse();

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

            const response = await mock.getResponse();

            expect(response.read().toString()).eql('body');
        });
    });
});

describe('RequestFilterRule', () => {
    it('Argument types', () => {
        let hook = new RequestFilterRule('http://example.com');

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
        expect(hook.options.predicate).eql(filterFn);
        expect(hook.toString()).eql('{ <predicate> }');
    });

    it('Match', async () => {
        const requestInfo = {
            url:     'http://example.com/',
            method:  'post',
            isAjax:  true,
            body:    '{ test: true }',
            headers: {
                'content-type': 'application/json'
            }
        };

        expect(await new RequestFilterRule('http://example.com').match(requestInfo)).to.be.true;
        expect(await new RequestFilterRule('http://example.com/').match(requestInfo)).to.be.true;
        expect(await new RequestFilterRule('http://example.com/index').match(requestInfo)).to.be.false;
        expect(await new RequestFilterRule('https://example.com').match(requestInfo)).to.be.false;
        expect(await new RequestFilterRule(/example.com/).match(requestInfo)).to.be.true;
        expect(await new RequestFilterRule(/example1.com/).match(requestInfo)).to.be.false;
        expect(await new RequestFilterRule({ url: 'http://example.com', method: 'Post' }).match(requestInfo)).to.be.true;
        expect(await new RequestFilterRule({ url: 123, method: 'Post' }).match(requestInfo)).to.be.false;
        expect(await new RequestFilterRule({ method: 'get' }).match(requestInfo)).to.be.false;
        expect(await new RequestFilterRule({ method: 1 }).match(requestInfo)).to.be.false;
        expect(await new RequestFilterRule({
            url:    'http://example.com',
            method: 'Post',
            isAjax: false
        }).match(requestInfo)).to.be.false;
        expect(await new RequestFilterRule({
            url:    'http://example.com',
            method: 'Post',
            isAjax: true
        }).match(requestInfo)).to.be.true;
        expect(await new RequestFilterRule({
            url:    'http://example.com',
            method: 'Post',
            isAjax: 'test'
        }).match(requestInfo)).to.be.false;
        expect(await new RequestFilterRule(() => {}).match(requestInfo)).to.be.false;
        expect(await new RequestFilterRule(request => request.url === 'wrong_url').match(requestInfo)).to.be.false;
        expect(await new RequestFilterRule(request => {
            return request.url === 'http://example.com/' &&
                   request.method === 'post' &&
                   request.isAjax &&
                   request.body === '{ test: true }' &&
                   request.headers['content-type'] === 'application/json';
        }).match(requestInfo)).to.be.true;
        expect(await new RequestFilterRule(async request => {
            const resultPromise = new Promise(resolve => {
                setTimeout(() => {
                    resolve(request.url === 'http://example.com/');
                }, 100);
            });

            return resultPromise;
        }).match(requestInfo)).to.be.true;
    });

    it('Match all', async () => {
        expect(await RequestFilterRule.ANY.match({ url: 'https://example.com' })).to.be.true;
        expect(await RequestFilterRule.ANY.match({ url: 'https://example.com/index.html' })).to.be.true;
        expect(await RequestFilterRule.ANY.match({ url: 'file://user/bin/data' })).to.be.true;
    });

    it('isANY', () => {
        expect(RequestFilterRule.isANY()).to.be.false;
        expect(RequestFilterRule.isANY(true)).to.be.false;
        expect(RequestFilterRule.isANY(RequestFilterRule.ANY)).to.be.true;
        expect(RequestFilterRule.isANY(new RequestFilterRule('https://example.com'))).to.be.false;
    });
});

it('Default configure options for onResponseEvent', () => {
    expect(ConfigureResponseEventOptions.DEFAULT.includeBody).eql(false);
    expect(ConfigureResponseEventOptions.DEFAULT.includeHeaders).eql(false);
});

describe('ConfigureResponseEvent', () => {
    it('Remove header', () => {
        const mockCtx = {
            destRes: {
                headers: {
                    'my-header': 'value'
                }
            }
        };
        const configureResponseEvent = new ConfigureResponseEvent(mockCtx);

        configureResponseEvent.removeHeader('My-Header');
        expect(mockCtx.destRes.headers).to.not.have.property('my-header');
    });

    it('Set header', () => {
        const mockCtx = {
            destRes: {
                headers: {}
            }
        };
        const configureResponseEvent = new ConfigureResponseEvent(mockCtx);

        configureResponseEvent.setHeader('My-Header', 'value');
        expect(mockCtx.destRes.headers).to.have.property('my-header').that.equals('value');
    });
});
