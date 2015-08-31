var Browser       = Hammerhead.get('./utils/browser');
var Settings      = Hammerhead.get('./settings');
var SharedUrlUtil = Hammerhead.get('../utils/url');
var UrlUtil       = Hammerhead.get('./utils/url');

var PROXY_PORT     = 1337;
var PROXY_HOSTNAME = '127.0.0.1';
var PROXY_HOST     = PROXY_HOSTNAME + ':' + PROXY_PORT;

test('getCrossDomainProxyUrl', function () {
    var storedCrossDomainport = Settings.get().CROSS_DOMAIN_PROXY_PORT;

    Settings.get().CROSS_DOMAIN_PROXY_PORT = '5555';

    strictEqual(UrlUtil.getCrossDomainProxyUrl(), 'http://' + location.hostname + ':5555/');

    Settings.get().CROSS_DOMAIN_PROXY_PORT = storedCrossDomainport;
});

test('sameOriginCheck', function () {
    ok(UrlUtil.sameOriginCheck('http://proxy/token!uid/http://origin.com:111/index.html', 'http://origin.com:111/index.php'));
    ok(UrlUtil.sameOriginCheck('http://proxy/token!uid/http://origin.com:111/index.html', 'http://sub.origin.com:111/index.php'));
    ok(UrlUtil.sameOriginCheck('http://proxy/token!uid/http://origin.com:111/index.html', 'http://sub1.sub2.origin.com:111/index.php'));
    ok(UrlUtil.sameOriginCheck('http://proxy/token!uid/http://sub.origin.com:111/index.html', 'http://origin.com:111/index.php'));
    ok(UrlUtil.sameOriginCheck('http://proxy/token!uid/http://sub.origin.com:111/index.html', 'http://proxy/index.php'));
    ok(UrlUtil.sameOriginCheck('http://proxy/token!uid/http://www.origin.com/index.html', 'http://origin.com/'));
    ok(!UrlUtil.sameOriginCheck('http://proxy/token!uid/http://origin.com:111/index.html', 'http://origin.com/index.php'));
    ok(!UrlUtil.sameOriginCheck('http://proxy/token!uid/http://sub.origin.com:111/index.html', 'http://location:111/index.php'));
    ok(!UrlUtil.sameOriginCheck('http://proxy/token!uid/http://sub.origin.com:111/index.html', 'https://location/index.php'));
    ok(!UrlUtil.sameOriginCheck('http://proxy/token!uid/http://origin.com:111/index.html', 'http://origin.com:222/index.php'));
    ok(!UrlUtil.sameOriginCheck('http://proxy/token!uid/http://origin.com:111/index.html', 'https://origin.com:111/index.php'));
    ok(!UrlUtil.sameOriginCheck('http://proxy/token!uid/http://origin.com:111/index.html', 'http://origin2.com:111/index.php'));
});

test('resolveUrl', function () {
    strictEqual(UrlUtil.resolveUrl('//domain.com/index.php'), 'https://domain.com/index.php');
    strictEqual(UrlUtil.resolveUrl('//dom\n\tain.com/index.php'), 'https://domain.com/index.php');
    strictEqual(UrlUtil.resolveUrl(location), location.toString());
});

test('resolveUrlAsOrigin', function () {
    strictEqual(UrlUtil.resolveUrlAsOrigin('/index.html#hash'), 'https://example.com/index.html#hash');
    strictEqual(UrlUtil.resolveUrlAsOrigin('javascript:0;'), 'javascript:0;');
    strictEqual(UrlUtil.resolveUrlAsOrigin('/index.html?param=value#hash'), 'https://example.com/index.html?param=value#hash');
    strictEqual(UrlUtil.resolveUrlAsOrigin('https://twitter.com/index.html?param=value#hash'), 'https://twitter.com/index.html?param=value#hash');
    strictEqual(UrlUtil.resolveUrlAsOrigin('//twitter.com/index.html?param=value#hash'), 'https://twitter.com/index.html?param=value#hash');
    strictEqual(UrlUtil.resolveUrlAsOrigin('http://g.tbcdn.cn/??kissy/k/1.4.2/seed-min.js'), 'http://g.tbcdn.cn/??kissy/k/1.4.2/seed-min.js');
});

