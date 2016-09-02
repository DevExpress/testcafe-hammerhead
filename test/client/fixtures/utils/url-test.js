var settings       = hammerhead.get('./settings');
var urlUtils       = hammerhead.get('./utils/url');
var sharedUrlUtils = hammerhead.get('../utils/url');
var destLocation   = hammerhead.get('./utils/destination-location');

var browserUtils  = hammerhead.utils.browser;
var iframeSandbox = hammerhead.sandbox.iframe;
var nativeMethods = hammerhead.nativeMethods;

var PROXY_PORT     = 1337;
var PROXY_HOSTNAME = '127.0.0.1';
var PROXY_HOST     = PROXY_HOSTNAME + ':' + PROXY_PORT;

QUnit.testStart(function () {
    // NOTE: The 'window.open' method used in QUnit.
    window.open       = nativeMethods.windowOpen;
    window.setTimeout = nativeMethods.setTimeout;
    iframeSandbox.on(iframeSandbox.RUN_TASK_SCRIPT, initIframeTestHandler);
    iframeSandbox.off(iframeSandbox.RUN_TASK_SCRIPT, iframeSandbox.iframeReadyToInitHandler);
});

QUnit.testDone(function () {
    iframeSandbox.off(iframeSandbox.RUN_TASK_SCRIPT, initIframeTestHandler);
});

function getProxyUrl (url, resourceType) {
    return urlUtils.getProxyUrl(url, {
        proxyHostname: PROXY_HOSTNAME,
        proxyPort:     PROXY_PORT,
        sessionId:     'sessionId',
        resourceType:  resourceType
    });
}

test('getCrossDomainProxyUrl', function () {
    var storedCrossDomainport = settings.get().crossDomainProxyPort;

    settings.get().crossDomainProxyPort = '5555';

    strictEqual(urlUtils.getCrossDomainProxyUrl(), 'http://' + location.hostname + ':5555/');

    settings.get().crossDomainProxyPort = storedCrossDomainport;
});

test('getCrossDomainIframeProxyUrl (GH-749)', function () {
    var destUrl               = 'test.html';
    var storedCrossDomainport = settings.get().crossDomainProxyPort;

    settings.get().crossDomainProxyPort = '5555';

    strictEqual(urlUtils.getCrossDomainIframeProxyUrl(destUrl),
        'http://' + location.hostname + ':5555' + '/sessionId!i/https://example.com/' + destUrl);

    settings.get().crossDomainProxyPort = storedCrossDomainport;
});

test('resolveUrlAsDest', function () {
    strictEqual(urlUtils.resolveUrlAsDest('/index.html#hash'), 'https://example.com/index.html#hash');
    strictEqual(urlUtils.resolveUrlAsDest('javascript:0;'), 'javascript:0;');
    strictEqual(urlUtils.resolveUrlAsDest('/index.html?param=value#hash'), 'https://example.com/index.html?param=value#hash');
    strictEqual(urlUtils.resolveUrlAsDest('https://twitter.com/index.html?param=value#hash'), 'https://twitter.com/index.html?param=value#hash');
    strictEqual(urlUtils.resolveUrlAsDest('//twitter.com/index.html?param=value#hash'), 'https://twitter.com/index.html?param=value#hash');
    strictEqual(urlUtils.resolveUrlAsDest('http://g.tbcdn.cn/??kissy/k/1.4.2/seed-min.js'), 'http://g.tbcdn.cn/??kissy/k/1.4.2/seed-min.js');
});

test('isSupportedProtocol', function () {
    ok(urlUtils.isSupportedProtocol('http://example.org'));
    ok(urlUtils.isSupportedProtocol('https://example.org'));
    ok(urlUtils.isSupportedProtocol('//example.org'));
    ok(urlUtils.isSupportedProtocol('/some/path'));
    ok(urlUtils.isSupportedProtocol('path'));
    ok(urlUtils.isSupportedProtocol('./'));
    ok(urlUtils.isSupportedProtocol('../../'));
    ok(urlUtils.isSupportedProtocol('?t'));
    ok(!urlUtils.isSupportedProtocol('#42'));
    ok(!urlUtils.isSupportedProtocol(' data:asdasdasdasdasdasd'));
    ok(!urlUtils.isSupportedProtocol('chrome-extension://google.com/image.png'));
});

