var urlUtils     = hammerhead.utils.url;
var destLocation = hammerhead.utils.destLocation;
var INSTRUCTION  = hammerhead.PROCESSING_INSTRUCTIONS.dom.script;
var XhrSandbox   = hammerhead.sandboxes.XhrSandbox;

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

test('wrappers of native functions should return the correct string representations', function () {
    window.checkStringRepresentation(window.CanvasRenderingContext2D.prototype.drawImage,
        nativeMethods.canvasContextDrawImage,
        'CanvasRenderingContext2D.prototype.drawImage');

    if (window.Object.assign)
        window.checkStringRepresentation(window.Object.assign, nativeMethods.objectAssign, 'Object.assign');

    window.checkStringRepresentation(window.open, nativeMethods.windowOpen, 'open');

    if (window.FontFace)
        window.checkStringRepresentation(window.FontFace, nativeMethods.FontFace, 'FontFace');

    if (window.Worker) {
        window.checkStringRepresentation(window.Worker, nativeMethods.Worker, 'Worker');
        window.checkStringRepresentation(window.Worker.prototype.constructor, nativeMethods.Worker,
            'Worker.prototype.constructor');
    }

    if (window.Blob)
        window.checkStringRepresentation(window.Blob, nativeMethods.Blob, 'Blob');

    window.checkStringRepresentation(window.File, nativeMethods.File, 'File');

    if (window.EventSource)
        window.checkStringRepresentation(window.EventSource, nativeMethods.EventSource, 'EventSource');

    if (window.MutationObserver)
        window.checkStringRepresentation(window.MutationObserver, nativeMethods.MutationObserver, 'MutationObserver');

    if (window.WebKitMutationObserver) {
        window.checkStringRepresentation(window.WebKitMutationObserver, nativeMethods.MutationObserver,
            'WebKitMutationObserver');
    }

    if (window.Proxy)
        window.checkStringRepresentation(window.Proxy, nativeMethods.Proxy, 'Proxy');

    if (window.registerServiceWorker) {
        window.checkStringRepresentation(window.registerServiceWorker, nativeMethods.registerServiceWorker,
            'registerServiceWorker');
    }

    if (window.getRegistrationServiceWorker) {
        window.checkStringRepresentation(window.getRegistrationServiceWorker,
            nativeMethods.getRegistrationServiceWorker,
            'getRegistrationServiceWorker');
    }

    if (window.Range.prototype.createContextualFragment) {
        window.checkStringRepresentation(window.Range.prototype.createContextualFragment,
            nativeMethods.createContextualFragment,
            'Range.prototype.createContextualFragment');
    }

    if (window.EventTarget) {
        window.checkStringRepresentation(window.EventTarget.prototype.addEventListener,
            nativeMethods.addEventListener,
            'EventTarget.prototype.addEventListener');
        window.checkStringRepresentation(window.EventTarget.prototype.removeEventListener,
            nativeMethods.removeEventListener,
            'EventTarget.prototype.removeEventListener');
    }
    else {
        window.checkStringRepresentation(window.addEventListener, nativeMethods.windowAddEventListener,
            'addEventListener');
        window.checkStringRepresentation(window.removeEventListener, nativeMethods.windowRemoveEventListener,
            'removeEventListener');
    }

    if (window.Image)
        window.checkStringRepresentation(window.Image, nativeMethods.Image, 'Image');

    window.checkStringRepresentation(window.Function, nativeMethods.Function, 'Function');
    window.checkStringRepresentation(window.Function.prototype.constructor, nativeMethods.Function,
        'Function.prototype.constructor');

    if (typeof window.history.pushState === 'function' && typeof window.history.replaceState === 'function') {
        window.checkStringRepresentation(window.history.pushState, nativeMethods.historyPushState,
            'history.pushState');
        window.checkStringRepresentation(window.history.replaceState, nativeMethods.historyReplaceState,
            'history.replaceState');
    }

    if (nativeMethods.sendBeacon)
        window.checkStringRepresentation(window.Navigator.prototype.sendBeacon, nativeMethods.sendBeacon, 'Navigator.prototype.sendBeacon');

    if (window.navigator.registerProtocolHandler) {
        window.checkStringRepresentation(window.navigator.registerProtocolHandler,
            nativeMethods.registerProtocolHandler,
            'navigator.registerProtocolHandler');
    }

    if (window.FormData) {
        window.checkStringRepresentation(window.FormData.prototype.append, nativeMethods.formDataAppend,
            'FormData.prototype.append');
    }

    if (window.WebSocket)
        window.checkStringRepresentation(window.WebSocket, nativeMethods.WebSocket, 'WebSocket');

    if (window.DOMParser) {
        window.checkStringRepresentation(window.DOMParser.prototype.parseFromString,
            nativeMethods.DOMParserParseFromString,
            'DOMParser.prototype.parseFromString');
    }

    if (window.DOMTokenList) {
        window.checkStringRepresentation(window.DOMTokenList.prototype.add, nativeMethods.tokenListAdd,
            'DOMTokenList.prototype.add');
        window.checkStringRepresentation(window.DOMTokenList.prototype.remove, nativeMethods.tokenListRemove,
            'DOMTokenList.prototype.remove');
        window.checkStringRepresentation(window.DOMTokenList.prototype.toggle, nativeMethods.tokenListToggle,
            'DOMTokenList.prototype.toggle');

        if (window.DOMTokenList.prototype.replace) {
            window.checkStringRepresentation(window.DOMTokenList.prototype.replace, nativeMethods.tokenListReplace,
                'DOMTokenList.prototype.replace');
        }

        if (window.DOMTokenList.prototype.supports) {
            window.checkStringRepresentation(window.DOMTokenList.prototype.supports, nativeMethods.tokenListSupports,
                'DOMTokenList.prototype.supports');
        }
    }

    window.checkStringRepresentation(window.DOMImplementation.prototype.createHTMLDocument,
        nativeMethods.createHTMLDocument,
        'DOMImplementation.prototype.createHTMLDocument');
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
                    strictEqual(msg, 'Error: error message');

                    return testMsg(new DOMException('You cannot use function', 'SecurityError'));
                })
                .then(function (msg) {
                    strictEqual(msg, 'SecurityError: You cannot use function');

                    return testMsg(new TypeError('type error'));
                })
                .then(function (msg) {
                    strictEqual(msg, 'TypeError: type error');

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
    XhrSandbox.REQUESTS_OPTIONS.set(xhr, { withCredentials: false });

    checkNativeFunctionArgs('send', 'xhrSend', xhr);

    // Event
    checkNativeFunctionArgs('addEventListener', 'addEventListener', window);
    checkNativeFunctionArgs('removeEventListener', 'removeEventListener', window);

    // Canvas
    var canvas = document.createElement('canvas');

    checkNativeFunctionArgs('drawImage', 'canvasContextDrawImage', canvas.getContext('2d'));

    // FormData
    if (window.FormData)
        checkNativeFunctionArgs('append', 'formDataAppend', new window.FormData());

    if (window.navigator.registerProtocolHandler)
        checkNativeFunctionArgs('registerProtocolHandler', 'registerProtocolHandler', window.navigator);

    if (browserUtils.version >= 12) {
        checkNativeFunctionArgs('setTimeout', 'setTimeout', window);
        checkNativeFunctionArgs('setTimeout', 'setTimeout', window);
    }

    var documentFragment = document.createDocumentFragment();

    checkNativeFunctionArgs('querySelector', 'documentFragmentQuerySelector', documentFragment);
    checkNativeFunctionArgs('querySelectorAll', 'documentFragmentQuerySelectorAll', documentFragment);
    checkNativeFunctionArgs('dispatchEvent', 'dispatchEvent', window);
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
            new SomeClass(),
        ];

        return createTestIframe({ src: getSameDomainPageUrl('../../../data/history/iframe.html') })
            .then(function (iframe) {
                var iframeWindow        = iframe.contentWindow;
                var iframeHammerhead    = iframeWindow['%hammerhead%'];
                var iframeHistory       = iframeWindow.history;
                var iframeNativeMethods = iframeHammerhead.nativeMethods;
                var iframeLocation      = iframeWindow.location;
                var baseUrl             = 'http://' + location.host + '/some/path';

                iframeHammerhead.utils.urlResolver.updateBase(baseUrl, iframe.contentDocument);
                iframeHammerhead.utils.destLocation
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
                    stack:   void 0,
                },
            },
            expectedStack: 'undefined\n    No stack trace available',
        },
        {
            event: {
                error: {
                    message: 'test message',
                    stack:   '    line 1\n    line2',
                },
            },
            expectedStack: 'test message\n    line 1\n    line2',
        },
        {
            event: {
                error: {
                    message: 'test message',
                    stack:   'Error: test message\n    line1\n    line2',
                },
            },
            expectedStack: 'Error: test message\n    line1\n    line2',
        },
        {
            event: {
                error:   null,
                message: 'test message',
            },
            expectedStack: 'test message\n    No stack trace available',
        },
    ];

    var testStack = function (testCase) {
        return new Promise(function (resolve) {
            var handler = function (msg) {
                windowSandox.off(hammerhead.EVENTS.uncaughtJsError, handler);

                strictEqual(testCase.expectedStack, msg.stack);
                resolve();
            };

            windowSandox.on(hammerhead.EVENTS.uncaughtJsError, handler);
            windowSandox.raiseUncaughtJsErrorEvent(hammerhead.EVENTS.uncaughtJsError, testCase.event, window);
        });
    };

    return Promise.all(testCases.map(function (item) {
        return testStack(item);
    }));
});

