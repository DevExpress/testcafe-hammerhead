var settings = hammerhead.get('./settings');

var iframeSandbox = hammerhead.sandbox.iframe;
var cookieSandbox = hammerhead.sandbox.cookie;
var nativeMethods = hammerhead.nativeMethods;
var browserUtils  = hammerhead.utils.browser;
var shadowUI      = hammerhead.sandbox.shadowUI;

QUnit.testStart(function () {
    // NOTE: The 'window.open' method used in QUnit.
    window.open       = nativeMethods.windowOpen;
    window.setTimeout = nativeMethods.setTimeout;
    iframeSandbox.on(iframeSandbox.RUN_TASK_SCRIPT_EVENT, initIframeTestHandler);
    iframeSandbox.off(iframeSandbox.RUN_TASK_SCRIPT_EVENT, iframeSandbox.iframeReadyToInitHandler);
});

QUnit.testDone(function () {
    iframeSandbox.off(iframeSandbox.RUN_TASK_SCRIPT_EVENT, initIframeTestHandler);
});

test('event should not raise before iframe is appended to DOM', function () {
    var eventRaised = false;

    var handler = function () {
        eventRaised = true;
    };

    iframeSandbox.on(iframeSandbox.RUN_TASK_SCRIPT_EVENT, handler);

    document.createElement('iframe');

    ok(!eventRaised);
    iframeSandbox.off(iframeSandbox.RUN_TASK_SCRIPT_EVENT, handler);
});

test('event should not raise if a cross-domain iframe is appended', function () {
    var eventRaised = false;

    var handler = function () {
        eventRaised = true;
    };

    iframeSandbox.on(iframeSandbox.RUN_TASK_SCRIPT_EVENT, handler);

    var $iframe = $('<iframe id="test7" src="http://cross.domain.com">').appendTo('body');

    ok(!eventRaised);
    iframeSandbox.off(iframeSandbox.RUN_TASK_SCRIPT_EVENT, handler);
    $iframe.remove();
});

test('document.write', function () {
    var iframe = document.createElement('iframe');

    iframe.id = 'test10';
    document.body.appendChild(iframe);
    iframe.contentDocument.write('<script>window.tempTestValue = !!__call$;<\/script>');

    ok(iframe.contentWindow.tempTestValue);

    iframe.parentNode.removeChild(iframe);
});

module('regression');

test('take sequences starting with "$" into account when generating task scripts (GH-389)', function () {
    expect(1);

    var iframeTemplate = '$$ $& $` $\' $n $nn {{{cookie}}}{{{referer}}}{{{iframeTaskScriptTemplate}}}';

    var evtMock = {
        iframe: {
            contentWindow: {
                eval: function (processed) {
                    strictEqual(processed, '$$ $& $` $\' $n $nn "' + cookieSandbox.getCookie() + '"' +
                                           window.location.toString() + '"' + iframeTemplate + '"');
                }
            }
        }
    };

    var templateSettings = settings.get();
    var storedTemplate   = templateSettings.iframeTaskScriptTemplate;

    templateSettings.iframeTaskScriptTemplate = iframeTemplate;
    iframeSandbox.iframeReadyToInitHandler(evtMock);
    templateSettings.iframeTaskScriptTemplate = storedTemplate;
});

test('ready to init event must not raise for added iframe(B239643)', function () {
    var iframe                   = document.createElement('iframe');
    var container                = document.createElement('div');
    var iframeLoadingEventRaised = false;

    iframe.id = 'test' + Date.now();
    container.appendChild(iframe);

    var promise = window.QUnitGlobals.waitForIframe(iframe)
        .then(function () {
            var handler = function () {
                iframeLoadingEventRaised = true;
            };

            iframeSandbox.on(iframeSandbox.RUN_TASK_SCRIPT_EVENT, handler);

            /* eslint-disable no-unused-vars */
            var dummy = container.innerHTML;

            /* eslint-enable no-unused-vars */
            ok(!iframeLoadingEventRaised);
            iframeSandbox.off(iframeSandbox.RUN_TASK_SCRIPT_EVENT, handler);
            container.parentNode.removeChild(container);
        });

    document.body.appendChild(container);

    return promise;
});

