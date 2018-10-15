// NOTE: You should clear a browser's cookie if tests are fail,
// because document.cookie can contains cookie from another sites which was run through playground
var sharedCookieUtils = hammerhead.get('../utils/cookie');
var settings          = hammerhead.get('./settings');
var urlUtils          = hammerhead.get('./utils/url');
var destLocation      = hammerhead.get('./utils/destination-location');

var nativeMethods = hammerhead.nativeMethods;
var browserUtils  = hammerhead.utils.browser;
var Promise       = hammerhead.Promise;

QUnit.testDone(function () {
    nativeMethods.documentCookieGetter.call(document)
        .split(';')
        .forEach(function (cookie) {
            var key = cookie.split('=')[0];

            nativeMethods.documentCookieSetter.call(document, key + '=;Path=/;expires=Thu, 01 Jan 1970 00:00:01 GMT');
        });

    settings.get().cookie = '';
});

test('get/set', function () {
    var storedForcedLocation = destLocation.getLocation();

    function testCookies (location, cookieStrs, expectedCookies) {
        if (location !== storedForcedLocation)
            destLocation.forceLocation(urlUtils.getProxyUrl(location));

        settings.get().cookie = '';

        for (var i = 0; i < cookieStrs.length; i++)
            document.cookie = cookieStrs[i];

        strictEqual(document.cookie, expectedCookies, 'destLocation = ' + destLocation.getLocation());
    }

    testCookies(storedForcedLocation, [
        'Test1=Basic; expires=Wed, 13-Jan-2021 22:23:01 GMT',
        'Test2=PathMatch; expires=Wed, 13-Jan-2021 22:23:01 GMT; path=/',
        'Test4=DomainMatch; expires=Wed, 13-Jan-2021 22:23:01 GMT; domain=.example.com',
        'Test5=DomainNotMatch; expires=Wed, 13-Jan-2021 22:23:01 GMT; domain=.cbf4e2d79.com',
        'Test6=HttpOnly; expires=Wed, 13-Jan-2021 22:23:01 GMT; path=/; HttpOnly',
        'Test7=Secure; expires=Wed, 13-Jan-2021 22:23:01 GMT; path=/; Secure',
        'Test8=Expired; expires=Wed, 13-Jan-1977 22:23:01 GMT; path=/',
        'Test9=Duplicate; One=More; expires=Wed, 13-Jan-2021 22:23:01 GMT; path=/',
        'Test10=' + new Array(350).join('(big cookie)'),
        'value without key'
    ], 'Test1=Basic; Test2=PathMatch; Test4=DomainMatch; Test7=Secure; Test9=Duplicate; value without key');

    testCookies('http://localhost', [
        'Test1=DomainMatch; expires=Wed, 13-Jan-2021 22:23:01 GMT; domain=localhost',
        'Test2=DomainNotMatch; expires=Wed, 13-Jan-2021 22:23:01 GMT; domain=localhost:80',
        'Test2=DomainNotMatch; expires=Wed, 13-Jan-2021 22:23:01 GMT; domain=127.0.0.1',
    ], 'Test1=DomainMatch');

    testCookies('http://127.0.0.1', [
        'Test1=DomainMatch; expires=Wed, 13-Jan-2021 22:23:01 GMT; domain=127.0.0.1',
        'Test2=DomainNotMatch; expires=Wed, 13-Jan-2021 22:23:01 GMT; domain=127.0.0.1:80',
        'Test2=DomainNotMatch; expires=Wed, 13-Jan-2021 22:23:01 GMT; domain=localhost',
    ], 'Test1=DomainMatch');

    testCookies('http://sub.example.com/', [
        'Test1=DomainMatch; domain=sub.example.com',
        'Test2=DomainMatch; domain=.sub.example.com',
        'Test3=DomainMatch; Domain=SUB.Example.com',
        'Test4=DomainMatch; Domain=example.com',
        'Test5=DomainMatch; Domain=.example.com',
        'Test6=DomainNotMatch; domain=123',
        'Test7=DomainNotMatch; domain=sub.example',
        'Test8=DomainNotMatch; domain=example.co',
        'Test9=DomainNotMatch; domain=b.example.com'
    ], 'Test1=DomainMatch; Test2=DomainMatch; Test3=DomainMatch; Test4=DomainMatch; Test5=DomainMatch');

    destLocation.forceLocation(storedForcedLocation);
});

