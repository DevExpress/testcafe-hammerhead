const fs                           = require('fs');
const { HTTP2_HEADER_STATUS }      = require('http2').constants;
const { expect }                   = require('chai');
const request                      = require('request-promise-native');
const logger                       = require('../../../lib/utils/logger');
const { clearSessionsCache }       = require('../../../lib/request-pipeline/destination-request/http2');
const { CROSS_DOMAIN_SERVER_PORT } = require('../common/constants');

const {
    createSession,
    createProxy,
    getBasicProxyUrl,
    createDestinationServer,
    createHttp2DestServer,
    compareCode
} = require('../common/utils');


describe('https proxy', () => {
    let session     = null;
    let proxy       = null;
    let http2Server = null;
    let httpsServer = null;
    let logs        = null;

    function getProxyUrl (url, resourceType) {
        return getBasicProxyUrl(url, resourceType, null, null, false, session);
    }

    function overrideLoggerFn (loggerObj, fnName) {
        const loggerFn = loggerObj[fnName];

        loggerObj[fnName]        = (_, ...args) => logs.push(fnName, args);
        loggerObj[fnName].native = loggerFn;
    }

    function restoreLoggerFn (loggerObj, fnName) {
        loggerObj[fnName] = loggerObj[fnName].native;
    }

    before(() => {

        const crossDomainDestinationServer = createDestinationServer(CROSS_DOMAIN_SERVER_PORT, true);
        const { app: httpsApp }            = crossDomainDestinationServer;

        httpsServer = crossDomainDestinationServer.server;

        httpsApp.get('/stylesheet', (_req, res) => res
            .status(200)
            .set('content-type', 'text/css')
            .end(fs.readFileSync('test/server/data/stylesheet/src.css')));

        const http2App = createHttp2DestServer();

        http2Server = http2App.server;

        http2App.get('/script', stream => {
            stream.respond({
                [HTTP2_HEADER_STATUS]: 200,
                'content-type':        'application/javascript'
            });

            stream.end(fs.readFileSync('test/server/data/script/src.js'));
        });

        overrideLoggerFn(logger.destination, 'onHttp2Stream');
        overrideLoggerFn(logger.destination, 'onHttp2SessionCreated');
        overrideLoggerFn(logger.destination, 'onHttp2Unsupported');
    });

    after(() => {
        restoreLoggerFn(logger.destination, 'onHttp2Stream');
        restoreLoggerFn(logger.destination, 'onHttp2SessionCreated');
        restoreLoggerFn(logger.destination, 'onHttp2Unsupported');
        http2Server.close();
        clearSessionsCache();
        httpsServer.close();
    });

    beforeEach(() => {
        session = createSession();
        proxy   = createProxy();
        logs    = [];
    });

    afterEach(() => proxy.close());

    it('Should send request through http2', () => {
        const proxyUrl = getProxyUrl('https://127.0.0.1:2000/script', { isScript: true });

        proxy.openSession('https://127.0.0.1:2000', session);

        return request(proxyUrl)
            .then(body => {
                const expected = fs.readFileSync('test/server/data/script/expected.js').toString();

                expect(body).eql(expected);
                expect(logs.length).eql(4);
                expect(logs[0]).eql('onHttp2SessionCreated');
                expect(logs[1]).deep.eql(['https://127.0.0.1:2000', 1, 100]);
                expect(logs[2]).eql('onHttp2Stream');
                expect(logs[3][0]).deep.eql({
                    ':method':    'GET',
                    ':path':      '/script',
                    ':authority': '127.0.0.1:2000'
                });
            });
    });

    it('Should send request through https', () => {
        session.id = 'sessionId';

        const proxyUrl = getProxyUrl('https://127.0.0.1:2002/stylesheet');

        proxy.openSession('https://127.0.0.1:2000', session);

        return request(proxyUrl)
            .then(body => {
                const expected = fs.readFileSync('test/server/data/stylesheet/expected.css').toString();

                compareCode(body, expected);
                expect(logs.length).eql(2);
                expect(logs[0]).eql('onHttp2Unsupported');
                expect(logs[1][0]).eql('https://127.0.0.1:2002');
            });
    });
});