module('parse url');

test('newline characters', function () {
    var url           = 'http://exa\nmple.com/?par\n=val';
    var parsingResult = UrlUtil.parseUrl(url);

    strictEqual(parsingResult.hostname, 'example.com');
    strictEqual(parsingResult.partAfterHost, '/?par=val');
});

test('tabulation characters', function () {
    var url           = 'http://exa\tmple.com/?par\t=val';
    var parsingResult = UrlUtil.parseUrl(url);

    strictEqual(parsingResult.hostname, 'example.com');
    strictEqual(parsingResult.partAfterHost, '/?par=val');
});

test('hash after host', function () {
    var url           = '//test.example.com#42';
    var parsingResult = UrlUtil.parseUrl(url);

    ok(!parsingResult.protocol);
    strictEqual(parsingResult.hostname, 'test.example.com');
    strictEqual(parsingResult.partAfterHost, '#42');

});

test('question mark disappears', function () {
    var url       = 'http://google.ru:345/path?';
    var parsedUrl = UrlUtil.parseUrl(url);

    strictEqual(parsedUrl.partAfterHost, '/path?');
    strictEqual(UrlUtil.formatUrl(parsedUrl), url);

    url       = 'http://yandex.ru:234/path';
    parsedUrl = UrlUtil.parseUrl(url);

    strictEqual(parsedUrl.partAfterHost, '/path');
    strictEqual(UrlUtil.formatUrl(parsedUrl), url);
});

module('get proxy url');

test('already proxied', function () {
    var originUrl = 'http://test.example.com/';
    var proxyUrl  = UrlUtil.getProxyUrl(originUrl, PROXY_HOSTNAME, PROXY_PORT, 'sessionId');
    var newUrl    = UrlUtil.getProxyUrl(proxyUrl, PROXY_HOSTNAME, PROXY_PORT, 'sessionId', 'iframe');

    strictEqual(UrlUtil.parseProxyUrl(newUrl).resourceType, 'iframe');

});

test('origin with query, path, hash and host', function () {
    var originUrl = 'http://test.example.com/pa/th/Page?param1=value&param2=&param3#testHash';
    var proxyUrl  = UrlUtil.getProxyUrl(originUrl, PROXY_HOSTNAME, PROXY_PORT, 'sessionId');

    strictEqual(proxyUrl, 'http://' + PROXY_HOST + '/sessionId/' + originUrl);
});

test('origin with host only', function () {
    var originUrl = 'http://test.example.com/';
    var proxyUrl  = UrlUtil.getProxyUrl(originUrl, PROXY_HOSTNAME, PROXY_PORT, 'sessionId');

    strictEqual(proxyUrl, 'http://' + PROXY_HOST + '/sessionId/' + originUrl);
});

test('origin with https protocol', function () {
    var originUrl = 'https://test.example.com:53/';
    var proxyUrl  = UrlUtil.getProxyUrl(originUrl, PROXY_HOSTNAME, PROXY_PORT, 'sessionId');

    strictEqual(proxyUrl, 'http://' + PROXY_HOST + '/sessionId/' + originUrl);
});

test('origin with non http or https protocol', function () {
    expect(2);

    var originUrl = 'someProtocol://test.example.com:53/';

    try {
        UrlUtil.getProxyUrl(originUrl, PROXY_HOSTNAME, PROXY_PORT);
    }
    catch (err) {
        strictEqual(err.code, SharedUrlUtil.URL_UTIL_PROTOCOL_IS_NOT_SUPPORTED);
        strictEqual(err.originUrl.toLowerCase(), originUrl.toLowerCase());
    }
});

test('relative path', function () {
    var originUrl = '/Image1.jpg';
    var proxyUrl  = UrlUtil.getProxyUrl(originUrl);

    strictEqual(proxyUrl, 'http://' + location.host + '/sessionId/https://example.com/Image1.jpg');

    var relativeUrl = 'share?id=1kjQMWh7IcHdTBbTv6otRvCGYr-p02q206M7aR7dmog0';
    var parsedUrl   = UrlUtil.parseUrl(relativeUrl);

    ok(!parsedUrl.hostname);
    ok(!parsedUrl.host);
    ok(!parsedUrl.hash);
    ok(!parsedUrl.port);
    ok(!parsedUrl.protocol);
    strictEqual(parsedUrl.partAfterHost, 'share?id=1kjQMWh7IcHdTBbTv6otRvCGYr-p02q206M7aR7dmog0');
});

