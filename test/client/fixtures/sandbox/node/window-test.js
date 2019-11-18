var urlUtils     = hammerhead.get('./utils/url');
var destLocation = hammerhead.get('./utils/destination-location');

var windowSandox  = hammerhead.sandbox.node.win;
var nativeMethods = hammerhead.nativeMethods;
var browserUtils  = hammerhead.utils.browser;

test('window.onerror setter/getter', function () {
    var storedOnErrorHandler = window.onerror;

    window.onerror = null;

    strictEqual(window.onerror, null);

    window.onerror = 123;

    strictEqual(window.onerror, null);

    var handler = function () {
    };

    window.onerror = handler;

    strictEqual(window.onerror, handler);

    window.onerror = storedOnErrorHandler;
});

if (nativeMethods.winOnUnhandledRejectionSetter) {
    module('unhandledrejection event (GH-1247)', function () {
        asyncTest('window.onunhandledrejection should be instrumented', function () {
            strictEqual(window.onunhandledrejection, null);

            window.onunhandledrejection = 123;

            strictEqual(window.onunhandledrejection, null);

            var handler = function (event) {
                ok(true, 'origin event called');
                ok(arguments.length, 1);
                ok(event instanceof window.PromiseRejectionEvent);
            };

            window.onunhandledrejection = handler;

            strictEqual(window.onunhandledrejection, handler);

            hammerhead.on(hammerhead.EVENTS.unhandledRejection, function onUnhandledRejection (event) {
                strictEqual(event.msg, 'unhandled rejection');
                hammerhead.off(hammerhead.EVENTS.unhandledRejection, onUnhandledRejection);
                start();
            });

            // eslint-disable-next-line no-new
            new Promise(function (resolve, reject) {
                reject('unhandled rejection');
            });
        });

        test('should not rise hh event when the unhandledrejection event prevented', function () {
            var testPreventing = function () {
                return new hammerhead.Promise(function (resolve) {
                    var timeoutId = null;

                    var onUnhandledRejection = function () {
                        clearTimeout(timeoutId);
                        hammerhead.off(hammerhead.EVENTS.unhandledRejection, onUnhandledRejection);
                        ok(false, 'hh event not prevented');
                        resolve();
                    };

                    timeoutId = setTimeout(function () {
                        hammerhead.off(hammerhead.EVENTS.unhandledRejection, onUnhandledRejection);
                        ok(true, 'hh event prevented');
                        resolve();
                    }, 500);

                    hammerhead.on(hammerhead.EVENTS.unhandledRejection, onUnhandledRejection);

                    // eslint-disable-next-line no-new
                    new Promise(function () {
                        throw new Error('unhandled rejection');
                    });
                });
            };

            return hammerhead.Promise.resolve()
                .then(function () {
                    window.onunhandledrejection = function () {
                        return false;
                    };

                    return testPreventing();
                })
                .then(function () {
                    window.onunhandledrejection = function (event) {
                        event.preventDefault();
                    };

                    return testPreventing();
                })
                .then(function () {
                    window.onunhandledrejection = null;

                    window.addEventListener('unhandledrejection', function onUnhandledRejection (event) {
                        event.preventDefault();
                        window.removeEventListener('unhandledrejection', onUnhandledRejection);
                    });

                    return testPreventing();
                });
        });

        test('should convert an unhandled rejection reason to string', function () {
            var testMsg = function (err) {
                return new Promise(function (resolve) {
                    hammerhead.on(hammerhead.EVENTS.unhandledRejection, function onUnhandledRejection (event) {
                        hammerhead.off(hammerhead.EVENTS.unhandledRejection, onUnhandledRejection);
                        resolve(event.msg);
                    });
                    // eslint-disable-next-line no-new
                    new Promise(function () {
                        throw err;
                    });
                });
            };

            return testMsg(null)
                .then(function (msg) {
                    ok(['undefined', '[object Null]'].indexOf(msg) !== -1);

                    return testMsg(void 0);
                })
                .then(function (msg) {
                    strictEqual(msg, 'undefined');

                    return testMsg('string message');
                })
                .then(function (msg) {
                    strictEqual(msg, 'string message');

                    return testMsg(1);
                })
                .then(function (msg) {
                    strictEqual(msg, '1');

                    return testMsg(true);
                })
                .then(function (msg) {
                    strictEqual(msg, 'true');

                    return testMsg(Symbol('foo'));
                })
                .then(function (msg) {
                    strictEqual(msg, 'Symbol(foo)');

                    return testMsg(new Error('error message'));
                })
                .then(function (msg) {
                    strictEqual(msg, 'error message');

                    return testMsg(new TypeError('type error'));
                })
                .then(function (msg) {
                    strictEqual(msg, 'type error');

                    return testMsg({ a: 1 });
                })
                .then(function (msg) {
                    strictEqual(msg, '[object Object]');

                    return testMsg(function () {
                    });
                })
                .then(function (msg) {
                    strictEqual(msg, '[object Function]');
                });
        });
    });
}

