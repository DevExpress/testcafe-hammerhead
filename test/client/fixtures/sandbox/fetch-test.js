var xhrHeaders = hammerhead.get('../request-pipeline/xhr/headers');

if (window.fetch) {
    asyncTest('global fetch - redirect request to proxy', function () {
        fetch('/xhr-test/100')
            .then(function (response) {
                return response.text();
            }).then(function (url) {
                strictEqual(url, '/sessionId/https://example.com/xhr-test/100');
                start();
            });
    });

    asyncTest('Request - redirect request to proxy', function () {
        var request = new Request('/xhr-test/100');

        fetch(request)
            .then(function (response) {
                return response.text();
            }).then(function (url) {
                strictEqual(url, '/sessionId/https://example.com/xhr-test/100');
                start();
            });
    });

    asyncTest('nested Request - redirect request to proxy', function () {
        var request = new Request('/xhr-test/100');

        fetch(new Request(request))
            .then(function (response) {
                return response.text();
            }).then(function (url) {
                strictEqual(url, '/sessionId/https://example.com/xhr-test/100');
                start();
            });
    });

    asyncTest('pass arguments', function () {
        var data = {
            param1: 'value1',
            param2: 'value2'
        };

        fetch('/echo-request-body', {
            method:  'post',
            headers: {
                'Content-Type': 'application/json; charset=UTF-8'
            },
            body: JSON.stringify(data)
        })
        .then(function (response) {
            return response.json();
        })
        .then(function (json) {
            strictEqual(JSON.stringify(json), JSON.stringify(data));
            start();
        });
    });

    asyncTest('the internal 222 status code should be replaced with 0 on the client side', function () {
        fetch('/xhr-222/')
            .then(function (response) {
                strictEqual(response.status, 0);

                start();
            });
    });

    module('Response.type', function () {
        asyncTest('basic', function () {
            fetch('/xhr-test/100')
                .then(function (response) {
                    strictEqual(response.type, 'basic');
                    start();
                });
        });
        asyncTest('cors', function () {
            fetch(window.QUnitGlobals.crossDomainHostname + '/xhr-test/100')
                .then(function (response) {
                    strictEqual(response.type, 'cors');
                    start();
                });
        });
        asyncTest('opaque', function () {
            fetch(window.QUnitGlobals.crossDomainHostname + '/xhr-222/')
                .then(function (response) {
                    strictEqual(response.type, 'opaque');
                    start();
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
            fetch('/xhr-test/100', { mode: 'no-cors' })
                .then(function (response) {
                    strictEqual(response.status, 0);
                    strictEqual(response.type, 'opaque');

                    start();
                });
        });

        module('same-origin');

        asyncTest('same-domain', function () {
            fetch('/xhr-test/100', { mode: 'same-origin' })
                .then(function (response) {
                    strictEqual(response.status, 200);
                    strictEqual(response.type, 'basic');

                    start();
                });
        });

        asyncTest('same-domain (sub-domain)', function () {
            fetch('https://sub-domain.example.com', { mode: 'same-origin' })
                .then(function () {
                    ok(false, 'request should not be performed');
                })
                .catch(function (err) {
                    ok(err instanceof TypeError);
                    start();
                });
        });

        asyncTest('cross-domain (global fetch)', function () {
            fetch('http://cross.domain.com', { mode: 'same-origin' })
                .then(function () {
                    ok(false, 'request should not be performed');
                })
                .catch(function (err) {
                    ok(err instanceof TypeError);
                    start();
                });
        });

        asyncTest('cross-domain (Request)', function () {
            var request = new Request('http://cross.domain.com', { mode: 'same-origin' });

            fetch(request)
                .then(function () {
                    ok(false, 'request should not be performed');
                })
                .catch(function (err) {
                    ok(err instanceof TypeError);
                    start();
                });
        });
    });

    module('special headers', function () {
        module('Fetch request credentials', function () {
            module('default values');

            asyncTest('headers is object', function () {
                fetch('/echo-request-headers', {
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
                    start();
                });
            });

            asyncTest('headers is window.Headers', function () {
                var testHeaders = new Headers();

                testHeaders.append('Content-Type', 'application/json; charset=UTF-8');

                fetch('/echo-request-headers', {
                    method:  'post',
                    headers: testHeaders
                })
                .then(function (response) {
                    return response.json();
                })
                .then(function (headers) {
                    strictEqual('omit', headers[xhrHeaders.fetchRequestCredentials]);
                    start();
                });
            });

            module('non-default values');

            asyncTest('headers is object', function () {
                fetch('/echo-request-headers', {
                    method:      'post',
                    headers:     { 'Content-Type': 'application/json; charset=UTF-8' },
                    credentials: 'same-origin'
                })
                .then(function (response) {
                    return response.json();
                })
                .then(function (headers) {
                    strictEqual('same-origin', headers[xhrHeaders.fetchRequestCredentials]);
                    start();
                });
            });

            asyncTest('headers is window.Headers', function () {
                var testHeaders = new Headers();

                testHeaders.append('Content-Type', 'application/json; charset=UTF-8');

                fetch('/echo-request-headers', {
                    method:      'post',
                    headers:     testHeaders,
                    credentials: 'same-origin'
                })
                .then(function (response) {
                    return response.json();
                })
                .then(function (headers) {
                    strictEqual('same-origin', headers[xhrHeaders.fetchRequestCredentials]);
                    start();
                });
            });
        });

        module('Origin', function () {
            module('global fetch');

            asyncTest('headers is object', function () {
                fetch('/echo-request-headers', {
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
                    start();
                });
            });

            asyncTest('headers is window.Headers', function () {
                var testHeaders = new Headers();

                testHeaders.append('Content-Type', 'application/json; charset=UTF-8');

                fetch('/echo-request-headers', {
                    method:  'post',
                    headers: testHeaders
                })
                .then(function (response) {
                    return response.json();
                })
                .then(function (headers) {
                    strictEqual('https://example.com', headers[xhrHeaders.origin]);
                    start();
                });
            });

            module('Request');

            asyncTest('headers is object', function () {
                var request = new Request('/echo-request-headers', {
                    method:  'post',
                    headers: {
                        'Content-Type': 'application/json; charset=UTF-8'
                    }
                });

                fetch(request)
                .then(function (response) {
                    return response.json();
                })
                .then(function (headers) {
                    strictEqual('https://example.com', headers[xhrHeaders.origin]);
                    start();
                });
            });

            asyncTest('headers is window.Headers', function () {
                var testHeaders = new Headers();

                testHeaders.append('Content-Type', 'application/json; charset=UTF-8');

                var request = new Request('/echo-request-headers', {
                    method:  'post',
                    headers: testHeaders
                });

                fetch(request)
                .then(function (response) {
                    return response.json();
                })
                .then(function (headers) {
                    strictEqual('https://example.com', headers[xhrHeaders.origin]);
                    start();
                });
            });
        });
    });

    module('regression', function () {
        asyncTest('request promise should be rejected for the 500 http status code (GH-602)', function () {
            expect(1);

            fetch('/respond-500')
                .then(function (response) {
                    return response.text();
                })
                .then(function () {
                    ok(false, 'request promise should be rejected');
                    start();
                })
                .catch(function (err) {
                    ok(err instanceof TypeError);
                    start();
                });
        });
    });
}


