var fs                  = require('fs');
var request             = require('request');
var expect              = require('chai').expect;
var express             = require('express');
var iconv               = require('iconv-lite');
var Proxy               = require('../../lib/proxy');
var Session             = require('../../lib/session');
var requestAgent        = require('../../lib/request-pipeline/destination-request/agent');
var Charset             = require('../../lib/processing/encoding/charset');
var encodeContent       = require('../../lib/processing/encoding').encodeContent;
var decodeContent       = require('../../lib/processing/encoding').decodeContent;
var urlUtils            = require('../../lib/utils/url');
var scriptProcessor     = require('../../lib/processing/resources/script');
var pageProcessor       = require('../../lib/processing/resources/page');
var stylesheetProcessor = require('../../lib/processing/resources/stylesheet');
var manifestProcessor   = require('../../lib/processing/resources/manifest');

function normalizeCode (code) {
    return code
        .replace(/(\r\n|\n|\r)/gm, ' ')
        .replace(/'/gm, '"')
        .replace(/\s+/gm, ' ');
}

function compareCode (code1, code2) {
    expect(normalizeCode(code1)).eql(normalizeCode(code2));
}

function noop () {
    // Do nothing =)
}

function getProxyUrl (url, type, charset) {
    return urlUtils.getProxyUrl(url, '127.0.0.1', 1836, 'sessionId', type, charset);
}

describe('Content charset', function () {
    var destServer = null;
    var proxy      = null;
    var session    = null;

    var pageWithMetaSrc    = fs.readFileSync('test/server/data/content-charset/page-with-meta.htm').toString();
    var pageWithoutMetaSrc = fs.readFileSync('test/server/data/content-charset/page-without-meta.htm').toString();
    var scriptSrc          = fs.readFileSync('test/server/data/content-charset/script.js').toString();
    var manifestSrc        = fs.readFileSync('test/server/data/content-charset/manifest').toString();
    var stylesheetSrc      = fs.readFileSync('test/server/data/content-charset/style.css').toString();

    // Fixture setup/teardown
    before(function () {
        var app = express();

        app
            .get('/page-with-bom', function (req, res) {
                res.set('content-type', 'text/html; charset=utf-8');
                res.end(iconv.encode(pageWithMetaSrc, 'utf-16be', { addBOM: true }));
            })
            .get('/page-with-content-type-header', function (req, res) {
                res.set('content-type', 'text/html; charset=utf-8');
                res.end(iconv.encode(pageWithMetaSrc, 'utf-8'));
            })
            .get('/page-with-meta-tag', function (req, res) {
                res.set('content-type', 'text/html');
                res.end(iconv.encode(pageWithMetaSrc, 'windows-1251'));
            })
            .get('/page-default', function (req, res) {
                res.set('content-type', 'text/html');
                res.end(iconv.encode(pageWithoutMetaSrc, 'iso-8859-1'));
            });

        app
            .get('/script-with-bom', function (req, res) {
                res.set('content-type', 'application/javascript; charset=utf-8');
                res.end(iconv.encode(scriptSrc, 'utf-16be', { addBOM: true }));
            })
            .get('/script-with-content-type-header', function (req, res) {
                res.set('content-type', 'application/javascript; charset=utf-8');
                res.end(iconv.encode(scriptSrc, 'utf-8'));
            })
            .get('/script-with-charset-in-url', function (req, res) {
                res.set('content-type', 'application/javascript');
                res.end(iconv.encode(scriptSrc, 'utf-16le'));
            });

        app
            .get('/other-resource/:resourceType/:charsetType', function (req, res) {
                var contentType;
                var src;

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
                        res.set('content-type', contentType + '; charset=utf-8');
                        res.end(iconv.encode(src, 'utf-16be', { addBOM: true }));
                        break;
                    case 'content-type':
                        res.set('content-type', contentType + '; charset=utf-8');
                        res.end(iconv.encode(src, 'utf-8'));
                        break;
                    default:
                        res.set('content-type', contentType);
                        res.end(iconv.encode(src, 'iso-8859-1'));
                }
            });

        destServer = app.listen(2000);

        session                    = new Session();
        session.getAuthCredentials = function () {
            return null;
        };
        session.id                 = 'sessionId';

        proxy = new Proxy('127.0.0.1', 1836, 1837);
        proxy.openSession('http://127.0.0.1:2000/', session);
    });

    after(function () {
        destServer.close();
        proxy.close();
        requestAgent.resetKeepAliveConnections();
    });

    // Tests
    describe('Pages', function () {
        function testDocumentCharset (originUrl, expectedBody, done) {
            var url     = getProxyUrl('http://127.0.0.1:2000' + originUrl);
            var options = {
                url:     url,
                headers: {
                    accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*!/!*;q=0.8'
                }
            };

            request(options, function (err, res, body) {
                compareCode(body, expectedBody);

                done();
            });
        }

        function getExpectedStr (src, charsetStr, addBOM) {
            var charset = {
                get: function () {
                    return charsetStr;
                },

                fromMeta: noop
            };

            var proxyResources = {
                scripts: [
                    'http://127.0.0.1:1836/hammerhead.js',
                    'http://127.0.0.1:1836/task.js'
                ],

                styleUrl: null
            };

            var processedResource = pageProcessor.processResource(src, {}, charset, noop, proxyResources);

            return iconv.encode(processedResource, charsetStr, { addBOM: addBOM }).toString();
        }

        it('Should set content charset from BOM', function (done) {
            testDocumentCharset(
                '/page-with-bom',
                getExpectedStr(pageWithMetaSrc, 'utf-16be', true),
                done
            );
        });

        it('Should set content charset from Content-Type header', function (done) {
            testDocumentCharset(
                '/page-with-content-type-header',
                getExpectedStr(pageWithMetaSrc, 'utf-8', false),
                done
            );
        });

        it('Should set content charset from meta', function (done) {
            testDocumentCharset(
                '/page-with-meta-tag',
                getExpectedStr(pageWithMetaSrc, 'windows-1251', false),
                done
            );
        });

        it('Should set default content charset', function (done) {
            testDocumentCharset(
                '/page-default',
                getExpectedStr(pageWithoutMetaSrc, 'iso-8859-1', false),
                done
            );
        });
    });

    describe('Scripts', function () {
        var processedScript = scriptProcessor.processResource(scriptSrc);

        function testScriptCharset (originUrl, expectedCharset, expectedBody, done) {
            var url = getProxyUrl('http://127.0.0.1:2000' + originUrl, urlUtils.SCRIPT, expectedCharset);

            request(url, function (err, res, body) {
                compareCode(body, expectedBody);

                done();
            });
        }

        it('Should set content charset from BOM', function (done) {
            testScriptCharset(
                '/script-with-bom',
                'utf-16be',
                iconv.encode(processedScript, 'utf-16be', { addBOM: true }).toString(),
                done
            );
        });

        it('Should set content charset from Content-Type header', function (done) {
            testScriptCharset(
                '/script-with-content-type-header',
                'utf-8',
                iconv.encode(processedScript, 'utf-8').toString(),
                done
            );
        });

        it('Should set content charset from url', function (done) {
            testScriptCharset(
                '/script-with-charset-in-url',
                'utf-16le',
                iconv.encode(processedScript, 'utf-16le').toString(),
                done
            );
        });
    });

    describe('Other resources', function () {
        function testResourceCharset (expectedBody, charsetStr, url) {
            return new Promise(function (resolve) {
                request(url, function (err, res, body) {
                    compareCode(body, iconv.encode(expectedBody, charsetStr, { addBOM: /\/bom$/.test(url) }).toString());

                    resolve();
                });
            });
        }

        it('Should set content charset for manifest', function (done) {
            var processedManifest = manifestProcessor.processResource(manifestSrc, null, null, getProxyUrl);
            var resourceUrl       = 'http://127.0.0.1:2000/other-resource/manifest/';

            Promise
                .all([
                    testResourceCharset(processedManifest, 'utf-16be', getProxyUrl(resourceUrl + 'bom')),
                    testResourceCharset(processedManifest, 'utf-8', getProxyUrl(resourceUrl + 'content-type')),
                    testResourceCharset(processedManifest, 'iso-8859-1', getProxyUrl(resourceUrl + 'default'))
                ])
                .then(function () {
                    done();
                })
                .catch(done);
        });

        it('Should set content charset for stylesheet', function (done) {
            var processedStylesheet = stylesheetProcessor.processResource(stylesheetSrc, null, null, getProxyUrl);
            var resourceUrl         = 'http://127.0.0.1:2000/other-resource/stylesheet/';

            Promise
                .all([
                    testResourceCharset(processedStylesheet, 'utf-16be', getProxyUrl(resourceUrl + 'bom')),
                    testResourceCharset(processedStylesheet, 'utf-8', getProxyUrl(resourceUrl + 'content-type')),
                    testResourceCharset(processedStylesheet, 'iso-8859-1', getProxyUrl(resourceUrl + 'default'))
                ])
                .then(function () {
                    done();
                })
                .catch(done);
        });
    });

    it('Should correctly determine the charset from BOM', function (done) {
        function testBOM (bomCharset, contentTypeHeader) {
            var inputData = iconv.encode(pageWithoutMetaSrc, bomCharset, { addBOM: true });
            var charset   = new Charset();

            charset.fromContentType(contentTypeHeader);

            return decodeContent(inputData, '', charset)
                .then(function (decoded) {
                    expect(decoded).eql(pageWithoutMetaSrc);
                    expect(charset.get()).eql(bomCharset);
                    expect(charset.isFromBOM()).to.be.true;

                    return encodeContent(pageWithoutMetaSrc, '', charset);
                })
                .then(function (encoded) {
                    expect(encoded).to.deep.equal(inputData);
                });
        }

        Promise
            .all([
                testBOM('utf-8', 'text/html; charset=utf16le'),
                testBOM('utf-16le', 'text/html; charset=utf16be'),
                testBOM('utf-16be', 'text/html')
            ])
            .then(function () {
                done();
            })
            .catch(done);
    });

    it('Should correctly determine the charset from meta', function () {
        function testMeta (html, expectedCharsetStr) {
            var charset = new Charset();

            pageProcessor.processResource(html, {}, charset, noop, {});

            expect(charset.get()).eql(expectedCharsetStr);
        }

        testMeta('<meta http-equiv="Content-Type" content="text/html;charset=utf-8">', 'utf-8');
        testMeta('<meta charset="windows-866">', 'windows-866');
        testMeta('<meta http-equiv="Content-Type" content="text/html;charset=windows-1252"><meta charset="utf-8">', 'utf-8');
        testMeta('<meta charset="windows-1251"><meta http-equiv="Content-Type" content="text/html;charset=utf-8">', 'windows-1251');
    });
});