test('formatUrl', function () {
    strictEqual(urlUtils.formatUrl({ hostname: 'localhost', partAfterHost: '/path' }), '/path');
    strictEqual(urlUtils.formatUrl({ port: '1400', partAfterHost: '/path' }), '/path');
    strictEqual(urlUtils.formatUrl({
        hostname: 'localhost',
        port:     '1400',
        protocol: 'http:'
    }), 'http://localhost:1400');

    var parsedUrl = {
        hostname: 'localhost',
        port:     '1400',
        protocol: 'http:',
        username: 'test',
        password: 'test'
    };

    strictEqual(urlUtils.formatUrl(parsedUrl), 'http://test:test@localhost:1400');

    parsedUrl = {
        hostname:      'localhost',
        port:          '1400',
        protocol:      'http:',
        username:      'test',
        password:      'test',
        partAfterHost: '/path'
    };
    strictEqual(urlUtils.formatUrl(parsedUrl), 'http://test:test@localhost:1400/path');
});

test('isRelativeUrl', function () {
    ok(!sharedUrlUtils.isRelativeUrl('http://example.com'));
    ok(sharedUrlUtils.isRelativeUrl('/test.html'));
});

module('parse url');

test('newline characters', function () {
    var url           = 'http://exa\nmple.com/?par\n=val';
    var parsingResult = urlUtils.parseUrl(url);

    strictEqual(parsingResult.hostname, 'example.com');
    strictEqual(parsingResult.partAfterHost, '/?par=val');
});

test('tabulation characters', function () {
    var url           = 'http://exa\tmple.com/?par\t=val';
    var parsingResult = urlUtils.parseUrl(url);

    strictEqual(parsingResult.hostname, 'example.com');
    strictEqual(parsingResult.partAfterHost, '/?par=val');
});

test('hash after host', function () {
    var url           = '//test.example.com#42';
    var parsingResult = urlUtils.parseUrl(url);

    ok(!parsingResult.protocol);
    strictEqual(parsingResult.hostname, 'test.example.com');
    strictEqual(parsingResult.partAfterHost, '#42');

});

test('question mark disappears', function () {
    var url       = 'http://google.ru:345/path?';
    var parsedUrl = urlUtils.parseUrl(url);

    strictEqual(parsedUrl.partAfterHost, '/path?');
    strictEqual(urlUtils.formatUrl(parsedUrl), url);

    url       = 'http://yandex.ru:234/path';
    parsedUrl = urlUtils.parseUrl(url);

    strictEqual(parsedUrl.partAfterHost, '/path');
    strictEqual(urlUtils.formatUrl(parsedUrl), url);
});

test('additional slashes after scheme (GH-739)', function () {
    var url           = 'http://///example.com/';
    var parsingResult = urlUtils.parseUrl(url);

    strictEqual(parsingResult.hostname, 'example.com');

    urlUtils.parseUrl('////mail.ru');
});

test('additional slashes before path', function () {
    var url           = '/////example.com/';
    var parsingResult = urlUtils.parseUrl(url);

    strictEqual(parsingResult.hostname, 'example.com');
});

module('get proxy url');

test('already proxied', function () {
    var destUrl  = 'http://test.example.com/';
    var proxyUrl = getProxyUrl(destUrl);
    var newUrl   = getProxyUrl(proxyUrl, 'i');

    strictEqual(urlUtils.parseProxyUrl(newUrl).resourceType, 'i');
});

test('destination with query, path, hash and host', function () {
    var destUrl  = 'http://test.example.com/pa/th/Page?param1=value&param2=&param3#testHash';
    var proxyUrl = getProxyUrl(destUrl);

    strictEqual(proxyUrl, 'http://' + PROXY_HOST + '/sessionId/' + destUrl);
});

