var settings     = hammerhead.settings;
var overriding   = hammerhead.utils.overriding;
var DomProcessor = hammerhead.processors.DomProcessor;
var htmlUtils    = hammerhead.utils.html;

var iframeSandbox = hammerhead.sandbox.iframe;
var cookieSandbox = hammerhead.sandbox.cookie;
var browserUtils  = hammerhead.utils.browser;
var domUtils      = hammerhead.utils.dom;
var shadowUI      = hammerhead.sandbox.shadowUI;
var Promise       = hammerhead.Promise;
var nativeMethods = hammerhead.nativeMethods;

test('should not miss the Hammerhead instance after the iframe.contentDocument.close function calling (GH-1821)', function () {
    function checkIframe (iframe) {
        iframe.contentDocument.open();
        iframe.contentDocument.write('Hello!');
        iframe.contentDocument.close();

        var iframeHammerhead = iframe.contentWindow['%hammerhead%'];

        ok(iframeHammerhead);
    }

    return Promise.all([
        createTestIframe(),
        createTestIframe({ src: getSameDomainPageUrl('../../data/iframe/simple-iframe.html') }),
    ])
        .then(function (iframes) {
            var iframeWithoutSrc = iframes[0];
            var iframeWithSrc    = iframes[1];

            checkIframe(iframeWithoutSrc);
            checkIframe(iframeWithSrc);
        });
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

    iframe.id = 'test' + Date.now();
    document.body.appendChild(iframe);
    iframe.contentDocument.write('<script>window.tempTestValue = !!__call$;<' + '/script>');

    ok(iframe.contentWindow.tempTestValue);

    iframe.parentNode.removeChild(iframe);
});

if (nativeMethods.iframeSrcdocGetter) {
    module('srcdoc');

    test('process html with iframe with srcdoc', function () {
        document.body.insertAdjacentHTML('beforeend', '<iframe id="test' + Date.now() + '" srcdoc="' +
            '<a href=\'http://domain.com/\'>Link</a><script>document.write(location.href)<' + '/script>"></iframe>');

        var iframe = document.body.lastChild;

        return window.QUnitGlobals.wait(function () {
            return true;
        })
            .then(function () {
                return window.QUnitGlobals.waitForIframe(iframe);
            })
            .then(function () {
                var anchor = iframe.contentDocument.querySelector('a');

                strictEqual(nativeMethods.anchorHrefGetter.call(anchor), 'http://' + location.host + '/sessionId!i/http://domain.com/');
                strictEqual(nativeMethods.getAttribute.call(anchor, DomProcessor.getStoredAttrName('href')), 'http://domain.com/');
                strictEqual(anchor.href, 'http://domain.com/');
                strictEqual(anchor.getAttribute('href'), 'http://domain.com/');

                iframe.contentDocument.body.removeChild(anchor);

                strictEqual(iframe.contentDocument.body.lastChild.textContent, 'https://example.com/');

                document.body.removeChild(iframe);
            });
    });

    test('the srcdoc property', function () {
        var iframe = document.createElement('iframe');
        var html   = '<body><script>document.write(location.href)<' + '/script>';

        iframe.srcdoc = html;
        iframe.id     = 'test' + Date.now();

        document.body.appendChild(iframe);

        return window.QUnitGlobals.wait(function () {
            return true;
        })
            .then(function () {
                return window.QUnitGlobals.waitForIframe(iframe);
            })
            .then(function () {
                strictEqual(iframe.srcdoc, html);
                ok(nativeMethods.iframeSrcdocGetter.call(iframe).indexOf('__get$Loc') > -1);
                strictEqual(iframe.contentDocument.body.lastChild.textContent, 'https://example.com/');

                document.body.removeChild(iframe);
            });
    });

    test('the srcdoc attribute', function () {
        var iframe = document.createElement('iframe');
        var html   = '<a href="123"></a>';

        iframe.setAttribute('srcdoc', html);

        strictEqual(iframe.getAttribute('srcdoc'), html);
        strictEqual(nativeMethods.getAttribute.call(iframe, 'srcdoc'), htmlUtils.processHtml(html, { isPage: true }).replace(/(sessionId)/, '$1!i'));
    });

    test('ready to init event should be raised after the document was initialized (added to dom)', function () {
        var iframeLoadingEventRaised = false;

        var handler = function (iframe) {
            iframeLoadingEventRaised = true;

            strictEqual(iframe.contentDocument.location.href, 'about:srcdoc');
        };

        iframeSandbox.on(iframeSandbox.RUN_TASK_SCRIPT_EVENT, handler);

        return createTestIframe({ srcdoc: '<h1>simple markup</h1>' })
            .then(function () {
                ok(iframeLoadingEventRaised);

                iframeSandbox.off(iframeSandbox.RUN_TASK_SCRIPT_EVENT, handler);
            });
    });

    test('ready to init event should be raised after the document was initialized (already in dom)', function () {
        createTestIframe({ src: getSameDomainPageUrl('../../data/iframe/iframe-with-srcdoc.html') });

        return waitForMessage(window)
            .then(function (iframeRunTaskScriptEventUrl) {
                strictEqual(iframeRunTaskScriptEventUrl, 'about:srcdoc');
            });
    });

    test('document\'s methods should be rewritten immediately after an iframe added to dom (GH-2647)', function () {
        var iframe = document.createElement('iframe');

        iframe.id     = 'test' + Date.now();
        iframe.srcdoc = '<h1>test</h1>';

        document.body.appendChild(iframe);

        iframe.contentDocument.open();
        iframe.contentDocument.write('<script>parent.postMessage("message", "*")<' + '/script>');
        iframe.contentDocument.close();

        return new Promise(function (resolve) {
            window.addEventListener('message', function onMessage (e) {
                strictEqual(e.data, 'message');

                window.removeEventListener('message', onMessage);
                document.body.removeChild(iframe);
                resolve();
            });
        });
    });
}

