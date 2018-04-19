var cookieUtils  = hammerhead.get('./utils/cookie');
var settings     = hammerhead.get('./settings');
var urlUtils     = hammerhead.get('./utils/url');
var destLocation = hammerhead.get('./utils/destination-location');

var nativeMethods = hammerhead.nativeMethods;
var browserUtils  = hammerhead.utils.browser;
var cookieSync    = hammerhead.sandbox.cookie.cookieSync;

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
    settings.get().cookie = '';

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

module('regression');

test('overwrite (B239496)', function () {
    settings.get().cookie = '';

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
    settings.get().cookie = '';

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
    settings.get().cookie = '';

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
    settings.get().cookie = '';

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
                strictEqual(getProperty(e, 'data'), expectedCookies, testedPages[urlIndex]);

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
