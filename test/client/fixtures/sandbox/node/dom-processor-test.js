var INTERNAL_ATTRS  = Hammerhead.get('../processing/dom/internal-attributes');
var htmlUtils       = Hammerhead.get('./utils/html');
var domProcessor    = Hammerhead.get('./dom-processor');
var scriptProcessor = Hammerhead.get('../processing/script');
var styleProcessor  = Hammerhead.get('../processing/style');
var settings        = Hammerhead.get('./settings');
var urlUtils        = Hammerhead.get('./utils/url');

var nativeMethods = Hammerhead.nativeMethods;
var iframeSandbox = Hammerhead.sandbox.iframe;

QUnit.testStart(function () {
    // 'window.open' method uses in the QUnit
    window.open = nativeMethods.windowOpen;
    iframeSandbox.on(iframeSandbox.IFRAME_READY_TO_INIT_EVENT, initIframeTestHandler);
    iframeSandbox.off(iframeSandbox.IFRAME_READY_TO_INIT_EVENT, iframeSandbox.iframeReadyToInitHandler);
});

QUnit.testDone(function () {
    iframeSandbox.off(iframeSandbox.IFRAME_READY_TO_INIT_EVENT, initIframeTestHandler);
});

test('iframe', function () {
    var iframe         = $('<iframe sandbox="allow-forms">')[0];
    var storedAttrName = domProcessor.getStoredAttrName('sandbox');

    domProcessor.processElement(iframe);

    strictEqual(nativeMethods.getAttribute.call(iframe, 'sandbox'), 'allow-forms allow-scripts');
    strictEqual(nativeMethods.getAttribute.call(iframe, storedAttrName), 'allow-forms');
});

test('link in iframe', function () {
    var $iframe    = $('<iframe id="test1">').appendTo('body');
    var iframeBody = $iframe[0].contentDocument.body;
    var $link      = $('<a href="/index.html">').appendTo('body');

    // HACK: IE
    if (!iframeBody) {
        $iframe[0].contentDocument.write('<body></body>');
        iframeBody = $iframe[0].contentDocument.body;
    }

    iframeBody.innerHTML = '<a href="/index.html"></a>';

    domProcessor.processElement(iframeBody.childNodes[0], urlUtils.convertToProxyUrl);
    domProcessor.processElement($link[0], urlUtils.convertToProxyUrl);

    strictEqual(urlUtils.parseProxyUrl(iframeBody.childNodes[0].href).resourceType, 'iframe');
    ok(!urlUtils.parseProxyUrl($link[0].href).resourceType);

    $iframe.remove();
    $link.remove();
});

test('script text', function () {
    var $div            = $('<div>').appendTo($('body'));
    var script          = 'var host = location.host';
    var processedScript = scriptProcessor.process(script);

    $div[0].innerHTML = '\<script\>' + script + '\</script\>';

    domProcessor.processElement($div.find('script')[0]);

    notEqual(script, processedScript);
    strictEqual($div[0].innerHTML.replace(/\s/g, ''), ('\<script\>' + processedScript +
                                                       '\</script\>').replace(/\s/g, ''));

    $div.remove();
});

test('comment inside script', function () {
    var testScript = function (scriptText) {
        var script = nativeMethods.createElement.call(document, 'script');

        script.text = scriptText;
        domProcessor.processElement(script);
        nativeMethods.appendChild.call(document.head, script);

        strictEqual(nativeMethods.getAttribute.call(window.commentTest, 'href'), urlUtils.getProxyUrl('http://google.com'));

        nativeMethods.removeAttribute.call(window.commentTest, 'href');
        document.head.removeChild(script);
    };

    window.commentTest = document.createElement('a');

    testScript('\<!-- Begin comment\n' + 'window.commentTest.href = "http://google.com";\n' + '//End comment -->');
    testScript('\<!-- Begin comment\n' + 'window.commentTest.href = "http://google.com";\n' + ' -->');
});

