var XhrSandbox = hammerhead.get('./sandbox/xhr');

var iframeSandbox = hammerhead.sandbox.iframe;
var browserUtils  = hammerhead.utils.browser;
var nativeMethods = hammerhead.nativeMethods;

QUnit.testStart(function () {
    iframeSandbox.on(iframeSandbox.RUN_TASK_SCRIPT, initIframeTestHandler);
    iframeSandbox.off(iframeSandbox.RUN_TASK_SCRIPT, iframeSandbox.iframeReadyToInitHandler);
});

QUnit.testDone(function () {
    iframeSandbox.off(iframeSandbox.RUN_TASK_SCRIPT, initIframeTestHandler);
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

module('regression');

asyncTest('unexpected text modifying during typing text in the search input on the http://www.google.co.uk (B238528)', function () {
    var timeout            = 100;
    var syncActionExecuted = false;
    var xhr                = new XMLHttpRequest();

    var ready = function () {
        if (this.readyState === this.DONE) {
            ok(syncActionExecuted);
            start();
        }
    };

    xhr.onreadystatechange = ready;
    xhr.open('GET', '/xhr-test/' + timeout);
    xhr.send(null);

    syncActionExecuted = true;
});

asyncTest('parameters must pass correctly in xhr event handlers (T239198)', function () {
    var request = new XMLHttpRequest();

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


test('createNativeXHR returns an xhr with the native "open" method (GH-492)', function () {
    var storedNativeOpen    = nativeMethods.xmlHttpRequestOpen;
    var storedPrototypeOpen = XMLHttpRequest.prototype.open;

    expect(1);

    nativeMethods.xmlHttpRequestOpen = function () {
        nativeMethods.xmlHttpRequestOpen = storedNativeOpen;
        XMLHttpRequest.prototype.open    = storedPrototypeOpen;
        ok(true);
    };

    XMLHttpRequest.prototype.open = function () {
    };

    XhrSandbox.createNativeXHR().open();
});

test('the internal 222 status code should be replaced to 0 on the client side', function () {
    var xhr = new XMLHttpRequest();

    xhr.open('GET', '/xhr-222/', false);
    ok(XhrSandbox.isOpenedXhr(xhr));
    xhr.send();

    strictEqual(xhr.response || xhr.responseText, 'true');
    strictEqual(getProperty(xhr, 'status'), 0);
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

        window.QUnitGlobals.waitForIframe(iframe)
            .then(function () {
                // NOTE: iframe without src
                iframe.contentWindow['%hammerhead%'].get('./utils/destination-location').forceLocation(null);

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
