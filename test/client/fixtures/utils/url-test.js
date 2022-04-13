var settings       = hammerhead.settings;
var urlUtils       = hammerhead.utils.url;
var sharedUrlUtils = hammerhead.sharedUtils.url;
var destLocation   = hammerhead.utils.destLocation;

var browserUtils  = hammerhead.utils.browser;
var nativeMethods = hammerhead.nativeMethods;
var nodeSandbox   = hammerhead.sandbox.node;
var Promise       = hammerhead.Promise;

var PROXY_PORT     = 1337;
var PROXY_HOSTNAME = '127.0.0.1';
var PROXY_HOST     = PROXY_HOSTNAME + ':' + PROXY_PORT;

function getProxyUrl (url, resourceType, protocol, windowId) {
    return urlUtils.getProxyUrl(url, {
        proxyHostname: PROXY_HOSTNAME,
        proxyPort:     PROXY_PORT,
        sessionId:     'sessionId',
        resourceType:  resourceType,
        proxyProtocol: protocol || 'http:',
        windowId:      windowId,
    });
}

test('getCrossDomainIframeProxyUrl (GH-749)', function () {
    var destUrl               = 'test.html';
    var storedCrossDomainport = settings.get().crossDomainProxyPort;

    settings.get().crossDomainProxyPort = '5555';

    strictEqual(urlUtils.getCrossDomainIframeProxyUrl(destUrl),
        'http://' + location.hostname + ':5555' + '/sessionId!i!s*example.com/https://example.com/' + destUrl);

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
    ok(urlUtils.isSupportedProtocol('file:///C:/index.htm'));
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
        protocol: 'http:',
    }), 'http://localhost:1400');

    var parsedUrl = {
        hostname: 'localhost',
        port:     '1400',
        protocol: 'http:',
        auth:     'test:test',
    };

    strictEqual(urlUtils.formatUrl(parsedUrl), 'http://test:test@localhost:1400');

    parsedUrl = {
        hostname:      'localhost',
        port:          '1400',
        protocol:      'http:',
        auth:          'test',
        partAfterHost: '/path',
    };
    strictEqual(urlUtils.formatUrl(parsedUrl), 'http://test@localhost:1400/path');
});

