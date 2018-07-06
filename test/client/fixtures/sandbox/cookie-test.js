// NOTE: You should clear a browser's cookie if tests are fail,
// because document.cookie can contains cookie from another sites which was run through playground

var cookieUtils       = hammerhead.get('./utils/cookie');
var sharedCookieUtils = hammerhead.get('../utils/cookie');
var settings          = hammerhead.get('./settings');
var urlUtils          = hammerhead.get('./utils/url');
var destLocation      = hammerhead.get('./utils/destination-location');

var nativeMethods = hammerhead.nativeMethods;
var browserUtils  = hammerhead.utils.browser;
var cookieSync    = hammerhead.sandbox.cookie.cookieSync;
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

function setCookieWithoutServerSync (value) {
    var storedFn = cookieSync.perform;

    cookieSync.perform = function () {
    };

    var result = document.cookie = value;

    cookieSync.perform = storedFn;

    return result;
}

test('get/set', function () {
    var storedForcedLocation = destLocation.getLocation();

    function testCookies (location, cookieStrs, expectedCookies) {
        if (location !== storedForcedLocation)
            destLocation.forceLocation(urlUtils.getProxyUrl(location));

        settings.get().cookie = '';

        for (var i = 0; i < cookieStrs.length; i++)
            setCookieWithoutServerSync(cookieStrs[i]);

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

    destLocation.forceLocation(storedForcedLocation);
});

test('path validation', function () {
    var src = getSameDomainPageUrl('../../data/cookie-sandbox/validation.html', 'cookie-sandbox/validation.html');

    return createTestIframe({ src: src })
        .then(function (iframe) {
            ok(iframe.contentWindow.runTest());
        });
});

test('remove real cookie after browser processing', function () {
    var uniqKey = Math.floor(Math.random() * 1e10).toString() + '_test_key';

    var cookieStr = cookieUtils.format({
        value: 'value',
        key:   uniqKey,
        path:  location.path || location.pathname.replace(/\/.*$/, '')
    });

    setCookieWithoutServerSync(cookieStr);

    strictEqual(settings.get().cookie, uniqKey + '=value');
    strictEqual(nativeMethods.documentCookieGetter.call(document).indexOf(uniqKey), -1);
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

    strictEqual(settings.get().cookie, 'test=123; temp=temp');
    strictEqual(nativeMethods.documentCookieGetter.call(document), '');
});

test('set cookie from the XMLHttpRequest', function () {
    var xhr = new XMLHttpRequest();

    strictEqual(nativeMethods.documentCookieGetter.call(document), '');
    strictEqual(document.cookie, '');

    return new Promise(function (resolve) {
        xhr.open('GET', '/xhr-with-sync-cookie/', true);
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

module('synchronization between frames');

test('same-domain frames', function () {
    var iframe         = null;
    var embeddedIframe = null;

    return createTestIframe()
        .then(function (createdIframe) {
            iframe = createdIframe;

            return createTestIframe(null, iframe.contentDocument.body);
        })
        .then(function (createdIframe) {
            embeddedIframe = createdIframe;

            nativeMethods.documentCookieSetter.call(document, 's|sessionId|test|example.com|%2F||1fckm5lnl=123;path=/');
            nativeMethods.documentCookieSetter.call(document, 's|sessionId|cafe|example.com|%2F||1fckm5lnl=321;path=/');

            strictEqual(settings.get().cookie, '');
            strictEqual(iframe.contentWindow['%hammerhead%'].get('./settings').get().cookie, '');
            strictEqual(embeddedIframe.contentWindow['%hammerhead%'].get('./settings').get().cookie, '');

            document.cookie; // eslint-disable-line no-unused-expressions

            strictEqual(nativeMethods.documentCookieGetter.call(document), '');
            strictEqual(settings.get().cookie, 'test=123; cafe=321');
            strictEqual(iframe.contentWindow['%hammerhead%'].get('./settings').get().cookie, 'test=123; cafe=321');
            strictEqual(embeddedIframe.contentWindow['%hammerhead%'].get('./settings').get().cookie, 'test=123; cafe=321');

            nativeMethods.documentCookieSetter.call(document, 's|sessionId|test|example.com|%2F||1fckm5lz3=321;path=/');

            iframe.contentDocument.cookie; // eslint-disable-line no-unused-expressions

            strictEqual(nativeMethods.documentCookieGetter.call(document), '');
            strictEqual(settings.get().cookie, 'test=321; cafe=321');
            strictEqual(iframe.contentWindow['%hammerhead%'].get('./settings').get().cookie, 'test=321; cafe=321');
            strictEqual(embeddedIframe.contentWindow['%hammerhead%'].get('./settings').get().cookie, 'test=321; cafe=321');

            nativeMethods.documentCookieSetter.call(document, 's|sessionId|cafe|example.com|%2F|0|1fckm5lz6=value;path=/');

            embeddedIframe.contentDocument.cookie; // eslint-disable-line no-unused-expressions

            strictEqual(nativeMethods.documentCookieGetter.call(document), '');
            strictEqual(settings.get().cookie, 'test=321');
            strictEqual(iframe.contentWindow['%hammerhead%'].get('./settings').get().cookie, 'test=321');
            strictEqual(embeddedIframe.contentWindow['%hammerhead%'].get('./settings').get().cookie, 'test=321');
        });
});

test('cross-domain frames', function () {
    var iframes = null;

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
        createTestIframe({ src: getCrossDomainPageUrl('../../data/cookie-sandbox/cross-domain-iframe.html') }),
        createTestIframe(),
        createTestIframe({ src: getCrossDomainPageUrl('../../data/cookie-sandbox/cross-domain-iframe.html') })
    ])
        .then(function (frames) {
            iframes = frames;

            nativeMethods.documentCookieSetter.call(document, 's|sessionId|test|example.com|%2F||1fckm5lnl=123;path=/');
            nativeMethods.documentCookieSetter.call(document, 's|sessionId|cafe|example.com|%2F||1fckm5lnl=321;path=/');

            strictEqual(settings.get().cookie, '');
            strictEqual(iframes[1].contentWindow['%hammerhead%'].get('./settings').get().cookie, '');

            return Promise.all([
                checkCrossDomainIframeCookie(iframes[0], ''),
                checkCrossDomainIframeCookie(iframes[2], '')
            ]);
        })
        .then(function () {
            document.cookie; // eslint-disable-line no-unused-expressions

            strictEqual(nativeMethods.documentCookieGetter.call(document), [
                'f|sessionId|test|example.com|%2F||1fckm5lnl=123',
                'f|sessionId|cafe|example.com|%2F||1fckm5lnl=321'
            ].join('; '));
            strictEqual(settings.get().cookie, 'test=123; cafe=321');
            strictEqual(iframes[1].contentWindow['%hammerhead%'].get('./settings').get().cookie, 'test=123; cafe=321');

            return window.QUnitGlobals.wait(realCookieIsEmpty, 5000);
        })
        .then(function () {
            return Promise.all([
                checkCrossDomainIframeCookie(iframes[0], 'test=123; cafe=321'),
                checkCrossDomainIframeCookie(iframes[2], 'test=123; cafe=321')
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
        });
});

module('regression');

test('overwrite (B239496)', function () {
    var savedUrlUtilParseProxyUrl = urlUtils.parseProxyUrl;

    urlUtils.parseProxyUrl = function (url) {
        return {
            destResourceInfo: urlUtils.parseUrl(url)
        };
    };

    setCookieWithoutServerSync('TestKey1=TestVal1');
    setCookieWithoutServerSync('TestKey2=TestVal2');
    strictEqual(document.cookie, 'TestKey1=TestVal1; TestKey2=TestVal2');

    setCookieWithoutServerSync('TestKey1=AnotherValue');
    strictEqual(document.cookie, 'TestKey1=AnotherValue; TestKey2=TestVal2');

    setCookieWithoutServerSync('TestKey2=12;');
    strictEqual(document.cookie, 'TestKey1=AnotherValue; TestKey2=12');

    setCookieWithoutServerSync('TestKey1=NewValue');
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

    setCookieWithoutServerSync('CookieToDelete=DeleteMe');
    strictEqual(document.cookie, 'CookieToDelete=DeleteMe');

    setCookieWithoutServerSync('NotExistent=; expires=Thu, 01 Jan 1970 00:00:01 GMT;');
    strictEqual(document.cookie, 'CookieToDelete=DeleteMe');

    setCookieWithoutServerSync('CookieToDelete=; expires=Thu, 01 Jan 1970 00:00:01 GMT;');
    strictEqual(document.cookie, '');

    urlUtils.parseProxyUrl = savedUrlUtilParseProxyUrl;
});

test('hammerhead crashes if client-side code contains "document.cookie=null" or "document.cookie=undefined" (GH-444, T349254).', function () {
    setCookieWithoutServerSync(null);
    strictEqual(document.cookie, 'null');

    setCookieWithoutServerSync(void 0);
    strictEqual(document.cookie, 'undefined');

    setCookieWithoutServerSync(true);
    strictEqual(document.cookie, 'true');

    setCookieWithoutServerSync('');
    strictEqual(document.cookie, '');

    setCookieWithoutServerSync(123);
    strictEqual(document.cookie, '123');
});

test('correct work with cookie with empty key (GH-899)', function () {
    setCookieWithoutServerSync('123');
    strictEqual(document.cookie, '123');

    setCookieWithoutServerSync('t=5');
    strictEqual(document.cookie, '123; t=5');

    setCookieWithoutServerSync('12');
    strictEqual(document.cookie, '12; t=5');

    setCookieWithoutServerSync('t=3');
    strictEqual(document.cookie, '12; t=3');

    setCookieWithoutServerSync('');
    strictEqual(document.cookie, '; t=3');
});

// NOTE: Browsers on iOS platform doesn't support beforeunload event.
// We cann't use the pagehide event for cookie synchronization.
// Request for a new page will be handled earlier than sync xhr request was sent from pagehide event handler.
if (!browserUtils.isIOS) {
    asyncTest('set cookie before unload (GH-1086)', function () {
        var iframe          = document.createElement('iframe');
        var expectedCookies = [];
        var testedPages     = [
            '../../data/cookie/set-cookie-and-load-new-location.html',
            '../../data/cookie/set-cookie-and-form-submit.html'
        ];

        for (var i = 0; i < 20; i++)
            expectedCookies.push('value' + i + '=some value');

        expectedCookies = expectedCookies.join('; ');

        var nextCookieTest = function (urlIndex) {
            iframe.setAttribute('id', 'test' + Date.now());
            iframe.setAttribute('src', getSameDomainPageUrl(testedPages[urlIndex]));

            window.addEventListener('message', function onMessage (e) {
                strictEqual(e.data, expectedCookies, testedPages[urlIndex]);

                window.removeEventListener('message', onMessage);
                document.body.removeChild(iframe);

                if (testedPages[urlIndex + 1])
                    nextCookieTest(urlIndex + 1);
                else
                    start();
            });

            document.body.appendChild(iframe);
        };

        nextCookieTest(0);
    });
}

asyncTest('limit of the failed cookie-sync requests (GH-1193)', function () {
    var storedCookieSyncUrl  = settings.get().cookieSyncUrl;
    var nativeOnRequestError = cookieSync._onRequestError;
    var failReqCount         = 0;

    cookieSync._onRequestError = function () {
        nativeOnRequestError.apply(this, arguments);

        failReqCount++;

        if (failReqCount === 3) {
            strictEqual(cookieSync.activeReq.readyState, XMLHttpRequest.DONE);
            strictEqual(cookieSync.activeReq.status, 404);
            strictEqual(cookieSync.queue.length, 1);
            strictEqual(cookieSync.queue[0].cookie, 'a=b');

            settings.get().cookieSyncUrl = storedCookieSyncUrl;
            cookieSync._onRequestError   = nativeOnRequestError;

            start();
        }
    };

    settings.get().cookieSyncUrl = '/cookie-sync-fail/';

    document.cookie = 'a=b';
});
