var DomProcessor    = hammerhead.get('../processing/dom');
var destLocation    = hammerhead.get('./utils/destination-location');
var urlUtils        = hammerhead.get('./utils/url');
var FileListWrapper = hammerhead.get('./sandbox/upload/file-list-wrapper');
var INTERNAL_ATTRS  = hammerhead.get('../processing/dom/internal-attributes');
var Promise         = hammerhead.Promise;
var processScript   = hammerhead.get('../processing/script').processScript;

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

test('refreshed classes "toString" method', function () {
    var testCases = [
        { refreshedClass: window.Window, storedClass: nativeMethods.windowClass },
        { refreshedClass: window.Document, storedClass: nativeMethods.documentClass },
        { refreshedClass: window.Location, storedClass: nativeMethods.locationClass },
        { refreshedClass: window.Element, storedClass: nativeMethods.elementClass },
        { refreshedClass: window.SVGElement, storedClass: nativeMethods.svgElementClass },
        { refreshedClass: window.Worker, storedClass: nativeMethods.Worker },
        { refreshedClass: window.ArrayBuffer, storedClass: nativeMethods.ArrayBuffer },
        { refreshedClass: window.Uint8Array, storedClass: nativeMethods.Uint8Array },
        { refreshedClass: window.DataView, storedClass: nativeMethods.DataView },
        { refreshedClass: window.Blob, storedClass: nativeMethods.Blob },
        { refreshedClass: window.XMLHttpRequest, storedClass: nativeMethods.XMLHttpRequest },
        { refreshedClass: window.Image, storedClass: nativeMethods.Image },
        { refreshedClass: window.Function, storedClass: nativeMethods.Function },
        { refreshedClass: window.StorageEvent, storedClass: nativeMethods.StorageEvent },
        { refreshedClass: window.MutationObserver, storedClass: nativeMethods.MutationObserver },
        { refreshedClass: window.WebSocket, storedClass: nativeMethods.WebSocket },
        { refreshedClass: window.DataTransfer, storedClass: nativeMethods.DataTransfer },
        { refreshedClass: window.FileList, storedClass: nativeMethods.FileList },
        { refreshedClass: window.FontFace, storedClass: nativeMethods.FontFace },
        { refreshedClass: window.EventSource, storedClass: nativeMethods.EventSource },
        { refreshedClass: window.Proxy, storedClass: nativeMethods.Proxy },
        { refreshedClass: window.DataTransferItemList, storedClass: nativeMethods.DataTransferItemList },
        { refreshedClass: window.DataTransferItem, storedClass: nativeMethods.DataTransferItem }
    ];

    testCases.forEach(function (testCase) {
        if (testCase.refreshedClass)
            strictEqual(testCase.refreshedClass.toString(), testCase.storedClass.toString());
    });
});

module('Blob');

test('window.Blob([data], { type: "" }) should return correct result for `ArrayBuffer`, `Uint8Array` and `DataView` data types (GH-1599)', function () {
    var bmpExample = {
        signature: [0x42, 0x4D]
    };

    var testConstructor = function (constructor) {
        return new Promise(function (resolve) {
            var arrayBuffer;
            var data;
            var typedArray;
            var i;

            if (constructor === ArrayBuffer) {
                arrayBuffer = new constructor(bmpExample.signature.length);
                typedArray  = new Uint8Array(arrayBuffer);

                for (i = 0; i < typedArray.length; i++)
                    typedArray[i] = bmpExample.signature[i];

                data = arrayBuffer;
            }
            else if (constructor === DataView) {
                arrayBuffer = new ArrayBuffer(bmpExample.signature.length);
                typedArray  = new Uint8Array(arrayBuffer);

                for (i = 0; i < typedArray.length; i++)
                    typedArray[i] = bmpExample.signature[i];

                var dataView = new constructor(arrayBuffer);

                data = browserUtils.isIE11 ? dataView.buffer : dataView;
            }
            else {
                typedArray = new constructor(bmpExample.signature);
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

                strictEqual(resultArray.toString(), bmpExample.signature.toString());
                resolve();
            };

            fileReader.readAsArrayBuffer(resultBlob);
        });
    };

    return Promise.all([
        testConstructor(ArrayBuffer),
        testConstructor(Uint8Array),
        testConstructor(DataView)
    ]);
});

