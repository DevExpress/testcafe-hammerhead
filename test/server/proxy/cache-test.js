const request       = require('request-promise-native');
const fs            = require('fs');
const { expect }    = require('chai');
const requestsCache = require('../../../lib/request-pipeline/cache');

const {
    PAGE_ACCEPT_HEADER,
    SAME_DOMAIN_SERVER_PORT
} = require('../common/constants');

const {
    createDestinationServer,
    createSession,
    createProxy,
    compareCode
} = require('../common/utils');

const SESSION_COUNT = 3;

describe('Cache', () => {
    let destServer       = null;
    let proxy            = null;
    let serverRouteCalls = 0;

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

        app.get('/script', (req, res) => {
            serverRouteCalls++;

            addCacheHeader(res);
            res.setHeader('content-type', 'application/javascript; charset=utf-8');
            res.end(readFileContentAsString('test/server/data/cache/script.js'));
        });
    }

    before(() => {
        setupSameDomainServer();
    });

    after(() => {
        destServer.close();
    });

    beforeEach(() => {
        proxy = createProxy({ cache: true });
    });

    afterEach(() => {
        proxy.close();
    });

    function getExpectedServerRouteCall (sessionNumber, requestNumber, shouldCache) {
        if (shouldCache)
            return 1;

        return sessionNumber * 2 + requestNumber;
    }

    async function testRequestCaching ({ requestParameters, expectedResultFile, shouldCache }) {
        for (let i = 0; i < SESSION_COUNT; i++) {
            const session                 = createSession();
            const clonedRequestParameters = Object.assign({}, requestParameters);

            clonedRequestParameters.url = proxy.openSession(clonedRequestParameters.url, session);

            const expectedResult         = readFileContentAsString(expectedResultFile);
            let expectedServerRouteCalls = getExpectedServerRouteCall(i, 1, shouldCache);

            let currentResult = await request(clonedRequestParameters);

            expect(serverRouteCalls).eql(expectedServerRouteCalls);
            compareCode(currentResult, expectedResult);

            currentResult = await request(clonedRequestParameters);

            expectedServerRouteCalls = getExpectedServerRouteCall(i, 2, shouldCache);

            expect(serverRouteCalls).eql(expectedServerRouteCalls);
            compareCode(currentResult, expectedResult);
        }

        serverRouteCalls = 0;
    }

    describe('Should cache destination responses', () => {
        it('RequestsCache.shouldCache', () => {
            expect(requestsCache.shouldCache({
                serverInfo:  { cacheRequests: true },
                contentInfo: { isScript: true },
                reqOpts:     { method: 'GET' }
            })).to.be.true;

            expect(requestsCache.shouldCache({
                serverInfo:  { cacheRequests: true },
                contentInfo: { isCSS: true },
                reqOpts:     { method: 'GET' }
            })).to.be.true;

            expect(requestsCache.shouldCache({
                serverInfo:  { cacheRequests: true },
                contentInfo: { isCSS: true },
                reqOpts:     { method: 'HEAD' }
            })).to.be.false;

            expect(requestsCache.shouldCache({
                serverInfo:     { cacheRequests: true },
                isFileProtocol: true
            })).to.be.false;

            expect(requestsCache.shouldCache({
                serverInfo:  { cacheRequests: false },
                contentInfo: { isScript: true },
                reqOpts:     { method: 'GET' }
            })).to.be.false;
        });

        it('Should not cache pages', async () => {
            await testRequestCaching({
                requestParameters: {
                    url:     'http://127.0.0.1:2000/page',
                    headers: {
                        accept: PAGE_ACCEPT_HEADER
                    }
                },
                expectedResultFile: 'test/server/data/cache/expected-page.html',
                shouldCache:        false
            });
        });

        it('Should cache scripts', async () => {
            await testRequestCaching({
                requestParameters: {
                    url: 'http://127.0.0.1:2000/script'
                },
                expectedResultFile: 'test/server/data/cache/expected-script.js',
                shouldCache:        true
            });
        });
    });
});
