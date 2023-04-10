var urlUtils      = hammerhead.utils.url;
var headersUtils  = hammerhead.sharedUtils.headers;
var nativeMethods = hammerhead.nativeMethods;
var browserUtils  = hammerhead.utils.browser;
var Promise       = hammerhead.Promise;
var fetchSandbox  = hammerhead.sandbox.fetch;
var settings      = hammerhead.settings;

if (window.fetch) {
    test('fetch.toString (GH-1662)', function () {
        strictEqual(fetch.toString(), nativeMethods.fetch.toString());
    });

    test('global fetch - redirect request to proxy', function () {
        return fetch('/xhr-test/100', { credentials: 'same-origin' })
            .then(function (response) {
                return response.text();
            })
            .then(function (url) {
                strictEqual(url, '/sessionId!a!1/https://example.com/xhr-test/100');
            });
    });

    test('Request - redirect request to proxy', function () {
        var request = new Request('/xhr-test/100', { credentials: 'omit' });

        return fetch(request)
            .then(function (response) {
                return response.text();
            })
            .then(function (url) {
                strictEqual(url, '/sessionId!a!2/https://example.com/xhr-test/100');
            });
    });

    test('nested Request - redirect request to proxy', function () {
        var request = new Request('/xhr-test/100', { credentials: 'include' });

        return fetch(new Request(request), { credentials: 'omit' })
            .then(function (response) {
                return response.text();
            })
            .then(function (url) {
                strictEqual(url, '/sessionId!a!2/https://example.com/xhr-test/100');
            });
    });

    test('pass arguments', function () {
        var data = {
            param1: 'value1',
            param2: 'value2',
        };

        return fetch('/echo-request-body', {
            method:  'post',
            body:    JSON.stringify(data),
            headers: {
                'Content-Type': 'application/json; charset=UTF-8',
            },
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
                expectedUrl: 'https://example.com/some-path',
            },
            {
                args:        [null],
                expectedUrl: 'https://example.com/null',
            },
            {
                args:        [void 0],
                expectedUrl: 'https://example.com/undefined',
            },
            {
                args:        [{ url: '/some-path' }],
                expectedUrl: 'https://example.com/[object%20Object]',
            },
            {
                args: [{
                    url:      '/some-path',
                    toString: function () {
                        return this.url;
                    },
                }],
                expectedUrl: 'https://example.com/some-path',
            },
        ];

        if (browserUtils.isSafari) {
            testCases.push({
                args:        [],
                expectedUrl: 'https://example.com/undefined',
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

    test('the failed cors request should emit an error', function () {
        return fetch(window.QUnitGlobals.crossDomainHostname + '/xhr-test/100')
            .catch(function (err) {
                ok(err);
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

    module('Response.type and Response.status', function () {
        test('basic', function () {
            return fetch('/xhr-test/100')
                .then(function (response) {
                    strictEqual(response.status, 200);
                    strictEqual(response.type, 'basic');
                });
        });
        test('cors', function () {
            return fetch(window.QUnitGlobals.crossDomainHostname + '/cors/')
                .then(function (response) {
                    strictEqual(response.status, 200);
                    strictEqual(response.type, 'cors');
                });
        });
        test('opaque', function () {
            return fetch(window.QUnitGlobals.crossDomainHostname + '/xhr-test/100', { mode: 'no-cors' })
                .then(function (response) {
                    strictEqual(response.status, 0);
                    strictEqual(response.type, 'opaque');
                });
        });
    });

    module('request modes', function () {
        module('no-cors');

        test('same-domain', function () {
            return fetch('/xhr-test/100', { mode: 'no-cors' })
                .then(function (response) {
                    strictEqual(response.status, 200);
                    strictEqual(response.type, 'basic');
                });
        });

        test('cross-domain', function () {
            return fetch(window.QUnitGlobals.crossDomainHostname + '/xhr-test/100', { mode: 'no-cors' })
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
        test('an instance of window.Headers should not iterate internal headers values', function () {
            var testHeaders = new Headers();

            testHeaders.append('Authorization', 'Basic qwerty');
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

                    deepEqual(result, ['authorization', 'Basic qwerty',
                        'content-type', 'application/json', 'x-header', 'value']);

                    var values = testHeaders.values();
                    var value  = values.next();

                    result = [];

                    while (!value.done) {
                        result = result.concat(value.value);
                        value  = values.next();
                    }

                    deepEqual(result, ['Basic qwerty', 'application/json', 'value']);

                    result = [];

                    testHeaders.forEach(result.push.bind(result));

                    deepEqual(result, ['Basic qwerty', 'authorization', testHeaders,
                        'application/json', 'content-type', testHeaders, 'value', 'x-header', testHeaders]);

                    result = [];

                    eval('for (const entry of testHeaders)' +
                         '    result = result.concat(entry);');

                    deepEqual(result, ['authorization', 'Basic qwerty',
                        'content-type', 'application/json', 'x-header', 'value']);
                });
        });

        test('an headers object passed to the fetch should not be changed', function () {
            var testHeaders = {
                'Content-Type':  'application/json; charset=UTF-8',
                'x-header':      'value',
                'authorization': 'Basic qwerty',
            };

            return fetch('/echo-request-headers', { method: 'post', headers: testHeaders })
                .then(function (res) {
                    return res.json();
                })
                .then(function (headers) {
                    strictEqual(testHeaders.authorization, 'Basic qwerty');
                    strictEqual(headers.authorization, headersUtils.addAuthorizationPrefix('Basic qwerty'));
                });
        });

        test('the www-authenticate and proxy-authenticate header processing', function () {
            var headers = new Headers();

            headers.set('content-type', 'text/plain');
            headers.set('www-authenticate', headersUtils.addAuthenticatePrefix('Basic realm="Login"'));
            headers.set('proxy-authenticate', headersUtils.addAuthenticatePrefix('Digital realm="Login"'));

            strictEqual(headers.get('WWW-Authenticate'), 'Basic realm="Login"');
            strictEqual(headers.get('Proxy-Authenticate'), 'Digital realm="Login"');
            strictEqual(nativeMethods.headersGet.call(headers, 'WWW-Authenticate'),
                headersUtils.addAuthenticatePrefix('Basic realm="Login"'));
            strictEqual(nativeMethods.headersGet.call(headers, 'Proxy-Authenticate'),
                headersUtils.addAuthenticatePrefix('Digital realm="Login"'));

            var headersValuesIterator = headers.values();
            var headersValuesArray    = [];

            for (var value = headersValuesIterator.next(); !value.done; value = headersValuesIterator.next())
                headersValuesArray.push(value.value);

            notEqual(headersValuesArray.indexOf('Basic realm="Login"'), -1);
            strictEqual(headersValuesArray.indexOf(headersUtils.addAuthenticatePrefix('Basic realm="Login"')), -1);

            var headersEntriesIterator = headers.entries();
            var headersEntriesArray    = [];

            for (var entry = headersEntriesIterator.next(); !entry.done; entry = headersEntriesIterator.next())
                headersEntriesArray.push(entry.value[0] + ': ' + entry.value[1]);

            var processedHeader = 'www-authenticate: ' + headersUtils.addAuthenticatePrefix('Basic realm="Login"');

            notEqual(headersEntriesArray.indexOf('www-authenticate: Basic realm="Login"'), -1);
            strictEqual(headersEntriesArray.indexOf(processedHeader), -1);

            headersEntriesArray = [];

            headers.forEach(function (hValue, hName) {
                headersEntriesArray.push(hName + ': ' + hValue);
            });

            notEqual(headersEntriesArray.indexOf('www-authenticate: Basic realm="Login"'), -1);
            strictEqual(headersEntriesArray.indexOf(processedHeader), -1);
        });

        test('the authorization and proxy-authorization header processing (GH-2344)', function () {
            var headers = {
                'content-type':        'text/plain',
                'Authorization':       'Basic qwerty',
                'proxy-Authorization': 'Digital abcdifg',
            };

            var storedFetch = nativeMethods.fetch;

            nativeMethods.fetch = function (url, init) {
                var proxyHeaders = init.headers;

                strictEqual(nativeMethods.headersGet.call(proxyHeaders, 'authorization'), headersUtils.addAuthorizationPrefix('Basic qwerty'));
                strictEqual(nativeMethods.headersGet.call(proxyHeaders, 'proxy-Authorization'), headersUtils.addAuthorizationPrefix('Digital abcdifg'));

                return window.Promise.resolve();
            };

            fetch('url', { headers: headers });

            nativeMethods.fetch = storedFetch;
        });

        test('set header functionality', function () {
            var headers = new Headers();

            headers.set('authorization', 'Basic');

            strictEqual(headers.get('authorization'), 'Basic');
            strictEqual(nativeMethods.headersGet.call(headers, 'authorization'), headersUtils.addAuthorizationPrefix('Basic'));
        });
    });

    test('wrappers of native functions should return the correct string representations', function () {
        window.checkStringRepresentation(window.Request, nativeMethods.Request, 'Request');
        window.checkStringRepresentation(window.fetch, nativeMethods.fetch, 'fetch');
        window.checkStringRepresentation(window.Headers.prototype.entries, nativeMethods.headersEntries,
            'Headers.prototype.entries');
        window.checkStringRepresentation(window.Headers.prototype.values, nativeMethods.headersValues,
            'Headers.prototype.values');
        window.checkStringRepresentation(window.Headers.prototype.forEach, nativeMethods.headersForEach,
            'Headers.prototype.forEach');
        window.checkStringRepresentation(window.Headers.prototype.get, nativeMethods.headersGet,
            'Headers.prototype.get');
        window.checkStringRepresentation(window.Headers.prototype.set, nativeMethods.headersSet,
            'Headers.prototype.set');
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
                    performRequest(nativeMethods.fetch, url),
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
                    },
                }),
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
                },
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
                headers: { header1: 'value1' },
            };
            var initWithHeader3           = {
                headers: { header3: 'value3' },
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
                    retrieveRequestBodyAsJson(nativeMethods.fetch.call(window, nativeRequest, initWithHeader3)),
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
                        },
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
                ['breaking-bad', '<3'],
                ['authorization', '123'],
            ];

            return fetch('/echo-request-headers', { method: 'post', headers: headersArr })
                .then(function (response) {
                    return response.json();
                })
                .then(function (headers) {
                    strictEqual(headers['content-type'], 'text/xml');
                    strictEqual(headers['breaking-bad'], '<3');
                    strictEqual(headers.authorization, headersUtils.addAuthorizationPrefix('123'));
                });
        });

        test('should not lost the headers if an request object and an option object without headers are passed to fetch (GH-2020)', function () {
            var request = new Request('/echo-request-headers', {
                headers: {
                    'Authorization': '123',
                    'Content-Type':  'charset=utf-8',
                },
            });

            return fetch(request, { cache: 'no-cache' })
                .then(function (response) {
                    return response.json();
                })
                .then(function (headers) {
                    strictEqual(headers.authorization, headersUtils.addAuthorizationPrefix('123'), 'Authorization');
                    strictEqual(headers['content-type'], 'charset=utf-8', 'Content-Type');
                });
        });

        test('the authorization header should be available by getting it from response.headers (GH-2334)', function () {
            var headers = { 'authorization': '123' };

            return fetch('/echo-request-body-in-response-headers', { method: 'post', body: JSON.stringify(headers) })
                .then(function (res) {
                    strictEqual(res.headers.get('authorization'), '123');
                    strictEqual(nativeMethods.headersGet.call(res.headers, 'authorization'), '123');
                });
        });
    });

    module('proxyless', function (hooks) {
        var storedSettings = settings.get();

        hooks.beforeEach(function () {
            settings.set({ ...storedSettings, nativeAutomation: true });
        });
        hooks.afterEach(function () {
            settings.set(storedSettings);
        });

        test('Request - should not redirect request to proxy', function () {
            var request = new Request('/xhr-test/100', { credentials: 'omit' });

            return fetch(request)
                .then(function (response) {
                    return response.text();
                })
                .then(function (url) {
                    strictEqual(url, '/xhr-test/100');
                });
        });

        test('global fetch - should not redirect request to proxy', function () {
            return fetch('/xhr-test/100', { credentials: 'same-origin' })
                .then(function (response) {
                    return response.text();
                })
                .then(function (url) {
                    strictEqual(url, '/xhr-test/100');
                });
        });

        test('response.url', function () {
            return fetch('/xhr-test/100')
                .then(function (response) {
                    strictEqual(response.url, location.origin + '/xhr-test/100');
                });
        });

        test('request.url', function () {
            var request = new Request('/xhr-test/100');

            strictEqual(request.url, location.origin + '/xhr-test/100');
        });

        asyncTest('should emit event', function () {
            expect(0);

            var eventRaisedListener = function () {
                fetchSandbox.off(fetchSandbox.FETCH_REQUEST_SENT_EVENT, eventRaisedListener);

                start();
            };

            fetchSandbox.on(fetchSandbox.FETCH_REQUEST_SENT_EVENT, eventRaisedListener);

            fetch('/xhr-test/100');
        });
    });
}
