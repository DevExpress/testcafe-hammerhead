var XhrSandbox     = hammerhead.sandboxes.XhrSandbox;
var destLocation   = hammerhead.utils.destLocation;
var urlUtils       = hammerhead.utils.url;
var sharedUrlUtils = hammerhead.sharedUtils.url;
var headersUtils   = hammerhead.sharedUtils.headers;

var nativeMethods = hammerhead.nativeMethods;
var xhrSandbox    = hammerhead.sandbox.xhr;
var Promise       = hammerhead.Promise;
var settings      = hammerhead.settings;

function getPrototypeFromChainContainsProp (obj, prop) {
    while (obj && !obj.hasOwnProperty(prop))
        obj = Object.getPrototypeOf(obj);

    return obj;
}

test('redirect requests to proxy', function () {
    var xhr = new XMLHttpRequest();

    xhr.open('get', '/xhr-test/100', false);
    xhr.send();

    strictEqual(xhr.responseText, '/sessionId!a!1/https://example.com/xhr-test/100');

    xhr = new XMLHttpRequest();

    xhr.open('get', 'https://example.com/xhr-test/200', false);
    xhr.send();

    strictEqual(xhr.responseText, '/sessionId!a!1/https://example.com/xhr-test/200');

    xhr = new XMLHttpRequest();

    xhr.open('get', '/xhr-test/150', false);
    xhr.withCredentials = true;
    xhr.send();

    strictEqual(xhr.responseText, '/sessionId!a!0/https://example.com/xhr-test/150');
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

test('different url types for xhr.open method (GH-1613)', function () {
    var storedNativeXhrOpen  = nativeMethods.xhrOpen;
    var xhr                  = new XMLHttpRequest();
    var getNativeOpenWrapper = function (expectedUrl) {
        return function (_method, url) {
            strictEqual(url, urlUtils.getProxyUrl(expectedUrl, {
                resourceType: urlUtils.stringifyResourceType({ isAjax: true }),
                credentials:  this.withCredentials ? sharedUrlUtils.Credentials.include : sharedUrlUtils.Credentials.sameOrigin,
            }));
        };
    };

    nativeMethods.xhrOpen = getNativeOpenWrapper('https://example.com/some-path');
    xhr.open('GET', new URL('https://example.com/some-path'));

    nativeMethods.xhrOpen = getNativeOpenWrapper('https://example.com/null');
    xhr.open('GET', null);

    nativeMethods.xhrOpen = getNativeOpenWrapper('https://example.com/undefined');
    xhr.open('GET', void 0);

    nativeMethods.xhrOpen = getNativeOpenWrapper('https://example.com/[object%20Object]');
    xhr.open('GET', { url: '/some-path' });

    nativeMethods.xhrOpen = getNativeOpenWrapper('https://example.com/some-path');
    xhr.open('GET', {
        toString: function () {
            return '/some-path';
        },
    });

    nativeMethods.xhrOpen = storedNativeXhrOpen;
});

test('throwing an error on invalid calling "open" method (GH-1613)', function () {
    var url = {
        toString: function () {
            return {};
        },
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

if (window.XMLHttpRequest) {
    test('wrappers of native functions should return the correct string representations', function () {
        window.checkStringRepresentation(window.XMLHttpRequest, nativeMethods.XMLHttpRequest, 'XMLHttpRequest');
        window.checkStringRepresentation(window.XMLHttpRequest.prototype.constructor, nativeMethods.XMLHttpRequest,
            'XMLHttpRequest.prototype.constructor');
        window.checkStringRepresentation(window.XMLHttpRequest.prototype.abort, nativeMethods.xhrAbort,
            'XMLHttpRequest.prototype.abort');
        window.checkStringRepresentation(window.XMLHttpRequest.prototype.open, nativeMethods.xhrOpen,
            'XMLHttpRequest.prototype.open');
        window.checkStringRepresentation(window.XMLHttpRequest.prototype.send, nativeMethods.xhrSend,
            'XMLHttpRequest.prototype.send');
        window.checkStringRepresentation(window.XMLHttpRequest.prototype.setRequestHeader,
            nativeMethods.xhrSetRequestHeader,
            'XMLHttpRequest.prototype.setRequestHeader');
        window.checkStringRepresentation(window.XMLHttpRequest.prototype.getResponseHeader,
            nativeMethods.xhrGetResponseHeader,
            'XMLHttpRequest.prototype.getResponseHeader');
        window.checkStringRepresentation(window.XMLHttpRequest.prototype.getAllResponseHeaders,
            nativeMethods.xhrGetAllResponseHeaders,
            'XMLHttpRequest.prototype.getAllResponseHeaders');
    });
}

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

test('the failed cors request should emit an error', function () {
    return new Promise(function (resolve, reject) {
        var xhr = new XMLHttpRequest();

        xhr.open('GET', window.QUnitGlobals.crossDomainHostname + '/echo-request-headers/', true);
        xhr.addEventListener('load', reject);
        xhr.addEventListener('error', resolve);
        xhr.send();
    })
        .then(function (err) {
            var xhr = err.target;

            strictEqual(xhr.response || xhr.responseText, '');
            strictEqual(xhr.status, 0);
        });
});

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

test('send the origin header correctly (GH-284)', function () {
    function xhrTestFunc (url, expectedParsedDescriptor, description) {
        var storedNativeXhrOpen = window['%hammerhead%'].nativeMethods.xhrOpen;
        var xhr                 = new XMLHttpRequest();

        window['%hammerhead%'].nativeMethods.xhrOpen = function (_method, proxyUrl) {
            var parsedProxyUrl = window['%hammerhead%'].utils.url.parseProxyUrl(proxyUrl);

            strictEqual(parsedProxyUrl.resourceType, expectedParsedDescriptor.resourceType, description + ' resourceType');
            strictEqual(parsedProxyUrl.reqOrigin, expectedParsedDescriptor.reqOrigin, description + ' reqOrigin');
            strictEqual(parsedProxyUrl.credentials, expectedParsedDescriptor.credentials, description + ' credentials');
        };

        xhr.open('POST', url, false);

        window['%hammerhead%'].nativeMethods.xhrOpen = storedNativeXhrOpen;
    }

    xhrTestFunc('/path', {
        resourceType: 'a',
        reqOrigin:    void 0,
        credentials:  sharedUrlUtils.Credentials.sameOrigin,
    }, 'same-domain src');

    destLocation.forceLocation('http://localhost/sessionId/file:///path/index.html');

    xhrTestFunc('/path', {
        resourceType: 'a',
        reqOrigin:    'null',
        credentials:  sharedUrlUtils.Credentials.sameOrigin,
    }, 'file: protocol src');

    destLocation.forceLocation('http://localhost/sessionId/http://example.com');

    xhrTestFunc('https://sub.example.com/path', {
        resourceType: 'a',
        reqOrigin:    'http://example.com',
        credentials:  sharedUrlUtils.Credentials.sameOrigin,
    }, 'cross-domain origin with http: protocol');

    destLocation.forceLocation('http://localhost/sessionId/https://example.com');

    xhrTestFunc('https://sub.example.com/path', {
        resourceType: 'a',
        reqOrigin:    'https://example.com',
        credentials:  sharedUrlUtils.Credentials.sameOrigin,
    }, 'cross-domain origin with https: protocol');

    return Promise.all([
        createTestIframe(),
        createTestIframe({ src: getSameDomainPageUrl('../../data/iframe/simple-iframe.html') }),
    ])
        .then(function (iframes) {
            function checkIframe (iframe, description) {
                iframe.contentWindow.eval('window.xhrTestFunc = ' + xhrTestFunc.toString());
                iframe.contentWindow.strictEqual = strictEqual;
                iframe.contentWindow.xhrTestFunc('https://example.com/path', {
                    resourceType: 'a',
                    reqOrigin:    void 0,
                    credentials:  sharedUrlUtils.Credentials.sameOrigin,
                }, description);
            }

            checkIframe(iframes[0], 'iframe without src');
            checkIframe(iframes[1], 'iframe with src');
        });
});

test('authorization headers by client should be processed (GH-1016)', function () {
    var xhr = new XMLHttpRequest();

    var processedHeaders       = {};
    var storedSetRequestHeader = nativeMethods.xhrSetRequestHeader;

    nativeMethods.xhrSetRequestHeader = function (name, value) {
        processedHeaders[name] = value;
    };

    xhr.setRequestHeader('Authorization', '123');
    xhr.setRequestHeader('x-header1', '456');
    xhr.setRequestHeader('Proxy-Authorization', '789');

    deepEqual(processedHeaders, {
        'Authorization':       headersUtils.addAuthorizationPrefix('123'),
        'x-header1':           '456',
        'Proxy-Authorization': headersUtils.addAuthorizationPrefix('789'),
    });

    nativeMethods.xhrSetRequestHeader = storedSetRequestHeader;
});

test('getResponseHeader', function () {
    var xhr = new XMLHttpRequest();

    var storedGetResponseHeader = nativeMethods.xhrGetResponseHeader;
    var makeGetResponseHeaderFn = function (value) {
        return function () {
            return value;
        };
    };

    var processedAuthenticateHeader = headersUtils.addAuthenticatePrefix('Basic realm="Login"');

    nativeMethods.xhrGetResponseHeader = makeGetResponseHeaderFn(processedAuthenticateHeader);

    strictEqual(xhr.getResponseHeader('content-type'), processedAuthenticateHeader);
    strictEqual(xhr.getResponseHeader('WWW-Authenticate'), 'Basic realm="Login"');
    strictEqual(xhr.getResponseHeader('proxy-Authenticate'), 'Basic realm="Login"');

    nativeMethods.xhrGetResponseHeader = makeGetResponseHeaderFn(null);

    strictEqual(xhr.getResponseHeader('WWW-Authenticate'), null);
    strictEqual(xhr.getResponseHeader('proxy-Authenticate'), null);

    nativeMethods.xhrGetResponseHeader = storedGetResponseHeader;
});

test('getAllResponseHeaders', function () {
    var xhr = new XMLHttpRequest();

    var storedGetAllResponseHeaders = nativeMethods.xhrGetAllResponseHeaders;

    nativeMethods.xhrGetAllResponseHeaders = function () {
        return 'connection: keep-alive\n' +
            'content-type: text/plain\n' +
            'date: Tue, 22 Dec 2020 12:37:49 GMT\n' +
            'proxy-authenticate: ' + headersUtils.addAuthenticatePrefix('Basic realm="Login"') +
            'keep-alive: timeout=5\n' +
            'transfer-encoding: chunked\n' +
            'www-authenticate: ' + headersUtils.addAuthenticatePrefix('Digital realm="Login"');
    };

    var headersStr = xhr.getAllResponseHeaders();

    ok(headersStr.indexOf('\nwww-authenticate: Digital realm="Login"') !== -1);
    ok(headersStr.indexOf('\nproxy-authenticate: Basic realm="Login"') !== -1);
    ok(headersStr.indexOf(headersUtils.addAuthenticatePrefix('')) === -1);

    nativeMethods.xhrGetAllResponseHeaders = storedGetAllResponseHeaders;
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
            performRequest(XhrSandbox.createNativeXHR(), url),
        ])
            .then(function (logs) {
                strictEqual(logs[0], logs[1]);
            });
    };

    return Promise.all([
        checkUrl('/close-request'),
        checkUrl('/respond-500'),
    ]);
});

test('should correctly send headers when the "withCredentials" property is changed', function () {
    var xhr = new XMLHttpRequest();

    xhr.open('get', '/echo-request-headers/');
    xhr.setRequestHeader('content-type', 'application/json');
    xhr.withCredentials = true;

    return new Promise(function (resolve) {
        xhr.addEventListener('load', resolve);
        xhr.send();
    })
        .then(function () {
            strictEqual(JSON.parse(xhr.responseText)['content-type'], 'application/json');

            if (nativeMethods.xhrResponseURLGetter) {
                strictEqual(nativeMethods.xhrResponseURLGetter.call(xhr),
                    'http://' + location.host + '/sessionId!a!0/https://example.com/echo-request-headers/');
            }

            xhr.open('get', '/echo-request-headers/');
            xhr.setRequestHeader('content-type', 'text/plain');
            xhr.withCredentials = false;

            // eslint-disable-next-line consistent-return
            return new Promise(function (resolve) {
                xhr.addEventListener('load', resolve);
                xhr.send();
            });
        })
        .then(function () {
            strictEqual(JSON.parse(xhr.responseText)['content-type'], 'text/plain');
            strictEqual(nativeMethods.xhrResponseURLGetter.call(xhr),
                'http://' + location.host + '/sessionId!a!1/https://example.com/echo-request-headers/');
        });
});

test('should handle blob object urls (GH-1397)', function () {
    return new Promise(function (resolve) {
        var xhr = new XMLHttpRequest();
        var blob = new Blob(['this is a text'], { type: 'plain/text' });
        var url = URL.createObjectURL(blob);

        xhr.open('get', url, false);
        xhr.addEventListener('load', function () {
            resolve(xhr);
        });

        xhr.send();
    }).then(function (xhr) {
        strictEqual(xhr.responseText, 'this is a text');
    });
});

module('nativeAutomation', function (hooks) {
    var storedSettings = settings.get();

    hooks.beforeEach(function () {
        settings.set({ ...storedSettings, nativeAutomation: true });
    });
    hooks.afterEach(function () {
        settings.set(storedSettings);
    });

    test('xhr.open method', function () {
        var xhr = new XMLHttpRequest();

        xhr.open('get', '/xhr-test/100', false);
        xhr.send();

        strictEqual(xhr.responseText, '/xhr-test/100');

        xhr = new XMLHttpRequest();

        xhr.open('get', '/xhr-test/100', false);
        xhr.withCredentials = true;
        xhr.send();

        strictEqual(xhr.responseText, '/xhr-test/100');
    });

    test('xhr.responseURL', function () {
        var xhr = new XMLHttpRequest();

        xhr.open('get', '/xhr-test/100', false);
        xhr.send();

        strictEqual(xhr.responseURL, location.origin + '/xhr-test/100');
    });

    test('should handle blob object urls (GH-1397)', function () {
        return new Promise(function (resolve) {
            var xhr = new XMLHttpRequest();
            var blob = new Blob(['this is a text'], { type: 'plain/text' });
            var url = URL.createObjectURL(blob);

            xhr.open('get', url, false);
            xhr.addEventListener('load', function () {
                resolve(xhr);
            });

            xhr.send();
        }).then(function (xhr) {
            strictEqual(xhr.responseText, 'this is a text');
        });
    });
});