test('destination with host only', function () {
    var destUrl  = 'http://test.example.com/';
    var proxyUrl = getProxyUrl(destUrl);

    strictEqual(proxyUrl, 'http://' + PROXY_HOST + '/sessionId/' + destUrl);
});

test('destination with https protocol', function () {
    var destUrl  = 'https://test.example.com:53/';
    var proxyUrl = getProxyUrl(destUrl);

    strictEqual(proxyUrl, 'http://' + PROXY_HOST + '/sessionId/' + destUrl);
});

test('relative path', function () {
    var destUrl  = '/Image1.jpg';
    var proxyUrl = urlUtils.getProxyUrl(destUrl);

    strictEqual(proxyUrl, 'http://' + location.host + '/sessionId/https://example.com/Image1.jpg');

    var relativeUrl = 'share?id=1kjQMWh7IcHdTBbTv6otRvCGYr-p02q206M7aR7dmog0';
    var parsedUrl   = urlUtils.parseUrl(relativeUrl);

    ok(!parsedUrl.hostname);
    ok(!parsedUrl.host);
    ok(!parsedUrl.hash);
    ok(!parsedUrl.port);
    ok(!parsedUrl.protocol);
    strictEqual(parsedUrl.partAfterHost, 'share?id=1kjQMWh7IcHdTBbTv6otRvCGYr-p02q206M7aR7dmog0');
});

test('contains successive question marks in query', function () {
    var destUrl  = 'http://test.example.com/??dirs/???files/';
    var proxyUrl = urlUtils.getProxyUrl(destUrl, {
        proxyHostname: '127.0.0.1',
        proxyPort:     PROXY_PORT,
        sessionId:     'sessionId'
    });

    strictEqual(proxyUrl, 'http://' + PROXY_HOST + '/sessionId/' + destUrl);
});

test('destination with port', function () {
    var destUrl  = 'http://test.example.com:53/';
    var proxyUrl = getProxyUrl(destUrl);

    strictEqual(proxyUrl, 'http://' + PROXY_HOST + '/sessionId/' + destUrl);
});

test('undefined or null', function () {
    // NOTE: In Safari, a.href = null  leads to the empty url, not <current_url>/null.
    if (!browserUtils.isSafari)
        strictEqual(getProxyUrl(null), 'http://' + PROXY_HOST + '/sessionId/https://example.com/null');

    strictEqual(getProxyUrl(void 0), 'http://' + PROXY_HOST + '/sessionId/https://example.com/undefined');
});

test('remove unnecessary slashes form the begin of the url', function () {
    var proxy = urlUtils.getProxyUrl('/////example.com', {
        proxyHostname: 'localhost',
        proxyPort:     '5555',
        sessionId:     'sessionId',
        resourceType:  'resourceType'
    });

    strictEqual(proxy, 'http://localhost:5555/sessionId!resourceType/https://example.com');
});

test('convert destination host and protocol to lower case', function () {
    // BUG: GH-1
    var proxy = getProxyUrl('hTtp://eXamPle.Com:123/paTh/Image?Name=Value&#Hash');

    ok(proxy.indexOf('http://example.com:123/paTh/Image?Name=Value&#Hash') !== -1);
});

test('unexpected trailing slash (GH-342)', function () {
    var proxyUrl = getProxyUrl('http://example.com');

    ok(!/\/$/.test(proxyUrl));

    proxyUrl = getProxyUrl('http://example.com/');
    ok(/\/$/.test(proxyUrl));
});

test('special pages (GH-339)', function () {
    sharedUrlUtils.SPECIAL_PAGES.forEach(function (url) {
        var proxyUrl = getProxyUrl(url);

        strictEqual(proxyUrl, 'http://' + PROXY_HOST + '/sessionId/' + url);
    });
});

test('convert a charset to lower case (GH-752)', function () {
    var url  = 'http://example.com';
    var opts = {
        sessionId:     'sessionId',
        charset:       'UTF-8',
        proxyHostname: 'localhost',
        proxyPort:     '5555'
    };

    strictEqual(sharedUrlUtils.getProxyUrl(url, opts), 'http://localhost:5555/sessionId!utf-8/' + url);
});

