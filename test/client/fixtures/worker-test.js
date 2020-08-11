var urlUtils = hammerhead.get('./utils/url');

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

test('checking parameters (GH-1132)', function () {
    var savedNativeWorker = nativeMethods.Worker;
    var workerOptions     = { name: 'test' };
    var resourceType      = urlUtils.stringifyResourceType({ isScript: true });

    nativeMethods.Worker = function (scriptURL) {
        strictEqual(arguments.length, 1);
        strictEqual(scriptURL, urlUtils.getProxyUrl('/test', { resourceType: resourceType }));
    };
    // eslint-disable-next-line no-new
    new Worker('/test');

    nativeMethods.Worker = function (scriptURL, options) {
        strictEqual(arguments.length, 2);
        strictEqual(scriptURL, urlUtils.getProxyUrl('/test', { resourceType: resourceType }));
        strictEqual(options, workerOptions);
    };
    /* eslint-disable no-new */
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
    });
}

test('calling overridden window.Worker should not cause the "use the \'new\'..." error (GH-1970)', function () {
    expect(0);

    var SavedWindowWorker = window.Worker;

    window.Worker = function (scriptURL) {
        return new SavedWindowWorker(scriptURL);
    };

    try {
        // eslint-disable-next-line no-new
        new Worker('/test');
    }
    catch (e) {
        ok(false);
    }

    window.Worker = SavedWindowWorker;
});

test('calling Worker without the "new" keyword (GH-1970)', function () {
    expect(browserUtils.isIE11 || browserUtils.isMSEdge ? 0 : 1);

    try {
        Worker('/test');
    }
    catch (e) {
        ok(true);
    }
});

if (!browserUtils.isIE) {
    test('send xhr from worker', function () {
        var worker = new Worker(window.QUnitGlobals.getResourceUrl('../data/web-worker/xhr.js'));

        return new Promise(function (resolve) {
            worker.onmessage = function (e) {
                worker.onmessage = void 0;

                resolve(JSON.parse(e.data));
            };
        })
            .then(function (headers) {
                strictEqual(headers['x-hammerhead-credentials'], 'same-origin');
                strictEqual(headers['x-hammerhead-origin'], 'https://example.com');
            });
    });
}

if (nativeMethods.fetch) {
    test('send fetch from worker', function () {
        var worker = new Worker(window.QUnitGlobals.getResourceUrl('../data/web-worker/fetch.js'));

        return new Promise(function (resolve) {
            worker.onmessage = function (e) {
                worker.onmessage = void 0;

                resolve(e.data);
            };
        })
            .then(function (headers) {
                strictEqual(headers['x-hammerhead-credentials'], 'omit');
                strictEqual(headers['x-hammerhead-origin'], 'https://example.com');
            });
    });
}

if (!browserUtils.isIE && !browserUtils.isSafari) {
    asyncTest('window.Blob with type=javascript must be overriden (T259367)', function () {
        var script = ['self.onmessage = function() { var t = {};', '__set$(t, "blobTest", true); postMessage(t.blobTest); };'];
        var blob   = new window.Blob(script, { type: 'texT/javascript' });
        var url    = window.URL.createObjectURL(blob);
        var worker = new window.Worker(url);

        worker.onmessage = function (e) {
            strictEqual(e.data, true);
            start();
        };

        worker.postMessage('');
    });
}

module('Service Worker');

if (window.navigator.serviceWorker) {
    test('window.navigator.serviceWorker.register (GH-797)', function () {
        var storedNative = nativeMethods.registerServiceWorker;
        var scriptUrl    = '/serviceWorker.js';
        var scopeUrl     = '/';

        nativeMethods.registerServiceWorker = function (url, options) {
            var resourceType = urlUtils.stringifyResourceType({ isScript: true });

            strictEqual(url, urlUtils.getProxyUrl(scriptUrl, { resourceType: resourceType }));
            strictEqual(options.scope, urlUtils.getProxyUrl(scopeUrl, { resourceType: resourceType }));

            nativeMethods.registerServiceWorker = storedNative;
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
            var scriptUrl = window.QUnitGlobals.getResourceUrl('../data/serviceWorker.js');
            var scopeUrl  = '/';

            return window.navigator.serviceWorker.register(scriptUrl, { scope: scopeUrl })
                .then(function () {
                    ok(true);
                })
                .catch(function (err) {
                    ok(false, err);
                });
        });

        test('window.navigator.serviceWorker.getReqistration (GH-1618)', function () {
            expect(1);

            var scriptUrl = window.QUnitGlobals.getResourceUrl('../data/serviceWorker.js');
            var scopeUrl  = '/';

            return window.navigator.serviceWorker.register(scriptUrl, { scope: scopeUrl })
                .then(function () {
                    window.navigator.serviceWorker.getRegistration(scopeUrl)
                        .then(function (serviceWorkerRegistration) {
                            ok(!!serviceWorkerRegistration);
                        })
                        .catch(function (err) {
                            ok(false, err);
                        });
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

    // NOTE: https://connect.microsoft.com/IE/feedback/details/801810/web-workers-from-blob-urls-in-ie-10-and-11
    var isWorkerFromBlobSupported = (function () {
        try {
            return !!new Worker(URL.createObjectURL(new Blob(['var a = 42;'])));
        }
        catch (e) {
            return false;
        }
    })();

    if (isWorkerFromBlobSupported) {
        asyncTest('blob should try to process data as a script even if the content type is not passed (GH-231)', function () {
            var script  = 'var obj = {}, prop = "prop"; obj[prop] = true; postMessage(true);';
            var blobURL = URL.createObjectURL(new Blob([script]));

            new Worker(blobURL).onmessage = function (e) {
                ok(e.data);
                start();
            };
        });
    }
}
