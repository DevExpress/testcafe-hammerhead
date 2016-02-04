var cookieUtils              = hammerhead.get('./utils/cookie');
var settings                 = hammerhead.get('./settings');
var urlUtils                 = hammerhead.get('./utils/url');
var COOKIE_HIDDEN_INPUT_NAME = hammerhead.get('../session/cookies/hidden-input-name');

var transport     = hammerhead.transport;
var cookieSandbox = hammerhead.sandbox.cookie;
var iframeSandbox = hammerhead.sandbox.iframe;

QUnit.testStart(function () {
    iframeSandbox.on(iframeSandbox.RUN_TASK_SCRIPT, initIframeTestHandler);
    iframeSandbox.off(iframeSandbox.RUN_TASK_SCRIPT, iframeSandbox.iframeReadyToInitHandler);
});

QUnit.testDone(function () {
    iframeSandbox.off(iframeSandbox.RUN_TASK_SCRIPT, initIframeTestHandler);
});


function setCookie (value) {
    return setProperty(document, 'cookie', value);
}

function getCookie () {
    return getProperty(document, 'cookie');
}

test('get/set', function () {
    settings.get().cookie = '';

    var savedQueuedAsyncServiceMsg = transport.queuedAsyncServiceMsg;

    transport.queuedAsyncServiceMsg = function () {
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

module('add cookie info to the form before submission');

asyncTest('POST', function () {
    var iframe = document.createElement('iframe');

    iframe.id   = 'test-cookie';
    iframe.name = 'cookie-iframe';

    document.body.appendChild(iframe);

    var storedCookieMsgInProgress = cookieSandbox._cookieMsgInProgress;

    cookieSandbox._cookieMsgInProgress = function () {
        return true;
    };

    settings.get().cookie = 'test-cookie1=true;test-cookie2=true';

    var form = document.createElement('form');

    form.action = '/get-req-body';
    form.target = 'cookie-iframe';
    form.method = 'POST';

    window.QUnitGlobals.waitForIframe(iframe)
        .then(function () {
            form.submit();

            var id = setInterval(function () {
                var resultContainer = iframe.contentDocument.getElementById('result');

                if (resultContainer) {
                    clearInterval(id);

                    var reqBody         = resultContainer.innerHTML;
                    var expectedReqBody = COOKIE_HIDDEN_INPUT_NAME + '=';

                    expectedReqBody += JSON.stringify({
                        cookie: settings.get().cookie,
                        url:    location.toString()
                    });

                    strictEqual(decodeURIComponent(reqBody), expectedReqBody);

                    iframe.parentNode.removeChild(iframe);
                    form.parentNode.removeChild(form);
                    cookieSandbox._cookieMsgInProgress = storedCookieMsgInProgress;
                    start();
                }
            }, 10);
        });

    document.body.appendChild(form);
});

asyncTest('GET', function () {
    var iframe = document.createElement('iframe');

    iframe.id   = 'test-cookie';
    iframe.name = 'cookie-iframe';

    document.body.appendChild(iframe);

    var storedCookieMsgInProgress = cookieSandbox._cookieMsgInProgress;

    cookieSandbox._cookieMsgInProgress = function () {
        return true;
    };

    settings.get().cookie = 'test-cookie1=true;test-cookie2=true';

    var form = document.createElement('form');

    form.action = '/get-request-url';
    form.target = 'cookie-iframe';
    form.method = 'GET';

    window.QUnitGlobals.waitForIframe(iframe)
        .then(function () {
            form.submit();

            var id = setInterval(function () {
                var result = iframe.contentDocument.getElementById('result');

                if (result) {
                    clearInterval(id);

                    var reqUrl              = result.innerHTML;
                    var expectedReqUrlParam = COOKIE_HIDDEN_INPUT_NAME + '=';

                    expectedReqUrlParam += encodeURIComponent(JSON.stringify({
                        cookie: settings.get().cookie,
                        url:    location.toString()
                    }));

                    ok(reqUrl.indexOf(expectedReqUrlParam) !== -1);

                    iframe.parentNode.removeChild(iframe);
                    form.parentNode.removeChild(form);
                    cookieSandbox._cookieMsgInProgress = storedCookieMsgInProgress;
                    start();
                }
            }, 10);
        });

    document.body.appendChild(form);
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
    strictEqual(getCookie(), '');

    setCookie(void 0);
    strictEqual(getCookie(), '');

    setCookie(true);
    strictEqual(getCookie(), '');

    setCookie('');
    strictEqual(getCookie(), '');

    setCookie(123);
    strictEqual(getCookie(), '');

    transport.queuedAsyncServiceMsg = savedQueuedAsyncServiceMsg;
});