test('should not call the contentWindow getter while cloning iframe/frame from XMLDocument (GH-2554)', function () {
    expect(0);

    var str = '<document><iframe /><frame /></document>';

    var parser      = new DOMParser();
    var xmlDocument = parser.parseFromString(str, 'text/xml');
    var iframe      = xmlDocument.childNodes[0].childNodes[0];
    var frame       = xmlDocument.childNodes[0].childNodes[1];

    try {
        // NOTE: in this case we have the "Element" iframe/frame prototype that doesn't have the contentWindow getter.
        iframe.cloneNode(true);
        frame.cloneNode(true);
    }
    catch (e) {
        ok(false, e);
    }
});

module('regression');

test('take sequences starting with "$" into account when generating task scripts (GH-389)', function () {
    expect(1);

    var iframeTemplate = '$$ $& $` $\' $n $nn {{{cookie}}}{{{referer}}}{{{iframeTaskScriptTemplate}}}';

    return createTestIframe()
        .then(function (iframe) {
            iframe.contentWindow.eval = function (processed) {
                strictEqual(processed, '$$ $& $` $\' $n $nn "' + cookieSandbox.getCookie() + '""' +
                                       window.location.toString() + '""' + iframeTemplate + '"');
            };

            var templateSettings = settings.get();
            var storedTemplate   = templateSettings.iframeTaskScriptTemplate;

            templateSettings.iframeTaskScriptTemplate = iframeTemplate;
            iframeSandbox.iframeReadyToInitHandler(iframe);
            templateSettings.iframeTaskScriptTemplate = storedTemplate;
        });
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

            // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
            var iframeDocument          = iframe.contentDocument;
            var iframeWindow            = iframe.contentWindow;
            var iframeHammerhead        = iframeWindow['%hammerhead%'];
            var overriddenCreateElement = iframeDocument.createElement;
            var overriddenAppendChild   = iframeDocument.createElement('div').appendChild;

            ok(!overriding.isNativeFunction(overriddenCreateElement));
            ok(!overriding.isNativeFunction(overriddenAppendChild));

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
            strictEqual(iframe.contentWindow['%hammerhead%'].settings.get().cookie, cookie);
        });
});

