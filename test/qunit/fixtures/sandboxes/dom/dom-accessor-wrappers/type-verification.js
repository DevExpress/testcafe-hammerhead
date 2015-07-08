var DomAccessorWrappers = Hammerhead.get('./sandboxes/dom-accessor-wrappers');
var IFrameSandbox       = Hammerhead.get('./sandboxes/iframe');
var UrlUtil             = Hammerhead.get('./util/url');

var accessors = DomAccessorWrappers.elementPropertyAccessors;

QUnit.testStart = function () {
    IFrameSandbox.on(IFrameSandbox.IFRAME_READY_TO_INIT, initIFrameTestHandler);
    IFrameSandbox.off(IFrameSandbox.IFRAME_READY_TO_INIT, IFrameSandbox.iframeReadyToInitHandler);
};

QUnit.testDone = function () {
    IFrameSandbox.off(IFrameSandbox.IFRAME_READY_TO_INIT, initIFrameTestHandler);
};

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
    var savedGetProxyUrl = UrlUtil.getProxyUrl;
    var fakeDoc          = {
        referrer: ''
    };

    UrlUtil.getProxyUrl = function () {
        return 'http://proxy/';
    };

    setProperty(fakeDoc, 'referrer', 'referrer');
    strictEqual(fakeDoc.referrer, 'referrer');

    UrlUtil.getProxyUrl = savedGetProxyUrl;
});

test('Is window instance', function () {
    var savedGetProxyUrl = UrlUtil.getProxyUrl;
    var fakeWin          = {
        location: ''
    };

    UrlUtil.getProxyUrl = function () {
        return 'http://proxy/';
    };

    setProperty(fakeWin, 'location', 'location');
    strictEqual(fakeWin.location, 'location');

    UrlUtil.getProxyUrl = savedGetProxyUrl;
});

test('Is location instance', function () {
    var savedGetProxyUrl = UrlUtil.getProxyUrl;
    var fakeLocation     = {
        href: ''
    };

    UrlUtil.getProxyUrl = function () {
        return 'http://proxy/';
    };

    setProperty(fakeLocation, 'href', 'href');
    strictEqual(fakeLocation.href, 'href');

    UrlUtil.getProxyUrl = savedGetProxyUrl;
});

