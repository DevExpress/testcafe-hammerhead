'use strict';

const url                           = require('url');
const expect                        = require('chai').expect;
const ResponseMock                  = require('../../lib/request-pipeline/request-hooks/response-mock');
const RequestFilterRule             = require('../../lib/request-pipeline/request-hooks/request-filter-rule');
const ConfigureResponseEventOptions = require('../../lib/session/events/configure-response-event-options');
const noop                          = require('lodash').noop;

describe('ResponseMock', () => {
    it('Header names should be lowercased', () => {
        const body     = '<html><body><h1>Test</h1></body></html>';
        const mock     = new ResponseMock(body, 200, { 'Access-Control-Allow-Origin': '*' });
        const response = mock.getResponse();

        expect(response.headers['access-control-allow-origin']).eql('*');
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
        it('JSON', () => {
            const data     = { test: 1 };
            const mock     = new ResponseMock(data);
            const response = mock.getResponse();

            expect(response.headers['content-type']).eql('application/json');
            expect(response.statusCode).eql(200);
            expect(response.read().toString()).eql(JSON.stringify(data));
        });

        it('HTML page', () => {
            const html     = '<html><body><h1>Test</h1></body></html>';
            const mock     = new ResponseMock(html);
            const response = mock.getResponse();

            expect(response.headers['content-type']).to.include('text/html');
            expect(response.statusCode).eql(200);
            expect(response.read().toString()).eql(html);
        });

        it('Binary data', () => {
            const binaryData = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01]);
            const mock       = new ResponseMock(binaryData);
            const response   = mock.getResponse();

            expect(response.statusCode).eql(200);
            expect(response.read()).eql(binaryData);
        });

        it('Empty HTML page', () => {
            const mock     = new ResponseMock();
            const response = mock.getResponse();

            expect(response.headers['content-type']).to.include('text/html');
            expect(response.statusCode).eql(200);
            expect(response.read().toString()).eql('<html><body></body></html>');
        });

        it('Custom status code', () => {
            const mock     = new ResponseMock(null, 204);
            const response = mock.getResponse();

            expect(response.headers['content-type']).to.include('text/html');
            expect(response.statusCode).eql(204);
            expect(response.read()).to.be.null;
        });

        it('Custom headers', () => {
            const script   = 'var t = 10';
            const mock     = new ResponseMock(script, 200, { 'content-type': 'application/javascript' });
            const response = mock.getResponse();

            expect(response.headers['content-type']).eql('application/javascript');
            expect(response.statusCode).eql(200);
            expect(response.read().toString()).eql(script);
        });

        it('Respond function', () => {
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

            const response = mock.getResponse();

            expect(response.setBody).to.be.indefined;
            expect(response.headers['content-type']).to.include('text/html');
            expect(response.statusCode).eql(555);
            expect(response.headers['x-calculated-header-name']).eql('calculated-value');
            expect(response.read().toString()).eql('calculated body3');
        });
    });
});

describe('RequestFilterRule', () => {
    it('Argument types', () => {
        let hook = new RequestFilterRule('http://example.com');

        expect(hook.options.url).eql('http://example.com');
        expect(hook.options.method).to.be.undefined;
        expect(hook.options.isAjax).to.be.undefined;
        expect(hook.toString()).contains('{ url: "http://example.com" }');

        hook = new RequestFilterRule(/example.com/);
        expect(hook.options.url).eql(/example.com/);
        expect(hook.options.method).to.be.undefined;
        expect(hook.options.isAjax).to.be.undefined;
        expect(hook.toString()).contains('{ url: /example.com/ }');

        hook = new RequestFilterRule({ url: 'http://example.com', method: 'GET', isAjax: false });
        expect(hook.options.url).eql('http://example.com');
        expect(hook.options.method).eql('get');
        expect(hook.options.isAjax).eql(false);
        expect(hook.toString()).contains('{ url: "http://example.com", method: "get" }');

        const filterFn = () => false;

        hook = new RequestFilterRule(filterFn);
        expect(hook.options).eql(filterFn);
        expect(hook.toString()).contains('{ <predicate> }');
    });

    it('Match', () => {
        const requestInfo = {
            url:     'http://example.com/',
            method:  'post',
            isAjax:  true,
            body:    '{ test: true }',
            headers: {
                'content-type': 'application/json'
            }
        };

        expect(new RequestFilterRule('http://example.com').match(requestInfo)).to.be.true;
        expect(new RequestFilterRule('http://example.com/').match(requestInfo)).to.be.true;
        expect(new RequestFilterRule('http://example.com/index').match(requestInfo)).to.be.false;
        expect(new RequestFilterRule('https://example.com').match(requestInfo)).to.be.false;
        expect(new RequestFilterRule(/example.com/).match(requestInfo)).to.be.true;
        expect(new RequestFilterRule(/example1.com/).match(requestInfo)).to.be.false;
        expect(new RequestFilterRule({ url: 'http://example.com', method: 'Post' }).match(requestInfo)).to.be.true;
        expect(new RequestFilterRule({ url: 123, method: 'Post' }).match(requestInfo)).to.be.false;
        expect(new RequestFilterRule({ method: 'get' }).match(requestInfo)).to.be.false;
        expect(new RequestFilterRule({ method: 1 }).match(requestInfo)).to.be.false;
        expect(new RequestFilterRule({
            url:    'http://example.com',
            method: 'Post',
            isAjax: false
        }).match(requestInfo)).to.be.false;
        expect(new RequestFilterRule({
            url:    'http://example.com',
            method: 'Post',
            isAjax: true
        }).match(requestInfo)).to.be.true;
        expect(new RequestFilterRule({
            url:    'http://example.com',
            method: 'Post',
            isAjax: 'test'
        }).match(requestInfo)).to.be.false;
        expect(new RequestFilterRule(() => {}).match(requestInfo)).to.be.false;
        expect(new RequestFilterRule(request => request.url === 'wrong_url').match(requestInfo)).to.be.false;
        expect(new RequestFilterRule(request => {
            return request.url === 'http://example.com/' &&
                   request.method === 'post' &&
                   request.isAjax &&
                   request.body === '{ test: true }' &&
                   request.headers['content-type'] === 'application/json';
        }).match(requestInfo)).to.be.true;
    });

    it('Match all', () => {
        expect(RequestFilterRule.ANY.match({ url: 'https://example.com' })).to.be.true;
        expect(RequestFilterRule.ANY.match({ url: 'https://example.com/index.html' })).to.be.true;
        expect(RequestFilterRule.ANY.match({ url: 'file://user/bin/data' })).to.be.true;
    });
});

it('Default configure options for onResponseEvent', () => {
    expect(ConfigureResponseEventOptions.DEFAULT.includeBody).eql(false);
    expect(ConfigureResponseEventOptions.DEFAULT.includeHeaders).eql(false);
});
