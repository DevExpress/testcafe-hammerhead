var settings       = hammerhead.get('./settings');
var sharedUrlUtils = hammerhead.get('../utils/url');
var urlUtils       = hammerhead.get('./utils/url');
var destLocation   = hammerhead.get('./utils/destination-location');

var browserUtils = hammerhead.utils.browser;

var PROXY_PORT     = 1337;
var PROXY_HOSTNAME = '127.0.0.1';
var PROXY_HOST     = PROXY_HOSTNAME + ':' + PROXY_PORT;

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
    var newUrl   = urlUtils.getProxyUrl(proxyUrl, PROXY_HOSTNAME, PROXY_PORT, 'sessionId', 'iframe');

    strictEqual(urlUtils.parseProxyUrl(newUrl).resourceType, 'iframe');

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

test('destination with non http or https protocol', function () {
    expect(2);

    var destUrl = 'someProtocol://test.example.com:53/';

    try {
        urlUtils.getProxyUrl(destUrl, PROXY_HOSTNAME, PROXY_PORT);
    }
    catch (err) {
        strictEqual(err.code, sharedUrlUtils.URL_UTIL_PROTOCOL_IS_NOT_SUPPORTED);
        strictEqual(err.destUrl.toLowerCase(), destUrl.toLowerCase());
    }
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
    var a        = document.createElement('a');
    var proxyUrl = urlUtils.getProxyUrl(null, PROXY_HOSTNAME, PROXY_PORT, 'sessionId');

    // NOTE: In Safari, a.href = null  leads to the current url, not <current_url>/null.
    if (!browserUtils.isSafari) {
        a.href = null;
        strictEqual(proxyUrl, urlUtils.getProxyUrl(a.href, PROXY_HOSTNAME, PROXY_PORT, 'sessionId'), 'null');
    }

    proxyUrl = urlUtils.getProxyUrl(void 0, PROXY_HOSTNAME, PROXY_PORT, 'sessionId');
    a.href   = void 0;
    strictEqual(proxyUrl, urlUtils.getProxyUrl(a.href, PROXY_HOSTNAME, PROXY_PORT, 'sessionId'), 'undefined');
});

test('remove unnecessary slashes form the begin of the url', function () {
    var proxy = urlUtils.getProxyUrl('/////example.com', 'localhost', '5555', 'sessionId', 'resourceType');

    strictEqual(proxy, 'http://localhost:5555/sessionId!resourceType/https://example.com/');
});

test('convert destination host and protocol to lower case', function () {
    // BUG: GH-1
    var proxy = urlUtils.getProxyUrl('hTtp://eXamPle.Com:123/paTh/Image?Name=Value&#Hash');

    ok(proxy.indexOf('http://example.com:123/paTh/Image?Name=Value&#Hash') !== -1);
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
