var expect        = require('chai').expect;
var parse5        = require('parse5');
var DomProcessor  = require('../../lib/processing/dom');
var processScript = require('../../lib/processing/script').processScript;
var DomAdapter    = require('../../lib/processing/dom/parse5-dom-adapter');
var urlUtils      = require('../../lib/utils/url');
var parse5Utils   = require('../../lib/utils/parse5');

var domAdapter   = new DomAdapter();
var domProcessor = new DomProcessor(domAdapter);

var testCrossDomainPort = 1338;
var testProxyHostName   = 'localhost';
var testProxyPort       = 80;

var parser = new parse5.Parser();

function process (html, isIframe) {
    var root             = parser.parse(html);
    var testDomProcessor = new DomProcessor(new DomAdapter(isIframe, testCrossDomainPort));
    var urlReplacer      = function (url, resourceType) {
        if (url.indexOf('//') === 0)
            url = 'http:' + url;
        else if (url.indexOf('/') === 0)
            url = 'http://example.com' + url;

        return urlUtils.getProxyUrl(url, {
            proxyHostname: 'localhost',
            proxyPort:     '80',
            sessionId:     'sessionId',
            resourceType:  resourceType
        });
    };

    parse5Utils.walkElements(root, function (el) {
        testDomProcessor.processElement(el, urlReplacer);
    });

    return root;
}