if (window.FontFace) {
    test('FontFace', function () {
        var nativeFontFace = nativeMethods.FontFace;
        var url            = 'https://fonts.com/fs_albert.woff2';
        var desc           = {};

        nativeMethods.FontFace = function (family, source, descriptors) {
            strictEqual(family, 'family');
            strictEqual(source, 'url("' + urlUtils.getProxyUrl(url) + '")');
            ok(descriptors, desc);

            nativeMethods.FontFace = nativeFontFace;
        };

        return new FontFace('family', 'url("' + url + '")', desc);
    });

    test('should work with the operator "instanceof" (GH-690)', function () {
        var fontFace = new FontFace('family', 'url("someUrl")', {});

        ok(fontFace instanceof window.FontFace);
    });
}

test('parameters passed to the native function in its original form', function () {
    // XHR
    var xhr = new nativeMethods.XMLHttpRequest();

    checkNativeFunctionArgs('abort', 'xhrAbort', xhr);

    nativeMethods.xhrOpen.call(xhr, 'GET', '/path', true);
    checkNativeFunctionArgs('send', 'xhrSend', xhr);

    // registerServiceWorker
    if (nativeMethods.registerServiceWorker)
        checkNativeFunctionArgs('register', 'registerServiceWorker', window.navigator.serviceWorker);

    // Event
    checkNativeFunctionArgs('addEventListener', 'windowAddEventListener', window);
    checkNativeFunctionArgs('removeEventListener', 'windowRemoveEventListener', window);

    // Canvas
    var canvas = document.createElement('canvas');

    checkNativeFunctionArgs('drawImage', 'canvasContextDrawImage', canvas.getContext('2d'));

    // FormData
    if (window.FormData)
        checkNativeFunctionArgs('append', 'formDataAppend', new window.FormData());

    if (window.navigator.registerProtocolHandler)
        checkNativeFunctionArgs('registerProtocolHandler', 'registerProtocolHandler', window.navigator);

    if (!browserUtils.isIE || browserUtils.version >= 12) {
        checkNativeFunctionArgs('setTimeout', 'setTimeout', window);
        checkNativeFunctionArgs('setTimeout', 'setTimeout', window);
    }

    var documentFragment = document.createDocumentFragment();

    checkNativeFunctionArgs('querySelector', 'documentFragmentQuerySelector', documentFragment);
    checkNativeFunctionArgs('querySelectorAll', 'documentFragmentQuerySelectorAll', documentFragment);
    checkNativeFunctionArgs('dispatchEvent', 'windowDispatchEvent', window);
});