test('path validation', function () {
    var src = getSameDomainPageUrl('../../data/cookie-sandbox/validation.html', 'cookie-sandbox/validation.html');

    return createTestIframe({ src: src })
        .then(function (iframe) {
            ok(iframe.contentWindow.runTest());
        });
});

module('sharedCookieUtils.parseClientSyncCookieStr');

test('different path', function () {
    nativeMethods.documentCookieSetter.call(document, 's|sessionId|test|example.com|%2Fpath||1fckm5lnl=123;path=/');
    nativeMethods.documentCookieSetter.call(document, 's|sessionId|test|example.com|%2F||1fckm5ln1=321;path=/');

    var parsedCookie = sharedCookieUtils.parseClientSyncCookieStr(nativeMethods.documentCookieGetter.call(document));

    strictEqual(parsedCookie.actual[0].syncKey, 's|sessionId|test|example.com|%2Fpath||1fckm5lnl');
    strictEqual(parsedCookie.actual[1].syncKey, 's|sessionId|test|example.com|%2F||1fckm5ln1');
});

test('different domain', function () {
    nativeMethods.documentCookieSetter.call(document, 's|sessionId|test|example.com|%2F||1fckm5lnl=123;path=/');
    nativeMethods.documentCookieSetter.call(document, 's|sessionId|test|example.uk|%2F||1fckm5ln1=321;path=/');

    var parsedCookie = sharedCookieUtils.parseClientSyncCookieStr(nativeMethods.documentCookieGetter.call(document));

    strictEqual(parsedCookie.actual[0].syncKey, 's|sessionId|test|example.com|%2F||1fckm5lnl');
    strictEqual(parsedCookie.actual[1].syncKey, 's|sessionId|test|example.uk|%2F||1fckm5ln1');
});

test('same lastAccessed time and different expire time', function () {
    nativeMethods.documentCookieSetter.call(document, 's|sessionId|test|example.com|%2F|1fm3324lk|1fckm5ln1=123;path=/');
    nativeMethods.documentCookieSetter.call(document, 's|sessionId|test|example.com|%2F|1fm3g5ln1|1fckm5ln1=321;path=/');

    var parsedCookie = sharedCookieUtils.parseClientSyncCookieStr(nativeMethods.documentCookieGetter.call(document));

    strictEqual(parsedCookie.actual[0].syncKey, 's|sessionId|test|example.com|%2F|1fm3g5ln1|1fckm5ln1');
    strictEqual(parsedCookie.outdated[0].syncKey, 's|sessionId|test|example.com|%2F|1fm3324lk|1fckm5ln1');
});

test('different lastAccessed time and first is lower', function () {
    nativeMethods.documentCookieSetter.call(document, 's|sessionId|test|example.com|%2F||1fckm5ln1=123;path=/');
    nativeMethods.documentCookieSetter.call(document, 's|sessionId|test|example.com|%2F||1fckm5ln2=321;path=/');

    var parsedCookie = sharedCookieUtils.parseClientSyncCookieStr(nativeMethods.documentCookieGetter.call(document));

    strictEqual(parsedCookie.actual[0].syncKey, 's|sessionId|test|example.com|%2F||1fckm5ln2');
    strictEqual(parsedCookie.outdated[0].syncKey, 's|sessionId|test|example.com|%2F||1fckm5ln1');
});

test('different lastAccessed time and last is lower', function () {
    nativeMethods.documentCookieSetter.call(document, 's|sessionId|test|example.com|%2F||1fckm5ln2=123;path=/');
    nativeMethods.documentCookieSetter.call(document, 's|sessionId|test|example.com|%2F||1fckm5ln1=321;path=/');

    var parsedCookie = sharedCookieUtils.parseClientSyncCookieStr(nativeMethods.documentCookieGetter.call(document));

    strictEqual(parsedCookie.actual[0].syncKey, 's|sessionId|test|example.com|%2F||1fckm5ln2');
    strictEqual(parsedCookie.outdated[0].syncKey, 's|sessionId|test|example.com|%2F||1fckm5ln1');
});