asyncTest('an error occurs when proxing two nested iframes (a top iframe has src with javascript protocol) (GH-125)', function () {
    var iframe                         = document.createElement('iframe');
    var countNestedIframeLoadEvents    = 0;
    var maxCountNestedIframeLoadEvents = browserUtils.isWebKit && !browserUtils.isChrome ? 2 : 1; // GH-1966
    var countXhrLoadEvents             = 0;
    var validCountXhrLoadEvents        = browserUtils.isWebKit && !browserUtils.isChrome ? 2 : 1; // GH-1966

    iframe.id = 'test_iframe_id_96ljkls';
    iframe.setAttribute('src', 'javascript:"<html><body><h1>test</h1></body></html>"');
    iframe.addEventListener('load', function () {
        var iframeHammerhead       = iframe.contentWindow['%hammerhead%'];
        var iframeIframeSandbox    = iframeHammerhead.sandbox.iframe;
        var iframeDocument         = iframe.contentDocument;
        var nestedIframe           = iframeDocument.createElement('iframe');
        var checkXhrEventListeners = function () {
            var xhr = new iframe.contentWindow.XMLHttpRequest();

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
        iframeIframeSandbox.on(iframeIframeSandbox.RUN_TASK_SCRIPT_EVENT, initIframeTestHandler);

        checkXhrEventListeners();
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
    var maxLoadEventCount = browserUtils.isWebKit && !browserUtils.isChrome ? 2 : 1; // GH-1966

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
        var internalClickEventCounter = 0;

        return createTestIframe({ src: getSameDomainPageUrl('../../data/iframe/window-event-listeners.html') })
            .then(function (iframe) {
                iframe.contentWindow.performWrite();
                iframe.contentWindow['%hammerhead%'].eventSandbox.listeners.addInternalEventBeforeListener(iframe.contentWindow, ['click'], function () {
                    ++internalClickEventCounter;
                });

                iframe.contentDocument.body.click();

                return window.wait(500);
            })
            .then(function () {
                strictEqual(internalClickEventCounter, 1);
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

    document.body.removeChild(iframe);
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
                    iframeHammerhead.shadowUI._iframeSandbox,
                    iframeHammerhead.shadowUI._nodeMutation,
                    iframeHammerhead.sandbox.codeInstrumentation._locationAccessorsInstrumentation,
                ];

                testedSandboxes.forEach(function (sandbox) {
                    checkDublicatedEventListeners(sandbox);
                });
            });
    });
}

test('overridden functions should have the right prototype in an iframe without src (GH-1824)', function () {
    return createTestIframe()
        .then(function (iframe) {
            iframe.contentWindow.eval('Function.prototype.testFn = function () { return true; }');

            ok(iframe.contentWindow.Function.testFn());
            ok(iframe.contentWindow.Image.testFn());
            ok(iframe.contentDocument.body.appendChild.testFn());
            notOk(window.Function.testFn);
        });
});

test('hammerhead should not use overridden contentWindow, contentDocument getters (GH-1850)', function () {
    return createTestIframe()
        .then(function (iframe) {
            Object.defineProperties(iframe, {
                contentWindow: {
                    get: function () { /* eslint-disable-line getter-return */
                        ok('false', 'contentWindow');
                    },
                    enumerable:   true,
                    configurable: true,
                },
                contentDocument: {
                    get: function () { /* eslint-disable-line getter-return */
                        ok('false', 'contentDocument');
                    },
                    enumerable:   true,
                    configurable: true,
                },
            });

            ok(domUtils.isIframeWithoutSrc(iframe));
            strictEqual(domUtils.getIframeLocation(iframe).documentLocation, 'about:blank');
        });
});

test('a self-removing script should not stop the parsing stream (GH-2000)', function () {
    return createTestIframe()
        .then(function (iframe) {
            var iframeDoc = iframe.contentDocument;

            iframeDoc.open('text/html', 'replace');
            iframeDoc.write('<!DOCTYPE html><html><head><link rel="stylesheet" href="./style.css"></head>',
                '<body><div id="mountPoint"></div></body></html>');
            iframeDoc.close();

            notEqual(iframeDoc.querySelector('#mountPoint'), null);

            iframeDoc.open('text/html', 'replace');
            iframeDoc.write('<!DOCTYPE html><html><head><link rel="stylesheet" href="./style.css"></head>',
                '<body><div id="mountPoint"></div><script>var x = 5;<' + '/script></body></html>');
            iframeDoc.close();

            notEqual(iframeDoc.querySelector('#mountPoint'), null);

            iframeDoc.open('text/html', 'replace');
            iframeDoc.write('<!DOCTYPE html><html><head><link rel="stylesheet" href="./style.css"></head>',
                '<body><script>var x = 5;<' + '/script><div id="mountPoint"></div></body></html>');
            iframeDoc.close();

            strictEqual(iframeDoc.querySelector('#mountPoint'),
                browserUtils.isChrome || browserUtils.isSafari ? null : iframeDoc.body.children[1]);
        });
});

test('the internal anchor element should be restored after the reusing hammerhead in iframe (GH-2461)', function () {
    var iframe;

    return createTestIframe({ src: 'javascript:"<p></p>"' })
        .then(function (createdIframe) {
            iframe = createdIframe;
            iframe.src = getSameDomainPageUrl('../../data/iframe/simple-iframe.html');

            return window.QUnitGlobals.waitForIframe(iframe);
        })
        .then(function () {
            var anchor = iframe.contentDocument.createElement('a');

            anchor.href = 'http://example.com/';

            strictEqual(anchor.hostname, 'example.com');
        });
});

test('Uninitialized iframes should correctly behave when they are rewritten (GH-2694 & GH-2693)', function () {
    return createTestIframe({ src: getSameDomainPageUrl('../../data/iframe/multi-write.html') })
        .then(function (iframe) {
            var idoc    = iframe.contentDocument;
            var iframe1 = idoc.querySelector('#first-iframe');
            var iframe2 = idoc.querySelector('#second-iframe');

            strictEqual(idoc.body.lastElementChild.textContent, 'Current iframe!');
            strictEqual(iframe1.contentDocument.body.lastChild.textContent, 'First iframe!');
            strictEqual(iframe2.contentDocument.body.lastChild.textContent, 'Second iframe!');
        });
});

test('should not throw an exception if iframe name contains quotes (GH-7194)', function () {
    expect(0);

    return createTestIframe({
        name: 'my "example" page',
    });
});

if (browserUtils.isChrome && browserUtils.version > 88 || browserUtils.isFirefox) {
    test('the correct referrer for cross-domain iframes', function () {
        createTestIframe({ src: getCrossDomainPageUrl('../../data/cross-domain/get-referrer.html') });

        return waitForMessage(window)
            .then(function (referrer) {
                strictEqual(referrer, 'https://example.com/');
            });
    });
}