if (window.history.replaceState && window.history.pushState) {
    test('window.history.replaceState, window.history.pushState', function () {
        function SomeClass () {
            this.url = 'url';
        }

        SomeClass.prototype.toString = function () {
            return this.url;
        };

        var urlValues = [
            'string',
            12345,
            true,
            false,
            NaN,
            Infinity,
            null,
            void 0,
            new SomeClass()
        ];

        return createTestIframe({ src: getSameDomainPageUrl('../../../data/history/iframe.html') })
            .then(function (iframe) {
                var iframeWindow        = iframe.contentWindow;
                var iframeHammerhead    = iframeWindow['%hammerhead%'];
                var iframeHistory       = iframeWindow.history;
                var iframeNativeMethods = iframeHammerhead.nativeMethods;
                var iframeLocation      = iframeWindow.location;
                var baseUrl             = 'http://' + location.host + '/some/path';

                iframeHammerhead.get('./utils/url-resolver').updateBase(baseUrl, iframe.contentDocument);
                iframeHammerhead.get('./utils/destination-location')
                    .forceLocation('http://' + iframeLocation.host + '/sessionId/' + baseUrl);

                var testUrl = function (url, fn, nativeFn) {
                    nativeFn.call(iframeHistory, null, null, baseUrl);
                    nativeFn.call(iframeHistory, null, null, url);

                    var destUrl           = iframeLocation.toString();
                    var destUrlNotChanged = destUrl === baseUrl;

                    nativeFn.call(iframeHistory, null, null, baseUrl);
                    fn.call(iframeHistory, null, null, url);

                    var parsedProxyUrl = urlUtils.parseProxyUrl(iframeLocation.toString());

                    if (parsedProxyUrl)
                        strictEqual(destUrl, parsedProxyUrl.destUrl);
                    else
                        ok(destUrlNotChanged);
                };

                for (var i = 0; i < urlValues.length; i++) {
                    var url = urlValues[i];

                    testUrl(url, iframeHistory.replaceState, iframeNativeMethods.historyReplaceState);
                    testUrl(url, iframeHistory.pushState, iframeNativeMethods.historyPushState);
                }
            });
    });
}

test('an overridden "target" attribute getter should return the same value as origin getter (attribute value is not defined)', function () {
    var anchor = document.createElement('a');
    var area   = document.createElement('area');
    var base   = document.createElement('base');
    var form   = document.createElement('form');

    strictEqual(nativeMethods.anchorTargetGetter.call(anchor), anchor.target);
    strictEqual(nativeMethods.areaTargetGetter.call(area), area.target);
    strictEqual(nativeMethods.baseTargetGetter.call(base), base.target);
    strictEqual(nativeMethods.formTargetGetter.call(form), form.target);
});

test('an overridden "formtarget" attribute getter should return the same value as origin getter (attribute value is not defined)', function () {
    var input  = document.createElement('input');
    var button = document.createElement('button');

    strictEqual(nativeMethods.inputFormTargetGetter.call(input), input.formTarget);
    strictEqual(nativeMethods.buttonFormTargetGetter.call(button), button.formTarget);
});

module('should format "stack" property');

test('UNCAUGHT_JS_ERROR_EVENT', function () {
    var Promise = window.Promise || hammerhead.Promise;

    var testCases = [
        {
            event: {
                error: {
                    message: void 0,
                    stack:   void 0
                },
            },
            expectedStack: 'undefined:\n    No stack trace available'
        },
        {
            event: {
                error: {
                    message: 'test message',
                    stack:   '    line 1\n    line2'
                },
            },
            expectedStack: 'test message:\n    line 1\n    line2'
        },
        {
            event: {
                error: {
                    message: 'test message',
                    stack:   'Error: test message:\n    line1\n    line2'
                },
            },
            expectedStack: 'Error: test message:\n    line1\n    line2'
        },
        {
            event: {
                error:   null,
                message: 'test message'
            },
            expectedStack: 'test message:\n    No stack trace available'
        }
    ];

    var testStack = function (testCase) {
        return new Promise(function (resolve) {
            var handler = function (msg) {
                windowSandox.off(hammerhead.EVENTS.uncaughtJsError, handler);

                strictEqual(testCase.expectedStack, msg.stack);
                resolve();
            };

            windowSandox.on(hammerhead.EVENTS.uncaughtJsError, handler);
            windowSandox._raiseUncaughtJsErrorEvent(hammerhead.EVENTS.uncaughtJsError, testCase.event, window);
        });
    };

    return Promise.all(testCases.map(function (item) {
        return testStack(item);
    }));
});

