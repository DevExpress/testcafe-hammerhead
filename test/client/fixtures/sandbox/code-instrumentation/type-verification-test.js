var urlUtils = hammerhead.get('./utils/url');

var accessors     = hammerhead.sandbox.codeInstrumentation.elementPropertyAccessors;
var iframeSandbox = hammerhead.sandbox.iframe;

QUnit.testStart(function () {
    iframeSandbox.on(iframeSandbox.RUN_TASK_SCRIPT_EVENT, initIframeTestHandler);
    iframeSandbox.off(iframeSandbox.RUN_TASK_SCRIPT_EVENT, iframeSandbox.iframeReadyToInitHandler);
});

QUnit.testDone(function () {
    iframeSandbox.off(iframeSandbox.RUN_TASK_SCRIPT_EVENT, initIframeTestHandler);
});

test('is anchor instance', function () {
    var anchor = document.createElement('a');

    ok(accessors.protocol.condition(anchor));
});

test('is dom element instance', function () {
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

test('is document instance', function () {
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

test('is window instance', function () {
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

test('is location instance', function () {
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