if (nativeMethods.winOnUnhandledRejectionSetter) {
    test('UNHANDLED_REJECTION_EVENT', function () {
        var error = new Error('bla bla bla');

        function prepareStackForError () {
            // NOTE: Firefox does not include an error message in a stack trace (unlike other browsers)
            const stack = error.stack;

            if (stack.indexOf(error.message) === -1)
                return 'Error: bla bla bla\n' + stack;

            return stack;
        }

        var testCases = [
            {
                reason:        'test reason',
                expectedStack: 'test reason\n    No stack trace available',
            },
            {
                reason:        null,
                expectedStack: '[object Null]\n    No stack trace available',
            },
            {
                reason:        error,
                expectedStack: prepareStackForError(error),
            },
        ];

        var testStack = function (testCase) {
            return new Promise(function (resolve) {
                var handler = function (msg) {
                    windowSandox.off(hammerhead.EVENTS.unhandledRejection, handler);

                    strictEqual(testCase.expectedStack, msg.stack);
                    resolve();
                };

                windowSandox.on(hammerhead.EVENTS.unhandledRejection, handler);
                windowSandox.raiseUncaughtJsErrorEvent(hammerhead.EVENTS.unhandledRejection, { reason: testCase.reason }, window);
            });
        };

        return Promise.all(testCases.map(function (item) {
            return testStack(item);
        }));
    });
}