if (nativeMethods.winOnUnhandledRejectionSetter) {
    test('UNHANDLED_REJECTION_EVENT', function () {
        var error = new Error('test');

        var testCases = [
            {
                reason:        'test reason',
                expectedStack: 'test reason:\n    No stack trace available'
            },
            {
                reason:        null,
                expectedStack: '[object Null]:\n    No stack trace available'
            },
            {
                reason:        error,
                expectedStack: error.stack
            }
        ];

        var testStack = function (testCase) {
            return new Promise(function (resolve) {
                var handler = function (msg) {
                    windowSandox.off(hammerhead.EVENTS.unhandledRejection, handler);

                    strictEqual(testCase.expectedStack, msg.stack);
                    resolve();
                };

                windowSandox.on(hammerhead.EVENTS.unhandledRejection, handler);
                windowSandox._raiseUncaughtJsErrorEvent(hammerhead.EVENTS.unhandledRejection, { reason: testCase.reason }, window);
            });
        };

        return Promise.all(testCases.map(function (item) {
            return testStack(item);
        }));
    });
}

if (nativeMethods.windowOriginGetter) {
    test('should override window.origin', function () {
        strictEqual(window.origin, 'https://example.com');

        var storedWindowOriginGetter = nativeMethods.windowOriginGetter;

        nativeMethods.windowOriginGetter = function () {
            return null;
        };

        strictEqual(window.origin, null);

        nativeMethods.windowOriginGetter = storedWindowOriginGetter;

        strictEqual(window.origin, 'https://example.com');

        var storedForcedLocation = destLocation.getLocation();

        destLocation.forceLocation(urlUtils.getProxyUrl('file:///home/testcafe/site'));

        strictEqual(window.origin, null);

        destLocation.forceLocation(storedForcedLocation);
    });
}

module('regression');

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

if (window.navigator.sendBeacon) {
    test('Navigator.sendBeacon must be overriden (GH-1035)', function () {
        var originUrl    = 'http://example.com/index.html';
        var originData   = 'some data';
        var nativeMethod = nativeMethods.sendBeacon;

        nativeMethods.sendBeacon = function (url, data) {
            strictEqual(url, urlUtils.getProxyUrl(originUrl));
            strictEqual(data, originData);
            nativeMethods.sendBeacon = nativeMethod;
        };

        window.navigator.sendBeacon(originUrl, originData);
    });
}

test('window.onerror must be overriden (B238830)', function () {
    var error     = false;
    var windowObj = window.Window;

    window.onerror = function () {
        error = true;
    };

    window.Window = function () {
    };

    window.addEventListener('click', function () {
    });

    window.Window = windowObj;

    ok(!error);
});

test('should not raise internal events if an origin error event is prevented', function () {
    var testPreventing = function () {
        return new hammerhead.Promise(function (resolve) {
            var timeoutId = null;

            var onUncaughtError = function () {
                clearTimeout(timeoutId);
                hammerhead.off(hammerhead.EVENTS.uncaughtJsError, onUncaughtError);
                ok(false, 'internal event is raised');
                resolve();
            };

            timeoutId = setTimeout(function () {
                hammerhead.off(hammerhead.EVENTS.uncaughtJsError, onUncaughtError);
                ok(true, 'internal event is not raised');
                resolve();
            }, 500);

            hammerhead.on(hammerhead.EVENTS.uncaughtJsError, onUncaughtError);

            setTimeout(function () {
                throw new Error('error occurs');
            }, 0);
        });
    };

    return hammerhead.Promise.resolve()
        .then(function () {
            window.onerror = function () {
                setTimeout(function () {
                    window.onerror = null;
                }, 10);

                return true;
            };

            return testPreventing();
        })
        .then(function () {
            if (browserUtils.isIE11 || browserUtils.isMSEdge)
                return null;

            window.addEventListener('error', function onUncaughtError (event) {
                setTimeout(function () {
                    window.removeEventListener('error', onUncaughtError);
                }, 10);

                event.preventDefault();
            });

            return testPreventing();
        });
});

