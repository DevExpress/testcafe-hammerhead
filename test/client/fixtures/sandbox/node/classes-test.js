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

test('window.Worker should be overridden', function () {
    notEqual(window.Worker, nativeMethods.Worker);
});

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

test('window.EventSource should be overridden', function () {
    notEqual(window.EventSource, nativeMethods.EventSource);
});

test('should work with the operator "instanceof" (GH-690)', function () {
    var eventSource = new EventSource('');

    ok(eventSource instanceof EventSource);
});

if (window.MutationObserver) {
    module('MutationObserver');

    test('should work with the operator "instanceof" (GH-690)', function () {
        var observer = new MutationObserver(function () { });

        ok(observer instanceof MutationObserver);
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

    strictEqual(nativeMethods.getAttribute.call(img, 'src'), urlUtils.resolveUrlAsDest('data/image.png'));
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

