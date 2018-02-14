var urlUtils = hammerhead.get('./utils/url');

var accessors = hammerhead.sandbox.codeInstrumentation.elementPropertyAccessors;

test('is anchor instance', function () {
    var anchor = document.createElement('a');

    ok(accessors.protocol.condition(anchor));
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