module('parse proxy url');

test('http', function () {
    var proxyUrl      = 'http://' + PROXY_HOST + '/sessionId/http://test.example.com:53/PA/TH/?#testHash';
    var parsingResult = urlUtils.parseProxyUrl(proxyUrl);

    strictEqual(parsingResult.destUrl, 'http://test.example.com:53/PA/TH/?#testHash');
    strictEqual(parsingResult.destResourceInfo.protocol, 'http:');
    strictEqual(parsingResult.destResourceInfo.host, 'test.example.com:53');
    strictEqual(parsingResult.destResourceInfo.hostname, 'test.example.com');
    strictEqual(parsingResult.destResourceInfo.port, '53');
    strictEqual(parsingResult.destResourceInfo.partAfterHost, '/PA/TH/?#testHash');
    strictEqual(parsingResult.sessionId, 'sessionId');
});

test('https', function () {
    var proxyUrl      = 'http://' + PROXY_HOST + '/sessionId/https://test.example.com:53/PA/TH/?#testHash';
    var parsingResult = urlUtils.parseProxyUrl(proxyUrl);

    strictEqual(parsingResult.destUrl, 'https://test.example.com:53/PA/TH/?#testHash');
    strictEqual(parsingResult.destResourceInfo.protocol, 'https:');
    strictEqual(parsingResult.destResourceInfo.host, 'test.example.com:53');
    strictEqual(parsingResult.destResourceInfo.hostname, 'test.example.com');
    strictEqual(parsingResult.destResourceInfo.port, '53');
    strictEqual(parsingResult.destResourceInfo.partAfterHost, '/PA/TH/?#testHash');
    strictEqual(parsingResult.sessionId, 'sessionId');
});

test('non-proxy URL', function () {
    var proxyUrl    = 'http://' + PROXY_HOST + '/PA/TH/?someParam=value';
    var destUrlInfo = urlUtils.parseProxyUrl(proxyUrl);

    ok(!destUrlInfo);
});

test('successive question marks', function () {
    var proxyUrl      = 'http://' + PROXY_HOST +
                        '/sessionId/http://test.example.com:53??dirs/???files/&#testHash';
    var parsingResult = urlUtils.parseProxyUrl(proxyUrl);

    strictEqual(parsingResult.destUrl, 'http://test.example.com:53??dirs/???files/&#testHash');
    strictEqual(parsingResult.destResourceInfo.protocol, 'http:');
    strictEqual(parsingResult.destResourceInfo.host, 'test.example.com:53');
    strictEqual(parsingResult.destResourceInfo.hostname, 'test.example.com');
    strictEqual(parsingResult.destResourceInfo.port, '53');
    strictEqual(parsingResult.destResourceInfo.partAfterHost, '??dirs/???files/&#testHash');
    strictEqual(parsingResult.sessionId, 'sessionId');
});

test('single question mark', function () {
    var url       = 'http://ac-gb.marketgid.com/p/j/2865/11?';
    var proxyUtrl = urlUtils.getProxyUrl(url, {
        proxyHostname: 'hostname',
        proxyPort:     1111,
        sessionId:     'sessionId'
    });

    strictEqual(url, urlUtils.formatUrl(urlUtils.parseProxyUrl(proxyUtrl).destResourceInfo));
});

test('special pages (GH-339)', function () {
    sharedUrlUtils.SPECIAL_PAGES.forEach(function (url) {
        var proxyUrl      = 'http://' + PROXY_HOST + '/sessionId/' + url;
        var parsingResult = urlUtils.parseProxyUrl(proxyUrl);

        strictEqual(parsingResult.destUrl, url);
        strictEqual(parsingResult.destResourceInfo.protocol, 'about:');
        strictEqual(parsingResult.destResourceInfo.host, '');
        strictEqual(parsingResult.destResourceInfo.hostname, '');
        strictEqual(parsingResult.destResourceInfo.port, '');
        strictEqual(parsingResult.destResourceInfo.partAfterHost, '');
        strictEqual(parsingResult.sessionId, 'sessionId');
    });
});