test('attribute value', function () {
    var html =
            '<p class="location test"></p>' +
            '<p data-w="dslkfe"></p>' +
            '<p ' + Hammerhead.DOM_SANDBOX_STORED_ATTR_KEY_PREFIX + 'test="location"></p>' +
            '<div id="URL"></div>' +
            '<div attr=""></div>' +
            '<div data-wrap="{simbols: -904, action: data}"></div>' +
            '<span class="Client"></span>' +
            '<span test="sdk"></span>' +
            '<span id="href"></span>' +
            '<div data-src="test"></div>';

    var expectedHTML =
            '<p class="location test"></p>' +
            '<p data-w="dslkfe"></p>' +
            '<p ' + Hammerhead.DOM_SANDBOX_STORED_ATTR_KEY_PREFIX + 'test="location"></p>' +
            '<div id="URL"></div>' +
            '<div attr=""></div>' +
            '<div data-wrap="{simbols: -904, action: data}"></div>' +
            '<span class="Client"></span>' +
            '<span test="sdk"></span>' +
            '<span id="href"></span>' +
            '<div data-src="test"></div>';

    var container = document.createElement('div');

    container.innerHTML = html;

    $(container).find('*').each(function () {
        domProcessor.processElement(this);
    });

    strictEqual(container.innerHTML, expectedHTML);
});

test('script src', function () {
    var storedSessionId = settings.get().sessionId;

    settings.get().sessionId = 'uid';

    var script = document.createElement('script');

    script.src = 'http://google.com';

    domProcessor.processElement(script, urlUtils.convertToProxyUrl);

    strictEqual(urlUtils.parseProxyUrl(script.src).resourceType, urlUtils.SCRIPT);

    settings.get().sessionId = storedSessionId;
});

test('event attributes', function () {
    var div            = nativeMethods.createElement.call(document, 'div');
    var attrValue      = 'window.location="test";';
    var processedValue = processScript(attrValue);
    var storedAttrName = domProcessor.getStoredAttrName('onclick');

    notEqual(processedValue, attrValue);

    nativeMethods.setAttribute.call(div, 'onclick', attrValue);

    domProcessor.processElement(div, function () {
    });

    strictEqual(nativeMethods.getAttribute.call(div, 'onclick'), processedValue);
    strictEqual(nativeMethods.getAttribute.call(div, storedAttrName), attrValue);
});

test('javascript protocol', function () {
    var link           = nativeMethods.createElement.call(document, 'a');
    var attrValue      = 'javascript:window.location="test";';
    var processedValue = 'javascript:' + processScript(attrValue.replace('javascript:', ''));

    notEqual(processedValue, attrValue);

    nativeMethods.setAttribute.call(link, 'onclick', attrValue);
    nativeMethods.setAttribute.call(link, 'href', attrValue);

    domProcessor.processElement(link, function () {
    });

    strictEqual(nativeMethods.getAttribute.call(link, 'onclick'), processedValue);
    strictEqual(nativeMethods.getAttribute.call(link, 'href'), processedValue);
    strictEqual(nativeMethods.getAttribute.call(link, domProcessor.getStoredAttrName('onclick')), attrValue);
    strictEqual(nativeMethods.getAttribute.call(link, domProcessor.getStoredAttrName('href')), attrValue);
});

test('anchor with target attribute', function () {
    var anchor   = nativeMethods.createElement.call(document, 'a');
    var url      = 'http://url.com/';
    var proxyUrl = urlUtils.getProxyUrl(url, null, null, null, 'iframe');

    nativeMethods.setAttribute.call(anchor, 'href', url);
    nativeMethods.setAttribute.call(anchor, 'target', 'iframeName');

    domProcessor.processElement(anchor, function (url, resourceType) {
        return urlUtils.getProxyUrl(url, null, null, null, resourceType);
    });

    strictEqual(nativeMethods.getAttribute.call(anchor, 'href'), proxyUrl);
    strictEqual(nativeMethods.getAttribute.call(anchor, domProcessor.getStoredAttrName('href')), url);
});

