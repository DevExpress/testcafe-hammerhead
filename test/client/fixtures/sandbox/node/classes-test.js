var DomProcessor    = hammerhead.get('../processing/dom');
var destLocation    = hammerhead.get('./utils/destination-location');
var urlUtils        = hammerhead.get('./utils/url');
var FileListWrapper = hammerhead.get('./sandbox/upload/file-list-wrapper');
var INTERNAL_ATTRS  = hammerhead.get('../processing/dom/internal-attributes');
var Promise         = hammerhead.Promise;

var browserUtils  = hammerhead.utils.browser;
var nativeMethods = hammerhead.nativeMethods;

if (window.PerformanceNavigationTiming) {
    test('PerformanceNavigationTiming.name', function () {
        var storedNativePerformanceEntryNameGetter = nativeMethods.performanceEntryNameGetter;

        nativeMethods.performanceEntryNameGetter = function () {
            return 'http://localhost/sessionId/https://example.com';
        };

        var result = window.performance.getEntriesByType('navigation');

        strictEqual(result[0].name, 'https://example.com');
        nativeMethods.performanceEntryNameGetter = storedNativePerformanceEntryNameGetter;
    });
}

test('window.Blob([data], { type: "" }) should return correct result for all possible data type cases (GH-1599)', function () {
    var pngExample = {
        mime:      'image/bmp',
        signature: [0x42, 0x4D]
    };

    var testConstructor = function (constructor) {
        return new Promise(function (resolve) {
            var arrayBuffer;
            var data;
            var typedArray;
            var i;

            if (constructor === ArrayBuffer) {
                arrayBuffer = new constructor(pngExample.signature.length);
                typedArray  = new Uint8Array(arrayBuffer);

                for (i = 0; i < typedArray.length; i++)
                    typedArray[i] = pngExample.signature[i];

                data = arrayBuffer;
            }
            else if (constructor === DataView) {
                arrayBuffer = new ArrayBuffer(pngExample.signature.length);
                typedArray  = new Uint8Array(arrayBuffer);

                for (i = 0; i < typedArray.length; i++)
                    typedArray[i] = pngExample.signature[i];

                var dataView = new constructor(arrayBuffer);

                data = browserUtils.isIE11 ? dataView.buffer : dataView;
            }
            else {
                typedArray = new constructor(pngExample.signature);
                data       = typedArray;
            }

            var resultBlob = new Blob([data], { type: '' });
            var fileReader = new FileReader();

            fileReader.onload = function () {
                var resultArrayBuffer = this.result;

                var resultTypedArray = constructor === ArrayBuffer || constructor === DataView
                    ? new Uint8Array(resultArrayBuffer)
                    : new constructor(resultArrayBuffer);

                var resultArray = [].slice.call(resultTypedArray);

                strictEqual(resultArray.toString(), pngExample.signature.toString());
                resolve();
            };

            fileReader.readAsArrayBuffer(resultBlob);
        });
    };

    return Promise.all([
        testConstructor(ArrayBuffer),
        testConstructor(Int8Array),
        testConstructor(Uint8Array),
        testConstructor(Uint8ClampedArray),
        testConstructor(Int16Array),
        testConstructor(Uint16Array),
        testConstructor(Int32Array),
        testConstructor(Uint32Array),
        testConstructor(Float32Array),
        testConstructor(Float64Array),
        testConstructor(DataView)
    ]);
});

module('Image');

test('window.Image should be overridden', function () {
    notEqual(window.Image, nativeMethods.Image);
});

test('should work with the operator "instanceof" (GH-690)', function () {
    var img = new Image();

    ok(img instanceof Image);
});

module('Worker');

