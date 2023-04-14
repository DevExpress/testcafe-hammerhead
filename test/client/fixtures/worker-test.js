var urlUtils = hammerhead.utils.url;

var nativeMethods = hammerhead.nativeMethods;
var browserUtils  = hammerhead.utils.browser;
var Promise       = hammerhead.Promise;


module('Web Worker');

test('window.Worker should be overridden', function () {
    notEqual(window.Worker, nativeMethods.Worker);
});

test('throwing errors (GH-1132)', function () {
    throws(function () {
        window.Worker();
    }, TypeError);

    throws(function () {
        // eslint-disable-next-line no-new
        new Worker();
    }, TypeError);
});

test('checking parameters (GH-1132, GH-2512)', function () {
    var savedNativeWorker = nativeMethods.Worker;
    var workerOptions     = { name: 'test' };
    var resourceType      = urlUtils.stringifyResourceType({ isScript: true });

    nativeMethods.Worker = function (scriptURL) {
        strictEqual(arguments.length, 1);
        strictEqual(scriptURL, urlUtils.getProxyUrl('/test', { resourceType: resourceType }));
    };
    /* eslint-disable no-new */
    new Worker('/test');
    // NOTE: GH-2512
    new Worker({
        toString: function () {
            return '/test';
        },
    });

    nativeMethods.Worker = function (scriptURL, options) {
        strictEqual(arguments.length, 2);
        strictEqual(scriptURL, urlUtils.getProxyUrl('/test', { resourceType: resourceType }));
        strictEqual(options, workerOptions);
    };
    new Worker('/test', workerOptions);
    /* eslint-enable no-new */

    nativeMethods.Worker = savedNativeWorker;
});

if (!browserUtils.isSafari) {
    test('should work with the operator "instanceof" (GH-690)', function () {
        var blob   = new Blob(['if(true) {}'], { type: 'text/javascript' });
        var url    = URL.createObjectURL(blob);
        var worker = new Worker(url);

        ok(worker instanceof Worker);

        worker.terminate();
    });
}

test('calling overridden window.Worker should not cause the "use the \'new\'..." error (GH-1970)', function () {
    expect(0);

    var SavedWindowWorker = window.Worker;

    window.Worker = function (scriptURL) {
        return new SavedWindowWorker(scriptURL);
    };

    try {
        var worker = new Worker('/test');
    }
    catch (e) {
        ok(false);
    }

    worker.terminate();

    window.Worker = SavedWindowWorker;
});

test('calling Worker without the "new" keyword (GH-1970)', function () {
    expect(1);

    try {
        Worker('/test');
    }
    catch (e) {
        ok(true);
    }
});

test('send xhr from worker', function () {
    var worker = new Worker(window.QUnitGlobals.getResourceUrl('../data/web-worker/xhr.js'));

    return waitForMessage(worker)
        .then(function (proxyUrl) {
            strictEqual(proxyUrl, '/sessionId!a!1/https://example.com/xhr-test/100');

            worker.terminate();
        });
});

test('importScripts', function () {
    var worker = new Worker(window.QUnitGlobals.getResourceUrl('../data/web-worker/import-scripts.js'));

    return waitForMessage(worker)
        .then(function (requestUrls) {
            strictEqual(requestUrls[0], '/sessionId!s/https://example.com/url1/script-url.js');
            strictEqual(requestUrls[1], '/sessionId!s/https://example.com/url2/script-url.js');

            worker.terminate();
        });
});

if (nativeMethods.fetch) {
    test('send fetch from worker', function () {
        var worker = new Worker(window.QUnitGlobals.getResourceUrl('../data/web-worker/fetch.js'));

        return waitForMessage(worker)
            .then(function (proxyUrl) {
                strictEqual(proxyUrl, '/sessionId!a!2/https://example.com/xhr-test/50');

                worker.terminate();
            });
    });
}

