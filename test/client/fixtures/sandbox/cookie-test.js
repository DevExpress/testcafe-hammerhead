var cookieUtils = hammerhead.get('./utils/cookie');
var settings    = hammerhead.get('./settings');
var urlUtils    = hammerhead.get('./utils/url');

var Promise       = hammerhead.Promise;
var transport     = hammerhead.transport;
var nativeMethods = hammerhead.nativeMethods;
var cookieSandbox = hammerhead.sandbox.cookie;

function setCookie (value) {
    return setProperty(document, 'cookie', value);
}

function getCookie () {
    return getProperty(document, 'cookie');
}

asyncTest('cookie must be to send to a server before form.submit', function () {
    var form                          = document.body.appendChild(document.createElement('form'));
    var storedAsyncServiceMsg         = transport.asyncServiceMsg;
    var resolveAsyncServiceMsgPromise = null;
    var storedNativeSubmit            = nativeMethods.formSubmit;
    var msgReceived                   = false;

    transport.asyncServiceMsg = function () {
        return new Promise(function (resolve) {
            resolveAsyncServiceMsgPromise = resolve;
        });
    };

    nativeMethods.formSubmit = function () {
        ok(msgReceived);

        nativeMethods.formSubmit  = storedNativeSubmit;
        transport.asyncServiceMsg = storedAsyncServiceMsg;

        start();
    };

    cookieSandbox.setCookie(document, 'cookie=1', true);

    processDomMeth(form);

    form.submit();

    msgReceived = true;
    resolveAsyncServiceMsgPromise();
});

test('get/set', function () {
    settings.get().cookie = '';

    var savedQueuedAsyncServiceMsg = transport.queuedAsyncServiceMsg;

    transport.queuedAsyncServiceMsg = function () {
    };

    var cookieStrs = [
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
    ];

    for (var i = 0; i < cookieStrs.length; i++)
        setCookie(cookieStrs[i]);

    strictEqual(getCookie(), 'Test1=Basic; Test2=PathMatch; Test4=DomainMatch; Test7=Secure; Test9=Duplicate; value without key');

    transport.queuedAsyncServiceMsg = savedQueuedAsyncServiceMsg;
});

asyncTest('path validation', function () {
    var iframe = document.createElement('iframe');
    var src    = window.QUnitGlobals.getResourceUrl('../../data/cookie-sandbox/validation.html', 'cookie-sandbox/validation.html');

    iframe.setAttribute('src', src);
    window.QUnitGlobals.waitForIframe(iframe)
        .then(function () {
            ok(iframe.contentWindow.runTest());
            iframe.parentNode.removeChild(iframe);
            start();
        });
    document.body.appendChild(iframe);
});

test('remove real cookie after browser processing', function () {
    settings.get().cookie = '';

    var savedQueuedAsyncServiceMsg = transport.queuedAsyncServiceMsg;

    transport.queuedAsyncServiceMsg = function () {
    };

    var uniqKey = Math.floor(Math.random() * 1e10).toString() + '_test_key';

    var cookieStr = cookieUtils.format({
        value: 'value',
        key:   uniqKey,
        path:  location.path || location.pathname.replace(/\/.*$/, '')
    });

    setCookie(cookieStr);

    strictEqual(settings.get().cookie, uniqKey + '=value');
    ok(document.cookie.indexOf(uniqKey) === -1);

    transport.queuedAsyncServiceMsg = savedQueuedAsyncServiceMsg;
});

module('regression');

test('overwrite (B239496)', function () {
    settings.get().cookie = '';

    var savedQueuedAsyncServiceMsg = transport.queuedAsyncServiceMsg;
    var savedUrlUtilParseProxyUrl  = urlUtils.parseProxyUrl;

    urlUtils.parseProxyUrl = function (url) {
        return {
            destResourceInfo: urlUtils.parseUrl(url)
        };
    };

    transport.queuedAsyncServiceMsg = function () {
    };

    setCookie('TestKey1=TestVal1');
    setCookie('TestKey2=TestVal2');
    strictEqual(getCookie(), 'TestKey1=TestVal1; TestKey2=TestVal2');

    setCookie('TestKey1=AnotherValue');
    strictEqual(getCookie(), 'TestKey1=AnotherValue; TestKey2=TestVal2');

    setCookie('TestKey2=12;');
    strictEqual(getCookie(), 'TestKey1=AnotherValue; TestKey2=12');

    setCookie('TestKey1=NewValue');
    strictEqual(getCookie(), 'TestKey1=NewValue; TestKey2=12');

    transport.queuedAsyncServiceMsg = savedQueuedAsyncServiceMsg;
    urlUtils.parseProxyUrl          = savedUrlUtilParseProxyUrl;
});

test('delete (B239496)', function () {
    settings.get().cookie = '';

    var savedQueuedAsyncServiceMsg = transport.queuedAsyncServiceMsg;
    var savedUrlUtilParseProxyUrl  = urlUtils.parseProxyUrl;

    urlUtils.parseProxyUrl = function (url) {
        return {
            destResourceInfo: urlUtils.parseUrl(url)
        };
    };

    transport.queuedAsyncServiceMsg = function () {
    };

    setCookie('CookieToDelete=DeleteMe');
    strictEqual(getCookie(), 'CookieToDelete=DeleteMe');

    setCookie('NotExistent=; expires=Thu, 01 Jan 1970 00:00:01 GMT;');
    strictEqual(getCookie(), 'CookieToDelete=DeleteMe');

    setCookie('CookieToDelete=; expires=Thu, 01 Jan 1970 00:00:01 GMT;');
    strictEqual(getCookie(), '');

    transport.queuedAsyncServiceMsg = savedQueuedAsyncServiceMsg;
    urlUtils.parseProxyUrl          = savedUrlUtilParseProxyUrl;
});

test('hammerhead crashes if client-side code contains "document.cookie=null" or "document.cookie=undefined" (GH-444, T349254).', function () {
    settings.get().cookie = '';

    var savedQueuedAsyncServiceMsg = transport.queuedAsyncServiceMsg;

    transport.queuedAsyncServiceMsg = function () {
    };

    setCookie(null);
    strictEqual(getCookie(), 'null');

    setCookie(void 0);
    strictEqual(getCookie(), 'undefined');

    setCookie(true);
    strictEqual(getCookie(), 'true');

    setCookie('');
    strictEqual(getCookie(), '');

    setCookie(123);
    strictEqual(getCookie(), '123');

    transport.queuedAsyncServiceMsg = savedQueuedAsyncServiceMsg;
});