asyncTest('should process Blob parts in the case of the "Array<string | number | boolean>" array (GH-2115)', function () {
    var parts = ['var test = ', 1, '+', true, ';'];

    var expectedScript = processScript(parts.join(''), true).replace(/\s/g, '');

    var blob   = new window.Blob(parts, { type: 'texT/javascript' });
    var reader = new FileReader();

    reader.addEventListener('loadend', function (e) {
        strictEqual(e.target.result.replace(/\s/g, ''), expectedScript);
        start();
    });

    reader.readAsText(blob);
});

// IE11 cannot create a Blob object from a boolean/number array
var canCreateBlobFromNumberBooleanArray = (function () {
    var array = [true, false, 1, 0];

    try {
        return !!new nativeMethods.Blob(array);
    }
    catch (err) {
        return false;
    }
})();

if (canCreateBlobFromNumberBooleanArray) {
    test('should not process unprocessable Blob parts (GH-2115)', function () {
        var unprocessableBlobParts = [true, false, 1, 0];
        var processableBlobParts   = ['const val1 =', true, '; const var2 =', 1];

        var testCases = [
            {
                blobParts: unprocessableBlobParts,
                options:   { type: '' }
            },
            {
                blobParts: unprocessableBlobParts,
                options:   { type: 'text/javascript' }
            },
            {
                blobParts: processableBlobParts.concat([new nativeMethods.Blob(['unprocessable part'])]),
                options:   { type: '' }
            },
            {
                blobParts: processableBlobParts.concat([new nativeMethods.Blob(['unprocessable part'])]),
                options:   { type: 'text/javascript' }
            }
        ];

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


        return Promise.all(testCases.map(function (testCase) {
            var overridenBlob  = new Blob(testCase.blobParts, testCase.options);
            var nativeBlob     = new nativeMethods.Blob(testCase.blobParts, testCase.options);
            var redBlobContent = null;

            return readBlobContent(overridenBlob)
                .then(function (blobContent) {
                    redBlobContent = blobContent;

                    return readBlobContent(nativeBlob);
                })
                .then(function (nativeBlobContent) {
                    deepEqual(redBlobContent, nativeBlobContent);
                });
        }));
    });
}

module('File');

// IE11 doesn't support File constructor
var isFileConstructable = (function () {
    var array = [true, false, 1, 0];

    try {
        return !!new nativeMethods.File(array, 'file.js');
    }
    catch (err) {
        return false;
    }
})();

