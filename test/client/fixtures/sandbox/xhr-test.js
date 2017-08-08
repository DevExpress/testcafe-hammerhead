var XhrSandbox    = hammerhead.get('./sandbox/xhr');
var XHR_HEADERS   = hammerhead.get('./../request-pipeline/xhr/headers');
var AUTHORIZATION = hammerhead.get('./../request-pipeline/xhr/authorization');
var destLocation  = hammerhead.get('./utils/destination-location');
var settings      = hammerhead.get('./settings');

var iframeSandbox = hammerhead.sandbox.iframe;
var browserUtils  = hammerhead.utils.browser;
var nativeMethods = hammerhead.nativeMethods;

QUnit.testStart(function () {
    iframeSandbox.on(iframeSandbox.RUN_TASK_SCRIPT_EVENT, initIframeTestHandler);
    iframeSandbox.off(iframeSandbox.RUN_TASK_SCRIPT_EVENT, iframeSandbox.iframeReadyToInitHandler);
});

QUnit.testDone(function () {
    iframeSandbox.off(iframeSandbox.RUN_TASK_SCRIPT_EVENT, initIframeTestHandler);
});

function getPrototypeFromChainContainsProp (obj, prop) {
    while (obj && !obj.hasOwnProperty(prop))
        obj = Object.getPrototypeOf(obj);

    return obj;
}

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

test('createNativeXHR', function () {
    window.XMLHttpRequest = function () {};

    var xhr = XhrSandbox.createNativeXHR();

    ok(xhr instanceof nativeMethods.XMLHttpRequest);

    window.XMLHttpRequest = nativeMethods.XMLHttpRequest;

    var isWrappedFunctionRE = /return 'function is wrapped'/;

    for (var prop in xhr) {
        if (typeof xhr[prop] === 'function' && prop !== 'msCachingEnabled') {
            var prototype = getPrototypeFromChainContainsProp(window.XMLHttpRequest.prototype, prop);
            var storedFn  = prototype[prop];

            prototype[prop] = function () {
                return 'function is wrapped';
            };

            ok(!isWrappedFunctionRE.test(xhr[prop]), prop);

            prototype[prop] = storedFn;
        }
    }
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

test('the internal 222 status code should be replaced with 0 on the client side', function () {
    var xhr = new XMLHttpRequest();

    xhr.open('GET', '/xhr-222/', false);
    ok(XhrSandbox.isOpenedXhr(xhr));
    xhr.send();

    strictEqual(xhr.response || xhr.responseText, 'true');
    strictEqual(getProperty(xhr, 'status'), 0);
});

if (!browserUtils.isIE9) {
    test('send the origin header correctly (GH-284)', function () {
        var xhrTestFunc = function () {
            var xhr = new XMLHttpRequest();

            xhr.open('POST', '/xhr-origin-header-test/', false);
            xhr.send();

            window.response = xhr.responseText;
        };

        xhrTestFunc();
        strictEqual(window.response, 'https://example.com', 'top window');

        destLocation.forceLocation('http://localhost/sessionId/file:///path/index.html');

        xhrTestFunc();
        strictEqual(window.response, 'file:///path/index.html', 'location with file protocol');

        destLocation.forceLocation('http://localhost/sessionId/https://example.com');

        return createTestIframe()
            .then(function (iframe) {
                // NOTE: iframe without src
                iframe.contentWindow['%hammerhead%'].get('./utils/destination-location').forceLocation(null);

                var script = document.createElement('script');

                script.innerHTML = '(' + xhrTestFunc.toString() + ')()';

                iframe.contentDocument.body.appendChild(script);

                strictEqual(iframe.contentWindow.response, 'https://example.com', 'iframe');
            });
    });
}

asyncTest('set cookie from a header of the XMLHttpRequest response (GH-905)', function () {
    var xhr = new XMLHttpRequest();

    strictEqual(getProperty(document, 'cookie'), '');

    xhr.open('GET', '/xhr-set-cookie-header-test/', true);
    xhr.addEventListener('readystatechange', function () {
        if (this.readyState === this.DONE) {
            strictEqual(getProperty(document, 'cookie'), 'hello=world');
            strictEqual(xhr.getResponseHeader(XHR_HEADERS.setCookie), null);
            strictEqual(xhr.getAllResponseHeaders().indexOf(XHR_HEADERS.setCookie), -1);
            strictEqual(xhr.getAllResponseHeaders().indexOf('hello=world'), -1);

            settings.get().cookie = '';

            start();
        }
    });
    xhr.send();
});

asyncTest('authorization headers by client should be processed (GH-1016)', function () {
    var xhr = new XMLHttpRequest();

    xhr.open('GET', '/echo-request-headers/', true);
    xhr.setRequestHeader('Authorization', '123');
    xhr.setRequestHeader('authentication-info', '123');
    xhr.setRequestHeader('x-header1', '456');
    xhr.setRequestHeader('x-header2', '789');
    xhr.addEventListener('readystatechange', function () {
        if (this.readyState === this.DONE) {
            var headers = JSON.parse(this.responseText);

            strictEqual(headers['authorization'], AUTHORIZATION.valuePrefix + '123');
            strictEqual(headers['authentication-info'], AUTHORIZATION.valuePrefix + '123');
            strictEqual(headers['x-header1'], '456');
            strictEqual(headers['x-header2'], '789');

            start();
        }
    });
    xhr.send();
});
