var urlUtils = hammerhead.get('./utils/url');

var accessors     = hammerhead.sandbox.codeInstrumentation.elementPropertyAccessors;
var iframeSandbox = hammerhead.sandbox.iframe;

QUnit.testStart(function () {
    iframeSandbox.on(iframeSandbox.IFRAME_READY_TO_INIT_EVENT, initIframeTestHandler);
    iframeSandbox.off(iframeSandbox.IFRAME_READY_TO_INIT_EVENT, iframeSandbox.iframeReadyToInitHandler);
});

QUnit.testDone(function () {
    iframeSandbox.off(iframeSandbox.IFRAME_READY_TO_INIT_EVENT, initIframeTestHandler);
});

test('Is anchor instance', function () {
    var anchor = document.createElement('a');

    ok(accessors.protocol.condition(anchor));
});

test('Is dom element instance', function () {
    var img           = document.createElement('img');
    var fragment      = document.createDocumentFragment();
    var notDomElement = {
        tagName:  'img',
        nodeType: 3
    };

    ok(accessors.src.condition(img), 'Element <img> is dom element');
    ok(!accessors.src.condition(fragment), 'Element "fragment" isn\'t dom element');
    ok(!accessors.src.condition(notDomElement), 'Object with property "tagName" isn\'t dom element');
    ok(!accessors.src.condition(document), 'Document isn\'t dom element');
});

test('Is document instance', function () {
    var savedGetProxyUrl = urlUtils.getProxyUrl;
    var fakeDoc          = {
        referrer: ''
    };

    urlUtils.getProxyUrl = function () {
        return 'http://proxy/';
    };

    setProperty(fakeDoc, 'referrer', 'referrer');
    strictEqual(fakeDoc.referrer, 'referrer');

    urlUtils.getProxyUrl = savedGetProxyUrl;
});

test('Is window instance', function () {
    var savedGetProxyUrl = urlUtils.getProxyUrl;
    var fakeWin          = {
        location: ''
    };

    urlUtils.getProxyUrl = function () {
        return 'http://proxy/';
    };

    setProperty(fakeWin, 'location', 'location');
    strictEqual(fakeWin.location, 'location');

    urlUtils.getProxyUrl = savedGetProxyUrl;
});

test('Is location instance', function () {
    var savedGetProxyUrl = urlUtils.getProxyUrl;
    var fakeLocation     = {
        href: ''
    };

    urlUtils.getProxyUrl = function () {
        return 'http://proxy/';
    };

    setProperty(fakeLocation, 'href', 'href');
    strictEqual(fakeLocation.href, 'href');

    urlUtils.getProxyUrl = savedGetProxyUrl;
});