test('a cookie value contains the "=" character', function () {
    nativeMethods.documentCookieSetter.call(document, 's|sessionId|test|example.com|%2F||1fckm5ln2=123=456=789;path=/');
    nativeMethods.documentCookieSetter.call(document, 'test=cookie;path=/');

    var parsedCookie = sharedCookieUtils.parseClientSyncCookieStr(nativeMethods.documentCookieGetter.call(document));

    strictEqual(parsedCookie.actual.length, 1);
    strictEqual(parsedCookie.outdated.length, 0);
    strictEqual(parsedCookie.actual[0].syncKey, 's|sessionId|test|example.com|%2F||1fckm5ln2');
    strictEqual(parsedCookie.actual[0].value, '123=456=789');
});

module('server synchronization with client');

test('process synchronization cookies on document.cookie getter', function () {
    strictEqual(document.cookie, '');

    nativeMethods.documentCookieSetter.call(document, 's|sessionId|test|example.com|%2F||1fckm5lnl=123;path=/');

    strictEqual(document.cookie, 'test=123');
    strictEqual(nativeMethods.documentCookieGetter.call(document), '');
});

test('process synchronization cookies on document.cookie setter', function () {
    strictEqual(document.cookie, '');

    nativeMethods.documentCookieSetter.call(document, 's|sessionId|test|example.com|%2F||1fckm5lnl=123;path=/');

    strictEqual(settings.get().cookie, '');

    document.cookie = 'temp=temp';

    strictEqual(settings.get().cookie, 'temp=temp; test=123');
    strictEqual(nativeMethods.documentCookieGetter.call(document).replace(/\|[^|]+=/, '|lastAccessed='),
        'c|sessionId|temp|example.com|%2F||lastAccessed=temp');
});

test('set cookie from the XMLHttpRequest', function () {
    var xhr = new XMLHttpRequest();

    strictEqual(nativeMethods.documentCookieGetter.call(document), '');
    strictEqual(document.cookie, '');

    return new Promise(function (resolve) {
        xhr.open('GET', '/xhr-with-sync-cookie/?rand=' + Math.random(), true);
        xhr.setRequestHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        xhr.addEventListener('load', resolve);
        xhr.send();
    })
        .then(function () {
            strictEqual(nativeMethods.documentCookieGetter.call(document), '');
            strictEqual(document.cookie, 'hello=world');
        });
});

if (window.fetch) {
    test('set cookie from the fetch request', function () {
        strictEqual(nativeMethods.documentCookieGetter.call(document), '');
        strictEqual(document.cookie, '');

        return fetch('/xhr-with-sync-cookie/', { credentials: 'same-origin' })
            .then(function () {
                strictEqual(nativeMethods.documentCookieGetter.call(document), '');
                strictEqual(document.cookie, 'hello=world');
            });
    });
}

module('client synchronization with server');

test('cookie with httpOnly flag', function () {
    strictEqual(document.cookie, '');

    document.cookie = 'HttpOnly=HttpOnly; HttpOnly';

    strictEqual(settings.get().cookie, '');
    strictEqual(nativeMethods.documentCookieGetter.call(document), '');
});

test('cross domain cookie', function () {
    strictEqual(document.cookie, '');

    document.cookie = 'cross=domain; Domain=localhost';

    strictEqual(settings.get().cookie, '');
    strictEqual(nativeMethods.documentCookieGetter.call(document), '');
});

test('cookie with the invalid path', function () {
    strictEqual(document.cookie, '');

    document.cookie = 'invalid=path; Path=/path';

    strictEqual(settings.get().cookie, '');
    strictEqual(nativeMethods.documentCookieGetter.call(document).replace(/\|[^|]+=/, '|lastAccessed='),
        'c|sessionId|invalid|example.com|%2Fpath||lastAccessed=path');
});

