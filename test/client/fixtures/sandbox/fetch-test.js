var destLocation     = hammerhead.get('./utils/destination-location');
var urlUtils         = hammerhead.get('./utils/url');
var INTERNAL_HEADERS = hammerhead.get('../request-pipeline/internal-header-names');

var nativeMethods = hammerhead.nativeMethods;
var browserUtils  = hammerhead.utils.browser;
var Promise       = hammerhead.Promise;

if (window.fetch) {
    test('fetch.toString (GH-1662)', function () {
        strictEqual(fetch.toString(), nativeMethods.fetch.toString());
    });

    test('global fetch - redirect request to proxy', function () {
        return fetch('/xhr-test/100')
            .then(function (response) {
                return response.text();
            })
            .then(function (url) {
                strictEqual(url, '/sessionId/https://example.com/xhr-test/100');
            });
    });

    test('Request - redirect request to proxy', function () {
        var request = new Request('/xhr-test/100');

        return fetch(request)
            .then(function (response) {
                return response.text();
            })
            .then(function (url) {
                strictEqual(url, '/sessionId/https://example.com/xhr-test/100');
            });
    });

    test('nested Request - redirect request to proxy', function () {
        var request = new Request('/xhr-test/100');

        return fetch(new Request(request))
            .then(function (response) {
                return response.text();
            })
            .then(function (url) {
                strictEqual(url, '/sessionId/https://example.com/xhr-test/100');
            });
    });

    test('pass arguments', function () {
        var data = {
            param1: 'value1',
            param2: 'value2'
        };

        return fetch('/echo-request-body', {
            method:  'post',
            body:    JSON.stringify(data),
            headers: {
                'Content-Type': 'application/json; charset=UTF-8'
            }
        })
            .then(function (response) {
                return response.json();
            })
            .then(function (json) {
                strictEqual(JSON.stringify(json), JSON.stringify(data));
            });
    });

    test('different url types for "fetch" (GH-1613)', function () {
        var testCases = [
            {
                args:        [new URL('https://example.com/some-path')],
                expectedUrl: 'https://example.com/some-path'
            },
            {
                args:        [null],
                expectedUrl: 'https://example.com/null'
            },
            {
                args:        [void 0],
                expectedUrl: 'https://example.com/undefined'
            },
            {
                args:        [{ url: '/some-path' }],
                expectedUrl: 'https://example.com/[object%20Object]'
            },
            {
                args: [{
                    url:      '/some-path',
                    toString: function () {
                        return this.url;
                    }
                }],
                expectedUrl: 'https://example.com/some-path'
            }
        ];

        if (browserUtils.isSafari) {
            testCases.push({
                args:        [],
                expectedUrl: 'https://example.com/undefined'
            });
        }

        var createTestCasePromise = function (testCase) {
            return fetch.apply(window, testCase.args)
                .then(function (response) {
                    strictEqual(response.url, testCase.expectedUrl);
                });
        };

        return Promise.all(testCases.map(createTestCasePromise));
    });

    test('the internal 222 status code should be replaced with 0 on the client side', function () {
        return fetch('/xhr-222/')
            .then(function (response) {
                strictEqual(response.status, 0);
            });
    });

    test('response.url', function () {
        return fetch('/xhr-test/100')
            .then(function (response) {
                strictEqual(response.url, 'https://example.com/xhr-test/100');
            });
    });

    test('request.url', function () {
        var request = new Request('/xhr-test/100');

        strictEqual(request.url, 'https://example.com/xhr-test/100');
    });

    module('Response.type', function () {
        test('basic', function () {
            return fetch('/xhr-test/100')
                .then(function (response) {
                    strictEqual(response.type, 'basic');
                });
        });
        test('cors', function () {
            return fetch(window.QUnitGlobals.crossDomainHostname + '/xhr-test/100')
                .then(function (response) {
                    strictEqual(response.type, 'cors');
                });
        });
        test('opaque', function () {
            return fetch(window.QUnitGlobals.crossDomainHostname + '/xhr-222/')
                .then(function (response) {
                    strictEqual(response.type, 'opaque');
                });
        });
    });

    module('request modes', function () {
        module('no-cors');

        // NOTE: not supported scenario
        // It is impossible to add custom headers to the fetch request
        // with the 'no-cors' mode
        // see https://fetch.spec.whatwg.org/#concept-headers-guard
        // https://fetch.spec.whatwg.org/#cors-safelisted-request-header
        QUnit.skip('same-domain', function () {
            return fetch('/xhr-test/100', { mode: 'no-cors' })
                .then(function (response) {
                    strictEqual(response.status, 0);
                    strictEqual(response.type, 'opaque');
                });
        });

        module('same-origin');

        test('same-domain', function () {
            return fetch('/xhr-test/100', { mode: 'same-origin' })
                .then(function (response) {
                    strictEqual(response.status, 200);
                    strictEqual(response.type, 'basic');
                });
        });

        test('same-domain (sub-domain)', function () {
            return fetch('https://sub-domain.example.com', { mode: 'same-origin' })
                .then(function () {
                    ok(false, 'request should not be performed');
                })
                .catch(function (err) {
                    ok(err instanceof TypeError);
                });
        });

        test('cross-domain (global fetch)', function () {
            return fetch('http://cross.domain.com', { mode: 'same-origin' })
                .then(function () {
                    ok(false, 'request should not be performed');
                })
                .catch(function (err) {
                    ok(err instanceof TypeError);
                });
        });

        test('cross-domain (Request)', function () {
            var request = new Request('http://cross.domain.com', { mode: 'same-origin' });

            return fetch(request)
                .then(function () {
                    ok(false, 'request should not be performed');
                })
                .catch(function (err) {
                    ok(err instanceof TypeError);
                });
        });
    });

    module('special headers', function () {
        test('an instance of window.Headers should not iterate internal headers', function () {
            var testHeaders = new Headers();

            testHeaders.append('Content-Type', 'application/json');
            testHeaders.append('x-header', 'value');

            return fetch('/echo-request-headers', { method: 'post', headers: testHeaders })
                .then(function () {
                    var entries = testHeaders.entries();
                    var entry   = entries.next();
                    var result  = [];

                    while (!entry.done) {
                        result = result.concat(entry.value);
                        entry  = entries.next();
                    }

                    deepEqual(result, ['content-type', 'application/json', 'x-header', 'value']);

                    var values = testHeaders.values();
                    var value  = values.next();

                    result = [];

                    while (!value.done) {
                        result = result.concat(value.value);
                        value  = values.next();
                    }

                    deepEqual(result, ['application/json', 'value']);

                    result = [];

                    testHeaders.forEach(result.push.bind(result));

                    deepEqual(result, ['application/json', 'content-type', testHeaders, 'value', 'x-header', testHeaders]);

                    result = [];

                    eval('for (const entry of testHeaders)' +
                         '    result = result.concat(entry);');

                    deepEqual(result, ['content-type', 'application/json', 'x-header', 'value']);
                });
        });

        test('an headers object passed to the fetch should not be changed', function () {
            var testHeaders = {
                'Content-Type': 'application/json; charset=UTF-8',
                'x-header':     'value'
            };

            return fetch('/echo-request-headers', { method: 'post', headers: testHeaders })
                .then(function () {
                    notOk(INTERNAL_HEADERS.credentials in testHeaders);
                    notOk(INTERNAL_HEADERS.origin in testHeaders);
                });
        });

        test('the www-authenticate and proxy-authenticate header processing', function () {
            var headers = { 'content-type': 'text/plain' };

            headers[INTERNAL_HEADERS.wwwAuthenticate]   = 'Basic realm="Login"';
            headers[INTERNAL_HEADERS.proxyAuthenticate] = 'Digital realm="Login"';

            return fetch('/echo-request-body-in-response-headers', { method: 'post', body: JSON.stringify(headers) })
                .then(function (res) {
                    strictEqual(nativeMethods.headersHas.call(res.headers, INTERNAL_HEADERS.wwwAuthenticate), true);
                    strictEqual(nativeMethods.headersHas.call(res.headers, INTERNAL_HEADERS.proxyAuthenticate), true);
                    strictEqual(nativeMethods.headersHas.call(res.headers, 'www-authenticate'), false);
                    strictEqual(nativeMethods.headersHas.call(res.headers, 'proxy-authenticate'), false);
                    strictEqual(res.headers.has('WWW-Authenticate'), true);
                    strictEqual(res.headers.get('WWW-Authenticate'), 'Basic realm="Login"');
                    strictEqual(res.headers.has('Proxy-Authenticate'), true);
                    strictEqual(res.headers.get('Proxy-Authenticate'), 'Digital realm="Login"');

                    var headersValuesIterator = res.headers.values();
                    var headersValuesArray    = [];

                    for (var value = headersValuesIterator.next(); !value.done; value = headersValuesIterator.next())
                        headersValuesArray.push(value.value);

                    notEqual(headersValuesArray.indexOf('Basic realm="Login"'), -1);

                    var headersEntriesIterator = res.headers.entries();
                    var headersEntriesArray    = [];

                    for (var entry = headersEntriesIterator.next(); !entry.done; entry = headersEntriesIterator.next())
                        headersEntriesArray.push(entry.value[0] + ': ' + entry.value[1]);

                    notEqual(headersEntriesArray.indexOf('www-authenticate: Basic realm="Login"'), -1);

                    headersEntriesArray = [];

                    res.headers.forEach(function (hValue, hName) {
                        headersEntriesArray.push(hName + ': ' + hValue);
                    });

                    notEqual(headersEntriesArray.indexOf('www-authenticate: Basic realm="Login"'), -1);
                });
        });

        test('the authorization and proxy-authorization header processing (GH-2344)', function () {
            var headers = { 'content-type': 'text/plain' };

            headers['Authorization']       = 'Basic qwerty';
            headers['proxy-Authorization'] = 'Digital abcdifg';

            return fetch('/echo-request-headers', { method: 'post', headers: headers })
                .then(function (res) {
                    return res.json();
                })
                .then(function (proxyHeaders) {
                    notOk('authorization' in proxyHeaders);
                    notOk('proxy-authorization' in proxyHeaders);
                    strictEqual(proxyHeaders[INTERNAL_HEADERS.authorization], 'Basic qwerty');
                    strictEqual(proxyHeaders[INTERNAL_HEADERS.proxyAuthorization], 'Digital abcdifg');
                });
        });

        test('set header functionality', function () {
            var headers = new Headers();

            headers.set(INTERNAL_HEADERS.authorization, 'Basic');

            strictEqual(nativeMethods.headersHas.call(headers, INTERNAL_HEADERS.authorization), true);
            strictEqual(nativeMethods.headersHas.call(headers, 'authorization'), false);
            strictEqual(nativeMethods.headersGet.call(headers, INTERNAL_HEADERS.authorization), 'Basic');
            strictEqual(nativeMethods.headersGet.call(headers, 'authorization'), null);

            strictEqual(headers.has('authorization'), true);
            strictEqual(headers.get('authorization'), 'Basic');
        });

        module('Fetch request credentials', function () {
            module('default values');

            test('headers is object', function () {
                return fetch('/echo-request-headers', {
                    method:  'post',
                    headers: {
                        'Content-Type': 'application/json; charset=UTF-8'
                    }
                })
                    .then(function (response) {
                        return response.json();
                    })
                    .then(function (headers) {
                        ok(headers.hasOwnProperty(INTERNAL_HEADERS.credentials));
                    });
            });

            test('headers is window.Headers', function () {
                var testHeaders = new Headers();

                testHeaders.append('Content-Type', 'application/json; charset=UTF-8');

                return fetch('/echo-request-headers', {
                    method:  'post',
                    headers: testHeaders
                })
                    .then(function (response) {
                        return response.json();
                    })
                    .then(function (headers) {
                        ok(headers.hasOwnProperty(INTERNAL_HEADERS.credentials));
                    });
            });

            module('non-default values');

            test('headers is object', function () {
                return fetch('/echo-request-headers', {
                    method:      'post',
                    headers:     { 'Content-Type': 'application/json; charset=UTF-8' },
                    credentials: 'same-origin'
                })
                    .then(function (response) {
                        return response.json();
                    })
                    .then(function (headers) {
                        strictEqual(headers[INTERNAL_HEADERS.credentials], 'same-origin');
                    });
            });

            test('headers is window.Headers', function () {
                var testHeaders = new Headers();

                testHeaders.append('Content-Type', 'application/json; charset=UTF-8');

                return fetch('/echo-request-headers', {
                    method:      'post',
                    headers:     testHeaders,
                    credentials: 'same-origin'
                })
                    .then(function (response) {
                        return response.json();
                    })
                    .then(function (headers) {
                        strictEqual(headers[INTERNAL_HEADERS.credentials], 'same-origin');
                    });
            });
        });

        module('Origin', function () {
            module('global fetch');

            test('headers is object', function () {
                return fetch('/echo-request-headers', {
                    method:  'post',
                    headers: {
                        'Content-Type': 'application/json; charset=UTF-8'
                    }
                })
                    .then(function (response) {
                        return response.json();
                    })
                    .then(function (headers) {
                        strictEqual(headers[INTERNAL_HEADERS.origin], 'https://example.com');
                    });
            });

            test('headers is window.Headers', function () {
                var testHeaders = new Headers();

                testHeaders.append('Content-Type', 'application/json; charset=UTF-8');

                return fetch('/echo-request-headers', {
                    method:  'post',
                    headers: testHeaders
                })
                    .then(function (response) {
                        return response.json();
                    })
                    .then(function (headers) {
                        strictEqual(headers[INTERNAL_HEADERS.origin], 'https://example.com');
                    });
            });

            module('Request');

            test('headers is object', function () {
                var request = new Request('/echo-request-headers', {
                    method:  'post',
                    headers: {
                        'Content-Type': 'application/json; charset=UTF-8'
                    }
                });

                return fetch(request)
                    .then(function (response) {
                        return response.json();
                    })
                    .then(function (headers) {
                        strictEqual(headers[INTERNAL_HEADERS.origin], 'https://example.com');
                    });
            });

            test('headers is window.Headers', function () {
                var testHeaders = new Headers();

                testHeaders.append('Content-Type', 'application/json; charset=UTF-8');

                var request = new Request('/echo-request-headers', {
                    method:  'post',
                    headers: testHeaders
                });

                return fetch(request)
                    .then(function (response) {
                        return response.json();
                    })
                    .then(function (headers) {
                        strictEqual(headers[INTERNAL_HEADERS.origin], 'https://example.com');
                    });
            });

            module('location with file protocol');

            test('headers is object', function () {
                destLocation.forceLocation('http://localhost/sessionId/file:///path/index.html');

                return fetch('/echo-request-headers', {
                    method:  'post',
                    headers: { 'Content-Type': 'application/json; charset=UTF-8' }
                })
                    .then(function (response) {
                        return response.json();
                    })
                    .then(function (headers) {
                        strictEqual(headers[INTERNAL_HEADERS.origin], 'file:///path/index.html');
                        destLocation.forceLocation('http://localhost/sessionId/https://example.com');
                    });
            });

            test('headers is window.Headers', function () {
                destLocation.forceLocation('http://localhost/sessionId/file:///path/index.html');

                var testHeaders = new Headers();

                testHeaders.append('Content-Type', 'application/json; charset=UTF-8');

                return fetch('/echo-request-headers', {
                    method:  'post',
                    headers: testHeaders
                })
                    .then(function (response) {
                        return response.json();
                    })
                    .then(function (headers) {
                        strictEqual(headers[INTERNAL_HEADERS.origin], 'file:///path/index.html');
                        destLocation.forceLocation('http://localhost/sessionId/https://example.com');
                    });
            });
        });
    });

    module('regression', function () {
        test('should emulate native browser behavior for fetch requests that end with an error or non-success status code (GH-1397)', function () {
            var performRequest = function (fetchFn, url) {
                var logs = [];

                return fetchFn(url)
                    .then(function (response) {
                        logs.push('fetch resolved');
                        logs.push('status ' + response.status);
                        logs.push('statusText ' + response.statusText);

                        return response.text();
                    })
                    .then(function () {
                        logs.push('response body read');
                    })
                    .catch(function (err) {
                        logs.push('fetch rejected');
                        logs.push(err);
                    })
                    .then(function () {
                        return logs.join('\n');
                    });
            };

            var checkUrl = function (url) {
                return Promise.all([
                    performRequest(fetch, url),
                    performRequest(nativeMethods.fetch, url)
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

        test('request promise should be rejected on invalid calling (GH-939)', function () {
            var checkArg = function () {
                return fetch.apply(window, arguments)
                    .then(function () {
                        ok(false, 'wrong state of the request promise');
                    })
                    .catch(function () {
                        ok(true);
                    });
            };

            var cases = [
                checkArg({
                    toString: function () {
                        return {};
                    }
                })
            ];

            // NOTE: Safari processed `fetch()` without `Promise` rejection (GH-1613)
            if (!browserUtils.isSafari)
                cases.push(checkArg());

            return Promise.all(cases);
        });

        test('should return non-overridden Promise on calling the "fetch" without parameters (GH-1099)', function () {
            var storedWindowPromise = window.Promise;

            window.Promise = {
                reject: function () {
                }
            };

            var fetchPromise = fetch();

            strictEqual(fetchPromise.constructor, storedWindowPromise);

            window.Promise = storedWindowPromise;
        });

        module('should emulate native behaviour on headers overwriting', function () {
            // NOTE: These tests fail in the Android 6.0 browser with the following errors:
            // Failed to construct 'Request': Cannot construct a Request with a Request object that has already been used.
            // Failed to execute 'fetch' on 'Window': Cannot construct a Request with a Request object that has already been used.
            if (browserUtils.isAndroid)
                return;

            var initWithHeader1           = {
                headers: { header1: 'value1' }
            };
            var initWithHeader3           = {
                headers: { header3: 'value3' }
            };
            var retrieveRequestBodyAsJson = function (fetchPromise) {
                return fetchPromise
                    .then(function (response) {
                        return response.json();
                    })
                    .then(function (headers) {
                        return headers;
                    });
            };

            test('nested Requests', function () {
                var request1       = new Request('/echo-request-headers', initWithHeader1);
                var request2       = new Request(request1);
                var request3       = new Request(request1, initWithHeader3);
                var nativeRequest1 = new nativeMethods.Request('/echo-request-headers', initWithHeader1);
                var nativeRequest2 = new nativeMethods.Request(nativeRequest1);
                var nativeRequest3 = new nativeMethods.Request(nativeRequest1, initWithHeader3);

                strictEqual(request1.headers.has('header1'), nativeRequest1.headers.has('header1'));
                strictEqual(request2.headers.has('header1'), nativeRequest2.headers.has('header1'));
                strictEqual(request3.headers.has('header1'), nativeRequest3.headers.has('header1'));
                strictEqual(request3.headers.has('header3'), nativeRequest3.headers.has('header3'));
            });

            test('global fetch', function () {
                var request       = new Request('/echo-request-headers', initWithHeader1);
                var proxiedUrl    = urlUtils.getProxyUrl('/echo-request-headers');
                var nativeRequest = new nativeMethods.Request(proxiedUrl, initWithHeader1);

                return Promise.all([
                    retrieveRequestBodyAsJson(fetch('/echo-request-headers', initWithHeader1)),
                    retrieveRequestBodyAsJson(fetch(request)),
                    retrieveRequestBodyAsJson(fetch(request, initWithHeader3)),
                    retrieveRequestBodyAsJson(nativeMethods.fetch.call(window, proxiedUrl, initWithHeader1)),
                    retrieveRequestBodyAsJson(nativeMethods.fetch.call(window, nativeRequest)),
                    retrieveRequestBodyAsJson(nativeMethods.fetch.call(window, nativeRequest, initWithHeader3))
                ])
                    .then(function (data) {
                        var request1Headers       = data[0];
                        var request2Headers       = data[1];
                        var request3Headers       = data[2];
                        var nativeRequest1Headers = data[3];
                        var nativeRequest2Headers = data[4];
                        var nativeRequest3Headers = data[5];

                        strictEqual(request1Headers['header1'], nativeRequest1Headers['header1']);
                        strictEqual(request2Headers['header1'], nativeRequest2Headers['header1']);
                        strictEqual(request3Headers['header1'], nativeRequest3Headers['header1']);
                        strictEqual(request3Headers['header3'], nativeRequest3Headers['header3']);
                    });
            });
        });

        test('should emulate native promise behaviour if the catch is first in chain (GH-1234)', function () {
            return fetch('/xhr-test/100')
                .catch(function () {
                })
                .then(function (response) {
                    strictEqual(response.status, 200);
                    strictEqual(response.type, 'basic');
                });
        });

        test('should not duplicate values of internal headers (GH-1360)', function () {
            var reqInit = {
                credentials: 'same-origin',
                headers:     new Headers({
                    'content-type': 'application/json'
                })
            };

            fetch('/echo-request-headers', reqInit);
            fetch('/echo-request-headers', reqInit);

            var origin                  = reqInit.headers.get(INTERNAL_HEADERS.origin);
            var fetchRequestCredentials = reqInit.headers.get(INTERNAL_HEADERS.credentials);

            strictEqual(origin, 'https://example.com');
            strictEqual(fetchRequestCredentials, 'same-origin');
        });

        test('should use the native "then" function (GH-TC-2686)', function () {
            var storedPromiseThen = window.Promise.prototype.then;

            window.Promise.prototype.then = function () {
                throw new Error('non-native function is called');
            };

            var fetchPromise = fetch('/xhr-test/100');

            window.Promise.prototype.then = storedPromiseThen;

            return fetchPromise
                .then(function (response) {
                    strictEqual(response.status, 200);
                });
        });

        test('should use the native "reject" function (GH-TC-2686)', function () {
            var storedPromiseReject = window.Promise.reject;

            window.Promise.reject = function () {
                throw new Error('non-native function is called');
            };

            return fetch('https://sub-domain.example.com', { mode: 'same-origin' })
                .catch(function () {
                    ok(true);

                    return fetch({
                        toString: function () {
                            return {};
                        }
                    });
                })
                .catch(function () {
                    window.Promise.reject = storedPromiseReject;

                    ok(true);
                });
        });

        test('should not throw an error when a data-url is used (GH-TC-2865)', function () {
            return fetch('data:text/plain,foo')
                .then(function (res) {
                    return res.text();
                })
                .then(function (body) {
                    strictEqual(body, 'foo');
                });
        });

        test('should not throw an error when a data-url is used in Request constructor (GH-2428)', function () {
            return fetch(new Request('data:text/plain,foo'))
                .then(function (res) {
                    return res.text();
                })
                .then(function (body) {
                    strictEqual(body, 'foo');
                });
        });

        test('should process headers passed as an array', function () {
            var headersArr = [
                ['content-type', 'text/xml'],
                ['breaking-bad', '<3']
            ];

            return fetch('/echo-request-headers', { method: 'post', headers: headersArr })
                .then(function (response) {
                    return response.json();
                })
                .then(function (headers) {
                    ok(headers['content-type'], 'text/xml');
                    ok(headers['breaking-bad'], '<3');
                    ok(headers.hasOwnProperty(INTERNAL_HEADERS.credentials));
                });
        });

        test('should not lost the headers if an request object and an option object without headers are passed to fetch (GH-2020)', function () {
            var request = new Request('/echo-request-headers', {
                headers: {
                    'Authorization': '123',
                    'Content-Type':  'charset=utf-8'
                }
            });

            return fetch(request, { cache: 'no-cache' })
                .then(function (response) {
                    return response.json();
                })
                .then(function (headers) {
                    strictEqual(headers[INTERNAL_HEADERS.authorization], '123', 'Authorization');
                    strictEqual(headers['content-type'], 'charset=utf-8', 'Content-Type');
                });
        });
    });
}
