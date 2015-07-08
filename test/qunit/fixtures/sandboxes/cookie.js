var CookieSandbox = Hammerhead.get('./sandboxes/cookie');
var CookieUtil    = Hammerhead.get('./util/cookie');
var NativeMethods = Hammerhead.get('./sandboxes/native-methods');
var Settings      = Hammerhead.get('./settings');
var SharedUrlUtil = Hammerhead.get('../utils/url');
var Transport     = Hammerhead.get('./transport');
var UrlUtil       = Hammerhead.get('./util/url');

function setCookie (value) {
    return setProperty(document, 'cookie', value);
}

function getCookie () {
    return getProperty(document, 'cookie');
}

asyncTest('form submit', function () {
    var form                    = document.body.appendChild(document.createElement('form'));
    var storedAsyncServiceMsg   = Transport.asyncServiceMsg;
    var asyncServiceMsgCallback = null;
    var storedNativeSubmit      = NativeMethods.formSubmit;
    var msgReceived             = false;

    Transport.asyncServiceMsg = function (msg, callback) {
        asyncServiceMsgCallback = callback;
    };

    NativeMethods.formSubmit = function () {
        ok(msgReceived);

        NativeMethods.formSubmit  = storedNativeSubmit;
        Transport.asyncServiceMsg = storedAsyncServiceMsg;

        start();
    };

    CookieSandbox.setCookie(document, 'cookie=1');

    overrideDomMeth(form);

    form.submit();

    window.setTimeout(function () {
        msgReceived = true;
        asyncServiceMsgCallback();
    }, 500);
});

test('get/set', function () {
    Settings.get().COOKIE = '';

    var savedQueuedAsyncServiceMsg = Transport.queuedAsyncServiceMsg;
    var savedUrlUtilParseProxyUrl  = SharedUrlUtil.parseProxyUrl;

    SharedUrlUtil.parseProxyUrl = function (url) {
        return {
            'originResourceInfo': UrlUtil.parseUrl(url)
        };
    };

    Transport.queuedAsyncServiceMsg = function () {
    };

    var cookieStrs = [
        'Test1=Basic; expires=Wed, 13-Jan-2021 22:23:01 GMT',
        'Test2=PathMatch; expires=Wed, 13-Jan-2021 22:23:01 GMT; path=/',
        'Test4=DomainMatch; expires=Wed, 13-Jan-2021 22:23:01 GMT; domain=.' + document.location.host.toString(),
        'Test5=DomainNotMatch; expires=Wed, 13-Jan-2021 22:23:01 GMT; domain=.cbf4e2d79.com',
        'Test6=HttpOnly; expires=Wed, 13-Jan-2021 22:23:01 GMT; path=/; HttpOnly',
        'Test7=Secure; expires=Wed, 13-Jan-2021 22:23:01 GMT; path=/; Secure',
        'Test8=Expired; expires=Wed, 13-Jan-1977 22:23:01 GMT; path=/',
        'Test9=Duplicate; One=More; expires=Wed, 13-Jan-2021 22:23:01 GMT; path=/'
    ];

    for (var i = 0; i < cookieStrs.length; i++)
        setCookie(cookieStrs[i]);

    strictEqual(getCookie(), 'Test1=Basic; Test2=PathMatch; Test4=DomainMatch; Test7=Secure; Test9=Duplicate');

    Transport.queuedAsyncServiceMsg = savedQueuedAsyncServiceMsg;
    SharedUrlUtil.parseProxyUrl     = savedUrlUtilParseProxyUrl;
});

asyncTest('path validation', function () {
    var iframe = document.createElement('iframe');

    iframe.src = UrlUtil.getProxyUrl('/data/cookie-sandbox/validation.html');
    iframe.addEventListener('load', function () {
        ok(this.contentWindow.runTest());
        this.parentNode.removeChild(this);
        start();
    });

    document.body.appendChild(iframe);
});

test('remove real cookie after browser processing', function () {
    Settings.get().COOKIE = '';

    var savedQueuedAsyncServiceMsg = Transport.queuedAsyncServiceMsg;

    Transport.queuedAsyncServiceMsg = function () {
    };

    var uniqKey = Math.floor(Math.random() * 1e10).toString() + '_test_key';

    var cookieStr = CookieUtil.format({
        value: 'value',
        key:   uniqKey,
        path:  location.path || location.pathname.replace(/\/.*$/, '')
    });

    setCookie(cookieStr);

    strictEqual(Settings.get().COOKIE, uniqKey + '=value');
    ok(document.cookie.indexOf(uniqKey) === -1);

    Transport.queuedAsyncServiceMsg = savedQueuedAsyncServiceMsg;
});

//B239496 - Overwrite cookie
test('overwrite', function () {
    Settings.get().COOKIE = '';

    var savedQueuedAsyncServiceMsg = Transport.queuedAsyncServiceMsg;
    var savedUrlUtilParseProxyUrl  = UrlUtil.parseProxyUrl;

    UrlUtil.parseProxyUrl = function (url) {
        return {
            'originResourceInfo': UrlUtil.parseUrl(url)
        };
    };

    Transport.queuedAsyncServiceMsg = function () {
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

    Transport.queuedAsyncServiceMsg = savedQueuedAsyncServiceMsg;
    UrlUtil.parseProxyUrl           = savedUrlUtilParseProxyUrl;
});

//B239496 - Delete cookie
test('delete', function () {
    Settings.get().COOKIE = '';

    var savedQueuedAsyncServiceMsg = Transport.queuedAsyncServiceMsg;
    var savedUrlUtilParseProxyUrl  = UrlUtil.parseProxyUrl;

    UrlUtil.parseProxyUrl = function (url) {
        return {
            'originResourceInfo': UrlUtil.parseUrl(url)
        };
    };

    Transport.queuedAsyncServiceMsg = function () {
    };

    setCookie('CookieToDelete=DeleteMe');
    strictEqual(getCookie(), 'CookieToDelete=DeleteMe');

    setCookie('NotExistent=; expires=Thu, 01 Jan 1970 00:00:01 GMT;');
    strictEqual(getCookie(), 'CookieToDelete=DeleteMe');

    setCookie('CookieToDelete=; expires=Thu, 01 Jan 1970 00:00:01 GMT;');
    strictEqual(getCookie(), '');

    Transport.queuedAsyncServiceMsg = savedQueuedAsyncServiceMsg;
    UrlUtil.parseProxyUrl           = savedUrlUtilParseProxyUrl;
});
