var Html            = Hammerhead.get('./util/html');
var DomProcessor    = Hammerhead.get('./dom-processor/dom-processor');
var ScriptProcessor = Hammerhead.get('../processing/script');
var StyleProcessor  = Hammerhead.get('../processing/style');
var Settings        = Hammerhead.get('./settings');
var Const           = Hammerhead.get('../const');
var IFrameSandbox   = Hammerhead.get('./sandboxes/iframe');
var UrlUtil         = Hammerhead.get('./util/url');
var NativeMethods   = Hammerhead.get('./sandboxes/native-methods');


QUnit.testStart = function () {
    // 'window.open' method uses in the QUnit
    window.open = NativeMethods.windowOpen;
    IFrameSandbox.on(IFrameSandbox.IFRAME_READY_TO_INIT, initIFrameTestHandler);
    IFrameSandbox.off(IFrameSandbox.IFRAME_READY_TO_INIT, IFrameSandbox.iframeReadyToInitHandler);
};

QUnit.testDone = function () {
    IFrameSandbox.off(IFrameSandbox.IFRAME_READY_TO_INIT, initIFrameTestHandler);
};

test('iframe', function () {
    var iframe         = $('<iframe sandbox="allow-forms">')[0];
    var storedAttrName = DomProcessor.getStoredAttrName('sandbox');

    DomProcessor.processElement(iframe);

    strictEqual(NativeMethods.getAttribute.call(iframe, 'sandbox'), 'allow-forms allow-scripts');
    strictEqual(NativeMethods.getAttribute.call(iframe, storedAttrName), 'allow-forms');
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

    DomProcessor.processElement(iframeBody.childNodes[0], UrlUtil.convertToProxyUrl);
    DomProcessor.processElement($link[0], UrlUtil.convertToProxyUrl);

    strictEqual(UrlUtil.parseProxyUrl(iframeBody.childNodes[0].href).resourceType, 'iframe');
    ok(!UrlUtil.parseProxyUrl($link[0].href).resourceType);

    $iframe.remove();
    $link.remove();
});

//T216999 - TestCafe playback - act.click doesn\'t work in an iframe
asyncTest('a.href in iframe', function () {
    var iframe         = document.createElement('iframe');
    var storedAttrName = DomProcessor.getStoredAttrName('href');

    iframe.id  = 'test';
    iframe.src = '/data/dom-processor/iframe.html';

    iframe.addEventListener('load', function () {
        var link = NativeMethods.getElementById.call(this.contentDocument, 'link');

        strictEqual(NativeMethods.getAttribute.call(link, storedAttrName), '/index.html');

        this.parentNode.removeChild(this);
        start();
    });

    document.body.appendChild(iframe);
});

test('script text', function () {
    var $div            = $('<div>').appendTo($('body'));
    var script          = 'var host = location.host';
    var processedScript = ScriptProcessor.process(script);

    $div[0].innerHTML = '\<script\>' + script + '\</script\>';

    DomProcessor.processElement($div.find('script')[0]);

    notEqual(script, processedScript);
    strictEqual($div[0].innerHTML.replace(/\s/g, ''), ('\<script\>' + processedScript +
                                                       '\</script\>').replace(/\s/g, ''));

    $div.remove();
});

test('comment inside script', function () {
    var testScript = function (scriptText) {
        var script = NativeMethods.createElement.call(document, 'script');

        script.text = scriptText;
        DomProcessor.processElement(script);
        NativeMethods.appendChild.call(document.head, script);

        strictEqual(NativeMethods.getAttribute.call(window.commentTest, 'href'), UrlUtil.getProxyUrl('http://google.com'));

        NativeMethods.removeAttribute.call(window.commentTest, 'href');
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
        DomProcessor.processElement(this);
    });

    strictEqual(container.innerHTML, expectedHTML);
});

test('script src', function () {
    var storedJobUid     = Settings.get().JOB_UID;
    var storedOwnerToken = Settings.get().JOB_OWNER_TOKEN;

    Settings.get().JOB_UID         = 'uid';
    Settings.get().JOB_OWNER_TOKEN = 'token';

    var script = document.createElement('script');

    script.src = 'http://google.com';

    DomProcessor.processElement(script, UrlUtil.convertToProxyUrl);

    strictEqual(UrlUtil.parseProxyUrl(script.src).resourceType, UrlUtil.SCRIPT);

    Settings.get().JOB_UID         = storedJobUid;
    Settings.get().JOB_OWNER_TOKEN = storedOwnerToken;
});

test('event attributes', function () {
    var div            = NativeMethods.createElement.call(document, 'div');
    var attrValue      = 'window.location="test";';
    var processedValue = processScript(attrValue);
    var storedAttrName = DomProcessor.getStoredAttrName('onclick');

    notEqual(processedValue, attrValue);

    NativeMethods.setAttribute.call(div, 'onclick', attrValue);

    DomProcessor.processElement(div, function () {
    });

    strictEqual(NativeMethods.getAttribute.call(div, 'onclick'), processedValue);
    strictEqual(NativeMethods.getAttribute.call(div, storedAttrName), attrValue);
});

test('javascript protocol', function () {
    var link           = NativeMethods.createElement.call(document, 'a');
    var attrValue      = 'javascript:window.location="test";';
    var processedValue = 'javascript:' + processScript(attrValue.replace('javascript:', ''));

    notEqual(processedValue, attrValue);

    NativeMethods.setAttribute.call(link, 'onclick', attrValue);
    NativeMethods.setAttribute.call(link, 'href', attrValue);

    DomProcessor.processElement(link, function () {
    });

    strictEqual(NativeMethods.getAttribute.call(link, 'onclick'), processedValue);
    strictEqual(NativeMethods.getAttribute.call(link, 'href'), processedValue);
    strictEqual(NativeMethods.getAttribute.call(link, DomProcessor.getStoredAttrName('onclick')), attrValue);
    strictEqual(NativeMethods.getAttribute.call(link, DomProcessor.getStoredAttrName('href')), attrValue);
});