test('autocomplete attribute', function () {
    var input1 = nativeMethods.createElement.call(document, 'input');
    var input2 = nativeMethods.createElement.call(document, 'input');
    var input3 = nativeMethods.createElement.call(document, 'input');
    var input4 = nativeMethods.createElement.call(document, 'input');

    nativeMethods.setAttribute.call(input1, 'autocomplete', 'on');
    nativeMethods.setAttribute.call(input2, 'autocomplete', 'off');
    nativeMethods.setAttribute.call(input3, 'autocomplete', '');

    domProcessor.processElement(input1);
    domProcessor.processElement(input2);
    domProcessor.processElement(input3);
    domProcessor.processElement(input4);

    var storedAutocompleteAttr = domProcessor.getStoredAttrName('autocomplete');

    strictEqual(nativeMethods.getAttribute.call(input1, 'autocomplete'), 'off');
    strictEqual(nativeMethods.getAttribute.call(input1, storedAutocompleteAttr), 'on');

    strictEqual(nativeMethods.getAttribute.call(input2, 'autocomplete'), 'off');
    strictEqual(nativeMethods.getAttribute.call(input2, storedAutocompleteAttr), 'off');

    strictEqual(nativeMethods.getAttribute.call(input3, 'autocomplete'), 'off');
    strictEqual(nativeMethods.getAttribute.call(input3, storedAutocompleteAttr), '');

    strictEqual(nativeMethods.getAttribute.call(input4, 'autocomplete'), 'off');
    strictEqual(nativeMethods.getAttribute.call(input4, storedAutocompleteAttr), 'none');
});

test('crossdomain src', function () {
    var url                   = 'http://cross.domain.com/';
    var proxyUrl              = urlUtils.getProxyUrl(url, location.hostname, 2001, null, 'iframe');
    var storedCrossDomainPort = settings.get().crossDomainProxyPort;

    settings.get().crossDomainProxyPort = 2001;

    var processed = htmlUtils.processHtml('<iframe src="' + url + '"></iframe>');

    ok(processed.indexOf('src="' + proxyUrl) !== -1);
    ok(processed.indexOf(domProcessor.getStoredAttrName('src') + '="' + url + '"') !== -1);

    settings.get().crossDomainProxyPort = storedCrossDomainPort;
});

test('stylesheet', function () {
    var urlReplacer = function () {
        return 'replaced';
    };

    var check = function (css, expected) {
        strictEqual(styleProcessor.process(css, urlReplacer), expected);
    };

    check('a:hover {}', 'a[' + INTERNAL_ATTRS.hoverPseudoClass + '] {}');
    check('div { background-image: url(""); }', 'div { background-image: url(""); }');
    check('div { background-image: url(\'\'); }', 'div { background-image: url(\'\'); }');
    check('div { background-image: url(); }', 'div { background-image: url(); }');
    check('div { background-image: url("/image.png"); }', 'div { background-image: url("replaced"); }');
    check('div { background-image: url(\'/image.png\'); }', 'div { background-image: url(\'replaced\'); }');
    check('div { background-image: url(/image.png); }', 'div { background-image: url(replaced); }');
    check('@import "/image.png"', '@import "replaced"');
    check('@import \'/image.png\'', '@import \'replaced\'');
    check('@import ""', '@import ""');
    check('@import \'\'', '@import \'\'');
});