test('contains successive question marks in query', function () {
    var originUrl = 'http://test.example.com/??dirs/???files/';
    var proxyUrl  = UrlUtil.getProxyUrl(originUrl, '127.0.0.1', PROXY_PORT, 'sessionId');

    strictEqual(proxyUrl, 'http://' + PROXY_HOST + '/sessionId/' + originUrl);
});

test('origin with port', function () {
    var originUrl = 'http://test.example.com:53/';
    var proxyUrl  = UrlUtil.getProxyUrl(originUrl, PROXY_HOSTNAME, PROXY_PORT, 'sessionId');

    strictEqual(proxyUrl, 'http://' + PROXY_HOST + '/sessionId/' + originUrl);
});

test('undefined or null', function () {
    var a        = document.createElement('a');
    var proxyUrl = UrlUtil.getProxyUrl(null, PROXY_HOSTNAME, PROXY_PORT, 'sessionId');

    //In Safari a.href = null will equal the current url instead <current_url>/null
    if (!Browser.isSafari) {
        a.href = null;
        strictEqual(proxyUrl, UrlUtil.getProxyUrl(a.href, PROXY_HOSTNAME, PROXY_PORT, 'sessionId'), 'null');
    }

    proxyUrl = UrlUtil.getProxyUrl(void 0, PROXY_HOSTNAME, PROXY_PORT, 'sessionId');
    a.href   = void 0;
    strictEqual(proxyUrl, UrlUtil.getProxyUrl(a.href, PROXY_HOSTNAME, PROXY_PORT, 'sessionId'), 'undefined');
});

test('remove unnecessary slashes form the begin of the url', function () {
    var proxy = UrlUtil.getProxyUrl('/////example.com', 'localhost', '5555', 'sessionId', 'resourceType');

    strictEqual(proxy, 'http://localhost:5555/sessionId!resourceType/https://example.com/');
});

test('convert origin host and protocol to lower case', function () {
    // BUG: https://github.com/superroma/testcafe-hammerhead/issues/1
    var proxy = UrlUtil.getProxyUrl('hTtp://eXamPle.Com:123/paTh/Image?Name=Value&#Hash');

    ok(proxy.indexOf('http://example.com:123/paTh/Image?Name=Value&#Hash') !== -1);
});

module('parse proxy url');

test('http', function () {
    var proxyUrl      = 'http://' + PROXY_HOST + '/sessionId/http://test.example.com:53/PA/TH/?#testHash';
    var parsingResult = UrlUtil.parseProxyUrl(proxyUrl);

    strictEqual(parsingResult.originUrl, 'http://test.example.com:53/PA/TH/?#testHash');
    strictEqual(parsingResult.originResourceInfo.protocol, 'http:');
    strictEqual(parsingResult.originResourceInfo.host, 'test.example.com:53');
    strictEqual(parsingResult.originResourceInfo.hostname, 'test.example.com');
    strictEqual(parsingResult.originResourceInfo.port, '53');
    strictEqual(parsingResult.originResourceInfo.partAfterHost, '/PA/TH/?#testHash');
    strictEqual(parsingResult.sessionId, 'sessionId');
});

test('https', function () {
    var proxyUrl      = 'http://' + PROXY_HOST + '/sessionId/https://test.example.com:53/PA/TH/?#testHash';
    var parsingResult = UrlUtil.parseProxyUrl(proxyUrl);

    strictEqual(parsingResult.originUrl, 'https://test.example.com:53/PA/TH/?#testHash');
    strictEqual(parsingResult.originResourceInfo.protocol, 'https:');
    strictEqual(parsingResult.originResourceInfo.host, 'test.example.com:53');
    strictEqual(parsingResult.originResourceInfo.hostname, 'test.example.com');
    strictEqual(parsingResult.originResourceInfo.port, '53');
    strictEqual(parsingResult.originResourceInfo.partAfterHost, '/PA/TH/?#testHash');
    strictEqual(parsingResult.sessionId, 'sessionId');
});