test('cookie with the invalid secure', function () {
    var storedForcedLocation = destLocation.getLocation();

    destLocation.forceLocation(storedForcedLocation.replace(/\/https/, '/http'));

    strictEqual(document.cookie, '');

    document.cookie = 'Secure=Secure; Secure';

    strictEqual(settings.get().cookie, '');
    strictEqual(nativeMethods.documentCookieGetter.call(document).replace(/\|[^|]+=/, '|lastAccessed='),
        'c|sessionId|Secure|example.com|%2F||lastAccessed=Secure');

    destLocation.forceLocation(storedForcedLocation);
});

test('valid the secure and path parameters', function () {
    strictEqual(document.cookie, '');

    document.cookie = 'test=test; Path=/; Secure';

    strictEqual(settings.get().cookie, 'test=test');
    strictEqual(nativeMethods.documentCookieGetter.call(document).replace(/\|[^|]+=/, '|lastAccessed='),
        'c|sessionId|test|example.com|%2F||lastAccessed=test');
});

module('synchronization between frames');

test('same-domain frames', function () {
    var sameDomainSrc  = getSameDomainPageUrl('../../data/cookie-sandbox/same-domain-iframe.html');
    var iframe         = null;
    var embeddedIframe = null;

    return createTestIframe({ src: sameDomainSrc })
        .then(function (createdIframe) {
            iframe = createdIframe;

            return createTestIframe({ src: sameDomainSrc + '&iframe=embedded' }, iframe.contentDocument.body);
        })
        .then(function (createdIframe) {
            embeddedIframe = createdIframe;

            function checkCookies (expectedCookies) {
                strictEqual(nativeMethods.documentCookieGetter.call(document), '');
                strictEqual(settings.get().cookie, expectedCookies);
                strictEqual(iframe.contentWindow['%hammerhead%'].get('./settings').get().cookie, expectedCookies);
                strictEqual(embeddedIframe.contentWindow['%hammerhead%'].get('./settings').get().cookie, expectedCookies);
            }

            checkCookies('');

            nativeMethods.documentCookieSetter.call(document, 's|sessionId|cafe|example.com|%2F||1fckm5lnl=321;path=/');
            nativeMethods.documentCookieSetter.call(document, 's|sessionId|test|example.com|%2F||1fckm5lnl=123;path=/');

            document.cookie; // eslint-disable-line no-unused-expressions

            checkCookies('cafe=321; test=123');

            nativeMethods.documentCookieSetter.call(document, 's|sessionId|test|example.com|%2F||1fckm5lz3=321;path=/');

            iframe.contentDocument.cookie; // eslint-disable-line no-unused-expressions

            checkCookies('cafe=321; test=321');

            nativeMethods.documentCookieSetter.call(document, 's|sessionId|cafe|example.com|%2F|0|1fckm5lz6=value;path=/');

            embeddedIframe.contentDocument.cookie; // eslint-disable-line no-unused-expressions

            checkCookies(' test=321');
        });
});

