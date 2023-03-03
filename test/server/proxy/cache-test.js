const request       = require('request-promise-native');
const fs            = require('fs');
const { expect }    = require('chai');
const requestsCache = require('../../../lib/request-pipeline/cache');
const EventEmitter  = require('events');

const {
    PAGE_ACCEPT_HEADER,
    SAME_DOMAIN_SERVER_PORT,
} = require('../common/constants');

const {
    createDestinationServer,
    createSession,
    createAndStartProxy,
    compareCode,
    getBasicProxyUrl,
} = require('../common/utils');

const emitter       = new EventEmitter();
const SESSION_COUNT = emitter.getMaxListeners() + 3;

describe('Cache', () => {
    let destServer       = null;
    let proxy            = null;
    let serverRouteCalls = 0;
    const warnings       = [];

    function readFileContentAsString (path) {
        return fs.readFileSync(path).toString();
    }

    function addCacheHeader (res) {
        res.setHeader('cache-control', 'max-age=86400'); // Cache response 1 day
    }

    function setupSameDomainServer () {
        const sameDomainDestinationServer = createDestinationServer(SAME_DOMAIN_SERVER_PORT);
        const { app }                     = sameDomainDestinationServer;

        destServer = sameDomainDestinationServer.server;

        app.get('/page', (req, res) => {
            serverRouteCalls++;

            addCacheHeader(res);
            res.setHeader('content-type', 'text/html');
            res.end(readFileContentAsString('test/server/data/cache/page.html'));
        });

        app.get('/script/:id', (req, res) => {
            serverRouteCalls++;

            addCacheHeader(res);
            res.setHeader('content-type', 'application/javascript; charset=utf-8');
            res.end(readFileContentAsString('test/server/data/cache/script.js'));
        });

        app.get('/image-like/:size', (req, res) => {
            serverRouteCalls++;

            addCacheHeader(res);
            res.setHeader('content-type', 'image/png');

            const size = parseInt(req.params.size, 10);
            const arr  = Array(size).fill(0x66);
            const data = Buffer.from(arr);

            res.end(data);
        });
    }

    function collectWarnings (warning) {
        warnings.push(warning);
    }

    before(() => {
        setupSameDomainServer();

        process.on('warning', collectWarnings);
    });

    after(() => {
        destServer.close();

        process.off('warning', collectWarnings);

        expect(warnings.length).eql(0);
    });

    beforeEach(() => {
        proxy = createAndStartProxy({ cache: true });
    });

    afterEach(() => {
        proxy.close();
    });

    function getExpectedServerRouteCall (sessionNumber, requestNumber, shouldCache) {
        if (shouldCache)
            return 1;

        return sessionNumber * 2 + requestNumber;
    }

    async function testRequestCaching ({ requestParameters, expectedResultFile, isAjax, shouldCache }) {
        for (let i = 0; i < SESSION_COUNT; i++) {
            const session                 = createSession();
            const clonedRequestParameters = Object.assign({}, requestParameters);

            clonedRequestParameters.url = getBasicProxyUrl(clonedRequestParameters.url, { isAjax }, void 0, void 0, false, session);

            proxy.openSession('http://example.com/', session);

            let expectedResult = null;

            if (expectedResultFile)
                expectedResult = readFileContentAsString(expectedResultFile);

            let expectedServerRouteCalls = getExpectedServerRouteCall(i, 1, shouldCache);

            let currentResult = await request(clonedRequestParameters);

            expect(serverRouteCalls).eql(expectedServerRouteCalls);

            if (expectedResult)
                compareCode(currentResult, expectedResult);
            else
                expect(currentResult.length).gt(0);

            currentResult = await request(clonedRequestParameters);

            expectedServerRouteCalls = getExpectedServerRouteCall(i, 2, shouldCache);

            expect(serverRouteCalls).eql(expectedServerRouteCalls);

            if (expectedResult)
                compareCode(currentResult, expectedResult);
            else
                expect(currentResult.length).gt(0);
        }

        serverRouteCalls = 0;
    }

    describe('Should cache destination responses', () => {
        it('RequestsCache.shouldCache', () => {
            expect(requestsCache.shouldCache({
                serverInfo:  { cacheRequests: true },
                contentInfo: { isScript: true },
                reqOpts:     { method: 'GET' },
            })).to.be.true;

            expect(requestsCache.shouldCache({
                serverInfo:  { cacheRequests: true },
                contentInfo: { isCSS: true },
                reqOpts:     { method: 'GET' },
            })).to.be.true;

            expect(requestsCache.shouldCache({
                serverInfo:  { cacheRequests: true },
                contentInfo: { requireProcessing: false },
                reqOpts:     { method: 'GET' },
            })).to.be.true;

            expect(requestsCache.shouldCache({
                serverInfo:  { cacheRequests: true },
                contentInfo: { isCSS: true },
                reqOpts:     { method: 'HEAD' },
            })).to.be.false;

            expect(requestsCache.shouldCache({
                serverInfo:     { cacheRequests: true },
                isFileProtocol: true,
            })).to.be.false;

            expect(requestsCache.shouldCache({
                serverInfo:  { cacheRequests: false },
                contentInfo: { isScript: true },
                reqOpts:     { method: 'GET' },
            })).to.be.false;

            expect(requestsCache.shouldCache({
                serverInfo:  { cacheRequests: true },
                contentInfo: { requireProcessing: true },
                reqOpts:     { method: 'GET' },
            })).to.be.false;
        });

        it('Should not cache pages', async () => {
            await testRequestCaching({
                requestParameters: {
                    url:     'http://127.0.0.1:2000/page',
                    headers: {
                        accept: PAGE_ACCEPT_HEADER,
                    },
                },
                expectedResultFile: 'test/server/data/cache/expected-page.html',
                shouldCache:        false,
            });
        });

        describe('Should cache scripts', async () => {
            it('Processed', async () => {
                await testRequestCaching({
                    requestParameters: {
                        url: 'http://127.0.0.1:2000/script/1',
                    },
                    expectedResultFile: 'test/server/data/cache/expected-script.js',
                    shouldCache:        true,
                });
            });

            it('Non-processed', async () => {
                await testRequestCaching({
                    requestParameters: {
                        url: 'http://127.0.0.1:2000/script/2',
                    },
                    expectedResultFile: 'test/server/data/cache/script.js',
                    shouldCache:        true,
                    isAjax:             true,
                });
            });
        });

        describe('Should cache non-proxied resources', () => {
            it('Regular size', async () => {
                await testRequestCaching({
                    requestParameters: {
                        url: 'http://127.0.0.1:2000/image-like/1234',
                    },
                    shouldCache: true,
                });
            });

            it('Large size', async () => {
                await testRequestCaching({
                    requestParameters: {
                        url: 'http://127.0.0.1:2000/image-like/6291456', // 6 Mb
                    },
                    shouldCache: false,
                });
            });
        });
    });
});
