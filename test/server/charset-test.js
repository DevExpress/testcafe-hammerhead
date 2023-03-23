const fs                               = require('fs');
const request                          = require('request-promise-native');
const { expect }                       = require('chai');
const express                          = require('express');
const iconv                            = require('iconv-lite');
const { noop }                         = require('lodash');
const Session                          = require('../../lib/session');
const Charset                          = require('../../lib/processing/encoding/charset');
const { encodeContent, decodeContent } = require('../../lib/processing/encoding');
const urlUtils                         = require('../../lib/utils/url');
const { processScript }                = require('../../lib/processing/script');
const pageProcessor                    = require('../../lib/processing/resources/page');
const stylesheetProcessor              = require('../../lib/processing/resources/stylesheet');
const manifestProcessor                = require('../../lib/processing/resources/manifest');
const { createAndStartProxy }          = require('./common/utils');


function normalizeCode (code) {
    return code
        .replace(/(\r\n|\n|\r)/gm, ' ')
        .replace(/'/gm, '"')
        .replace(/\s+/gm, ' ');
}

function compareCode (code1, code2) {
    expect(normalizeCode(code1)).eql(normalizeCode(code2));
}

function getProxyUrl (url, resourceType, charset) {
    return urlUtils.getProxyUrl(url, {
        proxyHostname: '127.0.0.1',
        proxyPort:     1836,
        sessionId:     'sessionId',
        resourceType:  resourceType,
        charset:       charset,
    });
}

describe('Content charset', () => {
    let destServer = null;
    let proxy      = null;
    let session    = null;

    const pageWithMetaSrc    = fs.readFileSync('test/server/data/content-charset/page-with-meta.htm').toString();
    const pageWithoutMetaSrc = fs.readFileSync('test/server/data/content-charset/page-without-meta.htm').toString();
    const scriptSrc          = fs.readFileSync('test/server/data/content-charset/script.js').toString();
    const manifestSrc        = fs.readFileSync('test/server/data/content-charset/manifest').toString();
    const stylesheetSrc      = fs.readFileSync('test/server/data/content-charset/style.css').toString();

    function testMeta (html, expectedCharsetStr) {
        const charset = new Charset();

        const requestPipelineContextMock = {
            dest:    {},
            session: {
                requestHookEventProvider: { hasRequestEventListeners: () => false },
                options:                  { allowMultipleWindows: false },
            },
            serverInfo: {
                crossDomainPort: 1338,
            },
            getInjectableStyles:  () => [],
            getInjectableScripts: () => [],
        };

        pageProcessor.processResource(html, requestPipelineContextMock, charset, noop);

        expect(charset.get()).eql(expectedCharsetStr);
    }

    before(() => {
        const app = express();

        app
            .get('/page-with-bom', (req, res) => {
                res.setHeader('content-type', 'text/html; charset=utf-8');
                res.end(iconv.encode(pageWithMetaSrc, 'utf-16be', { addBOM: true }));
            })
            .get('/page-with-content-type-header', (req, res) => {
                res.setHeader('content-type', 'text/html; charset=utf-8');
                res.end(iconv.encode(pageWithMetaSrc, 'utf-8'));
            })
            .get('/page-with-meta-tag', (req, res) => {
                res.setHeader('content-type', 'text/html');
                res.end(iconv.encode(pageWithMetaSrc, 'windows-1251'));
            })
            .get('/page-default', (req, res) => {
                res.setHeader('content-type', 'text/html');
                res.end(iconv.encode(pageWithoutMetaSrc, 'iso-8859-1'));
            });

        app
            .get('/script-with-bom', (req, res) => {
                res.setHeader('content-type', 'application/javascript; charset=utf-8');
                res.end(iconv.encode(scriptSrc, 'utf-16be', { addBOM: true }));
            })
            .get('/script-with-content-type-header', (req, res) => {
                res.setHeader('content-type', 'application/javascript; charset=utf-8');
                res.end(iconv.encode(scriptSrc, 'utf-8'));
            })
            .get('/script-with-charset-in-url', (req, res) => {
                res.setHeader('content-type', 'application/javascript');
                res.end(iconv.encode(scriptSrc, 'utf-16le'));
            });

        app
            .get('/other-resource/:resourceType/:charsetType', (req, res) => {
                let contentType;
                let src;

                switch (req.params.resourceType) {
                    case 'stylesheet':
                        contentType = 'text/css';
                        src         = stylesheetSrc;
                        break;
                    case 'manifest':
                        contentType = 'text/cache-manifest';
                        src         = manifestSrc;
                        break;
                }

                switch (req.params.charsetType) {
                    case 'bom':
                        res.setHeader('content-type', contentType + '; charset=utf-8');
                        res.end(iconv.encode(src, 'utf-16be', { addBOM: true }));
                        break;
                    case 'content-type':
                        res.setHeader('content-type', contentType + '; charset=utf-8');
                        res.end(iconv.encode(src, 'utf-8'));
                        break;
                    default:
                        res.setHeader('content-type', contentType);
                        res.end(iconv.encode(src, 'iso-8859-1'));
                }
            });

        destServer = app.listen(2000);

        session                    = new Session();
        session.getAuthCredentials = () => null;
        session.handleAttachment   = () => void 0;
        session.id                 = 'sessionId';

        proxy = createAndStartProxy();

        proxy.openSession('http://127.0.0.1:2000/', session);
    });

    after(() => {
        destServer.close();
        proxy.close();
    });

    describe('Pages', () => {
        function testDocumentCharset (destUrl, expectedBody) {
            const url     = getProxyUrl('http://127.0.0.1:2000' + destUrl);
            const options = {
                url:     url,
                headers: {
                    accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*!/!*;q=0.8',
                },
            };

            return request(options)
                .then(body => {
                    compareCode(body, expectedBody);
                });
        }

        function getExpectedStr (src, charsetStr, addBOM) {
            const charset = {
                get:      () => charsetStr,
                fromMeta: noop,
            };

            const requestPipelineContextMock = {
                dest:    {},
                session: {
                    requestHookEventProvider: { hasRequestEventListeners: () => false },
                    options:                  { allowMultipleWindows: false },
                },
                serverInfo: {
                    crossDomainPort: 1338,
                },
                getInjectableStyles:  () => [],
                getInjectableScripts: () => [
                    'http://127.0.0.1:1836/hammerhead.js',
                    'http://127.0.0.1:1836/task.js',
                ],
            };

            const processedResource = pageProcessor.processResource(src, requestPipelineContextMock, charset, noop);

            return iconv.encode(processedResource, charsetStr, { addBOM: addBOM }).toString();
        }

        it('Should set content charset from BOM', () => {
            return testDocumentCharset(
                '/page-with-bom',
                getExpectedStr(pageWithMetaSrc, 'utf-16be', true),
            );
        });

        it('Should set content charset from Content-Type header', () => {
            return testDocumentCharset(
                '/page-with-content-type-header',
                getExpectedStr(pageWithMetaSrc, 'utf-8', false),
            );
        });

        it('Should set content charset from meta', () => {
            return testDocumentCharset(
                '/page-with-meta-tag',
                getExpectedStr(pageWithMetaSrc, 'windows-1251', false),
            );
        });

        it('Should set default content charset', () => {
            return testDocumentCharset(
                '/page-default',
                getExpectedStr(pageWithoutMetaSrc, 'iso-8859-1', false),
            );
        });
    });

    describe('Scripts', () => {
        const processedScript = processScript(scriptSrc, true);

        function testScriptCharset (destUrl, expectedCharset, expectedBody) {
            const resourceType = {
                isIframe: false,
                isForm:   false,
                isScript: true,
            };
            const url          = getProxyUrl('http://127.0.0.1:2000' +
                                             destUrl, urlUtils.getResourceTypeString(resourceType), expectedCharset);

            return request(url)
                .then(body => {
                    compareCode(body, expectedBody);
                });
        }

        it('Should set content charset from BOM', () => {
            return testScriptCharset(
                '/script-with-bom',
                'utf-16be',
                iconv.encode(processedScript, 'utf-16be', { addBOM: true }).toString(),
            );
        });

        it('Should set content charset from Content-Type header', () => {
            return testScriptCharset(
                '/script-with-content-type-header',
                'utf-8',
                iconv.encode(processedScript, 'utf-8').toString(),
            );
        });

        it('Should set content charset from url', () => {
            return testScriptCharset(
                '/script-with-charset-in-url',
                'utf-16le',
                iconv.encode(processedScript, 'utf-16le').toString(),
            );
        });
    });

    describe('Other resources', () => {
        function testResourceCharset (expectedBody, charsetStr, url) {
            return request(url)
                .then(body => {
                    compareCode(body, iconv.encode(expectedBody, charsetStr, { addBOM: /\/bom$/.test(url) }).toString());
                });
        }

        it('Should set content charset for manifest', () => {
            const processedManifest = manifestProcessor.processResource(manifestSrc, null, null, getProxyUrl);
            const resourceUrl       = 'http://127.0.0.1:2000/other-resource/manifest/';

            return Promise.all([
                testResourceCharset(processedManifest, 'utf-16be', getProxyUrl(resourceUrl + 'bom')),
                testResourceCharset(processedManifest, 'utf-8', getProxyUrl(resourceUrl + 'content-type')),
                testResourceCharset(processedManifest, 'iso-8859-1', getProxyUrl(resourceUrl + 'default')),
            ]);
        });

        it('Should set content charset for stylesheet', () => {
            const processedStylesheet = stylesheetProcessor.processResource(stylesheetSrc, null, null, getProxyUrl);
            const resourceUrl         = 'http://127.0.0.1:2000/other-resource/stylesheet/';

            return Promise.all([
                testResourceCharset(processedStylesheet, 'utf-16be', getProxyUrl(resourceUrl + 'bom')),
                testResourceCharset(processedStylesheet, 'utf-8', getProxyUrl(resourceUrl + 'content-type')),
                testResourceCharset(processedStylesheet, 'iso-8859-1', getProxyUrl(resourceUrl + 'default')),
            ]);
        });
    });

    it('Should correctly determine the charset from BOM', () => {
        function testBOM (bomCharset, contentTypeHeader) {
            const inputData = iconv.encode(pageWithoutMetaSrc, bomCharset, { addBOM: true });
            const charset   = new Charset();

            charset.fromContentType(contentTypeHeader);

            return decodeContent(inputData, '', charset)
                .then(decoded => {
                    expect(decoded).eql(pageWithoutMetaSrc);
                    expect(charset.get()).eql(bomCharset);
                    expect(charset.isFromBOM()).to.be.true;

                    return encodeContent(pageWithoutMetaSrc, '', charset);
                })
                .then(encoded => {
                    expect(encoded).to.deep.equal(inputData);
                });
        }

        return Promise.all([
            testBOM('utf-8', 'text/html; charset=utf16le'),
            testBOM('utf-16le', 'text/html; charset=utf16be'),
            testBOM('utf-16be', 'text/html'),
        ]);
    });

    it('Should correctly determine the charset from meta', () => {
        testMeta('<meta http-equiv="Content-Type" content="text/html;charset=utf-8">', 'utf-8');
        testMeta('<meta charset="windows-874">', 'windows-874');
        testMeta('<meta http-equiv="Content-Type" content="text/html;charset=windows-1252"><meta charset="utf-8">', 'utf-8');
        testMeta('<meta charset="windows-1251"><meta http-equiv="Content-Type" content="text/html;charset=utf-8">', 'windows-1251');
    });

    describe('regression', () => {
        it('Should ignore a wrong charset from meta (GH-604)', () => {
            const defaultCharset = new Charset().get();

            testMeta('<meta charset="wrong-encoding-name"', defaultCharset);
        });
    });
});
