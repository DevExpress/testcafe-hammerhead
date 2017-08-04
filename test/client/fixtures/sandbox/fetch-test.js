var xhrHeaders   = hammerhead.get('../request-pipeline/xhr/headers');
var destLocation = hammerhead.get('./utils/destination-location');
var urlUtils     = hammerhead.get('./utils/url');

var nativeMethods = hammerhead.nativeMethods;

if (window.fetch) {
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

    test('the internal 222 status code should be replaced with 0 on the client side', function () {
        return fetch('/xhr-222/')
            .then(function (response) {
                strictEqual(response.status, 0);
            });
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
                        strictEqual('omit', headers[xhrHeaders.fetchRequestCredentials]);
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
                        strictEqual('omit', headers[xhrHeaders.fetchRequestCredentials]);
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
                        strictEqual('same-origin', headers[xhrHeaders.fetchRequestCredentials]);
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
                        strictEqual('same-origin', headers[xhrHeaders.fetchRequestCredentials]);
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
                        strictEqual('https://example.com', headers[xhrHeaders.origin]);
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
                        strictEqual('https://example.com', headers[xhrHeaders.origin]);
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
                        strictEqual('https://example.com', headers[xhrHeaders.origin]);
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
                        strictEqual('https://example.com', headers[xhrHeaders.origin]);
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
                        strictEqual(headers[xhrHeaders.origin], 'file:///path/index.html');
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
                        strictEqual(headers[xhrHeaders.origin], 'file:///path/index.html');
                        destLocation.forceLocation('http://localhost/sessionId/https://example.com');
                    });
            });
        });
    });

    module('regression', function () {
        test('request promise should be rejected for the 500 http status code (GH-602)', function () {
            return fetch('/respond-500')
                .then(function (response) {
                    return response.text();
                })
                .then(function () {
                    ok(false, 'request promise should be rejected');
                })
                .catch(function (err) {
                    ok(err instanceof TypeError);
                });
        });

        test('request promise should be rejected on invalid calling (GH-939)', function () {
            var testCases = [
                123,
                function () {},
                null
            ];

            var createTestCasePromise = function (firstArg) {
                return fetch.call(window, firstArg)
                    .then(function () {
                        ok(false, 'wrong state of the request promise');
                    })
                    .catch(function () {
                        ok(true);
                    });
            };

            return Promise.all(testCases.map(createTestCasePromise));
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
    });
}