test('non-proxy URL', function () {
    var proxyUrl      = 'http://' + PROXY_HOST + '/PA/TH/?someParam=value';
    var originUrlInfo = UrlUtil.parseProxyUrl(proxyUrl);

    ok(!originUrlInfo);
});

test('successive question marks', function () {
    var proxyUrl      = 'http://' + PROXY_HOST +
                        '/sessionId/http://test.example.com:53??dirs/???files/&#testHash';
    var parsingResult = UrlUtil.parseProxyUrl(proxyUrl);

    strictEqual(parsingResult.originUrl, 'http://test.example.com:53??dirs/???files/&#testHash');
    strictEqual(parsingResult.originResourceInfo.protocol, 'http:');
    strictEqual(parsingResult.originResourceInfo.host, 'test.example.com:53');
    strictEqual(parsingResult.originResourceInfo.hostname, 'test.example.com');
    strictEqual(parsingResult.originResourceInfo.port, '53');
    strictEqual(parsingResult.originResourceInfo.partAfterHost, '??dirs/???files/&#testHash');
    strictEqual(parsingResult.sessionId, 'sessionId');
});

test('single question mark', function () {
    var url       = 'http://ac-gb.marketgid.com/p/j/2865/11?';
    var proxyUtrl = UrlUtil.getProxyUrl(url, 'hostname', 1111, 'sessionId');

    strictEqual(url, UrlUtil.formatUrl(UrlUtil.parseProxyUrl(proxyUtrl).originResourceInfo));
});

module('change proxy url');

test('origin URL part', function () {
    var proxyUrl = 'http://localhost:1337/sessionId/http://test.example.com:53/#testHash';
    var changed  = UrlUtil.changeOriginUrlPart(proxyUrl, 'port', '34');

    strictEqual(changed, 'http://localhost:1337/sessionId/http://test.example.com:34/#testHash');

    changed = UrlUtil.changeOriginUrlPart(proxyUrl, 'host', 'newhost:99');
    strictEqual(changed, 'http://localhost:1337/sessionId/http://newhost:99/#testHash');

    changed = UrlUtil.changeOriginUrlPart(proxyUrl, 'hostname', 'newhostname');
    strictEqual(changed, 'http://localhost:1337/sessionId/http://newhostname:53/#testHash');

    changed = UrlUtil.changeOriginUrlPart(proxyUrl, 'protocol', 'https:');
    strictEqual(changed, 'http://localhost:1337/sessionId/https://test.example.com:53/#testHash');

    changed = UrlUtil.changeOriginUrlPart(proxyUrl, 'pathname', 'test1.html');
    strictEqual(changed, 'http://localhost:1337/sessionId/http://test.example.com:53/test1.html#testHash');

    changed = UrlUtil.changeOriginUrlPart(proxyUrl, 'hash', 'newHash');
    strictEqual(changed, 'http://localhost:1337/sessionId/http://test.example.com:53/#newHash');

    changed = UrlUtil.changeOriginUrlPart(proxyUrl, 'search', '?hl=ru&tab=wn');
    strictEqual(changed, 'http://localhost:1337/sessionId/http://test.example.com:53/?hl=ru&tab=wn#testHash');
});

module('regression');

test('sameOriginCheck for third-level domain (T106172)', function () {
    ok(UrlUtil.sameOriginCheck('http://www.example.com', 'http://money.example.com'));
});

test('location.port must return the empty string (T262593)', function () {
    /* eslint-disable no-undef */
    eval(processScript([
        // code from att.com, iframesrc === https://att.com:null/?IFRAME
        'var port = (document.location.port == "") ? "" : (":" + document.location.port);',
        'var iframesrc = document.location.protocol + "//" + document.location.hostname + port + "/" + "?IFRAME";'
    ].join('\n')));

    strictEqual(iframesrc, 'https://example.com/?IFRAME');
    /* eslint-enable no-undef */
});