if (!browserUtils.isSafari) {
    asyncTest('window.Blob with type=javascript must be overriden (T259367)', function () {
        var script = ['self.onmessage = function() { var t = {};', '__set$(t, "blobTest", true); postMessage(t.blobTest); };'];
        var blob   = new window.Blob(script, { type: 'texT/javascript' });
        var url    = window.URL.createObjectURL(blob);
        var worker = new window.Worker(url);

        worker.onmessage = function (e) {
            strictEqual(e.data, true);
            worker.terminate();
            start();
        };

        worker.postMessage('');
    });

    asyncTest('should try to process data as a script even if the content type is not passed', function () {
        var script  = 'var obj = {}, prop = "prop"; obj[prop] = true; postMessage(true);';
        var fileURL = URL.createObjectURL(new File([script], 'script.js'));
        var worker  = new Worker(fileURL);

        worker.onmessage = function (e) {
            ok(e.data);

            worker.terminate();
            start();
        };
    });

    test('send request with relative url from worker with object url', function () {
        var scriptWithRelativeUrl        = [
            'var xhr = new XMLHttpRequest();',
            'try {',
            '    xhr.open("post", "/echo-request-headers/");',
            '}',
            'catch (e) {',
            '    postMessage(e.toString());',
            '}',
        ].join('\n');
        var scriptWithUrlWithoutProtocol = scriptWithRelativeUrl.replace('/echo-request-headers/', '//example.com/echo-request-headers/');
        var runBlob                      = function (blob) {
            var fileURL = URL.createObjectURL(blob);
            var worker  = new Worker(fileURL);

            return waitForMessage(worker)
                .then(function (msg) {
                    worker.terminate();

                    return msg;
                });
        };

        return Promise.all([
            runBlob(new nativeMethods.Blob([scriptWithRelativeUrl])),
            runBlob(new Blob([scriptWithRelativeUrl])),
            runBlob(new nativeMethods.Blob([scriptWithUrlWithoutProtocol])),
            runBlob(new Blob([scriptWithUrlWithoutProtocol])),
        ])
            .then(function (errors) {
                strictEqual(errors[0], errors[1]);
                strictEqual(errors[2], errors[3]);
            });
    });

    test('send xhr from worker with object url', function () {
        var script  = [
            'var xhr = new XMLHttpRequest();',
            'xhr.open("get", "https://example.com/xhr-test/20");',
            'xhr.addEventListener("load", function () {',
            '    postMessage(xhr.responseText);',
            '});',
            'xhr.send();',
        ].join('\n');
        var fileURL = URL.createObjectURL(new File([script], 'script.js'));
        var worker  = new Worker(fileURL);

        return waitForMessage(worker)
            .then(function (proxyUrl) {
                strictEqual(proxyUrl, '/sessionId!a!1/https://example.com/xhr-test/20');

                worker.terminate();
            });
    });

    test('send fetch from worker with object url', function () {
        var script  = [
            'fetch("https://example.com/xhr-test/30")',
            '    .then(res => res.text())' +
            '    .then(text => postMessage(text));',
        ].join('\n');
        var fileURL = URL.createObjectURL(new File([script], 'script.js'));
        var worker  = new Worker(fileURL);

        return waitForMessage(worker)
            .then(function (proxyUrl) {
                strictEqual(proxyUrl, '/sessionId!a!1/https://example.com/xhr-test/30');

                worker.terminate();
            });
    });

    asyncTest('blob: should try to process data as a script even if the content type is not passed (GH-231)', function () {
        var script  = 'var obj = {}, prop = "prop"; obj[prop] = true; postMessage(true);';
        var blobURL = URL.createObjectURL(new Blob([script]));
        var worker  = new Worker(blobURL);

        worker.onmessage = function (e) {
            ok(e.data);
            worker.terminate();
            start();
        };
    });

    test('blob: should support using importScripts', function () {
        var script  = 'importScripts("' + window.getSameDomainPageUrl('../data/web-worker/simple.js') + '")';
        var blobURL = URL.createObjectURL(new Blob([script]));
        var worker  = new Worker(blobURL);

        return waitForMessage(worker)
            .then(function (data) {
                strictEqual(data.foo, 'bar');

                worker.terminate();
            });
    });
}