test('the constructor field of a function should return a wrapped Function object (GH-913)', function () {
    var f = function f () {
    };

    strictEqual(f.constructor, Function);
    strictEqual(f.constructor.toString(), nativeMethods.Function.toString());

    var toString       = Function.toString;
    var nativeToString = Function.prototype.toString;

    // eslint-disable-next-line no-extend-native
    Function.prototype.toString = function () {
        var str = toString.call(this);

        ok(true);

        return str;
    };

    strictEqual(f.toString().replace(/\s+/g, ''), 'functionf(){}');

    // eslint-disable-next-line no-extend-native
    Function.prototype.toString = nativeToString;
});

// IE11 cannot create a Blob object from a number array
var canCreateBlobFromNumberArray = (function () {
    var array = [1, 2, 3, 4, 5];

    try {
        return !!new nativeMethods.Blob(array);
    }
    catch (err) {
        return false;
    }
})();

if (canCreateBlobFromNumberArray) {
    test('should not process a common binary data (images, font and etc.) passed to a Blob constructor (GH-1359) as script', function () {
        var gifImageData    = [71, 73, 70, 56, 57, 97, 1, 0];
        var overridenBlob   = new Blob(gifImageData);
        var nativeBlob      = new nativeMethods.Blob(gifImageData);
        var redBlobContent  = null;
        var readBlobContent = function (blob) {
            return new hammerhead.Promise(function (resolve) {
                var reader = new FileReader();

                reader.addEventListener('loadend', function () {
                    var arr = new Uint8Array(this.result);

                    resolve(arr);
                });
                reader.readAsArrayBuffer(blob);
            });
        };


        return readBlobContent(overridenBlob)
            .then(function (blobContent) {
                redBlobContent = blobContent;

                return readBlobContent(nativeBlob);
            })
            .then(function (nativeBlobContent) {
                deepEqual(redBlobContent, nativeBlobContent);
            });
    });
}

if (window.Proxy) {
    module('Proxy');

    test('methods', function () {
        strictEqual(window.Proxy.toString(), nativeMethods.Proxy.toString());
        strictEqual(window.Proxy.revocable, nativeMethods.Proxy.revocable);
    });

    test('should correctly pass arguments', function () {
        var obj = { prop: 1 };
        var proxy = new Proxy(obj, {
            get: function (target, name, receiver) {
                strictEqual(target, obj);
                strictEqual(name, 'prop');
                strictEqual(receiver, proxy);

                return target[name];
            }
        });

        strictEqual(proxy.prop, 1);
    });

    test('should not call a `get` handler during an internal property accessing', function () {
        var handledWasCalled = false;

        var obj = {
            nestedObj: {
                prop1: 1,
                prop2: 2
            }
        };

        obj.proxy = new Proxy(obj.nestedObj, {
            get: function () {
                handledWasCalled = true;
            }
        });

        strictEqual(getProperty(obj, 'proxy'), obj.proxy);
        strictEqual(setProperty(obj.proxy, 'prop1', 1), 1);
        notOk(handledWasCalled);
    });
}

asyncTest('window.onhashchange should be instrumented', function () {
    strictEqual(window.onhashchange, null);

    window.onhashchange = 123;

    strictEqual(window.onhashchange, null);

    var handlerIsCalled = false;

    var handler = function (event) {
        handlerIsCalled = true;

        ok(event instanceof window.HashChangeEvent);
    };

    window.onhashchange = handler;

    strictEqual(window.onhashchange, handler);

    windowSandox.on(windowSandox.HASH_CHANGE_EVENT, function onHashChangeEvent () {
        ok(handlerIsCalled);
        windowSandox.off(windowSandox.HASH_CHANGE_EVENT, onHashChangeEvent);

        start();
    });

    window.location += '#test';
});