if (nativeMethods.windowOriginGetter) {
    module('window.origin');

    test('getter', function () {
        strictEqual(window.origin, 'https://example.com');

        var storedWindowOriginGetter = nativeMethods.windowOriginGetter;

        nativeMethods.windowOriginGetter = function () {
            return 'null';
        };

        strictEqual(window.origin, 'null');

        nativeMethods.windowOriginGetter = storedWindowOriginGetter;

        strictEqual(window.origin, 'https://example.com');

        var storedForcedLocation = destLocation.getLocation();

        destLocation.forceLocation(urlUtils.getProxyUrl('file:///home/testcafe/site'));

        strictEqual(window.origin, 'null');

        destLocation.forceLocation(storedForcedLocation);
    });

    test('setter', function () {
        strictEqual(window.origin, 'https://example.com');

        strictEqual(window.origin = '1', '1');

        window.origin = 2;
        strictEqual(window.origin, 2);
    });

    test('should be null in iframe with the sandbox attribute that doesn`t contain `allow-same-origin`', function () {
        return createTestIframe({
            src:     getSameDomainPageUrl('../../../data/iframe/simple-iframe.html'),
            sandbox: 'allow-scripts',
        })
            .then(function (iframe) {
                strictEqual(iframe.contentWindow.origin, 'null');
            });
    });
}

module('regression');