test('isRelativeUrl', function () {
    ok(!sharedUrlUtils.isRelativeUrl('http://example.com'));
    ok(sharedUrlUtils.isRelativeUrl('/test.html'));
    ok(!sharedUrlUtils.isRelativeUrl('file:///C:/index.htm'));
    ok(sharedUrlUtils.isRelativeUrl('C:\\index.htm'));
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

test('auth', function () {
    strictEqual(urlUtils.parseUrl('http://username:password@example.com').auth, 'username:password');
    strictEqual(urlUtils.parseUrl('http://username@example.com').auth, 'username');
    strictEqual(urlUtils.parseUrl('http://example.com').auth, void 0);
});

test('scope', function () {
    strictEqual(urlUtils.getScope('http://example.com'), '/');
    strictEqual(urlUtils.getScope('http://example.com/'), '/');
    strictEqual(urlUtils.getScope('http://example.com/img.gif'), '/');
    strictEqual(urlUtils.getScope('http://example.com/path/to/ws.js'), '/path/to/');
    strictEqual(urlUtils.getScope('http://example.com/path/?z=9'), '/path/');
    strictEqual(urlUtils.getScope('http://example.com/path?z=9'), '/');
    strictEqual(urlUtils.getScope('/path/?z=9'), '/path/');
    strictEqual(urlUtils.getScope('../path/sw.js'), '/path/');

    // GH-2524
    strictEqual(urlUtils.getScope('http://example.com/path/sw.js?https://some.url/another-path'), '/path/');
    strictEqual(urlUtils.getScope('/path/sw.js?v=arg=/another-path'), '/path/');
    strictEqual(urlUtils.getScope('/path/sw.js?'), '/path/');
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
    var proxyUrl = urlUtils.getProxyUrl('/Image1.jpg');

    strictEqual(proxyUrl, 'http://' + location.host + '/sessionId/https://example.com/Image1.jpg');

    var parsedUrl = urlUtils.parseUrl('share?id=1kjQMWh7IcHdTBbTv6otRvCGYr-p02q206M7aR7dmog0');

    ok(!parsedUrl.hostname);
    ok(!parsedUrl.host);
    ok(!parsedUrl.hash);
    ok(!parsedUrl.port);
    ok(!parsedUrl.protocol);
    strictEqual(parsedUrl.partAfterHost, 'share?id=1kjQMWh7IcHdTBbTv6otRvCGYr-p02q206M7aR7dmog0');
});

if (window.navigator.platform.toLowerCase() === 'win32' && !browserUtils.isFirefox) {
    test('relative file path', function () {
        var destUrl  = 'C:\\index.htm';
        var proxyUrl = urlUtils.getProxyUrl(destUrl);

        strictEqual(proxyUrl, 'http://' + location.host + '/sessionId/file:///C:/index.htm');
    });
}

test('contains successive question marks in query', function () {
    var destUrl  = 'http://test.example.com/??dirs/???files/';
    var proxyUrl = urlUtils.getProxyUrl(destUrl, {
        proxyHostname: '127.0.0.1',
        proxyPort:     PROXY_PORT,
        sessionId:     'sessionId',
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
        resourceType:  'resourceType',
    });

    strictEqual(proxy, 'http://localhost:5555/sessionId!resourceType/https://example.com');
});

test('should ensure triple starting slashes in a scheme-less file URLs', function () {
    var storedLocation = destLocation.getLocation();

    destLocation.forceLocation(urlUtils.getProxyUrl('file:///home/testcafe/site'));

    var opts = { proxyHostname: 'localhost' };

    strictEqual(urlUtils.getProxyUrl('/////home/testcafe/site2', opts), 'http://localhost:2000/sessionId/file:///home/testcafe/site2');
    strictEqual(urlUtils.getProxyUrl('/////D:/testcafe/site2', opts), 'http://localhost:2000/sessionId/file:///D:/testcafe/site2');
    strictEqual(urlUtils.getProxyUrl('//D:/testcafe/site2', opts), 'http://localhost:2000/sessionId/file:///D:/testcafe/site2');

    destLocation.forceLocation(storedLocation);
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
        proxyPort:     '5555',
    };

    strictEqual(sharedUrlUtils.getProxyUrl(url, opts), 'http://localhost:5555/sessionId!utf-8/' + url);
});

test('windowId', function () {
    var destUrl  = 'http://example.com';
    var proxyUrl = getProxyUrl(destUrl, null, null, '123456789');

    strictEqual(proxyUrl, 'http://' + PROXY_HOST + '/sessionId' + '*123456789/' + destUrl);
});

test('getPageProxyUrl', function () {
    var sameDomainUrl        = 'https://example.com/';
    var crossDomainUrl       = 'https://devexpress.com/';
    var proxySameDomainHost  = location.host;
    var proxyCrossDomainHost = location.hostname + ':' + settings.get().crossDomainProxyPort;

    strictEqual(urlUtils.getPageProxyUrl(sameDomainUrl, 'windowId'),
        'http://' + proxySameDomainHost + '/sessionId*windowId/' + sameDomainUrl);
    strictEqual(urlUtils.getPageProxyUrl(crossDomainUrl, 'windowId'),
        'http://' + proxyCrossDomainHost + '/sessionId*windowId/' + crossDomainUrl);
    strictEqual(urlUtils.getPageProxyUrl('http://' + proxySameDomainHost + '/sessionId*pa/' + sameDomainUrl, 'windowId'),
        'http://' + proxySameDomainHost + '/sessionId*windowId/' + sameDomainUrl);
    strictEqual(urlUtils.getPageProxyUrl('http://' + proxySameDomainHost + '/sessionId*pa!if/' + sameDomainUrl, 'windowId'),
        'http://' + proxySameDomainHost + '/sessionId*windowId!f/' + sameDomainUrl);
    strictEqual(urlUtils.getPageProxyUrl('http://' + proxyCrossDomainHost + '/sessionId*pa!i/' + sameDomainUrl, 'windowId'),
        'http://' + proxySameDomainHost + '/sessionId*windowId/' + sameDomainUrl);
});

module('https proxy protocol');

test('destination with host only', function () {
    var destUrl  = 'http://test.example.com/';
    var proxyUrl = getProxyUrl(destUrl, '', 'https:');

    strictEqual(proxyUrl, 'https://' + PROXY_HOST + '/sessionId/' + destUrl);
});

test('relative path', function () {
    var proxyUrl = getProxyUrl('/Image1.jpg', '', 'https:');

    strictEqual(proxyUrl, 'https://' + PROXY_HOST + '/sessionId/https://example.com/Image1.jpg');
});

test('special pages', function () {
    sharedUrlUtils.SPECIAL_PAGES.forEach(function (url) {
        var proxyUrl = getProxyUrl(url, '', 'https:');

        strictEqual(proxyUrl, 'https://' + PROXY_HOST + '/sessionId/' + url);
    });
});

test('parse proxy url', function () {
    var proxyUrl      = 'https://' + PROXY_HOST + '/sessionId/http://test.example.com:53/PA/TH/?#testHash';
    var parsingResult = urlUtils.parseProxyUrl(proxyUrl);

    strictEqual(parsingResult.destUrl, 'http://test.example.com:53/PA/TH/?#testHash');
    strictEqual(parsingResult.destResourceInfo.protocol, 'http:');
    strictEqual(parsingResult.destResourceInfo.host, 'test.example.com:53');
    strictEqual(parsingResult.destResourceInfo.hostname, 'test.example.com');
    strictEqual(parsingResult.destResourceInfo.port, '53');
    strictEqual(parsingResult.destResourceInfo.partAfterHost, '/PA/TH/?#testHash');
    strictEqual(parsingResult.sessionId, 'sessionId');
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
        sessionId:     'sessionId',
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

test('special page with hash (GH-1671)', function () {
    var specialPageUrlWithHash = 'about:error#hash';
    var proxyUrl               = 'http://' + PROXY_HOST + '/sessionId/' + specialPageUrlWithHash;
    var parsingResult          = urlUtils.parseProxyUrl(proxyUrl);

    strictEqual(parsingResult.destUrl, specialPageUrlWithHash);
    strictEqual(parsingResult.destResourceInfo.protocol, 'about:');
    strictEqual(parsingResult.destResourceInfo.host, '');
    strictEqual(parsingResult.destResourceInfo.hostname, '');
    strictEqual(parsingResult.destResourceInfo.port, '');
    strictEqual(parsingResult.destResourceInfo.partAfterHost, '');
    strictEqual(parsingResult.sessionId, 'sessionId');
});

test('hash with whitespace (GH-971)', function () {
    var url           = 'http://' + PROXY_HOST + '/sessionId/http://some.domain.com/path/#word word';
    var parsingResult = urlUtils.parseProxyUrl(url);

    strictEqual(parsingResult.sessionId, 'sessionId');
    strictEqual(parsingResult.destUrl, 'http://some.domain.com/path/#word word');
    strictEqual(parsingResult.destResourceInfo.partAfterHost, '/path/#word word');
});

test('windowId', function () {
    var proxyUrl       = 'http://' + PROXY_HOST + '/sessionId*123456789/http://example.com';
    var parsedProxyUrl = urlUtils.parseProxyUrl(proxyUrl);

    strictEqual(parsedProxyUrl.destUrl, 'http://example.com');
    strictEqual(parsedProxyUrl.sessionId, 'sessionId');
    strictEqual(parsedProxyUrl.resourceType, null);
    strictEqual(parsedProxyUrl.windowId, '123456789');
});

module('change proxy url');

test('destination URL part', function () {
    var proxyUrl = 'http://localhost:1337/sessionId/http://test.example.com:53/#testHash';
    var changed  = urlUtils.changeDestUrlPart(proxyUrl, nativeMethods.anchorPortSetter, '34');

    strictEqual(changed, 'http://localhost:1337/sessionId/http://test.example.com:34/#testHash');

    changed = urlUtils.changeDestUrlPart(proxyUrl, nativeMethods.anchorHostSetter, 'newhost:99');
    strictEqual(changed, 'http://localhost:1337/sessionId/http://newhost:99/#testHash');

    changed = urlUtils.changeDestUrlPart(proxyUrl, nativeMethods.anchorHostnameSetter, 'newhostname');
    strictEqual(changed, 'http://localhost:1337/sessionId/http://newhostname:53/#testHash');

    changed = urlUtils.changeDestUrlPart(proxyUrl, nativeMethods.anchorProtocolSetter, 'https:');
    strictEqual(changed, 'http://localhost:1337/sessionId/https://test.example.com:53/#testHash');

    changed = urlUtils.changeDestUrlPart(proxyUrl, nativeMethods.anchorPathnameSetter, 'test1.html');
    strictEqual(changed, 'http://localhost:1337/sessionId/http://test.example.com:53/test1.html#testHash');

    changed = urlUtils.changeDestUrlPart(proxyUrl, nativeMethods.anchorSearchSetter, '?hl=ru&tab=wn');
    strictEqual(changed, 'http://localhost:1337/sessionId/http://test.example.com:53/?hl=ru&tab=wn#testHash');
});

module('regression');

test('location.port must return the empty string (T262593)', function () {
    eval(processScript([
        // NOTE: From att.com, iframesrc === https://att.com:null/?IFRAME.
        'var port = (document.location.port == "") ? "" : (":" + document.location.port);',
        'var iframesrc = document.location.protocol + "//" + document.location.hostname + port + "/" + "?IFRAME";',
    ].join('\n')));

    // eslint-disable-next-line no-undef
    strictEqual(iframesrc, 'https://example.com/?IFRAME');
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

test('recreating a document with the "base" tag (GH-371)', function () {
    var src = getSameDomainPageUrl('../../data/same-domain/resolving-url-after-document-recreation.html');

    return createTestIframe({ src: src })
        .then(function (iframe) {
            var iframeDocument = iframe.contentDocument;
            var anchor         = iframeDocument.getElementsByTagName('a')[0];
            var proxyUrl       = 'http://' + location.hostname + ':' + location.port +
                                 '/sessionId!i/http://subdomain.example.com/index.html';

            strictEqual(nativeMethods.anchorHrefGetter.call(anchor), proxyUrl);
        });
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

test('resolving url after writing the "base" tag (GH-526)', function () {
    var src = getSameDomainPageUrl('../../data/same-domain/resolving-url-after-writing-base-tag.html');

    return createTestIframe({ src: src })
        .then(function (iframe) {
            var anchor   = iframe.contentDocument.querySelector('a');
            var proxyUrl = urlUtils.getProxyUrl('http://example.com/relative', {
                proxyHostname: location.hostname,
                proxyPort:     location.port,
                sessionId:     'sessionId',
                resourceType:  'i',
            });

            strictEqual(nativeMethods.anchorHrefGetter.call(anchor), proxyUrl);
        });
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
        '<head><script src="scripts/scr.js"><' + '/script></head>',
        '...',
        '</html>' // eslint-disable-line comma-dangle
    );

    strictEqual(nativeMethods.scriptSrcGetter.call(iframe.contentDocument.querySelector('script')),
        'http://' + location.host + '/sessionId!s/https://example.com/subpath/scripts/scr.js');

    document.body.removeChild(iframe);
});

test('only first base tag should be affected', function () {
    var storedProcessElement = nodeSandbox._processElement;
    var nativeIframe         = nativeMethods.createElement.call(document, 'iframe');
    var proxiedIframe        = null;

    nodeSandbox._processElement = function (el) {
        if (el !== nativeIframe)
            storedProcessElement.call(nodeSandbox, el);
    };

    function checkTestCase (name, fn) {
        fn(nativeIframe.contentDocument);
        fn(proxiedIframe.contentDocument);

        var nativeAnchor  = nativeIframe.contentDocument.querySelector('a');
        var proxiedAnchor = proxiedIframe.contentDocument.querySelector('a');

        nativeAnchor.setAttribute('href', 'path');
        proxiedAnchor.setAttribute('href', 'path');

        strictEqual(urlUtils.parseProxyUrl(nativeMethods.anchorHrefGetter.call(proxiedAnchor)).destUrl, nativeAnchor.href, name);
    }

    return createTestIframe()
        .then(function (iframe) {
            proxiedIframe = iframe;

            return new Promise(function (resolve) {
                const nativeAddEventListener = nativeMethods.documentAddEventListener || nativeMethods.addEventListener;

                nativeAddEventListener.call(nativeIframe, 'load', resolve);
                nativeMethods.appendChild.call(document.body, nativeIframe);
            });
        })
        .then(function () {
            checkTestCase('append first base', function (doc) {
                var anchor = doc.createElement('a');
                var base   = doc.createElement('base');

                anchor.textContent = 'link';

                base.setAttribute('href', 'https://example.com/123/');
                doc.head.appendChild(base);
                doc.body.appendChild(anchor);
            });

            checkTestCase('create base', function (doc) {
                doc.createElement('base');
            });

            checkTestCase('create base and set attribute', function (doc) {
                doc.createElement('base').setAttribute('href', 'http://example.com/base/');
            });

            checkTestCase('append second base', function (doc) {
                var base = doc.createElement('base');

                base.setAttribute('href', 'https://example.com/some/');
                doc.head.appendChild(base);
            });

            checkTestCase('change first base', function (doc) {
                var base = doc.querySelectorAll('base')[0];

                base.setAttribute('href', 'https://example.com/something/');
            });

            checkTestCase('change second base', function (doc) {
                var base = doc.querySelectorAll('base')[1];

                base.setAttribute('href', 'https://example.com/something/');
            });

            checkTestCase('remove second base', function (doc) {
                var base = doc.querySelectorAll('base')[1];

                doc.head.removeChild(base);
            });

            checkTestCase('append second base', function (doc) {
                var base = doc.createElement('base');

                base.setAttribute('href', 'https://example.com/some/');
                doc.head.appendChild(base);
            });

            checkTestCase('remove first base', function (doc) {
                var base = doc.querySelectorAll('base')[0];

                doc.head.removeChild(base);
            });

            checkTestCase('append base to fragment', function (doc) {
                var fragment = doc.createDocumentFragment();
                var base     = doc.createElement('base');

                base.setAttribute('href', 'https://example.com/fragment/');

                fragment.appendChild(base);
            });

            checkTestCase('innerHtml', function (doc) {
                doc.head.innerHTML = '<base href="https://example.com/inner-html/">';
            });

            checkTestCase('insert first base without href', function (doc) {
                var base = doc.createElement('base');

                document.head.insertBefore(base, document.head.firstChild);
            });
        })
        .then(function () {
            nativeMethods.removeChild.call(document.body, nativeIframe);
            nodeSandbox._processElement = storedProcessElement;
        });
});
