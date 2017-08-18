var domProcessor    = hammerhead.get('./dom-processor');
var destLocation    = hammerhead.get('./utils/destination-location');
var urlUtils        = hammerhead.get('./utils/url');
var FileListWrapper = hammerhead.get('./sandbox/upload/file-list-wrapper');
var INTERNAL_ATTRS  = hammerhead.get('../processing/dom/internal-attributes');

var browserUtils  = hammerhead.utils.browser;
var nativeMethods = hammerhead.nativeMethods;

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

if (browserUtils.isIE9) {
    test('should not create the window.Worker property in IE9', function () {
        ok(!window.Worker);
    });
}

if (!browserUtils.isIE || browserUtils.isIE11) {
    test('should work with the operator "instanceof" (GH-690)', function () {
        var blob   = new Blob(['if(true) {}'], { type: 'text/javascript' });
        var url    = URL.createObjectURL(blob);
        var worker = new Worker(url);

        ok(worker instanceof Worker);
    });
}

module('EventSource');

if (browserUtils.isIE) {
    test('should not create the window.EventSource property in IE (GH-716)', function () {
        ok(!window.EventSource);
    });
}

if (window.EventSource) {
    test('should work with the operator "instanceof" (GH-690)', function () {
        var eventSource = new EventSource('');

        ok(eventSource instanceof EventSource);
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

if (window.MutationObserver) {
    module('MutationObserver');

    test('should work with the operator "instanceof" (GH-690)', function () {
        var observer = new MutationObserver(function () { });

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

    setProperty(img, 'src', 'data/image.png');

    strictEqual(nativeMethods.getAttribute.call(img, 'src'), urlUtils.getProxyUrl('data/image.png'));
    strictEqual(nativeMethods.getAttribute.call(img, domProcessor.getStoredAttrName('src')), 'data/image.png');

    var NativeImage = nativeMethods.Image;

    strictEqual((new Image()).outerHTML, new NativeImage().outerHTML);
    strictEqual((new Image(15)).outerHTML, new NativeImage(15).outerHTML);
    strictEqual((new Image(15, 15)).outerHTML, new NativeImage(15, 15).outerHTML);
    strictEqual((new Image(void 0)).outerHTML, new NativeImage(void 0).outerHTML);
    strictEqual((new Image(void 0, void 0)).outerHTML, new NativeImage(void 0, void 0).outerHTML);
});

if (!browserUtils.isIE || browserUtils.isIE11) {
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

if (window.XDomainRequest) {
    test('window.XDomainRequest must be overriden (GH-801)', function () {
        strictEqual(window.XDomainRequest, window.XMLHttpRequest);
    });
}