module('change proxy url');

test('destination URL part', function () {
    var proxyUrl = 'http://localhost:1337/sessionId/http://test.example.com:53/#testHash';
    var changed  = urlUtils.changeDestUrlPart(proxyUrl, 'port', '34');

    strictEqual(changed, 'http://localhost:1337/sessionId/http://test.example.com:34/#testHash');

    changed = urlUtils.changeDestUrlPart(proxyUrl, 'host', 'newhost:99');
    strictEqual(changed, 'http://localhost:1337/sessionId/http://newhost:99/#testHash');

    changed = urlUtils.changeDestUrlPart(proxyUrl, 'hostname', 'newhostname');
    strictEqual(changed, 'http://localhost:1337/sessionId/http://newhostname:53/#testHash');

    changed = urlUtils.changeDestUrlPart(proxyUrl, 'protocol', 'https:');
    strictEqual(changed, 'http://localhost:1337/sessionId/https://test.example.com:53/#testHash');

    changed = urlUtils.changeDestUrlPart(proxyUrl, 'pathname', 'test1.html');
    strictEqual(changed, 'http://localhost:1337/sessionId/http://test.example.com:53/test1.html#testHash');

    changed = urlUtils.changeDestUrlPart(proxyUrl, 'hash', 'newHash');
    strictEqual(changed, 'http://localhost:1337/sessionId/http://test.example.com:53/#newHash');

    changed = urlUtils.changeDestUrlPart(proxyUrl, 'search', '?hl=ru&tab=wn');
    strictEqual(changed, 'http://localhost:1337/sessionId/http://test.example.com:53/?hl=ru&tab=wn#testHash');
});

module('regression');

test('sameOriginCheck for third-level domain (T106172)', function () {
    ok(destLocation.sameOriginCheck('http://www.example.com', 'http://money.example.com'));
});

test('location.port must return the empty string (T262593)', function () {
    /* eslint-disable no-undef */
    eval(processScript([
        // NOTE: From att.com, iframesrc === https://att.com:null/?IFRAME.
        'var port = (document.location.port == "") ? "" : (":" + document.location.port);',
        'var iframesrc = document.location.protocol + "//" + document.location.hostname + port + "/" + "?IFRAME";'
    ].join('\n')));

    strictEqual(iframesrc, 'https://example.com/?IFRAME');
    /* eslint-enable no-undef */
});

test('a correct proxy URL should be obtained from a destination that has a URL in its path (GH-471)', function () {
    var destUrl  = 'https://example.com/path/path/sdfjhsdkjf/http://example.com/image.png';
    var proxyUrl = getProxyUrl(destUrl);

    strictEqual(proxyUrl, 'http://' + PROXY_HOST + '/sessionId/' + destUrl);
});

module('getProxyUrl in a document with "base" tag');

test('add, update and remove the "base" tag (GH-371)', function () {
    strictEqual(getProxyUrl('image.png'), 'http://' + PROXY_HOST + '/sessionId/https://example.com/image.png');

    var baseEl = document.createElement('base');

    strictEqual(getProxyUrl('image.png'), 'http://' + PROXY_HOST + '/sessionId/https://example.com/image.png');

    baseEl.setAttribute('href', 'http://subdomain.example.com');
    document.head.appendChild(baseEl);

    strictEqual(getProxyUrl('image.png'), 'http://' + PROXY_HOST + '/sessionId/http://subdomain.example.com/image.png');

    baseEl.setAttribute('href', 'http://example2.com');
    strictEqual(getProxyUrl('image.png'), 'http://' + PROXY_HOST + '/sessionId/http://example2.com/image.png');

    baseEl.removeAttribute('href');
    strictEqual(getProxyUrl('image.png'), 'http://' + PROXY_HOST + '/sessionId/https://example.com/image.png');

    baseEl.parentNode.removeChild(baseEl);

    strictEqual(getProxyUrl('image.png'), 'http://' + PROXY_HOST + '/sessionId/https://example.com/image.png');
});