test('clean up stylesheet', function () {
    var url      = 'http://google.com/image.png';
    var proxyUrl = urlUtils.getProxyUrl(url);

    var check = function (css, expected) {
        strictEqual(styleProcessor.cleanUp(css, urlUtils.parseProxyUrl, urlUtils.formatUrl), expected);
    };

    check('a[' + INTERNAL_ATTRS.hoverPseudoClass + '] {}', 'a:hover {}');
    check('div { background-image: url(""); }', 'div { background-image: url(""); }');
    check('div { background-image: url(\'\'); }', 'div { background-image: url(\'\'); }');
    check('div { background-image: url(); }', 'div { background-image: url(); }');
    check('div { background-image: url("' + proxyUrl + '"); }', 'div { background-image: url("' + url + '"); }');
    check('div { background-image: url(\'' + proxyUrl + '\'); }', 'div { background-image: url(\'' + url + '\'); }');
    check('div { background-image: url(' + proxyUrl + '); }', 'div { background-image: url(' + url + '); }');
    check('@import "' + proxyUrl + '"', '@import "' + url + '"');
    check('@import \'' + proxyUrl + '\'', '@import \'' + url + '\'');
    check('@import ""', '@import ""');
    check('@import \'\'', '@import \'\'');
});

test('stylesheet after innerHTML', function () {
    var div   = $('<div>').appendTo('body')[0];
    var style = $('<style>')[0];
    var check = function (cssText) {
        strictEqual(cssText.indexOf(styleProcessor.IS_STYLESHEET_PROCESSED_COMMENT), 0);
        strictEqual(cssText.indexOf(styleProcessor.IS_STYLESHEET_PROCESSED_COMMENT, 1), -1);
        strictEqual(cssText.replace(/^[\s\S]+url\(([\s\S]+)\)[\s\S]+$/, '$1'), urlUtils.getProxyUrl('http://test.ru'));
    };

    eval(processScript('div.innerHTML = "<style>.rule { background: url(http://test.ru) }</style>";'));
    check(div.children[0].innerHTML);

    eval(processScript('div.innerHTML = div.innerHTML;'));
    check(div.children[0].innerHTML);

    eval(processScript('style.innerHTML = ".rule { background: url(http://test.ru) }";'));
    check(style.innerHTML);

    eval(processScript('style.innerHTML = style.innerHTML;'));
    check(style.innerHTML);
});

module('regression');

asyncTest('link with target=\'_parent\' in iframe (T216999)', function () {
    var iframe         = document.createElement('iframe');
    var storedAttrName = domProcessor.getStoredAttrName('href');

    iframe.id  = 'test';
    iframe.src = window.QUnitGlobals.getResourceUrl('../../../data/dom-processor/iframe.html');

    iframe.addEventListener('load', function () {
        var link = nativeMethods.getElementById.call(this.contentDocument, 'link');

        strictEqual(nativeMethods.getAttribute.call(link, storedAttrName), '/index.html');

        this.parentNode.removeChild(this);
        start();
    });

    document.body.appendChild(iframe);
});

test('iframe with javascript protocol in \'src\' attribute value must be processed (T135513)', function () {
    var iframe = nativeMethods.createElement.call(document, 'iframe');
    var src    = 'javascript:"<html><body><a id=\'test\' data-attr=\"123\">link</a></body></html>"';

    nativeMethods.setAttribute.call(iframe, 'src', src);

    domProcessor.processElement(iframe, function (url) {
        return url;
    });

    var srcAttr       = nativeMethods.getAttribute.call(iframe, 'src');
    var storedSrcAttr = nativeMethods.getAttribute.call(iframe, domProcessor.getStoredAttrName('src'));

    notEqual(srcAttr, src);
    strictEqual(srcAttr, 'javascript:\'' +
                         htmlUtils.processHtml('<html><body><a id=\'test\' data-attr="123">link</a></body></html>') +
                         '\'');
    strictEqual(storedSrcAttr, src);
});

test('The URL attribute must be set to an empty string on the server only once (T295078) (GH-159)', function () {
    var iframe = nativeMethods.createElement.call(document, 'iframe');

    nativeMethods.setAttribute.call(iframe, 'src', '/should_not_be_changed');
    // NOTE: Simulating that iframe was processed on the server
    nativeMethods.setAttribute.call(iframe, domProcessor.getStoredAttrName('src'), '');

    domProcessor.processElement(iframe, function () {
        return 'fail';
    });

    strictEqual(nativeMethods.getAttribute.call(iframe, 'src'), '/should_not_be_changed');
});
