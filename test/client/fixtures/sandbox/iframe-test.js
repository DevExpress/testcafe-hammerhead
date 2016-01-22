var urlUtils = hammerhead.get('./utils/url');
var settings = hammerhead.get('./settings');

var iframeSandbox = hammerhead.sandbox.iframe;
var nativeMethods = hammerhead.nativeMethods;
var browserUtils  = hammerhead.utils.browser;

QUnit.testStart(function () {
    // NOTE: The 'window.open' method used in QUnit.
    window.open       = nativeMethods.windowOpen;
    window.setTimeout = nativeMethods.setTimeout;
    iframeSandbox.on(iframeSandbox.RUN_TASK_SCRIPT, initIframeTestHandler);
    iframeSandbox.off(iframeSandbox.RUN_TASK_SCRIPT, iframeSandbox.iframeReadyToInitHandler);
});

QUnit.testDone(function () {
    iframeSandbox.off(iframeSandbox.RUN_TASK_SCRIPT, initIframeTestHandler);
});

test('event should not raise before iframe is appended to DOM', function () {
    var eventRaised = false;

    var handler = function () {
        eventRaised = true;
    };

    iframeSandbox.on(iframeSandbox.RUN_TASK_SCRIPT, handler);

    document.createElement('iframe');

    ok(!eventRaised);
    iframeSandbox.off(iframeSandbox.RUN_TASK_SCRIPT, handler);
});

test('event should not raise if a cross-domain iframe is appended', function () {
    var eventRaised = false;

    var handler = function () {
        eventRaised = true;
    };

    iframeSandbox.on(iframeSandbox.RUN_TASK_SCRIPT, handler);

    var $iframe = $('<iframe id="test7" src="http://cross.domain.com">').appendTo('body');

    ok(!eventRaised);
    iframeSandbox.off(iframeSandbox.RUN_TASK_SCRIPT, handler);
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

asyncTest('element.setAttribute', function () {
    // NOTE: Firefox doesn't raise the 'load' event for double-nested iframes without src
    var src    = browserUtils.isFirefox ? 'javascript:"<html><body></body></html>"' : '';
    var iframe = document.createElement('iframe');

    iframe.id = 'test20';
    iframe.setAttribute('src', src);
    window.QUnitGlobals.waitForIframe(iframe)
        .then(function () {
            var iframeHammerhead    = iframe.contentWindow['%hammerhead%'];
            var iframeIframeSandbox = iframeHammerhead.sandbox.iframe;

            iframeIframeSandbox.on(iframeIframeSandbox.RUN_TASK_SCRIPT, initIframeTestHandler);
            iframeIframeSandbox.off(iframeIframeSandbox.RUN_TASK_SCRIPT, iframeSandbox.iframeReadyToInitHandler);

            var iframeDocument = iframe.contentDocument;
            var iframeBody     = iframeDocument.body;
            var nestedIframe   = iframeDocument.createElement('iframe');

            nestedIframe.id = 'test21';

            window.QUnitGlobals.waitForIframe(nestedIframe)
                .then(function () {
                    var nestedIframeHammerhead = nestedIframe.contentWindow['%hammerhead%'];

                    ok(nestedIframeHammerhead);

                    var nestedIframeDocument = nestedIframe.contentDocument;
                    var nestedIframeBody     = nestedIframeDocument.body;
                    var testData             = [
                        [document.body, 'a', 'href', null, null],
                        [iframeBody, 'a', 'href', null, 'iframe'],
                        [document.body, 'form', 'action', null, null],
                        [iframeBody, 'form', 'action', null, 'iframe'],
                        [document.body, 'area', 'href', null, null],
                        [iframeBody, 'area', 'href', null, null],
                        [document.body, 'a', 'href', '_top', null],
                        [iframeBody, 'a', 'href', '_top', null],
                        [nestedIframeBody, 'a', 'href', '_top', null],
                        [document.body, 'a', 'href', '_parent', null],
                        [iframeBody, 'a', 'href', '_parent', null],
                        [nestedIframeBody, 'a', 'href', '_parent', 'iframe']
                    ];

                    var testIframeFlag = function (body, tag, urlAttr, target, resultFlag) {
                        var element = iframeDocument.createElement(tag);

                        body.appendChild(element);
                        if (target)
                            element.setAttribute('target', target);
                        element.setAttribute(urlAttr, '/index.html');

                        strictEqual(urlUtils.parseProxyUrl(element[urlAttr]).resourceType, resultFlag);

                        body.removeChild(element);
                    };

                    for (var i = 0; i < testData.length; i++)
                        testIframeFlag.apply(null, testData[i]);

                    iframe.parentNode.removeChild(iframe);
                    start();
                });
            iframeBody.appendChild(nestedIframe);
        });
    document.body.appendChild(iframe);
});

module('regression');

asyncTest('ready to init event must not raise for added iframe(B239643)', function () {
    var iframe                   = document.createElement('iframe');
    var container                = document.createElement('div');
    var iframeLoadingEventRaised = false;

    iframe.id = 'test1';
    container.appendChild(iframe);
    window.QUnitGlobals.waitForIframe(iframe)
        .then(function () {
            var handler = function () {
                iframeLoadingEventRaised = true;
            };

            iframeSandbox.on(iframeSandbox.RUN_TASK_SCRIPT, handler);

            /* eslint-disable no-unused-vars */
            var dummy = container.innerHTML;

            /* eslint-enable no-unused-vars */
            ok(!iframeLoadingEventRaised);
            iframeSandbox.off(iframeSandbox.RUN_TASK_SCRIPT, handler);
            container.parentNode.removeChild(container);
            start();
        });
    document.body.appendChild(container);
});

asyncTest('the AMD module loader disturbs proxying an iframe without src (GH-127)', function () {
    var amdModuleLoaderMock = function () {
    };

    amdModuleLoaderMock.amd = {};
    window.define           = amdModuleLoaderMock;

    var iframe = document.createElement('iframe');

    iframe.id = 'test_iframe_unique_id_jlsuie56598o';
    window.QUnitGlobals.waitForIframe(iframe)
        .then(function () {
            ok(iframe.contentWindow['%hammerhead%']);
            delete window.define;
            iframe.parentNode.removeChild(iframe);
            start();
        });
    document.body.appendChild(iframe);
});

asyncTest('native methods are properly initialized in an iframe without src (GH-279)', function () {
    var iframe = document.createElement('iframe');

    iframe.id = 'test_unique_id_lkjlosjkf';
    window.QUnitGlobals.waitForIframe(iframe)
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
            start();
        });
    document.body.appendChild(iframe);
});

asyncTest('quotes in the cookies are not escaped when a task script for an iframe is built on the client (GH-366)', function () {
    var iframe = document.createElement('iframe');
    var cookie = '""\'\'';

    iframe.id             = 'test_cookie';
    settings.get().cookie = cookie;

    window.QUnitGlobals.waitForIframe(iframe)
        .then(function () {
            strictEqual(iframe.contentWindow['%hammerhead%'].get('./settings').get().cookie, cookie);
            iframe.parentNode.removeChild(iframe);
            start();
        });

    document.body.appendChild(iframe);
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

        iframeIframeSandbox.off(iframeIframeSandbox.RUN_TASK_SCRIPT, iframeIframeSandbox.iframeReadyToInitHandler);
        iframeIframeSandbox.on(iframeIframeSandbox.RUN_TASK_SCRIPT, checkXhrEventListeners);
        iframeIframeSandbox.on(iframeIframeSandbox.RUN_TASK_SCRIPT, initIframeTestHandler);

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