if (nativeMethods.sendBeacon) {
    test('navigator.sendBeacon must be overriden (GH-1035)', function () {
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

    test('Navigator.prototype.sendBeacon must be overriden (GH-2642)', function () {
        var originUrl    = 'http://example.com/index.html';
        var originData   = 'some data';
        var nativeMethod = nativeMethods.sendBeacon;

        nativeMethods.sendBeacon = function (url, data) {
            strictEqual(url, urlUtils.getProxyUrl(originUrl));
            strictEqual(data, originData);
            nativeMethods.sendBeacon = nativeMethod;
        };

        window.Navigator.prototype.sendBeacon.call(window.navigator, originUrl, originData);
    });
}

test('window.onerror must be overridden (B238830)', function () {
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
            },
        });

        strictEqual(proxy.prop, 1);
    });

    test('proxy created with the same handler (GH-2206)', function () {
        var handler = {
            get: function (obj, prop) {
                return prop in obj ? obj[prop] : 37;
            },
        };

        var p;

        for (let i = 0; i < 100000; i++)
            p = new Proxy({}, handler);

        strictEqual(p.a, 37);
    });

    test('should not call a `get` handler during an internal property accessing', function () {
        var handledWasCalled = false;

        var obj = {
            nestedObj: {
                prop1: 1,
                prop2: 2,
            },
        };

        obj.proxy = new Proxy(obj.nestedObj, {
            get: function () {
                handledWasCalled = true;
            },
        });

        strictEqual(getProperty(obj, 'proxy'), obj.proxy);
        strictEqual(setProperty(obj.proxy, 'prop1', 1), 1);
        notOk(handledWasCalled);
    });

    test('any proxy object should return correct code instrumentation instructions (GH-2056)', function () {
        var proxy = new Proxy({}, {
            get: function () {
                return void 0;
            },
        });

        strictEqual(proxy[INSTRUCTION.processScript], window[INSTRUCTION.processScript]);
        strictEqual(proxy[INSTRUCTION.setProperty], window[INSTRUCTION.setProperty]);
        strictEqual(proxy[INSTRUCTION.getProperty], window[INSTRUCTION.getProperty]);

        eval(window.processScript([
            'var proxy = new Proxy({ eval: window.eval }, {',
            '    get: function (target, prop) {',
            '        return target[prop];',
            '    },',
            '    has: function () {',
            '        return true',
            '    }',
            '});',
            '',
            'with (proxy) {',
            '    eval(";");',
            '}',
        ].join('\n')));

        ok(true, 'regression check');
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

test('patching EventTarget methods on the client side: addEventListener, removeEventListener, dispatchEvent (GH-1902)', function () {
    var eventTargetMethods = [
        'addEventListener',
        'removeEventListener',
        'dispatchEvent',
    ];
    var savedMethods       = eventTargetMethods.map(function (methodName) {
        return window.EventTarget.prototype[methodName];
    });
    const div              = document.createElement('div');
    var contextElements    = [
        window,
        document,
        document.body,
        div,
    ];

    expect(eventTargetMethods.length * contextElements.length);

    document.body.appendChild(div);

    function callMethod (contextEl, methodName) {
        if (methodName === 'dispatchEvent')
            contextEl[methodName]('click');
        else
            contextEl[methodName]('click', function () { });
    }

    function checkMethod (methodName) {
        contextElements.forEach(function (el) {
            callMethod(el, methodName);
        });
    }


    eventTargetMethods.forEach(function (methodName) {
        window.EventTarget.prototype[methodName] = function () {
            ok(true, this + ': ' + methodName);
        };
    });

    eventTargetMethods.forEach(function (methodName) {
        checkMethod(methodName);
    });

    eventTargetMethods.forEach(function (methodName, index) {
        window.EventTarget.prototype[methodName] = savedMethods[index];
    });
});

test('An instance of a class that extends Function should contains class methods (GH-2439)', function () {
    var functionInheritorInstance = nativeMethods.eval([
        'class A extends Function {',
        '    methodA () {}',
        '}',
        'class B extends A {',
        '    methodB () {}',
        '}',
        'new B("return \'hello\'");',
    ].join('\n'));

    ok(!!functionInheritorInstance.methodA);
    ok(!!functionInheritorInstance.methodB);
    strictEqual(functionInheritorInstance(), 'hello');
});