test('the AMD module loader disturbs proxying an iframe without src (GH-127)', function () {
    var amdModuleLoaderMock = function () {
    };

    amdModuleLoaderMock.amd = {};
    window.define           = amdModuleLoaderMock;

    var iframe = document.createElement('iframe');

    iframe.id = 'test' + Date.now();

    var promise = window.QUnitGlobals.waitForIframe(iframe)
        .then(function () {
            ok(iframe.contentWindow['%hammerhead%']);
            delete window.define;
            iframe.parentNode.removeChild(iframe);
        });

    document.body.appendChild(iframe);

    return promise;
});

test('native methods are properly initialized in an iframe without src (GH-279)', function () {
    var iframe = document.createElement('iframe');

    iframe.id = 'test' + Date.now();

    var promise = window.QUnitGlobals.waitForIframe(iframe)
        .then(function () {
            var iframeDocument         = iframe.contentDocument;
            var iframeWindow           = iframe.contentWindow;
            var iframeHammerhead       = iframeWindow['%hammerhead%'];
            var nativeCreateElement    = iframeHammerhead.sandbox.nativeMethods.createElement.toString();
            var nativeAppendChild      = iframeHammerhead.sandbox.nativeMethods.appendChild.toString();
            var nativeImage            = iframeHammerhead.sandbox.nativeMethods.Image.toString();
            var overridedCreateElement = iframeDocument.createElement.toString();
            var overridedAppendChild   = iframeDocument.createElement('div').appendChild.toString();
            var overridedImage         = iframeWindow.Image.toString();

            ok(nativeCreateElement !== overridedCreateElement);
            ok(nativeAppendChild !== overridedAppendChild);
            ok(nativeImage !== overridedImage);
            iframe.parentNode.removeChild(iframe);
        });

    document.body.appendChild(iframe);

    return promise;
});

test('quotes in the cookies are not escaped when a task script for an iframe is built on the client (GH-366)', function () {
    var iframe = document.createElement('iframe');
    var cookie = '""\'\'';

    iframe.id             = 'test' + Date.now();
    settings.get().cookie = cookie;

    var promise = window.QUnitGlobals.waitForIframe(iframe)
        .then(function () {
            strictEqual(iframe.contentWindow['%hammerhead%'].get('./settings').get().cookie, cookie);
            iframe.parentNode.removeChild(iframe);
        });

    document.body.appendChild(iframe);

    return promise;
});

asyncTest('an error occurs when proxing two nested iframes (a top iframe has src with javascript protocol) (GH-125)', function () {
    var iframe                         = document.createElement('iframe');
    var countNestedIframeLoadEvents    = 0;
    var maxCountNestedIframeLoadEvents = browserUtils.isWebKit ? 2 : 1;
    var countXhrLoadEvents             = 0;
    var validCountXhrLoadEvents        = browserUtils.isWebKit ? 2 : 1;

    iframe.id = 'test_iframe_id_96ljkls';
    iframe.setAttribute('src', 'javascript:"<html><body><h1>test</h1></body></html>"');
    iframe.addEventListener('load', function () {
        var iframeHammerhead       = iframe.contentWindow['%hammerhead%'];
        var iframeIframeSandbox    = iframeHammerhead.sandbox.iframe;
        var iframeDocument         = iframe.contentDocument;
        var nestedIframe           = iframeDocument.createElement('iframe');
        var checkXhrEventListeners = function () {
            var xhr = new iframeHammerhead.sandbox.nativeMethods.XMLHttpRequest();

            xhr.addEventListener('load', function () {
                countXhrLoadEvents++;
                ok(this.responseText, 'test');
            });
            xhr.addEventListener('error', function () {
                ok(false, 'error event must not be raised');
            });
            xhr.open('post', '/get-script/test', false);
            xhr.send();
        };

        iframeIframeSandbox.off(iframeIframeSandbox.RUN_TASK_SCRIPT_EVENT, iframeIframeSandbox.iframeReadyToInitHandler);
        iframeIframeSandbox.on(iframeIframeSandbox.RUN_TASK_SCRIPT_EVENT, checkXhrEventListeners);
        iframeIframeSandbox.on(iframeIframeSandbox.RUN_TASK_SCRIPT_EVENT, initIframeTestHandler);

        nestedIframe.id = 'test_nestedIframe_klshgfn111';
        nestedIframe.setAttribute('src', 'about:blank');
        window.QUnitGlobals.waitForIframe(nestedIframe)
            .then(function () {
                countNestedIframeLoadEvents++;

                if (countNestedIframeLoadEvents === maxCountNestedIframeLoadEvents) {
                    strictEqual(countXhrLoadEvents, validCountXhrLoadEvents);
                    iframe.parentNode.removeChild(iframe);
                    start();
                }
            });
        iframeDocument.body.appendChild(nestedIframe);
    });
    document.body.appendChild(iframe);
});