test('cross-domain frames', function () {
    var sameDomainSrc   = getSameDomainPageUrl('../../data/cookie-sandbox/same-domain-iframe.html');
    var crossDomainSrc  = getCrossDomainPageUrl('../../data/cookie-sandbox/cross-domain-iframe.html');
    var iframes         = null;
    var expectedCookies = '';

    function checkCrossDomainIframeCookie (iframe, expectedValue) {
        return new Promise(function (resolve) {
            var handler = function (e) {
                if (e.source !== iframe.contentWindow)
                    return;

                window.removeEventListener('message', handler);
                strictEqual(e.data, expectedValue);
                resolve();
            };

            window.addEventListener('message', handler);
            callMethod(iframe.contentWindow, 'postMessage', ['get cookie', '*']);
        });
    }

    function realCookieIsEmpty () {
        return nativeMethods.documentCookieGetter.call(document) === '';
    }

    return Promise.all([
        createTestIframe({ src: crossDomainSrc }),
        createTestIframe({ src: sameDomainSrc }),
        createTestIframe({ src: crossDomainSrc })
    ])
        .then(function (frames) {
            iframes = frames;

            nativeMethods.documentCookieSetter.call(document, 's|sessionId|cafe|example.com|%2F||1fckm5lnl=321;path=/');
            nativeMethods.documentCookieSetter.call(document, 's|sessionId|test|example.com|%2F||1fckm5lnl=123;path=/');

            strictEqual(settings.get().cookie, '');
            strictEqual(iframes[1].contentWindow['%hammerhead%'].get('./settings').get().cookie, '');

            return Promise.all([
                checkCrossDomainIframeCookie(iframes[0], ''),
                checkCrossDomainIframeCookie(iframes[2], '')
            ]);
        })
        .then(function () {
            document.cookie; // eslint-disable-line no-unused-expressions

            expectedCookies = 'cafe=321; test=123';

            strictEqual(settings.get().cookie, expectedCookies);
            strictEqual(iframes[1].contentWindow['%hammerhead%'].get('./settings').get().cookie, expectedCookies);

            return window.QUnitGlobals.wait(realCookieIsEmpty, 5000);
        })
        .then(function () {
            return Promise.all([
                checkCrossDomainIframeCookie(iframes[0], expectedCookies),
                checkCrossDomainIframeCookie(iframes[2], expectedCookies)
            ]);
        })
        .then(function () {
            nativeMethods.documentCookieSetter.call(document, 's|sessionId|cafe|example.com|%2F|0|1fckm5lz6=value;path=/');
            callMethod(iframes[0].contentWindow, 'postMessage', ['set cookie', '*']);

            return window.QUnitGlobals.wait(realCookieIsEmpty, 5000);
        })
        .then(function () {
            strictEqual(settings.get().cookie, 'test=123; set=cookie');
            strictEqual(iframes[1].contentWindow['%hammerhead%'].get('./settings').get().cookie, 'test=123; set=cookie');

            return Promise.all([
                checkCrossDomainIframeCookie(iframes[0], 'test=123; set=cookie'),
                checkCrossDomainIframeCookie(iframes[2], 'test=123; set=cookie')
            ]);
        })
        .then(function () {
            document.cookie = 'client=cookie';

            strictEqual(settings.get().cookie, 'test=123; set=cookie; client=cookie');

            if (!browserUtils.isIE) {
                strictEqual(nativeMethods.documentCookieGetter.call(document).replace(/\|[^|]+=/, '|lastAccessed='),
                    'cw|sessionId|client|example.com|%2F||lastAccessed=cookie');// ??
            }

            return window.QUnitGlobals.wait(function () {
                return nativeMethods.documentCookieGetter.call(document).indexOf('c|sessionId') === 0;
            }, 5000);
        })
        .then(function () {
            strictEqual(nativeMethods.documentCookieGetter.call(document).replace(/\|[^|]+=/, '|lastAccessed='),
                'c|sessionId|client|example.com|%2F||lastAccessed=cookie');

            return Promise.all([
                checkCrossDomainIframeCookie(iframes[0], 'test=123; set=cookie; client=cookie'),
                checkCrossDomainIframeCookie(iframes[2], 'test=123; set=cookie; client=cookie')
            ]);
        });
});

test('actual cookie in iframe even if a synchronization message does not received yet', function () {
    return createTestIframe({ src: getSameDomainPageUrl('../../data/cookie-sandbox/same-domain-iframe.html') })
        .then(function (iframe) {
            nativeMethods.documentCookieSetter.call(document, 's|sessionId|test|example.com|%2F||1fckm5lnl=123;path=/');

            var storedCookieSandbox = iframe.contentWindow['%hammerhead%'].sandbox.cookie;

            iframe.contentWindow['%hammerhead%'].sandbox.cookie = null;

            strictEqual(document.cookie, 'test=123');

            iframe.contentWindow['%hammerhead%'].sandbox.cookie = storedCookieSandbox;

            strictEqual(nativeMethods.documentCookieGetter.call(document), 'w|sessionId|test|example.com|%2F||1fckm5lnl=123');
            strictEqual(iframe.contentDocument.cookie, 'test=123');

            return window.QUnitGlobals.wait(function () {
                return nativeMethods.documentCookieGetter.call(document) === '';
            }, 5000);
        });
});