if (window.Worker) {
    test('window.Worker should be overridden', function () {
        notEqual(window.Worker, nativeMethods.Worker);
    });

    test('throwing errors (GH-1132)', function () {
        throws(function () {
            window.Worker();
        }, TypeError);

        throws(function () {
            /*eslint-disable no-new*/
            new Worker();
            /*eslint-enable no-new*/
        }, TypeError);
    });

    test('checking parameters (GH-1132', function () {
        var savedNativeWorker = nativeMethods.Worker;
        var workerOptions     = { name: 'test' };
        var resourceType      = urlUtils.stringifyResourceType({ isScript: true });

        nativeMethods.Worker = function (scriptURL) {
            strictEqual(arguments.length, 1);
            strictEqual(scriptURL, urlUtils.getProxyUrl('/test', { resourceType: resourceType }));
        };
        /* eslint-disable no-new */
        new Worker('/test');
        /* eslint-enable no-new */

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
}

test('should work with the operator "instanceof" (GH-690)', function () {
    var blob   = new Blob(['if(true) {}'], { type: 'text/javascript' });
    var url    = URL.createObjectURL(blob);
    var worker = new Worker(url);

    ok(worker instanceof Worker);
});

module('EventSource');

if (browserUtils.isIE) {
    test('should not create the window.EventSource property in IE (GH-716)', function () {
        ok(!window.EventSource);
    });
}

if (window.EventSource) {
    test('should work with the "instanceof" operator (GH-690)', function () {
        var eventSource = new EventSource('');

        ok(eventSource instanceof EventSource);

        eventSource.close();
    });

    test('should have static constants (GH-1106)', function () {
        ok(EventSource.hasOwnProperty('CONNECTING'));
        ok(EventSource.hasOwnProperty('OPEN'));
        ok(EventSource.hasOwnProperty('CLOSED'));
    });

    test('should process url to proxy with special flag (GH-1106)', function () {
        var nativeEventSource = nativeMethods.EventSource;

        nativeMethods.EventSource = function (url) {
            strictEqual(url, 'http://' + location.host + '/sessionId!e/http://localhost/event');
        };

        /* eslint-disable no-new */
        new EventSource('http://localhost/event');
        /* eslint-enable no-new */

        nativeMethods.EventSource = nativeEventSource;
    });

    test('should call the constructor with the correct length of arguments (GH-1106)', function () {
        var nativeEventSource = nativeMethods.EventSource;

        nativeMethods.EventSource = function () {
            strictEqual(arguments.length, 0);
        };

        /* eslint-disable no-new */
        new EventSource();
        /* eslint-enable no-new */

        nativeMethods.EventSource = function (url) {
            strictEqual(arguments.length, 1);
            strictEqual(url, 'http://' + location.host + '/sessionId!e/http://localhost/event');
        };

        /* eslint-disable no-new */
        new EventSource('http://localhost/event');
        /* eslint-enable no-new */

        nativeMethods.EventSource = function (url, opts) {
            strictEqual(arguments.length, 2);
            strictEqual(url, 'http://' + location.host + '/sessionId!e/http://localhost/event');
            strictEqual(opts.withCredentials, true);
        };

        /* eslint-disable no-new */
        new EventSource('http://localhost/event', { withCredentials: true });
        /* eslint-enable no-new */

        nativeMethods.EventSource = nativeEventSource;
    });
}

module('MutationObserver');

if (window.MutationObserver) {
    test('should work with the operator "instanceof" (GH-690)', function () {
        var observer = new MutationObserver(function () {
        });

        ok(observer instanceof MutationObserver);
    });

    asyncTest('should pass the second parameter to a callback function (GH-1268)', function () {
        var mutaionRootElement = document.createElement('div');
        var testElement        = document.createElement('div');

        document.body.appendChild(mutaionRootElement);

        var observer = new MutationObserver(function (mutations, observerInstance) {
            strictEqual(mutations.length, 1);
            ok(observerInstance instanceof MutationObserver);

            mutaionRootElement.parentNode.removeChild(mutaionRootElement);
            start();
        });

        observer.observe(mutaionRootElement, { childList: true });

        mutaionRootElement.appendChild(testElement);
    });
}

module('WebSocket');

if (window.WebSocket) {
    test('constructor', function () {
        var socket = new WebSocket('ws://' + location.host);

        ok(socket instanceof WebSocket);

        strictEqual(WebSocket.CONNECTING, socket.CONNECTING);
        strictEqual(WebSocket.OPEN, socket.OPEN);
        strictEqual(WebSocket.CLOSING, socket.CLOSING);
        strictEqual(WebSocket.CLOSED, socket.CLOSED);

        socket.close();
    });

    test('url property', function () {
        var url    = 'ws://' + location.host;
        var socket = new WebSocket(url);

        strictEqual(socket.url, url);

        socket.close();

        var secureUrl    = 'wss://' + location.host;
        var secureSocket = new WebSocket(secureUrl);

        strictEqual(secureSocket.url, secureUrl);

        secureSocket.close();
    });

    test('origin property of MessageEvent', function () {
        var event                  = nativeMethods.documentCreateEvent.call(document, 'MessageEvent');
        var storedAddEventListener = WebSocket.prototype.addEventListener;

        WebSocket.prototype.addEventListener = function (type, fn) {
            fn(event);
        };

        var socket = new WebSocket('ws://example.com');

        event.__defineGetter__('target', function () {
            return socket;
        });

        strictEqual(event.origin, 'ws://example.com');

        socket.close();

        WebSocket.prototype.addEventListener = storedAddEventListener;
    });

    test('checking parameters', function () {
        var nativeWebSocket  = nativeMethods.WebSocket;
        var originHeader     = encodeURIComponent(destLocation.getOriginHeader());
        var addEventListener = function () {
        };

        nativeMethods.WebSocket = function (url) {
            strictEqual(url, 'ws://' + location.host + '/sessionId!w!' + originHeader + '/http://localhost/socket');
        };

        nativeMethods.WebSocket.prototype.addEventListener = addEventListener;

        /* eslint-disable no-new */
        new WebSocket('ws://localhost/socket');

        nativeMethods.WebSocket = function (url) {
            strictEqual(url, 'ws://' + location.host + '/sessionId!w!' + originHeader +
                             '/https://localhost/secure-socket');
        };

        nativeMethods.WebSocket.prototype.addEventListener = addEventListener;

        new WebSocket('wss://localhost/secure-socket');
        new WebSocket('wss://localhost/secure-socket', ['soap']);

        nativeMethods.WebSocket = function (url) {
            strictEqual(arguments.length, 3);
            strictEqual(url, 'ws://' + location.host + '/sessionId!w!' + originHeader +
                             '/https://localhost/secure-socket');
        };

        nativeMethods.WebSocket.prototype.addEventListener = addEventListener;

        new WebSocket('wss://localhost/secure-socket', ['soap'], 123);
        new WebSocket('wss://localhost/secure-socket', ['soap'], 123, 'str');
        /* eslint-enable no-new */

        nativeMethods.WebSocket = nativeWebSocket;
    });

    /* eslint-disable no-new */
    test('throwing errors', function () {
        throws(function () {
            new WebSocket();
        });

        throws(function () {
            new WebSocket('');
        });

        throws(function () {
            new WebSocket('/path');
        });

        throws(function () {
            new WebSocket('//example.com');
        });

        throws(function () {
            new WebSocket('http://example.com');
        });
    });
    /* eslint-enable no-new */
}

module('regression');

if (window.Blob) {
    test('window.Blob with a different number of parameters (GH-44)', function () {
        var testCases = [
            {
                description: 'without parameters',
                newBlobFunc: function () {
                    return new window.Blob();
                }
            },
            {
                description: 'only "parts" parameter',
                newBlobFunc: function () {
                    return new window.Blob(['text']);
                }
            },
            {
                description: '"parts" and "opts" parameters',
                newBlobFunc: function () {
                    return new window.Blob(['text'], { type: 'text/plain' });
                }
            }
        ];

        testCases.forEach(function (testCase) {
            try {
                ok(!!testCase.newBlobFunc(), testCase.description);
            }
            catch (e) {
                ok(false, testCase.description);
            }
        });
    });

    test('should work with the operator "instanceof" (GH-690)', function () {
        var blob = new Blob();

        ok(blob instanceof window.Blob);
    });
}

if (window.FormData) {
    asyncTest('FormData must be sent correctly with our file wrappers (GH-324)', function () {
        var formData = new FormData();
        var xhr      = new XMLHttpRequest();

        formData.append('file', FileListWrapper._createFileWrapper({
            info: {
                size: 4,
                type: 'text/plain',
                name: 'correctName.txt'
            },
            blob: new Blob(['text'], { type: 'text/plain' })
        }));
        formData.append(INTERNAL_ATTRS.uploadInfoHiddenInputName, '[]');

        xhr.open('post', '/form-data', true);
        xhr.addEventListener('readystatechange', function () {
            if (this.readyState !== this.DONE)
                return;

            var contentDispositionHeader = 'Content-Disposition: form-data; name="file"; filename="correctName.txt"';

            ok(this.responseText.indexOf(contentDispositionHeader) !== -1);
            ok(this.responseText.indexOf(INTERNAL_ATTRS.uploadInfoHiddenInputName) === -1);

            start();
        });
        xhr.send(formData);
    });

    test('should work with the operator "instanceof" (GH-690)', function () {
        var formData = new FormData();

        ok(formData instanceof FormData);
    });
}

test('window.Image must be overriden (B234340)', function () {
    var img = new Image();

    img.src = 'data/image.png';

    strictEqual(nativeMethods.getAttribute.call(img, 'src'), urlUtils.getProxyUrl('data/image.png'));
    strictEqual(nativeMethods.getAttribute.call(img, DomProcessor.getStoredAttrName('src')), 'data/image.png');

    var NativeImage  = nativeMethods.Image;
    var getOuterHTML = nativeMethods.elementOuterHTMLGetter;

    strictEqual(getOuterHTML.call(new Image()), getOuterHTML.call(new NativeImage()));
    strictEqual(getOuterHTML.call(new Image(15)), getOuterHTML.call(new NativeImage(15)));
    strictEqual(getOuterHTML.call(new Image(15, 15)), getOuterHTML.call(new NativeImage(15, 15)));
    strictEqual(getOuterHTML.call(new Image(void 0)), getOuterHTML.call(new NativeImage(void 0)));
    strictEqual(getOuterHTML.call(new Image(void 0, void 0)), getOuterHTML.call(new NativeImage(void 0, void 0)));
});

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

if (navigator.registerProtocolHandler) {
    test('navigator.registerProtocolHandler must be overriden (T185853)', function () {
        var savedGetOriginLocation = destLocation.get;

        var testUrl = function (url, result, description) {
            var exception = false;

            try {
                navigator.registerProtocolHandler('web+testprotocol', url, 'Title');
            }
            catch (e) {
                exception = true;
            }
            finally {
                strictEqual(result, exception, description);
            }
        };

        destLocation.get = function () {
            return 'https://example.com:233';
        };

        testUrl('https://example.com:233/?url=%s', false, 'Destination url');
        testUrl('http://example.com:233/?url=%s', !browserUtils.isFirefox, 'Another protocol');
        testUrl('https://xample.com:233/?url=%s', true, 'Another hostname');
        testUrl('https://example.com:934/?url=%s', !browserUtils.isFirefox, 'Another port');
        testUrl('https://subdomain.example.com:233/?url=%s', false, 'Sub domain');

        destLocation.get = savedGetOriginLocation;
    });
}

test('window.Function must be overriden (T423261) (GH-769)', function () {
    var fnCtor           = Function;
    var codeStr          = 'location.href="/page.htm";';
    var processedCodeStr = processScript(codeStr).trim();
    var getFnBody        = function (fn) {
        return fn.toString().replace(/^[^{]+\{\s+|\s+}$/g, '');
    };

    /*eslint-disable no-new-func*/
    strictEqual(getFnBody(new Function('arg1', 'arg2', codeStr)), processedCodeStr);
    strictEqual(getFnBody(Function('arg1', 'arg2', codeStr)), processedCodeStr);
    strictEqual(getFnBody(fnCtor('arg1', 'arg2', 'arg3', codeStr)), processedCodeStr);
    strictEqual(getFnBody(Function.apply(null, ['arg1', codeStr])), processedCodeStr);
    strictEqual(getFnBody(Function.call(null, 'arg1', codeStr)), processedCodeStr);

    ok(Function() instanceof Function);
    /*eslint-enable no-new-func*/
});
