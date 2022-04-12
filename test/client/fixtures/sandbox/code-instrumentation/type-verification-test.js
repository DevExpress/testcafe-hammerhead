var urlUtils = hammerhead.utils.url;

test('is window instance', function () {
    var savedGetProxyUrl = urlUtils.getProxyUrl;
    var fakeWin          = {
        location: '',
    };

    urlUtils.overrideGetProxyUrl(function () {
        return 'http://proxy/';
    });

    setProperty(fakeWin, 'location', 'location');
    strictEqual(fakeWin.location, 'location');

    urlUtils.overrideGetProxyUrl(savedGetProxyUrl);
});

test('is location instance', function () {
    var savedGetProxyUrl = urlUtils.getProxyUrl;
    var fakeLocation     = {
        href: '',
    };

    urlUtils.overrideGetProxyUrl(function () {
        return 'http://proxy/';
    });

    setProperty(fakeLocation, 'href', 'href');
    strictEqual(fakeLocation.href, 'href');

    urlUtils.overrideGetProxyUrl(savedGetProxyUrl);
});