asyncTest('recreating a document with the "base" tag (GH-371)', function () {
    var iframe = document.createElement('iframe');
    var src    = window.QUnitGlobals.getResourceUrl('../../data/same-domain/resolving-url-after-document-recreation.html');

    iframe.id = 'test_ojfnnhsg43';
    iframe.setAttribute('src', src);
    window.QUnitGlobals.waitForIframe(iframe)
        .then(function () {
            var iframeDocument = iframe.contentDocument;
            var link           = iframeDocument.getElementsByTagName('a')[0];
            var proxyUrl       = 'http://' + location.hostname + ':' + location.port +
                                 '/sessionId!i!' + iframe.contentWindow.name +
                                 '/http://subdomain.example.com/index.html';

            strictEqual(link.href, proxyUrl);
            iframe.parentNode.removeChild(iframe);
            start();
        });
    document.body.appendChild(iframe);
});

test('setting up an href attribute for a non-added to DOM "base" tag should not cause urlResolver to update. (GH-415)', function () {
    var baseEl = document.createElement('base');

    baseEl.setAttribute('href', 'http://subdomain.example.com');

    strictEqual(getProxyUrl('image.png'), 'http://' + PROXY_HOST + '/sessionId/https://example.com/image.png');
});

test('"base" tag with an empty href attribute (GH-422)', function () {
    var base = document.createElement('base');

    document.head.appendChild(base);

    strictEqual(getProxyUrl('image.png'), 'http://' + PROXY_HOST + '/sessionId/https://example.com/image.png');

    base.setAttribute('href', '');

    strictEqual(getProxyUrl('image.png'), 'http://' + PROXY_HOST + '/sessionId/https://example.com/image.png');
});

test('"base" tag with an href attribute that is set to a relative url (GH-422)', function () {
    var base = document.createElement('base');

    document.head.appendChild(base);
    base.setAttribute('href', '/test1/test2/test3');
    strictEqual(getProxyUrl('../image.png'), 'http://' + PROXY_HOST + '/sessionId/https://example.com/test1/image.png');
    base.parentNode.removeChild(base);
});

asyncTest('resolving url after writing the "base" tag (GH-526)', function () {
    var iframe = document.createElement('iframe');
    var src    = window.QUnitGlobals.getResourceUrl('../../data/same-domain/resolving-url-after-writing-base-tag.html');

    iframe.id = 'test';
    iframe.setAttribute('src', src);
    window.QUnitGlobals.waitForIframe(iframe)
        .then(function () {
            strictEqual(iframe.contentDocument.querySelector('a').href,
                urlUtils.getProxyUrl('http://example.com/relative', {
                    proxyHostname: location.hostname,
                    proxyPort:     location.port,
                    sessionId:     'sessionId',
                    target:        iframe.contentWindow.name,
                    resourceType:  'i'
                }));

            iframe.parentNode.removeChild(iframe);
            start();
        });
    document.body.appendChild(iframe);
});

test('"base" tag with an href attribute that is set to a protocol relative url (GH-568)', function () {
    var base = document.createElement('base');

    document.head.appendChild(base);
    base.setAttribute('href', '//test.com');

    strictEqual(getProxyUrl('/image.png'), 'http://' + PROXY_HOST + '/sessionId/https://test.com/image.png');
    base.parentNode.removeChild(base);
});

test('resolving a url in a tag that is written along with a "base" tag (GH-644)', function () {
    var iframe = document.createElement('iframe');

    iframe.id = 'test902345';

    document.body.appendChild(iframe);

    iframe.contentDocument.write(
        '<base href="/subpath/"/>',
        '<!DOCTYPE html>',
        '<html>',
        '<head><script src="scripts/scr.js"><\/script></head>',
        '...',
        '</html>'
    );

    strictEqual(iframe.contentDocument.querySelector('script').src, urlUtils.getProxyUrl('https://example.com/subpath/scripts/scr.js', { resourceType: 's' }));
    document.body.removeChild(iframe);
});
