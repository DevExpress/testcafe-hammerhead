const fs                           = require('fs');
const { expect }                   = require('chai');
const request                      = require('request-promise-native');
const logger                       = require('../../../lib/utils/logger');
const { noop }                     = require('lodash');
const http2Utils                   = require('../../../lib/request-pipeline/destination-request/http2');
const { CROSS_DOMAIN_SERVER_PORT } = require('../common/constants');

const {
    HTTP2_HEADER_STATUS,
    NGHTTP2_HTTP_1_1_REQUIRED,
} = require('http2').constants;


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

    const nativeLoggerFns = [];

    function getProxyUrl (url, resourceType) {
        return getBasicProxyUrl(url, resourceType, null, null, false, session);
    }

    function overrideLoggerFn (loggerObj, fnName, wrapper = (_, ...args) => logs.push(fnName, args)) {
        nativeLoggerFns.push({ obj: loggerObj, name: fnName, fn: wrapper });

        loggerObj[fnName] = wrapper;
    }

    function restoreLoggerFns () {
        for (const { obj, fn, name } of nativeLoggerFns)
            obj[name] = fn;
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

        http2App.get('/http1.1-required', stream => {
            stream.on('error', noop);
            stream.close(NGHTTP2_HTTP_1_1_REQUIRED);
        });

        overrideLoggerFn(logger.destination, 'onHttp2Stream');
        overrideLoggerFn(logger.destination, 'onHttp2SessionCreated');
        overrideLoggerFn(logger.destination, 'onHttp2Unsupported');
        overrideLoggerFn(logger.destination, 'onRequest', opts => logs.push('onRequest', opts.url));
    });

    after(() => {
        restoreLoggerFns();
        http2Server.close();
        httpsServer.close();
    });

    beforeEach(() => {
        session = createSession();
        proxy   = createProxy();
        logs    = [];
    });

    afterEach(() => {
        proxy.close();
        http2Utils.clearSessionsCache();
    });

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
                expect(logs.length).eql(4);
                expect(logs[0]).eql('onHttp2Unsupported');
                expect(logs[1][0]).eql('https://127.0.0.1:2002');
                expect(logs[2]).eql('onRequest');
                expect(logs[3]).eql('https://127.0.0.1:2002/stylesheet');
            });
    });

    // https://github.com/nodejs/node/issues/37849
    it('Should resend a request through https if http2 stream is emitted a protocol error', () => {
        const sessionMock = {
            destroyCalled: false,

            request: () => ({
                setTimeout: noop,
                write:      noop,

                end: function () {
                    setImmediate(() => this._errorHandler({
                        code:    'ERR_HTTP2_STREAM_ERROR',
                        message: 'Stream closed with error code NGHTTP2_PROTOCOL_ERROR'
                    }));
                },

                on: function (eventName, fn) {
                    if (eventName === 'error')
                        this._errorHandler = fn;
                }
            }),

            destroy: function () {
                this.destroyCalled = true;
            }
        };

        session.id = 'sessionId';

        const storedGetHttp2Session = http2Utils.getHttp2Session;
        const proxyUrl = getProxyUrl('https://127.0.0.1:2002/stylesheet');

        http2Utils.getHttp2Session = () => sessionMock;

        proxy.openSession('https://127.0.0.1:2000/', session);

        return request(proxyUrl, { form: { key: 'value' } })
            .then(body => {
                http2Utils.getHttp2Session = storedGetHttp2Session;

                const expected = fs.readFileSync('test/server/data/stylesheet/expected.css').toString();

                compareCode(body, expected);
                expect(logs[0]).eql('onHttp2Stream');
                expect(sessionMock.destroyCalled).to.be.true;
            });
    });

    it('Should resend a request through https if http2 stream is emitted that http 1.1 required', () => {
        session.id = 'sessionId';

        const proxyUrl = getProxyUrl('https://127.0.0.1:2000/http1.1-required');

        proxy.openSession('https://127.0.0.1:2000', session);

        return request(proxyUrl)
            .catch(() => {
                expect(logs.length).eql(6);
                expect(logs[0]).eql('onHttp2SessionCreated');
                expect(logs[1][0]).eql('https://127.0.0.1:2000');
                expect(logs[2]).eql('onHttp2Stream');
                expect(logs[3][0][':path']).eql('/http1.1-required');
                expect(logs[4]).eql('onRequest');
                expect(logs[5]).eql('https://127.0.0.1:2000/http1.1-required');
            });
    });
});
