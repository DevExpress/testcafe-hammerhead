var sharedUrlUtils = hammerhead.get('../utils/url');

var xhrSandbox    = hammerhead.sandbox.xhr;
var iframeSandbox = hammerhead.sandbox.iframe;
var browserUtils  = hammerhead.utils.browser;

QUnit.testStart(function () {
    iframeSandbox.on(iframeSandbox.IFRAME_READY_TO_INIT_EVENT, initIframeTestHandler);
    iframeSandbox.off(iframeSandbox.IFRAME_READY_TO_INIT_EVENT, iframeSandbox.iframeReadyToInitHandler);
});

QUnit.testDone(function () {
    iframeSandbox.off(iframeSandbox.IFRAME_READY_TO_INIT_EVENT, initIframeTestHandler);
});

test('redirect requests to proxy', function () {
    jQuery.ajaxSetup({ async: false });

    $.get('/xhr-test/100', function (url) {
        strictEqual(url, '/sessionId/https://example.com/xhr-test/100');
    });

    $.get('http://' + window.location.host + '/xhr-test/200', function (url) {
        strictEqual(url, '/sessionId/https://example.com/xhr-test/200');
    });

    $.get('https://example.com/xhr-test/300', function (url) {
        strictEqual(url, '/sessionId/https://example.com/xhr-test/300');
    });

    jQuery.ajaxSetup({ async: true });
});

asyncTest('unsupported protocol', function () {
    var unsupportedUrl = 'gopher://test.domain/';

    var handler = function (e) {
        strictEqual(e.err.code, sharedUrlUtils.URL_UTIL_PROTOCOL_IS_NOT_SUPPORTED);
        strictEqual(e.err.destUrl, unsupportedUrl);
        xhrSandbox.off(xhrSandbox.XHR_ERROR_EVENT, handler);
        start();
    };

    xhrSandbox.on(xhrSandbox.XHR_ERROR_EVENT, handler);

    var request = new XMLHttpRequest();

    request.open('GET', unsupportedUrl, true);
});

module('regression');

asyncTest('Unexpected text modifying during typing text in the search input on the http://www.google.co.uk (B238528)', function () {
    var timeout = 100;

    var ready = function () {
        if (this.readyState === this.DONE) {
            ok(syncActionExecuted);
            start();
        }
    };

    var syncActionExecuted = false;

    var xhr = new XMLHttpRequest();

    xhr.onreadystatechange = ready;
    xhr.open('GET', '/xhr-test/' + timeout);
    xhr.send(null);

    syncActionExecuted = true;
});

asyncTest('parameters must pass correctly in xhr event handlers (T239198)', function () {
    var request = new XMLHttpRequest();

    // NOTE: Check if the XHR is wrapped.
    ok(request.hasOwnProperty('addEventListener'));

    request.addEventListener('progress', function (e) {
        ok(e.target);
    }, true);

    request.addEventListener('load', function (e) {
        ok(e.target);
        start();
    }, true);

    request.addEventListener('error', function () {
        ok(false);
    });

    request.open('GET', '/xhr-large-response', true);
    request.send(null);
});

if (!browserUtils.isIE9) {
    asyncTest('send the origin header correctly (GH-284)', function () {
        var xhrTestFunc = function () {
            var xhr = new XMLHttpRequest();

            xhr.open('POST', '/xhr-origin-header-test/', false);
            xhr.send();

            window.response = xhr.responseText;
        };

        xhrTestFunc();
        strictEqual(window.response, 'https://example.com', 'top window');

        var iframe = document.createElement('iframe');

        iframe.id = 'test';
        iframe.addEventListener('load', function () {
            var script = document.createElement('script');

            script.innerHTML = '(' + xhrTestFunc.toString() + ')()';

            iframe.contentDocument.body.appendChild(script);

            strictEqual(iframe.contentWindow.response, 'https://example.com', 'iframe');

            document.body.removeChild(iframe);

            expect(2);
            start();
        });

        document.body.appendChild(iframe);
    });
}
