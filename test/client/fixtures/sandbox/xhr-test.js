var XhrSandbox    = hammerhead.get('./sandbox/xhr');
var XHR_HEADERS   = hammerhead.get('./../request-pipeline/xhr/headers');
var AUTHORIZATION = hammerhead.get('./../request-pipeline/xhr/authorization');
var destLocation  = hammerhead.get('./utils/destination-location');
var settings      = hammerhead.get('./settings');
var urlUtils      = hammerhead.get('./utils/url');

var nativeMethods = hammerhead.nativeMethods;
var xhrSandbox    = hammerhead.sandbox.xhr;
var Promise       = hammerhead.Promise;
var browserUtils  = hammerhead.utils.browser;

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
    var storedXMLHttpRequest = window.XMLHttpRequest;

    window.XMLHttpRequest = function () {
    };

    var xhr = XhrSandbox.createNativeXHR();

    ok(xhr instanceof nativeMethods.XMLHttpRequest);

    window.XMLHttpRequest = storedXMLHttpRequest;

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

test('toString, instanceof, constructor and static properties', function () {
    var xhr = new XMLHttpRequest();

    strictEqual(XMLHttpRequest.toString(), nativeMethods.XMLHttpRequest.toString());
    ok(xhr instanceof XMLHttpRequest);
    strictEqual(XMLHttpRequest.prototype.constructor, XMLHttpRequest);
    strictEqual(XMLHttpRequest.UNSENT, nativeMethods.XMLHttpRequest.UNSENT);
    strictEqual(XMLHttpRequest.OPENED, nativeMethods.XMLHttpRequest.OPENED);
    strictEqual(XMLHttpRequest.HEADERS_RECEIVED, nativeMethods.XMLHttpRequest.HEADERS_RECEIVED);
    strictEqual(XMLHttpRequest.LOADING, nativeMethods.XMLHttpRequest.LOADING);
    strictEqual(XMLHttpRequest.DONE, nativeMethods.XMLHttpRequest.DONE);
});

test('overridden "open" function should process some url argument types before the native "XMLHttpRequest.open" method calling (GH-1613)', function () {
    var storedNativeXhrOpen = nativeMethods.xhrOpen;
    var xhr                 = new XMLHttpRequest();

    // NOTE: IE11 doesn't support 'URL()'
    if (!browserUtils.isIE11) {
        nativeMethods.xhrOpen = function () {
            strictEqual(arguments[1], urlUtils.getProxyUrl('https://example.com/some-path'));
        };
        xhr.open('GET', new URL('https://example.com/some-path'));
    }

    nativeMethods.xhrOpen = function () {
        strictEqual(arguments[1], urlUtils.getProxyUrl('https://example.com/null'));
    };
    xhr.open('GET', null);

    nativeMethods.xhrOpen = function () {
        strictEqual(arguments[1], urlUtils.getProxyUrl('https://example.com/undefined'));
    };
    xhr.open('GET', void 0);

    nativeMethods.xhrOpen = function () {
        strictEqual(arguments[1], urlUtils.getProxyUrl('https://example.com/[object%20Object]'));
    };
    xhr.open('GET', { url: '/some-path' });

    nativeMethods.xhrOpen = function () {
        strictEqual(arguments[1], urlUtils.getProxyUrl('https://example.com/some-path'));
    };
    xhr.open('GET', {
        toString: function () {
            return '/some-path';
        }
    });

    nativeMethods.xhrOpen = storedNativeXhrOpen;
});

test('should throwing an error on invalid calling "open" (GH-1613)', function () {
    var url = {
        toString: function () {
            return {};
        }
    };

    var exception = false;
    var xhr       = new XMLHttpRequest();

    try {
        xhr.open('GET', url, false);
    }
    catch (e) {
        exception = true;
    }
    finally {
        ok(exception);
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
    xhr.send();

    strictEqual(xhr.response || xhr.responseText, 'true');
    strictEqual(xhr.status, 0);
});

// NOTE: IE11 doesn't support 'XMLHttpRequest.responseURL'
if (browserUtils.isIE11) {
    asyncTest('xhr.responseURL', function () {
        var xhr       = new XMLHttpRequest();
        var testCount = 0;

        xhr.addEventListener('readystatechange', function () {
            if (this.responseURL) {
                strictEqual(this.responseURL, 'https://example.com/xhr-large-response');
                ++testCount;
            }

            if (this.readyState === XMLHttpRequest.DONE) {
                expect(testCount);
                start();
            }
        });
        xhr.open('GET', '/redirect/', true);
        xhr.send(null);
    });
}

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

            nativeMethods.scriptTextSetter.call(script, '(' + xhrTestFunc.toString() + ')()');

            iframe.contentDocument.body.appendChild(script);

            strictEqual(iframe.contentWindow.response, 'https://example.com', 'iframe');
        });
});

asyncTest('set cookie from a header of the XMLHttpRequest response (GH-905)', function () {
    var xhr = new XMLHttpRequest();

    strictEqual(document.cookie, '');

    xhr.open('GET', '/xhr-set-cookie-header-test/', true);
    xhr.addEventListener('readystatechange', function () {
        if (this.readyState === this.DONE) {
            strictEqual(document.cookie, 'hello=world');
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

asyncTest('"XHR_COMPLETED_EVENT" should be raised when xhr is prevented (GH-1283)', function () {
    var xhr       = new XMLHttpRequest();
    var timeoutId = null;
    var testDone  = function (eventObj) {
        xhrSandbox.off(xhrSandbox.XHR_COMPLETED_EVENT, testDone);
        clearTimeout(timeoutId);
        ok(!!eventObj);
        start();
    };

    var readyStateChangeHandler = function (e) {
        if (this.readyState === this.DONE)
            e.stopImmediatePropagation();
    };

    xhr.addEventListener('readystatechange', readyStateChangeHandler, true);
    xhr.onreadystatechange = readyStateChangeHandler;

    xhrSandbox.on(xhrSandbox.XHR_COMPLETED_EVENT, testDone);
    timeoutId = setTimeout(testDone, 2000);

    xhr.open('GET', '/xhr-test/', true);
    xhr.send();
});

test('should emulate native browser behavior for xhr requests that end with an error or non-success status code (GH-1397)', function () {
    var performRequest = function (xhr, url) {
        return new Promise(function (resolve) {
            var logs = [];

            xhr.open('GET', url, true);

            xhr.addEventListener('readystatechange', function () {
                var log = 'ready state change event ' + this.readyState;

                if (logs[logs.length - 1] !== log)
                    logs.push(log);
            });

            xhr.addEventListener('load', function () {
                logs.push('load event');

                resolve(logs.join('\n'));
            });

            xhr.addEventListener('error', function () {
                logs.push('error event');

                resolve(logs.join('\n'));
            });

            xhr.send();
        });
    };

    var checkUrl = function (url) {
        return Promise.all([
            performRequest(new XMLHttpRequest(), url),
            performRequest(XhrSandbox.createNativeXHR(), url)
        ])
            .then(function (logs) {
                strictEqual(logs[0], logs[1]);
            });
    };

    return Promise.all([
        checkUrl('/close-request'),
        checkUrl('/respond-500')
    ]);
});
