var settings = hammerhead.get('./settings');

var iframeSandbox = hammerhead.sandbox.iframe;
var cookieSandbox = hammerhead.sandbox.cookie;
var browserUtils  = hammerhead.utils.browser;
var shadowUI      = hammerhead.sandbox.shadowUI;

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
    iframe.contentDocument.write('<script>window.tempTestValue = !!__call$;<' + '/script>');

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
    var container = document.createElement('div');

    document.body.appendChild(container);

    return createTestIframe(null, container)
        .then(function () {
            var iframeLoadingEventRaised = false;

            var handler = function () {
                iframeLoadingEventRaised = true;
            };

            iframeSandbox.on(iframeSandbox.RUN_TASK_SCRIPT_EVENT, handler);

            // eslint-disable-next-line no-unused-vars
            var dummy = container.innerHTML;

            ok(!iframeLoadingEventRaised);
            iframeSandbox.off(iframeSandbox.RUN_TASK_SCRIPT_EVENT, handler);
        });
});

test('the AMD module loader disturbs proxying an iframe without src (GH-127)', function () {
    var amdModuleLoaderMock = function () {
    };

    amdModuleLoaderMock.amd = {};
    window.define           = amdModuleLoaderMock;

    return createTestIframe()
        .then(function (iframe) {
            ok(iframe.contentWindow['%hammerhead%']);
            delete window.define;
        });
});

test('native methods are properly initialized in an iframe without src (GH-279)', function () {
    return createTestIframe()
        .then(function (iframe) {
            var iframeDocument         = iframe.contentDocument;
            var iframeWindow           = iframe.contentWindow;
            var iframeHammerhead       = iframeWindow['%hammerhead%'];
            var nativeCreateElement    = iframeHammerhead.sandbox.nativeMethods.createElement.toString();
            var nativeAppendChild      = iframeHammerhead.sandbox.nativeMethods.appendChild.toString();
            var overridedCreateElement = iframeDocument.createElement.toString();
            var overridedAppendChild   = iframeDocument.createElement('div').appendChild.toString();

            ok(nativeCreateElement !== overridedCreateElement);
            ok(nativeAppendChild !== overridedAppendChild);

            var nativeImage     = new iframeHammerhead.sandbox.nativeMethods.Image(10, 10);
            var overridedImage  = new iframeWindow.Image(10, 10);
            var nativeSrcGetter = iframeHammerhead.sandbox.nativeMethods.imageSrcGetter;
            var imageSrc        = 'test.jpg';

            nativeImage.src    = imageSrc;
            overridedImage.src = imageSrc;

            ok(nativeSrcGetter.call(nativeImage) !== nativeSrcGetter.call(overridedImage));
        });
});

test('quotes in the cookies are not escaped when a task script for an iframe is built on the client (GH-366)', function () {
    var cookie = '""\'\'';

    settings.get().cookie = cookie;

    return createTestIframe()
        .then(function (iframe) {
            strictEqual(iframe.contentWindow['%hammerhead%'].get('./settings').get().cookie, cookie);
        });
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

asyncTest('native methods of the iframe document aren`t overridden for iframe with javascript src (GH-358)', function () {
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

test('native methods of the iframe document aren`t overridden for iframe with javascript src (GH-358)', function () {
    var iframe = document.createElement('iframe');

    ok(!iframeSandbox._shouldSaveIframeNativeMethods(iframe));

    iframe.setAttribute('src', '');
    ok(!iframeSandbox._shouldSaveIframeNativeMethods(iframe));

    iframe.setAttribute('src', 'javascript:false');
    strictEqual(iframeSandbox._shouldSaveIframeNativeMethods(iframe), browserUtils.isWebKit);

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
        return createTestIframe({ src: getSameDomainPageUrl('../../data/iframe/window-event-listeners.html') })
            .then(function (iframe) {
                iframe.contentWindow.eventListenersCount = {};
                iframe.contentWindow.performWrite();

                deepEqual(iframe.contentWindow.eventListenersCount, {});
            });
    });
}

test('self-removing script shouldn\'t throw an error (GH-TC-2469)', function () {
    var iframe = document.createElement('iframe');

    expect(0);

    iframe.id = 'test' + Date.now();
    iframe.src = 'javascript:""';
    document.body.appendChild(iframe);

    var iframeDocument = iframe.contentDocument;

    iframeDocument.open();
    iframe.contentWindow.onerror = function (e) {
        ok(false, e);
    };
    iframeDocument.write('<html><head></head><body></body></html>');
    iframeDocument.close();
});

test('write "doctype" markup without head and body tags (GH-TC-2639)', function () {
    var iframe = document.createElement('iframe');

    expect(0);

    iframe.id = 'test' + Date.now();
    document.body.appendChild(iframe);

    try {
        iframe.contentDocument.write('<!DOCTYPE html><div>x</div>');
    }
    catch (e) {
        ok(false, e);
    }

    iframe.contentDocument.close();
    iframe.parentNode.removeChild(iframe);
});

test('should not throw an exception if `Array.prototype.filter` was overriden (GH-1395)', function () {
    expect(0);

    var storedArrayFilter = Array.prototype.filter;

    // eslint-disable-next-line no-extend-native
    Array.prototype.filter = function () {
        throw new Error('Should not use the `Array.prototype.filter` method for internal purposes.');
    };

    return createTestIframe()
        .then(function () {
            // eslint-disable-next-line no-extend-native
            Array.prototype.filter = storedArrayFilter;
        });
});

// NOTE: https://github.com/DevExpress/testcafe-hammerhead/issues/1821
if (!browserUtils.isFirefox) {
    test('should not dublicate internal handlers after `Sandbox.reattach` call', function () {
        return createTestIframe()
            .then(function (iframe) {
                var checkDublicatedEventListeners = function (sandbox) {
                    var eventListeners = sandbox.eventsListeners;

                    Object.keys(eventListeners).forEach(function (event) {
                        var listenersArr = eventListeners[event].map(function (item) {
                            return item.toString();
                        });

                        var uniqueListenerArr = listenersArr.filter(function (element, index, arr) {
                            return arr.indexOf(element) === index;
                        });

                        strictEqual(listenersArr.length, uniqueListenerArr.length);
                    });
                };

                iframe.contentDocument.open();
                iframe.contentDocument.write('Hello!');
                iframe.contentDocument.close();

                var iframeHammerhead = iframe.contentWindow['%hammerhead%'];

                var testedSandboxes = [
                    iframeHammerhead.shadowUI.iframeSandbox,
                    iframeHammerhead.shadowUI.nodeMutation,
                    iframeHammerhead.sandbox.codeInstrumentation.locationAccessorsInstrumentation
                ];

                testedSandboxes.forEach(function (sandbox) {
                    checkDublicatedEventListeners(sandbox);
                });
            });
    });
}