if (isFileConstructable) {
    test('window.File should be overridden', function () {
        notEqual(window.File, nativeMethods.File);
    });

    test('window.File([data], "file.name", { type: "" }) should return correct result for `ArrayBuffer`, `Uint8Array` and `DataView` data types', function () {
        var bmpExample = {
            signature: [0x42, 0x4D]
        };

        var testConstructor = function (constructor) {
            return new Promise(function (resolve) {
                var arrayBuffer;
                var data;
                var typedArray;
                var i;

                if (constructor === ArrayBuffer) {
                    arrayBuffer = new constructor(bmpExample.signature.length);
                    typedArray  = new Uint8Array(arrayBuffer);

                    for (i = 0; i < typedArray.length; i++)
                        typedArray[i] = bmpExample.signature[i];

                    data = arrayBuffer;
                }
                else if (constructor === DataView) {
                    arrayBuffer = new ArrayBuffer(bmpExample.signature.length);
                    typedArray  = new Uint8Array(arrayBuffer);

                    for (i = 0; i < typedArray.length; i++)
                        typedArray[i] = bmpExample.signature[i];

                    var dataView = new constructor(arrayBuffer);

                    data = browserUtils.isIE11 ? dataView.buffer : dataView;
                }
                else {
                    typedArray = new constructor(bmpExample.signature);
                    data       = typedArray;
                }

                var resultFile = new File([data], 'file.name', { type: '' });
                var fileReader = new FileReader();

                fileReader.onload = function () {
                    var resultArrayBuffer = this.result;

                    var resultTypedArray = constructor === ArrayBuffer || constructor === DataView
                        ? new Uint8Array(resultArrayBuffer)
                        : new constructor(resultArrayBuffer);

                    var resultArray = [].slice.call(resultTypedArray);

                    strictEqual(resultArray.toString(), bmpExample.signature.toString());
                    resolve();
                };

                fileReader.readAsArrayBuffer(resultFile);
            });
        };

        return Promise.all([
            testConstructor(ArrayBuffer),
            testConstructor(Uint8Array),
            testConstructor(DataView)
        ]);
    });

    asyncTest('should process File parts in the case of the "Array<string | number | boolean>" array', function () {
        var parts = ['var test = ', 1, '+', true, ';'];

        var expectedScript = processScript(parts.join(''), true).replace(/\s/g, '');

        var file   = new window.File(parts, { type: 'texT/javascript' });
        var reader = new FileReader();

        reader.addEventListener('loadend', function (e) {
            strictEqual(e.target.result.replace(/\s/g, ''), expectedScript);
            start();
        });

        reader.readAsText(file);
    });

    asyncTest('should try to process data as a script even if the content type is not passed', function () {
        var script  = 'var obj = {}, prop = "prop"; obj[prop] = true; postMessage(true);';
        var fileURL = URL.createObjectURL(new File([script], 'script.js'));

        new Worker(fileURL).onmessage = function (e) {
            ok(e.data);
            start();
        };
    });

    if (canCreateBlobFromNumberBooleanArray) {
        test('should not process unprocessable File parts', function () {
            var unprocessableFileParts = [true, false, 1, 0];
            var processableFileParts   = ['const val1 =', true, '; const var2 =', 1];

            var testCases = [
                {
                    fileParts: unprocessableFileParts,
                    options:   { type: '' }
                },
                {
                    fileParts: unprocessableFileParts,
                    options:   { type: 'text/javascript' }
                },
                {
                    fileParts: processableFileParts.concat([new nativeMethods.File(['unprocessable part'], 'file.name')]),
                    options:   { type: '' }
                },
                {
                    fileParts: processableFileParts.concat([new nativeMethods.File(['unprocessable part'], 'file.name')]),
                    options:   { type: 'text/javascript' }
                }
            ];

            var readFileContent = function (file) {
                return new hammerhead.Promise(function (resolve) {
                    var reader = new FileReader();

                    reader.addEventListener('loadend', function () {
                        var arr = new Uint8Array(this.result);

                        resolve(arr);
                    });
                    reader.readAsArrayBuffer(file);
                });
            };

            return Promise.all(testCases.map(function (testCase) {
                var overridenFile  = new File(testCase.fileParts, 'file.name', testCase.options);
                var nativeFile     = new nativeMethods.File(testCase.fileParts, 'file.name', testCase.options);
                var redFileContent = null;

                return readFileContent(overridenFile)
                    .then(function (fileContent) {
                        redFileContent = fileContent;

                        return readFileContent(nativeFile);
                    })
                    .then(function (nativeFileContent) {
                        deepEqual(redFileContent, nativeFileContent);
                    });
            }));
        });
    }
}

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

    test('should work with the operator "instanceof" (GH-690)', function () {
        var blob   = new Blob(['if(true) {}'], { type: 'text/javascript' });
        var url    = URL.createObjectURL(blob);
        var worker = new Worker(url);

        ok(worker instanceof Worker);
    });

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
}

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

        // eslint-disable-next-line no-new
        new EventSource('http://localhost/event');

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

        // eslint-disable-next-line no-new
        new EventSource('http://localhost/event');

        nativeMethods.EventSource = function (url, opts) {
            strictEqual(arguments.length, 2);
            strictEqual(url, 'http://' + location.host + '/sessionId!e/http://localhost/event');
            strictEqual(opts.withCredentials, true);
        };

        // eslint-disable-next-line no-new
        new EventSource('http://localhost/event', { withCredentials: true });

        nativeMethods.EventSource = nativeEventSource;
    });
}

module('MutationObserver');

if (window.MutationObserver) {
    if (window.WebKitMutationObserver) {
        test('WebKitMutationObserver', function () {
            strictEqual(window.WebKitMutationObserver, MutationObserver);
        });
    }

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
        testUrl('https://subdomain.example.com:233/?url=%s', true, 'Sub domain');

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

    /* eslint-disable no-new-func */
    strictEqual(getFnBody(new Function('arg1', 'arg2', codeStr)), processedCodeStr);
    strictEqual(getFnBody(Function('arg1', 'arg2', codeStr)), processedCodeStr);
    strictEqual(getFnBody(fnCtor('arg1', 'arg2', 'arg3', codeStr)), processedCodeStr);
    strictEqual(getFnBody(Function.apply(null, ['arg1', codeStr])), processedCodeStr);
    strictEqual(getFnBody(Function.call(null, 'arg1', codeStr)), processedCodeStr);

    ok(Function() instanceof Function);
    /* eslint-enable no-new-func */
});