describe('DOM processor', function () {
    it('Should process elements outside <html></html>', function () {
        var root = process('<html></html><script src="http://example.com/script.js"></script>');

        var script = parse5Utils.findElementsByTagNames(root, 'script').script[0];

        expect(domAdapter.getAttr(script, 'src')).eql('http://localhost:80/sessionId!s/http://example.com/script.js');
    });

    it('Should process sandboxed <iframe>', function () {
        var root = process('<html><head></head><body><iframe sandbox="allow-forms"></iframe></body></html>');

        expect(new parse5.Serializer().serialize(root)).contains('<iframe sandbox="allow-forms allow-same-origin allow-scripts" ' +
                                                                 domProcessor.getStoredAttrName('sandbox') +
                                                                 '="allow-forms">');
    });

    it('Should process style attribute', function () {
        var root = process('<div style="background: url(\'http://example.com/style.css\')"></div>');

        expect(new parse5.Serializer().serialize(root)).eql('<html><head></head><body><div style="background: ' +
                                                            'url(\'http://localhost:80/sessionId/http://example.com/style.css\')"></div></body></html>');
    });

    it('Should process <script> src', function () {
        var root = process('<script src="http://example.com/script.js"></script>');

        var script = parse5Utils.findElementsByTagNames(root, 'script').script[0];

        expect(domAdapter.getAttr(script, 'src')).eql('http://localhost:80/sessionId!s/http://example.com/script.js');
    });

    it('Should process <script> with correct type', function () {
        var casesWithCorrectType = [
            'application/x-ecmascript', 'application/x-javascript', 'application/ecmascript', 'application/javascript',
            'text/x-ecmascript', 'text/ecmascript', 'text/x-javascript', 'text/jsscript', 'text/livescript',
            'text/javascript', 'text/javascript1.0', 'text/javascript1.1', 'text/javascript1.2',
            'text/javascript1.3', 'text/javascript1.4', 'text/javascript1.5', '   text/javascript1.5   '
        ];

        var casesWithIncorrectType = [
            '123', 'aplication/x-ecmascript', 'application/avacript', 'applica/ecmascr', 'test/javacript',
            'text/javascript2.0', 'text/javascript1.6', 'text/javascript1.7'
        ];

        var script          = 'location.path = "/path";';
        var processedScript = processScript(script, true);

        var checkType = function (type) {
            var result   = this.toString();
            var root     = process('<script type="' + type + '">' + script + '</script>');
            var scriptEl = parse5Utils.findElementsByTagNames(root, 'script').script[0];

            expect(scriptEl.childNodes[0].value).eql(result);
        };

        casesWithCorrectType.forEach(checkType, processedScript);
        casesWithIncorrectType.forEach(checkType, script);
    });

    it('Should process <img> src', function () {
        var root = process('<img src="http://example.com/image.png">');
        var img  = parse5Utils.findElementsByTagNames(root, 'img').img[0];

        expect(domAdapter.getAttr(img, 'src')).eql('http://example.com/image.png');
        expect(domAdapter.getAttr(img, domProcessor.getStoredAttrName('src'))).eql('http://example.com/image.png');

        root = process('<img src="">');
        img  = parse5Utils.findElementsByTagNames(root, 'img').img[0];

        expect(domAdapter.getAttr(img, 'src')).to.be.empty;
        expect(domAdapter.getAttr(img, domProcessor.getStoredAttrName('src'))).to.be.empty;

        root = process('<img src="about:blank">');
        img  = parse5Utils.findElementsByTagNames(root, 'img').img[0];

        expect(domAdapter.getAttr(img, 'src')).eql('about:blank');
        expect(domAdapter.getAttr(img, domProcessor.getStoredAttrName('src'))).eql('about:blank');
    });

    it.skip('Should process <iframe> with src', function () {
        // TODO: Rewrite moving url replacer to the page processor.
        //var $iframe                            = whacko.load('<iframe src="http://cross.domain.com/"></iframe>'),
        //    expectedHtml                       = '<iframe src="http://proxy.cross.domain.com/" src' +
        //                                         sharedConst.DOM_SANDBOX_STORED_ATTR_POSTFIX +
        //                                         '="http://cross.domain.com/"></iframe>',
        //
        //    storedGetCrossDomainIframeProxyUrl = urlUtil.getCrossDomainIframeProxyUrl,
        //    storedGetProxyUrl                  = urlUtil.getProxyUrl;
        //
        //urlUtil.getCrossDomainIframeProxyUrl = function () {
        //    return 'http://proxy.cross.domain.com/';
        //};
        //
        //urlUtil.getProxyUrl = function () {
        //    return 'http://proxy.com/-!id-ow!-/http://host';
        //};
        //
        //domProcessor.processPage($iframe, urlUtil.getProxyUrl);
        //
        //urlUtil.getCrossDomainIframeProxyUrl = storedGetCrossDomainIframeProxyUrl;
        //urlUtil.getProxyUrl                  = storedGetProxyUrl;
        //
        //t.ok($iframe.html().indexOf(expectedHtml) !== -1);
        //t.done();
    });

    it('Should process target attribute for the elements in <iframe>', function () {
        var root = process('<a id="a" href="http://example.com"></a>' +
                           '<form id="form" action="http://example.com"></form>' +
                           '<a id="a_target_top" href="http://example.com" target="_top"></a>' +
                           '<a id="a_target_parent" href="http://example.com" target="_parent"></a>', true);

        var elements = parse5Utils.findElementsByTagNames(root, ['a', 'form']);

        expect(urlUtils.parseProxyUrl(domAdapter.getAttr(elements.a[0], 'href')).resourceType).eql('i');
        expect(urlUtils.parseProxyUrl(domAdapter.getAttr(elements.form[0], 'action')).resourceType).eql('if');
        expect(urlUtils.parseProxyUrl(domAdapter.getAttr(elements.a[1], 'href')).resourceType).to.be.null;
        expect(domAdapter.getAttr(elements.a[2], 'href')).eql('http://example.com');
    });

    it('Should process <iframe> with src without protocol', function () {
        var root                 = process('<iframe src="//cross.domain.com/"></iframe><iframe src="//example.com/"></iframe>');
        var iframes              = parse5Utils.findElementsByTagNames(root, 'iframe').iframe;
        var crossDomainIframeSrc = domAdapter.getAttr(iframes[0], 'src');
        var crossDomainProxyUrl  = urlUtils.getProxyUrl('http://cross.domain.com/', {
            proxyHostname: testProxyHostName,
            proxyPort:     testCrossDomainPort,
            sessionId:     'sessionId',
            resourceType:  'i'
        });
        var iframeSrc            = domAdapter.getAttr(iframes[1], 'src');
        var proxyUrl             = urlUtils.getProxyUrl('http://example.com/', {
            proxyHostname: testProxyHostName,
            proxyPort:     testProxyPort,
            sessionId:     'sessionId',
            resourceType:  'i'
        });

        expect(crossDomainIframeSrc).eql(crossDomainProxyUrl);
        expect(iframeSrc).eql(proxyUrl);
    });
});
