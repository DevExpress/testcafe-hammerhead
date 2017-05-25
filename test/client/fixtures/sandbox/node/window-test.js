var urlUtils = hammerhead.get('./utils/url');

var nativeMethods = hammerhead.nativeMethods;
var browserUtils  = hammerhead.utils.browser;

test('window.onerror setter/getter', function () {
    strictEqual(getProperty(window, 'onerror'), null);

    setProperty(window, 'onerror', 123);
    strictEqual(getProperty(window, 'onerror'), null);

    var handler = function () {
    };

    setProperty(window, 'onerror', handler);
    strictEqual(getProperty(window, 'onerror'), handler);
});

if (window.FontFace) {
    asyncTest('FontFace', function () {
        var nativeFontFace = nativeMethods.FontFace;
        var url            = 'https://fonts.com/fs_albert.woff2';
        var desc           = {};

        nativeMethods.FontFace = function (family, source, descriptors) {
            strictEqual(family, 'family');
            strictEqual(source, 'url("' + urlUtils.getProxyUrl(url) + '")');
            ok(descriptors, desc);

            nativeMethods.FontFace = nativeFontFace;
            start();
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
    checkNativeFunctionArgs('open', 'xhrOpen', xhr);

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

if (window.history.replaceState) {
    asyncTest('replace history state with a various types of url', function () {
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

        var iframe  = document.createElement('iframe');

        iframe.setAttribute('src', window.QUnitGlobals.getResourceUrl('../../../data/history/iframe.html'));

        window.QUnitGlobals.waitForIframe(iframe)
            .then(function () {
                var iframeWindow        = iframe.contentWindow;
                var iframeHammerhead    = iframeWindow['%hammerhead%'];
                var iframeHistory       = iframeWindow.history;
                var iframeNativeMethods = iframeHammerhead.nativeMethods;
                var iframeLocation      = iframeWindow.location;
                var baseUrl             = 'http://' + location.host + '/some/path';

                iframeHammerhead.get('./utils/url-resolver').updateBase(baseUrl, iframe.contentDocument);
                iframeHammerhead.get('./utils/destination-location')
                    .forceLocation('http://' + iframeLocation.host + '/sessionId/' + baseUrl);

                for (var i = 0; i < urlValues.length; i++) {
                    iframeNativeMethods.historyReplaceState.call(iframeHistory, null, null, baseUrl);

                    var url = urlValues[i];

                    iframeNativeMethods.historyReplaceState.call(iframeHistory, null, null, url);

                    var destUrl           = iframeLocation.toString();
                    var destUrlNotChanged = destUrl === baseUrl;

                    iframeNativeMethods.historyReplaceState.call(iframeHistory, null, null, baseUrl);

                    iframeHistory.replaceState(null, null, url);

                    var parsedProxyUrl = urlUtils.parseProxyUrl(iframeLocation.toString());

                    if (parsedProxyUrl)
                        strictEqual(destUrl, parsedProxyUrl.destUrl);
                    else
                        ok(destUrlNotChanged);
                }

                document.body.removeChild(iframe);
                start();
            });

        document.body.appendChild(iframe);
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
    asyncTest('Navigator.sendBeacon must be overriden (GH-1035)', function () {
        var originUrl    = 'http://example.com/index.html';
        var originData   = 'some data';
        var nativeMethod = nativeMethods.sendBeacon;

        nativeMethods.sendBeacon = function (url, data) {
            strictEqual(url, urlUtils.getProxyUrl(originUrl));
            strictEqual(data, originData);
            nativeMethods.sendBeacon = nativeMethod;
            start();
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

test('the constructor field of a function should return a wrapped Function object (GH-913)', function () {
    var f = function f () {
    };

    strictEqual(f.constructor, Function);
    strictEqual(f.constructor.toString(), nativeMethods.Function.toString());

    var toString       = Function.toString;
    var nativeToString = Function.prototype.toString;

    /*eslint-disable no-extend-native*/
    Function.prototype.toString = function () {
        var str = toString.call(this);

        ok(true);

        return str;
    };

    strictEqual(f.toString().replace(/\s+/g, ''), 'functionf(){}');

    Function.prototype.toString = nativeToString;
    /*eslint-enable no-extend-native*/
});
