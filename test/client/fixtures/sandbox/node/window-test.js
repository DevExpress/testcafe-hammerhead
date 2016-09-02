var urlUtils = hammerhead.get('./utils/url');

var nativeMethods = hammerhead.nativeMethods;
var browserUtils  = hammerhead.utils.browser;
var iframeSandbox = hammerhead.sandbox.iframe;

QUnit.testStart(function () {
    iframeSandbox.on(iframeSandbox.RUN_TASK_SCRIPT, initIframeTestHandler);
    iframeSandbox.off(iframeSandbox.RUN_TASK_SCRIPT, iframeSandbox.iframeReadyToInitHandler);
});

QUnit.testDone(function () {
    iframeSandbox.off(iframeSandbox.RUN_TASK_SCRIPT, initIframeTestHandler);
});


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

    checkNativeFunctionArgs('abort', 'xmlHttpRequestAbort', xhr);
    checkNativeFunctionArgs('open', 'xmlHttpRequestOpen', xhr);

    xhr.setRequestHeader = function () {
    };
    checkNativeFunctionArgs('send', 'xmlHttpRequestSend', xhr);

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

    if (window.history.pushState && window.history.replaceState) {
        checkNativeFunctionArgs('pushState', 'historyPushState', window.history);
        checkNativeFunctionArgs('replaceState', 'historyReplaceState', window.history);
    }

    var documentFragment = document.createDocumentFragment();

    checkNativeFunctionArgs('querySelector', 'documentFragmentQuerySelector', documentFragment);
    checkNativeFunctionArgs('querySelectorAll', 'documentFragmentQuerySelectorAll', documentFragment);
    checkNativeFunctionArgs('dispatchEvent', 'windowDispatchEvent', window);
});

asyncTest('window.name must be overriden', function () {
    var iframe = document.createElement('iframe');

    iframe.setAttribute('src', 'about:blank');
    iframe.id  = 'test-' + Date.now();
    window.QUnitGlobals.waitForIframe(iframe)
        .then(function () {
            var window = iframe.contentWindow;

            ok(window.name);
            ok(!getProperty(window, 'name'));

            setProperty(window, 'name', 'windowName');
            strictEqual(window.name, 'windowName');
            strictEqual(getProperty(window, 'name'), 'windowName');

            setProperty(window, 'name', '');
            strictEqual(window.name, 'windowName');
            strictEqual(getProperty(window, 'name'), '');

            iframe.parentNode.removeChild(iframe);
            start();
        });

    document.body.appendChild(iframe);
});

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