// NOTE: This test works only if the load event is triggered synchronously after an iframe is appended to the body.
// It fails in Firefox because in this browser, the load event is triggered asynchronously.
if (!browserUtils.isFirefox) {
    test('cookieSandbox is not attached to iframe', function () {
        var iframe = document.createElement('iframe');

        iframe.id = 'test' + Date.now();

        nativeMethods.documentCookieSetter.call(document, 's|sessionId|test|example.com|%2F||1fckm5lnl=123;path=/');

        document.body.appendChild(iframe);

        strictEqual(document.cookie, 'test=123');
        strictEqual(nativeMethods.documentCookieGetter.call(document), 'w|sessionId|test|example.com|%2F||1fckm5lnl=123');

        return window.QUnitGlobals.wait(function () {
            return nativeMethods.documentCookieGetter.call(document) === '';
        }, 2000)
            .then(function () {
                document.body.removeChild(iframe);
            });
    });
}

module('regression');

test('overwrite (B239496)', function () {
    var savedUrlUtilParseProxyUrl = urlUtils.parseProxyUrl;

    urlUtils.parseProxyUrl = function (url) {
        return {
            destResourceInfo: urlUtils.parseUrl(url)
        };
    };

    document.cookie = 'TestKey1=TestVal1';
    document.cookie = 'TestKey2=TestVal2';
    strictEqual(document.cookie, 'TestKey1=TestVal1; TestKey2=TestVal2');

    document.cookie = 'TestKey1=AnotherValue';
    strictEqual(document.cookie, 'TestKey1=AnotherValue; TestKey2=TestVal2');

    document.cookie = 'TestKey2=12;';
    strictEqual(document.cookie, 'TestKey1=AnotherValue; TestKey2=12');

    document.cookie = 'TestKey1=NewValue';
    strictEqual(document.cookie, 'TestKey1=NewValue; TestKey2=12');

    urlUtils.parseProxyUrl = savedUrlUtilParseProxyUrl;
});

test('delete (B239496)', function () {
    var savedUrlUtilParseProxyUrl = urlUtils.parseProxyUrl;

    urlUtils.parseProxyUrl = function (url) {
        return {
            destResourceInfo: urlUtils.parseUrl(url)
        };
    };

    document.cookie = 'CookieToDelete=DeleteMe';
    strictEqual(document.cookie, 'CookieToDelete=DeleteMe');

    document.cookie = 'NotExistent=; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
    strictEqual(document.cookie, 'CookieToDelete=DeleteMe');

    document.cookie = 'CookieToDelete=; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
    strictEqual(document.cookie, '');

    urlUtils.parseProxyUrl = savedUrlUtilParseProxyUrl;
});

test('hammerhead crashes if client-side code contains "document.cookie=null" or "document.cookie=undefined" (GH-444, T349254).', function () {
    document.cookie = null;
    strictEqual(document.cookie, 'null');

    document.cookie = void 0;
    strictEqual(document.cookie, 'undefined');

    document.cookie = true;
    strictEqual(document.cookie, 'true');

    document.cookie = '';
    strictEqual(document.cookie, '');

    document.cookie = 123;
    strictEqual(document.cookie, '123');
});

test('correct work with cookie with empty key (GH-899)', function () {
    document.cookie = '123';
    strictEqual(document.cookie, '123');

    document.cookie = 't=5';
    strictEqual(document.cookie, '123; t=5');

    document.cookie = '12';
    strictEqual(document.cookie, '12; t=5');

    document.cookie = 't=3';
    strictEqual(document.cookie, '12; t=3');

    document.cookie = '';
    strictEqual(document.cookie, '; t=3');
});

if (browserUtils.isIE) {
    test('should not set cookie in iframe without the src attribute in IE only', function () {
        return createTestIframe()
            .then(function (iframe) {
                var iframeDocument = iframe.contentDocument;

                iframeDocument.cookie = 'test=iframe without src';
                nativeMethods.documentCookieSetter.call(iframeDocument, 'test_native=iframe without src');

                strictEqual(iframeDocument.cookie, nativeMethods.documentCookieGetter.call(iframeDocument));
            });
    });
}