//T135513 - Html code like as <iframe src="javascript:\'<html>....</html>\'"> not processed (http://www.tripadvisor.com/).
test('javascript protocol for iframe.src', function () {
    var iframe = NativeMethods.createElement.call(document, 'iframe');
    var src    = 'javascript:"<html><body><a id=\'test\' data-attr=\"123\">link</a></body></html>"';

    NativeMethods.setAttribute.call(iframe, 'src', src);

    DomProcessor.processElement(iframe, function (url) {
        return url;
    });

    var srcAttr       = NativeMethods.getAttribute.call(iframe, 'src');
    var storedSrcAttr = NativeMethods.getAttribute.call(iframe, DomProcessor.getStoredAttrName('src'));

    notEqual(srcAttr, src);
    strictEqual(srcAttr, 'javascript:\'' +
                         Html.processHtml('<html><body><a id=\'test\' data-attr="123">link</a></body></html>') + '\'');
    strictEqual(storedSrcAttr, src);
});

test('anchor with target attribute', function () {
    var anchor   = NativeMethods.createElement.call(document, 'a');
    var url      = 'http://url.com/';
    var proxyUrl = UrlUtil.getProxyUrl(url, null, null, null, null, 'iframe');

    NativeMethods.setAttribute.call(anchor, 'href', url);
    NativeMethods.setAttribute.call(anchor, 'target', 'iframeName');

    DomProcessor.processElement(anchor, function (url, resourceType) {
        return UrlUtil.getProxyUrl(url, null, null, null, null, resourceType);
    });

    strictEqual(NativeMethods.getAttribute.call(anchor, 'href'), proxyUrl);
    strictEqual(NativeMethods.getAttribute.call(anchor, DomProcessor.getStoredAttrName('href')), url);
});

test('autocomplete attribute', function () {
    var input1 = NativeMethods.createElement.call(document, 'input');
    var input2 = NativeMethods.createElement.call(document, 'input');
    var input3 = NativeMethods.createElement.call(document, 'input');
    var input4 = NativeMethods.createElement.call(document, 'input');

    NativeMethods.setAttribute.call(input1, 'autocomplete', 'on');
    NativeMethods.setAttribute.call(input2, 'autocomplete', 'off');
    NativeMethods.setAttribute.call(input3, 'autocomplete', '');

    DomProcessor.processElement(input1);
    DomProcessor.processElement(input2);
    DomProcessor.processElement(input3);
    DomProcessor.processElement(input4);

    var storedAutocompleteAttr = DomProcessor.getStoredAttrName('autocomplete');

    strictEqual(NativeMethods.getAttribute.call(input1, 'autocomplete'), 'off');
    strictEqual(NativeMethods.getAttribute.call(input1, storedAutocompleteAttr), 'on');

    strictEqual(NativeMethods.getAttribute.call(input2, 'autocomplete'), 'off');
    strictEqual(NativeMethods.getAttribute.call(input2, storedAutocompleteAttr), 'off');

    strictEqual(NativeMethods.getAttribute.call(input3, 'autocomplete'), 'off');
    strictEqual(NativeMethods.getAttribute.call(input3, storedAutocompleteAttr), '');

    strictEqual(NativeMethods.getAttribute.call(input4, 'autocomplete'), 'off');
    strictEqual(NativeMethods.getAttribute.call(input4, storedAutocompleteAttr), 'none');
});

test('crossdomain src', function () {
    var url                   = 'http://cross.domain.com/';
    var proxyUrl              = UrlUtil.getProxyUrl(url, location.hostname, 1336, null, null, 'iframe');
    var storedCrossDomainPort = Settings.get().CROSS_DOMAIN_PROXY_PORT;

    Settings.get().CROSS_DOMAIN_PROXY_PORT = 1336;

    var processed = Html.processHtml('<iframe src="' + url + '"></iframe>');

    ok(processed.indexOf('src="' + proxyUrl) !== -1);
    ok(processed.indexOf(DomProcessor.getStoredAttrName('src') + '="' + url + '"') !== -1);

    Settings.get().CROSS_DOMAIN_PROXY_PORT = storedCrossDomainPort;
});

test('stylesheet', function () {
    var urlReplacer = function () {
        return 'replaced';
    };

    var check = function (css, expected) {
        strictEqual(StyleProcessor.process(css, urlReplacer), expected);
    };

    check('a:hover {}', 'a[' + Const.HOVER_PSEUDO_CLASS_ATTR + '] {}');
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
    var proxyUrl = UrlUtil.getProxyUrl(url);

    var check = function (css, expected) {
        strictEqual(StyleProcessor.cleanUp(css, UrlUtil.parseProxyUrl, UrlUtil.formatUrl), expected);
    };

    check('a[' + Const.HOVER_PSEUDO_CLASS_ATTR + '] {}', 'a:hover {}');
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
        strictEqual(cssText.indexOf(Const.IS_STYLESHEET_PROCESSED_COMMENT), 0);
        strictEqual(cssText.indexOf(Const.IS_STYLESHEET_PROCESSED_COMMENT, 1), -1);
        strictEqual(cssText.replace(/^[\s\S]+url\(([\s\S]+)\)[\s\S]+$/, '$1'), UrlUtil.getProxyUrl('http://test.ru'));
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
