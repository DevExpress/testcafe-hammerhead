const { expect } = require('chai');
const Router     = require('../../lib/proxy/router');
const md5        = require('crypto-md5');
const { noop }   = require('lodash');

describe('Router', () => {
    it('Should route requests', () => {
        const router        = new Router();
        let calledHandlerId = null;
        let routeParams     = null;

        router._processStaticContent = noop;

        router.GET('/yo/42/test/', () => {
            calledHandlerId = 'get';
        });

        router.POST('/yo/42/test/', () => {
            calledHandlerId = 'post';
        });

        router.GET('/42/hammerhead', () => {
            calledHandlerId = 'no-trailing-slash';
        });

        router.GET('/yo/{param1}/{param2}', (req, res, serverInfo, params) => {
            calledHandlerId = 'get-with-params';
            routeParams     = params;
        });

        router.POST('/yo/{param1}/{param2}', (req, res, serverInfo, params) => {
            calledHandlerId = 'post-with-params';
            routeParams     = params;
        });

        function shouldRoute (url, method, expectedHandlerId, expectedParams) {
            calledHandlerId = null;
            routeParams     = null;

            expect(router._route({ url: url, method: method })).to.be.true;
            expect(calledHandlerId).eql(expectedHandlerId);

            if (expectedParams)
                expect(routeParams).eql(expectedParams);
        }

        function shouldNotRoute (url, method) {
            expect(router._route({ url: url, method: method })).to.be.false;
        }

        shouldRoute('/yo/42/test/', 'GET', 'get');
        shouldRoute('/yo/42/test/#check12', 'GET', 'get');
        shouldRoute('/yo/42/test/?yep', 'GET', 'get');
        shouldRoute('/yo/42/test/?yep#check12', 'GET', 'get');
        shouldRoute('/yo/42/test/?yep#check12#check21', 'GET', 'get');

        shouldRoute('/yo/42/test/', 'POST', 'post');

        shouldRoute('/42/hammerhead', 'GET', 'no-trailing-slash');
        shouldNotRoute('/42/hammerhead/', 'GET', 'no-trailing-slash');

        shouldRoute('/yo/something/awesome', 'GET', 'get-with-params', {
            param1: 'something',
            param2: 'awesome',
        });

        shouldRoute('/yo/the/router', 'POST', 'post-with-params', {
            param1: 'the',
            param2: 'router',
        });

        shouldNotRoute('/some/unknown/url', 'GET', 'no-trailing-slash');
    });

    it('Should provide headers and content for static resources if ETag not match', () => {
        const router = new Router();

        router._processStaticContent = noop;

        function testRoute (url, handler) {
            const reqMock = {
                url:     url,
                method:  'GET',
                headers: {
                    'if-none-match': 'some-random-value',
                },
            };

            const resMock = {
                headers:    {},
                content:    null,
                statusCode: null,

                setHeader: function (name, value) {
                    this.headers[name] = value;
                },

                end: function (content) {
                    this.content = content;
                },
            };


            router._route(reqMock, resMock);
            expect(resMock.content).eql(handler.content);
            expect(resMock.headers['content-type']).eql(handler.contentType);
            expect(resMock.headers['cache-control']).eql('max-age=30, must-revalidate');
        }

        const jsHandler = {
            contentType: 'application/x-javascript',
            content:     'js',
        };

        const cssHandler = {
            contentType: 'text/css',
            content:     'css',
        };

        router.GET('/some/static/js', jsHandler);
        router.GET('/some/static/css', cssHandler);

        testRoute('/some/static/js', jsHandler);
        testRoute('/some/static/css', cssHandler);
    });

    it('Should allow to customize the cache-control header for static resources', () => {
        const router = new Router({ staticContentCaching: { maxAge: 3600, mustRevalidate: false } });

        router._processStaticContent = noop;

        function testRoute (url, handler) {
            const reqMock = {
                url:     url,
                method:  'GET',
                headers: {
                    'if-none-match': 'some-random-value',
                },
            };

            const resMock = {
                headers:    {},
                content:    null,
                statusCode: null,

                setHeader: function (name, value) {
                    this.headers[name] = value;
                },

                end: function (content) {
                    this.content = content;
                },
            };


            router._route(reqMock, resMock);
            expect(resMock.content).eql(handler.content);
            expect(resMock.headers['content-type']).eql(handler.contentType);
            expect(resMock.headers['cache-control']).eql('max-age=3600');
        }

        const jsHandler = {
            contentType: 'application/x-javascript',
            content:     'js',
        };

        const cssHandler = {
            contentType: 'text/css',
            content:     'css',
        };

        router.GET('/some/static/js', jsHandler);
        router.GET('/some/static/css', cssHandler);

        testRoute('/some/static/js', jsHandler);
        testRoute('/some/static/css', cssHandler);
    });

    it('Should respond 304 for static resources if ETag match', () => {
        const router = new Router();

        router._processStaticContent = noop;

        const reqMock = {
            url:     '/some/static/js',
            method:  'GET',
            headers: {
                'if-none-match': md5('some content'),
            },
        };

        const resMock = {
            headers:    {},
            content:    null,
            statusCode: null,

            setHeader: function (name, value) {
                this.headers[name] = value;
            },

            end: function (content) {
                this.content = content;
            },
        };

        router.GET('/some/static/js', {
            contentType: 'text/css',
            content:     'some content',
        });

        router._route(reqMock, resMock);

        expect(resMock.statusCode).eql(304);
        expect(resMock.content).to.be.empty;
    });

    it('Should unregister routes', () => {
        const router        = new Router();
        let calledHandlerId = null;

        router.GET('/yo/42/test/', () => {
            calledHandlerId = 'getWithoutParams';
        });

        router.GET('/yo/1/{param1}', () => {
            calledHandlerId = 'getWithParams';
        });

        expect(router._route({ url: '/yo/42/test/', method: 'GET' })).to.be.true;
        expect(calledHandlerId).eql('getWithoutParams');

        expect(router._route({ url: '/yo/1/42', method: 'GET' })).to.be.true;
        expect(calledHandlerId).eql('getWithParams');

        router.unRegisterRoute('/yo/42/test/', 'GET');
        expect(router._route({ url: '/yo/42/test/', method: 'GET' })).to.be.false;

        router.unRegisterRoute('/yo/1/{param1}', 'GET');
        expect(router._route({ url: '/yo/1/42', method: 'GET' })).to.be.false;
    });
});