if (window.navigator.serviceWorker) {
    module('Service Worker');

    test('window.navigator.serviceWorker.register (GH-797)', function () {
        var storedNative = nativeMethods.registerServiceWorker;
        var scriptUrl    = '/serviceWorker.js';
        var scopeUrl     = '/path';

        nativeMethods.registerServiceWorker = function (url, options) {
            var resourceType = urlUtils.stringifyResourceType({ isServiceWorker: true });

            strictEqual(url, urlUtils.getProxyUrl(scriptUrl, { resourceType: resourceType }));
            strictEqual(options.scope, '/');

            nativeMethods.registerServiceWorker = storedNative;

            return new Promise(function () {});
        };

        window.navigator.serviceWorker.register(scriptUrl, { scope: scopeUrl });
    });

    test('should reject a Promise for unsecure url (GH-1411)', function () {
        return window.navigator.serviceWorker.register('http://example.com/worker.js')
            .then(function () {
                ok(false);
            })
            .catch(function () {
                ok(true);
            });
    });

    // NOTE: Service workers are only accessible via https. The easiest way around it is
    // to go to http://localhost instead of the IP address of the computer you are running.
    // https://www.chromium.org/Home/chromium-security/prefer-secure-origins-for-powerful-new-features
    // This condition works only for running on the local machine only. On Saucelabs url with a domain name is opened.
    if (location.hostname === 'localhost') {
        test('should correctly process the "scope" option into the serviceWorker.register (GH-1233)', function () {
            var scriptUrl = window.QUnitGlobals.getResourceUrl('../data/service-worker/simple-service-worker.js');

            return window.navigator.serviceWorker.register(scriptUrl, { scope: '/' })
                .then(function (reg) {
                    var worker = reg.installing || reg.waiting || reg.active;

                    worker.postMessage('unregister');
                    ok(true);
                })
                .catch(function (err) {
                    ok(false, err);
                });
        });

        test('window.navigator.serviceWorker.getRegistration (GH-1618)', function () {
            expect(1);

            var scriptUrl = window.QUnitGlobals.getResourceUrl('../data/service-worker/simple-service-worker.js');
            var scopeUrl  = '/';

            return window.navigator.serviceWorker.register(scriptUrl, { scope: scopeUrl })
                .then(function () {
                    window.navigator.serviceWorker.getRegistration(scopeUrl)
                        .then(function (reg) {
                            ok(!!reg);

                            var worker = reg.installing || reg.waiting || reg.active;

                            worker.postMessage('unregister');
                        })
                        .catch(function (err) {
                            ok(false, err);
                        });
                });
        });

        test('wrong scope', function () {
            var scriptUrl         = window.QUnitGlobals.getResourceUrl('../data/service-worker/wrong-scope.js');
            var storedPostMessage = ServiceWorker.prototype.postMessage;

            ServiceWorker.prototype.postMessage = function (msg, ports) {
                msg.currentScope = '/wrong/';

                storedPostMessage.call(this, msg, ports);
            };

            return window.navigator.serviceWorker.register(scriptUrl, { scope: '/' })
                .catch(function (err) {
                    strictEqual(err.message, 'The path of the provided scope (\'/\') is not under the max scope ' +
                        'allowed (\'/wrong/\'). Adjust the scope, move the Service Worker script, or use the ' +
                        'Service-Worker-Allowed HTTP header to allow the scope.');
                    ServiceWorker.prototype.postMessage = storedPostMessage;
                });
        });

        test('wrong scope header', function () {
            var scriptUrl = window.QUnitGlobals.getResourceUrl('../data/service-worker/wrong-scope-header.js');

            return window.navigator.serviceWorker.register(scriptUrl, { scope: '/' })
                .catch(function (err) {
                    strictEqual(err.message, 'The path of the provided scope (\'/\') is not under the max scope ' +
                        'allowed (set by Service-Worker-Allowed: \'/some/\'). Adjust the scope, move the Service ' +
                        'Worker script, or use the Service-Worker-Allowed HTTP header to allow the scope.');
                });
        });

        test('fetch event', function () {
            var scriptUrl     = top.QUnitGlobals.getResourceUrl('../data/service-worker/fetch-event.js');
            var serviceWorker = null;

            return navigator.serviceWorker.register(scriptUrl, { scope: '/path/' })
                .then(function (reg) {
                    serviceWorker = reg.installing || reg.waiting || reg.active;

                    return createTestIframe({ src: urlUtils.getProxyUrl('/path/iframe-created-from-service-worker.html') });
                })
                .then(function (iframe) {
                    var p = iframe.contentDocument.querySelector('p');

                    strictEqual(p.textContent, 'Hello from your friendly neighbourhood service worker!');
                    serviceWorker.postMessage('unregister');
                });
        });

        test('fetch event (incorrect scope)', function () {
            var scriptUrl     = top.QUnitGlobals.getResourceUrl('../data/service-worker/fetch-event.js');
            var serviceWorker = null;

            return navigator.serviceWorker.register(scriptUrl, { scope: '/path/and/path/' })
                .then(function (reg) {
                    serviceWorker = reg.installing || reg.waiting || reg.active;

                    return createTestIframe({ src: urlUtils.getProxyUrl('/path/iframe-created-from-service-worker.html') });
                })
                .then(function (iframe) {
                    var p = iframe.contentDocument.querySelector('p');

                    strictEqual(p, null);
                    serviceWorker.postMessage('unregister');
                });
        });

        test('fetch event (other hostname)', function () {
            var scriptUrl = top.QUnitGlobals.getResourceUrl('../data/service-worker/fetch-event-other-host.js');

            return navigator.serviceWorker.register(scriptUrl, { scope: '/path/' })
                .then(function (reg) {
                    var serviceWorker  = reg.installing || reg.waiting || reg.active;
                    var messageChannel = new MessageChannel();

                    serviceWorker.postMessage('callback', [messageChannel.port1]);

                    return createTestIframe({ src: urlUtils.getProxyUrl('/path/iframe-created-from-service-worker.html') })
                        .then(function () {
                            return new Promise(function (resolve) {
                                messageChannel.port2.onmessage = resolve;
                            });
                        });
                })
                .then(function (e) {
                    strictEqual(e.data, 'image requested');
                });
        });
    }

    asyncTest('navigator.serviceWorker in the iframe is not available (GH-277)', function () {
        var iframe = document.createElement('iframe');

        nativeMethods.setAttribute.call(iframe, 'sandbox', 'allow-scripts');

        iframe.src = getCrossDomainPageUrl('../data/cross-domain/service-worker-not-available.html');

        var onMessageHandler = function (e) {
            window.removeEventListener('message', onMessageHandler);

            var isRegisterServiceWorker = e.data;

            strictEqual(isRegisterServiceWorker, browserUtils.isFirefox);

            document.body.removeChild(iframe);

            start();
        };

        window.addEventListener('message', onMessageHandler);

        document.body.appendChild(iframe);
    });
}