asyncTest("native methods of the iframe document aren't overridden for iframe with javascript src (GH-358)", function () {
    var iframe            = document.createElement('iframe');
    var loadEventCount    = 0;
    var maxLoadEventCount = browserUtils.isWebKit ? 2 : 1;

    iframe.id = 'test_nmsghf';
    iframe.setAttribute('src', 'javascript:"<html><body>test</body></html>"');
    iframe.addEventListener('load', function () {
        var iframeHammerhead    = iframe.contentWindow['%hammerhead%'];
        var iframeNativeMethods = iframeHammerhead.nativeMethods;

        ok(iframeNativeMethods.createElement.toString().indexOf('native code') !== -1);

        loadEventCount++;

        if (loadEventCount >= maxLoadEventCount) {
            iframe.parentNode.removeChild(iframe);
            start();
        }
    });

    document.body.appendChild(iframe);
});

test("native methods of the iframe document aren't overridden for iframe with javascript src (GH-358)", function () {
    var iframe = document.createElement('iframe');

    ok(!iframeSandbox._shouldSaveIframeNativeMethods(iframe));

    iframe.setAttribute('src', '');
    ok(!iframeSandbox._shouldSaveIframeNativeMethods(iframe));

    iframe.setAttribute('src', 'javascript:false');
    ok(!iframeSandbox._shouldSaveIframeNativeMethods(iframe));

    iframe.setAttribute('src', 'javascript:"<html><body></body></html>"');
    strictEqual(iframeSandbox._shouldSaveIframeNativeMethods(iframe), browserUtils.isWebKit);
});

test("'body.appendChild' method works incorrectly in the particular case (GH-421)", function () {
    var iframes      = [];
    var countIframes = 2;

    var createIframes = function () {
        for (var i = 0; i < countIframes; i++) {
            var iframe = document.createElement('iframe');

            iframes.push(iframe);
            iframe.id = 'test_GH_i_421_' + i;
            iframe.setAttribute('src', 'javascript:false');
            document.body.appendChild(iframe);
        }
    };

    var performDocumentWriteInIframes = function () {
        for (var i = 0; i < countIframes; i++) {
            var iframe = iframes[i];

            iframe.contentDocument.open();
            iframe.contentDocument.write('<html><head><style></style><title>title</title></head><body></body></html>');
            iframe.contentDocument.close();
        }
    };

    var checkIframes = function () {
        for (var i = 0; i < countIframes; i++) {
            var iframe = iframes[i];

            ok(!iframe.contentWindow['%hammerhead%'].sandbox.shadowUI.root);
            iframe.parentNode.removeChild(iframe);
        }
    };

    createIframes();
    performDocumentWriteInIframes();

    var container = document.createElement('div');

    document.body.appendChild(container);

    var child = document.createElement('p');

    container.appendChild(child);
    document.body.removeChild(container);

    ok(shadowUI.root);

    checkIframes();
});

if (browserUtils.isWebKit) {
    test('event listeners added twice in an iframe after document.write (GH-839)', function () {
        var iframe = document.createElement('iframe');

        iframe.id  = 'test' + Date.now();
        iframe.src = window.QUnitGlobals.getResourceUrl('../../data/iframe/window-event-listeners.html');

        var promise = window.QUnitGlobals.waitForIframe(iframe)
            .then(function () {
                iframe.contentWindow.eventListenersCount = {};

                iframe.contentWindow.performWrite();

                deepEqual(iframe.contentWindow.eventListenersCount, {});

                document.body.removeChild(iframe);
            });

        document.body.appendChild(iframe);

        return promise;
    });
}
