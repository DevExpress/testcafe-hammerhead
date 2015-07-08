var expect         = require('chai').expect;
var whacko         = require('whacko');
var DomProcessor   = require('../../lib/processing/dom');
var DomAdapter = require('../../lib/processing/dom/adapter-server');
var SHARED_CONST   = require('../../lib/const');
var urlUtil        = require('../../lib/utils/url');

var domProcessor = new DomProcessor(new DomAdapter());

var testCrossDomainPort = 1338;
var testProxyHostName   = "localhost";
var testProxyPort       = 80;

function replacerMock () {
    return 'new-url';
}

function process (html, isIFrame) {
    var $            = whacko.load(html);
    var domProcessor = new DomProcessor(new DomAdapter(isIFrame, testCrossDomainPort));

    domProcessor.processPage($, function (url, resourceType) {
        url = url.indexOf('/') === 0 ? 'http://example.com' + url : url;

        return urlUtil.getProxyUrl(url, 'localhost', '80', 1337, '', resourceType);
    }, 1338, isIFrame);

    return $;
}

describe('DOM processor', function () {
    it('Should process elements outside <html></html>', function () {
        var $ = process('<html></html><script src="http://example.com/script.js"></script>');

        expect($('script')[0].attribs.src).eql('http://localhost:80/!1337!script/http://example.com/script.js');
    });

    it('Should process sandboxed <iframe>', function () {
        var $ = process('<html><head></head><body><iframe sandbox="allow-forms"></iframe></body></html>');

        expect($.html()).contains('<iframe sandbox="allow-forms allow-scripts" ' +
                                  domProcessor.getStoredAttrName('sandbox') + '="allow-forms">');
    });

    it('Should process style attribute', function () {
        var $ = process('<div style="background: url(\'http://example.com/style.css\')"></div>');

        expect($.html()).eql('<html><head></head><body><div style="background: ' +
                             'url(\'http://localhost:80/!1337/http://example.com/style.css\')"></div></body></html>');
    });

    it('Should process <script> src', function () {
        var $ = process('<script src="http://example.com/script.js"></script>');

        expect($('script')[0].attribs.src).eql('http://localhost:80/!1337!script/http://example.com/script.js');
    });

    it('Should process <img> src', function () {
        var $ = process('<img src="http://example.com/image.png">');

        expect($('img')[0].attribs['src']).eql('http://example.com/image.png');
        expect($('img')[0].attribs[domProcessor.getStoredAttrName('src')]).eql('http://example.com/image.png');

        $ = process('<img src="">');
        expect($('img')[0].attribs['src']).to.be.empty;
        expect($('img')[0].attribs[domProcessor.getStoredAttrName('src')]).to.be.empty;

        $ = process('<img src="about:blank">');
        expect($('img')[0].attribs['src']).eql('about:blank');
        expect($('img')[0].attribs[domProcessor.getStoredAttrName('src')]).to.be.empty;
    });

    it('Should process malformed <img> src', function () {
        var cases = [
            { html: '<img src="//:0/">', expectedSrc: '//:0/' },
            { html: '<img src="//:0">', expectedSrc: '//:0' },
            { html: '<img src="http://:0/">', expectedSrc: 'http://:0/' },
            { html: '<img src="https://:0">', expectedSrc: 'https://:0' }
        ];

        cases.forEach(function (testCase) {
            var $ = process(testCase.html);

            expect($('img')[0].attribs['src']).eql(testCase.expectedSrc);
            expect($('img')[0].attribs[domProcessor.getStoredAttrName('src')]).to.be.empty;
        });
    });

    it.skip('Should process <iframe> with src', function () {
        // TODO rewrite once with move url replacer to the page processor
        var $iframe                            = whacko.load('<iframe src="http://cross.domain.com/"></iframe>'),
            expectedHtml                       = '<iframe src="http://proxy.cross.domain.com/" src' +
                                                 sharedConst.DOM_SANDBOX_STORED_ATTR_POSTFIX +
                                                 '="http://cross.domain.com/"></iframe>',

            storedGetCrossDomainIframeProxyUrl = urlUtil.getCrossDomainIframeProxyUrl,
            storedGetProxyUrl                  = urlUtil.getProxyUrl;

        urlUtil.getCrossDomainIframeProxyUrl = function () {
            return 'http://proxy.cross.domain.com/';
        };

        urlUtil.getProxyUrl = function () {
            return 'http://proxy.com/-!id-ow!-/http://host'
        };

        pageProc.processPage($iframe, urlUtil.getProxyUrl);

        urlUtil.getCrossDomainIframeProxyUrl = storedGetCrossDomainIframeProxyUrl;
        urlUtil.getProxyUrl                  = storedGetProxyUrl;

        t.ok($iframe.html().indexOf(expectedHtml) !== -1);
        t.done();
    });

    it('Should process target attribute for the elements in <iframe>', function () {
        var $ = process('<a id="a" href="http://example.com"></a>' +
                        '<form id="form" action="http://example.com"></form>' +
                        '<a id="a_target_top" href="http://example.com" target="_top"></a>' +
                        '<a id="a_target_parent" href="http://example.com" target="_parent"></a>', true);

        expect(urlUtil.parseProxyUrl($('#a')[0].attribs.href).resourceType).eql('iframe');
        expect(urlUtil.parseProxyUrl($('#form')[0].attribs.action).resourceType).eql('iframe');
        expect(urlUtil.parseProxyUrl($('#a_target_top')[0].attribs.href).resourceType).to.be.null;
        expect($('#a_target_parent')[0].attribs.href).eql('http://example.com');
    });

    it('Should process <iframe> with src without protocol', function () {
        var $                    = process('<iframe src="//cross.domain.com/"></iframe><iframe src="//example.com/"></iframe>');
        var crossDomainIframeSrc = $('iframe')[0].attribs.src;
        var crossDomainProxyUrl  = urlUtil.getProxyUrl('http://cross.domain.com/', testProxyHostName, testCrossDomainPort, 1337, '', 'iframe');
        var iframeSrc            = $('iframe')[1].attribs.src;
        var proxyUrl             = urlUtil.getProxyUrl('http://example.com/', testProxyHostName, testProxyPort, 1337, '', 'iframe');

        expect(crossDomainIframeSrc).eql(crossDomainProxyUrl);
        expect(iframeSrc).eql(proxyUrl);
    });
});