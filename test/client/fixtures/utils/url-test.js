var settings       = hammerhead.get('./settings');
var urlUtils       = hammerhead.get('./utils/url');
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

test('getCrossDomainProxyUrl', function () {
    var storedCrossDomainport = settings.get().crossDomainProxyPort;

    settings.get().crossDomainProxyPort = '5555';

    strictEqual(urlUtils.getCrossDomainProxyUrl(), 'http://' + location.hostname + ':5555/');

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
    strictEqual(urlUtils.formatUrl({ hostname: 'localhost', port: '1400', protocol: 'http:' }), 'http://localhost:1400');

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

module('get proxy url');

test('already proxied', function () {
    var destUrl  = 'http://test.example.com/';
    var proxyUrl = urlUtils.getProxyUrl(destUrl, PROXY_HOSTNAME, PROXY_PORT, 'sessionId');
    var newUrl   = urlUtils.getProxyUrl(proxyUrl, PROXY_HOSTNAME, PROXY_PORT, 'sessionId', 'i');

    strictEqual(urlUtils.parseProxyUrl(newUrl).resourceType, 'i');

});

test('destination with query, path, hash and host', function () {
    var destUrl  = 'http://test.example.com/pa/th/Page?param1=value&param2=&param3#testHash';
    var proxyUrl = urlUtils.getProxyUrl(destUrl, PROXY_HOSTNAME, PROXY_PORT, 'sessionId');

    strictEqual(proxyUrl, 'http://' + PROXY_HOST + '/sessionId/' + destUrl);
});

test('destination with host only', function () {
    var destUrl  = 'http://test.example.com/';
    var proxyUrl = urlUtils.getProxyUrl(destUrl, PROXY_HOSTNAME, PROXY_PORT, 'sessionId');

    strictEqual(proxyUrl, 'http://' + PROXY_HOST + '/sessionId/' + destUrl);
});

test('destination with https protocol', function () {
    var destUrl  = 'https://test.example.com:53/';
    var proxyUrl = urlUtils.getProxyUrl(destUrl, PROXY_HOSTNAME, PROXY_PORT, 'sessionId');

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
    var proxyUrl = urlUtils.getProxyUrl(destUrl, '127.0.0.1', PROXY_PORT, 'sessionId');

    strictEqual(proxyUrl, 'http://' + PROXY_HOST + '/sessionId/' + destUrl);
});

test('destination with port', function () {
    var destUrl  = 'http://test.example.com:53/';
    var proxyUrl = urlUtils.getProxyUrl(destUrl, PROXY_HOSTNAME, PROXY_PORT, 'sessionId');

    strictEqual(proxyUrl, 'http://' + PROXY_HOST + '/sessionId/' + destUrl);
});

test('undefined or null', function () {
    // NOTE: In Safari, a.href = null  leads to the empty url, not <current_url>/null.
    if (!browserUtils.isSafari) {
        strictEqual(urlUtils.getProxyUrl(null, PROXY_HOSTNAME, PROXY_PORT, 'sessionId'),
                    'http://' + PROXY_HOST + '/sessionId/https://example.com/null');
    }

    strictEqual(urlUtils.getProxyUrl(void 0, PROXY_HOSTNAME, PROXY_PORT, 'sessionId'),
                'http://' + PROXY_HOST + '/sessionId/https://example.com/undefined');
});

test('remove unnecessary slashes form the begin of the url', function () {
    var proxy = urlUtils.getProxyUrl('/////example.com', 'localhost', '5555', 'sessionId', 'resourceType');

    strictEqual(proxy, 'http://localhost:5555/sessionId!resourceType/https://example.com');
});

test('convert destination host and protocol to lower case', function () {
    // BUG: GH-1
    var proxy = urlUtils.getProxyUrl('hTtp://eXamPle.Com:123/paTh/Image?Name=Value&#Hash');

    ok(proxy.indexOf('http://example.com:123/paTh/Image?Name=Value&#Hash') !== -1);
});

test('unexpected trailing slash (GH-342)', function () {
    var proxyUrl = urlUtils.getProxyUrl('http://example.com');

    ok(!/\/$/.test(proxyUrl));

    proxyUrl = urlUtils.getProxyUrl('http://example.com/');
    ok(/\/$/.test(proxyUrl));
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
    var proxyUrl      = 'http://' + PROXY_HOST + '/PA/TH/?someParam=value';
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
    var proxyUtrl = urlUtils.getProxyUrl(url, 'hostname', 1111, 'sessionId');

    strictEqual(url, urlUtils.formatUrl(urlUtils.parseProxyUrl(proxyUtrl).destResourceInfo));
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

module('getProxyUrl in a document with "base" tag');

test('add, update and remove the "base" tag (GH-371)', function () {
    strictEqual(urlUtils.getProxyUrl('image.png', PROXY_HOSTNAME, PROXY_PORT, 'sessionId'),
                'http://' + PROXY_HOST + '/sessionId/https://example.com/image.png');

    var baseEl = document.createElement('base');

    strictEqual(urlUtils.getProxyUrl('image.png', PROXY_HOSTNAME, PROXY_PORT, 'sessionId'),
                'http://' + PROXY_HOST + '/sessionId/https://example.com/image.png');

    baseEl.setAttribute('href', 'http://subdomain.example.com');
    document.head.appendChild(baseEl);

    strictEqual(urlUtils.getProxyUrl('image.png', PROXY_HOSTNAME, PROXY_PORT, 'sessionId'),
                'http://' + PROXY_HOST + '/sessionId/http://subdomain.example.com/image.png');

    baseEl.setAttribute('href', 'http://example2.com');
    strictEqual(urlUtils.getProxyUrl('image.png', PROXY_HOSTNAME, PROXY_PORT, 'sessionId'),
                'http://' + PROXY_HOST + '/sessionId/http://example2.com/image.png');

    baseEl.removeAttribute('href');
    strictEqual(urlUtils.getProxyUrl('image.png', PROXY_HOSTNAME, PROXY_PORT, 'sessionId'),
                'http://' + PROXY_HOST + '/sessionId/https://example.com/image.png');

    baseEl.parentNode.removeChild(baseEl);

    strictEqual(urlUtils.getProxyUrl('image.png', PROXY_HOSTNAME, PROXY_PORT, 'sessionId'),
                'http://' + PROXY_HOST + '/sessionId/https://example.com/image.png');
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
                                 '/sessionId!i/http://subdomain.example.com/index.html';

            strictEqual(link.href, proxyUrl);
            iframe.parentNode.removeChild(iframe);
            start();
        });
    document.body.appendChild(iframe);
});

test('setting up an href attribute for a non-added to DOM "base" tag should not cause urlResolver to update. (GH-415)', function () {
    var baseEl = document.createElement('base');

    baseEl.setAttribute('href', 'http://subdomain.example.com');

    strictEqual(urlUtils.getProxyUrl('image.png', PROXY_HOSTNAME, PROXY_PORT, 'sessionId'),
                'http://' + PROXY_HOST + '/sessionId/https://example.com/image.png');
});

test('"base" tag with an empty href attribute (GH-422)', function () {
    var base = document.createElement('base');

    document.head.appendChild(base);

    strictEqual(urlUtils.getProxyUrl('image.png', PROXY_HOSTNAME, PROXY_PORT, 'sessionId'),
                'http://' + PROXY_HOST + '/sessionId/https://example.com/image.png');

    base.setAttribute('href', '');

    strictEqual(urlUtils.getProxyUrl('image.png', PROXY_HOSTNAME, PROXY_PORT, 'sessionId'),
                'http://' + PROXY_HOST + '/sessionId/https://example.com/image.png');
});

test('"base" tag with an href attribute that is set to a relative url (GH-422)', function () {
    var base = document.createElement('base');

    document.head.appendChild(base);
    base.setAttribute('href', '/test1/test2/test3');

    strictEqual(urlUtils.getProxyUrl('../image.png', PROXY_HOSTNAME, PROXY_PORT, 'sessionId'),
                'http://' + PROXY_HOST + '/sessionId/https://example.com/test1/image.png');

    base.parentNode.removeChild(base);
});
