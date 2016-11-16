var INTERNAL_PROPS = hammerhead.get('../processing/dom/internal-properties');

var domUtils      = hammerhead.utils.dom;
var browserUtils  = hammerhead.utils.browser;
var iframeSandbox = hammerhead.sandbox.iframe;

QUnit.testStart(function () {
    iframeSandbox.on(iframeSandbox.RUN_TASK_SCRIPT, initIframeTestHandler);
    iframeSandbox.off(iframeSandbox.RUN_TASK_SCRIPT, iframeSandbox.iframeReadyToInitHandler);
});

QUnit.testDone(function () {
    iframeSandbox.off(iframeSandbox.RUN_TASK_SCRIPT, initIframeTestHandler);
});

function toArray (arg) {
    var arr    = [];
    var length = arg.length;

    for (var i = 0; i < length; i++)
        arr.push(arg[i]);

    return arr;
}

asyncTest('isCrossDomainWindows', function () {
    ok(!domUtils.isCrossDomainWindows(window, window));

    var iframeWithEmptySrc = document.createElement('iframe');

    iframeWithEmptySrc.id  = 'test2';
    iframeWithEmptySrc.src = '';
    document.body.appendChild(iframeWithEmptySrc);
    ok(!domUtils.isCrossDomainWindows(window, iframeWithEmptySrc.contentWindow));
    iframeWithEmptySrc.parentNode.removeChild(iframeWithEmptySrc);

    var iframeAboutBlank = document.createElement('iframe');

    iframeAboutBlank.id  = 'test3';
    iframeAboutBlank.src = 'about:blank';
    document.body.appendChild(iframeAboutBlank);
    ok(!domUtils.isCrossDomainWindows(window, iframeAboutBlank.contentWindow));
    iframeAboutBlank.parentNode.removeChild(iframeAboutBlank);

    var crossDomainIframe = document.createElement('iframe');

    window.QUnitGlobals.waitForIframe(crossDomainIframe)
        .then(function () {
            ok(domUtils.isCrossDomainWindows(window, crossDomainIframe.contentWindow));
            crossDomainIframe.parentNode.removeChild(crossDomainIframe);
            start();
        });
    crossDomainIframe.id  = 'test1';
    crossDomainIframe.src = window.getCrossDomainPageUrl('../../data/cross-domain/get-message.html');

    document.body.appendChild(crossDomainIframe);
});

test('isDomElement', function () {
    ok(!domUtils.isDomElement(document));
    ok(domUtils.isDomElement(document.documentElement));
    ok(domUtils.isDomElement(document.body));
    ok(domUtils.isDomElement(document.createElement('span')));
    ok(domUtils.isDomElement(document.createElement('strong')));
    ok(domUtils.isDomElement(document.createElement('a')));
    ok(!domUtils.isDomElement(null));

    //T184805
    var p = Element.prototype;

    /* eslint-disable no-extra-parens */
    do
        ok(!domUtils.isDomElement(p));
    while ((p = Object.getPrototypeOf(p)));
    /* eslint-enable no-extra-parens */
});

asyncTest('isDomElement for iframe elements', function () {
    var iframe = document.createElement('iframe');

    iframe.id  = 'test4';
    iframe.src = '';
    window.QUnitGlobals.waitForIframe(iframe)
        .then(function () {
            var iframeDocument = iframe.contentDocument;

            ok(!domUtils.isDomElement(iframeDocument));
            ok(domUtils.isDomElement(iframeDocument.documentElement));
            ok(domUtils.isDomElement(iframeDocument.body));
            ok(domUtils.isDomElement(iframeDocument.createElement('span')));
            ok(domUtils.isDomElement(iframeDocument.createElement('strong')));
            ok(domUtils.isDomElement(iframeDocument.createElement('a')));

            var p = iframe.contentWindow.Element.prototype;

            /* eslint-disable no-extra-parens */
            do
                ok(!domUtils.isDomElement(p));
            while ((p = Object.getPrototypeOf(p)));
            /* eslint-enable no-extra-parens */

            iframe.parentNode.removeChild(iframe);
            start();
        });
    document.body.appendChild(iframe);
});

asyncTest('getTopSameDomainWindow', function () {
    var iframe = document.createElement('iframe');

    iframe.id = 'test5';
    window.QUnitGlobals.waitForIframe(iframe)
        .then(function () {
            strictEqual(domUtils.getTopSameDomainWindow(window.top), window.top);
            strictEqual(domUtils.getTopSameDomainWindow(iframe.contentWindow), window.top);

            iframe.parentNode.removeChild(iframe);
            start();
        });
    document.body.appendChild(iframe);
});

test('isWindow', function () {
    ok(domUtils.isWindow(window));
    ok(!domUtils.isWindow({ top: '' }));

    var storedToString = window.toString;

    window.toString = function () {
        throw 'eid library overrides window.toString() method';
    };

    ok(domUtils.isWindow(window));

    window.toString = storedToString;
});

test('isXMLHttpRequest', function () {
    ok(domUtils.isXMLHttpRequest(new XMLHttpRequest()));
    ok(!domUtils.isXMLHttpRequest({ responseTest: '' }));

    var iframe = document.createElement('iframe');

    iframe.id = 'test087';
    document.body.appendChild(iframe);

    ok(domUtils.isXMLHttpRequest(new iframe.contentWindow.XMLHttpRequest()));

    document.body.removeChild(iframe);
});

test('closest element', function () {
    var div = document.createElement('div');

    div.className = 'parent';
    div           = document.body.appendChild(div);

    var innerDiv = document.createElement('div');

    innerDiv.className = 'child';
    div.appendChild(innerDiv);

    ok(!domUtils.closest(null, '.test'));
    strictEqual(domUtils.closest(innerDiv, '.parent'), div);
    strictEqual(domUtils.closest(div, 'html'), document.documentElement);

    var iframe = document.createElement('iframe');

    iframe.id = 'test5';
    iframe    = document.body.appendChild(iframe);

    var iframeDiv = iframe.contentDocument.createElement('div');

    iframeDiv.className = 'parent';

    // NOTE: IE9, IE10.
    if (!iframe.contentDocument.body) {
        var body = iframe.contentDocument.createElement('body');

        iframe.contentDocument.appendChild(body);
    }

    iframeDiv = iframe.contentDocument.body.appendChild(iframeDiv);

    var innerIframeDiv = iframe.contentDocument.createElement('div');

    innerIframeDiv.className = 'child';
    iframeDiv.appendChild(innerIframeDiv);

    strictEqual(domUtils.closest(innerIframeDiv, '.parent'), iframeDiv);
    strictEqual(domUtils.closest(iframeDiv, 'body'), iframe.contentDocument.body);

    iframe.parentNode.removeChild(iframe);
    div.parentNode.removeChild(div);
});

test('isSVGElement', function () {
    ok(!domUtils.isSVGElement(null));
    ok(!domUtils.isSVGElement(document));
    ok(!domUtils.isSVGElement(document.documentElement));
    ok(domUtils.isSVGElement(document.createElementNS('http://www.w3.org/2000/svg', 'svg')));
    ok(domUtils.isSVGElement(document.createElementNS('http://www.w3.org/2000/svg', 'use')));
    ok(!domUtils.isSVGElement(document.createElement('div')));
});

asyncTest('isSVGElement for iframe elements', function () {
    var iframe = document.createElement('iframe');

    iframe.id = 'test_unique_id_ydnfgf544332';
    window.QUnitGlobals.waitForIframe(iframe)
        .then(function () {
            var iframeDocument = iframe.contentDocument;

            ok(!domUtils.isSVGElement(null));
            ok(!domUtils.isSVGElement(iframeDocument));
            ok(!domUtils.isSVGElement(iframeDocument.documentElement));
            ok(domUtils.isSVGElement(iframeDocument.createElementNS('http://www.w3.org/2000/svg', 'svg')));
            ok(domUtils.isSVGElement(iframeDocument.createElementNS('http://www.w3.org/2000/svg', 'use')));
            ok(!domUtils.isSVGElement(iframeDocument.createElement('div')));

            iframe.parentNode.removeChild(iframe);
            start();
        });
    document.body.appendChild(iframe);
});

if (window.fetch) {
    test('isFetchHeaders', function () {
        ok(!domUtils.isFetchHeaders(null));
        ok(!domUtils.isFetchHeaders(document));
        ok(!domUtils.isFetchHeaders(document.documentElement));
        ok(!domUtils.isFetchHeaders(window.Headers));
        ok(domUtils.isFetchHeaders(new window.Headers()));
    });

    asyncTest('isFetchHeaders in iframe', function () {
        var iframe = document.createElement('iframe');

        iframe.id = 'test_unique_id_ydniv452';
        window.QUnitGlobals.waitForIframe(iframe)
            .then(function () {
                var iframeDocument = iframe.contentDocument;
                var iframeWindow   = iframe.contentWindow;

                ok(!domUtils.isFetchHeaders(null));
                ok(!domUtils.isFetchHeaders(iframeDocument));
                ok(!domUtils.isFetchHeaders(iframeDocument.documentElement));
                ok(!domUtils.isFetchHeaders(iframeWindow.Headers));
                ok(domUtils.isFetchHeaders(new iframeWindow.Headers()));

                iframe.parentNode.removeChild(iframe);
                start();
            });
        document.body.appendChild(iframe);
    });

    test('isFetchRequest', function () {
        ok(!domUtils.isFetchRequest(null));
        ok(!domUtils.isFetchRequest(document));
        ok(!domUtils.isFetchRequest(document.documentElement));
        ok(!domUtils.isFetchRequest(window.Request));
        ok(domUtils.isFetchRequest(new window.Request('http://domain.com')));
    });

    asyncTest('isFetchRequest in iframe', function () {
        var iframe = document.createElement('iframe');

        iframe.id = 'test_unique_id_ydosn52v452';
        window.QUnitGlobals.waitForIframe(iframe)
            .then(function () {
                var iframeDocument = iframe.contentDocument;
                var iframeWindow   = iframe.contentWindow;

                ok(!domUtils.isFetchRequest(null));
                ok(!domUtils.isFetchRequest(iframeDocument));
                ok(!domUtils.isFetchRequest(iframeDocument.documentElement));
                ok(!domUtils.isFetchRequest(iframeWindow.Request));
                ok(domUtils.isFetchRequest(new iframeWindow.Request('http://domain.com')));

                iframe.parentNode.removeChild(iframe);
                start();
            });
        document.body.appendChild(iframe);
    });

    test('window.Request should work with the operator "instanceof" (GH-690)', function () {
        var request = new Request();

        ok(request instanceof window.Request);
    });
}

test('isHammerheadAttr', function () {
    ok(!domUtils.isHammerheadAttr('href'));
    ok(!domUtils.isHammerheadAttr('class'));
    ok(domUtils.isHammerheadAttr('data-hammerhead-focused'));
    ok(domUtils.isHammerheadAttr('data-hammerhead-hovered'));
    ok(domUtils.isHammerheadAttr('src-hammerhead-stored-value'));
});

module('isIframeWithoutSrc');

asyncTest('after the location is set to an iframe without src isIframeWithoutSrc should return "false"', function () {
    var iframe  = document.createElement('iframe');
    var handler = function () {
        ok(domUtils.isIframeWithoutSrc(this));
        this.removeEventListener('load', handler);
        this.addEventListener('load', function () {
            ok(!domUtils.isIframeWithoutSrc(this));
            this.parentNode.removeChild(this);
            start();
        });

        this.contentWindow.location = window.QUnitGlobals.getResourceUrl('../../data/same-domain/service-message-from-removed-iframe.html');
    };

    iframe.id = 'test9';
    iframe.addEventListener('load', handler);
    document.body.appendChild(iframe);
});

// NOTE: https://developer.microsoft.com/en-us/microsoft-edge/platform/issues/8187450/
if (!browserUtils.isIE) {
    asyncTest('should return "false" after calling document.open, document.write, document.close for the same-domain iframe (GH-703) (GH-704)', function () {
        var iframe = document.createElement('iframe');

        iframe.src = window.QUnitGlobals.getResourceUrl('../../data/code-instrumentation/iframe.html');
        iframe.id  = 'test_unique_id_9090d';
        window.QUnitGlobals.waitForIframe(iframe)
            .then(function () {
                ok(!domUtils.isIframeWithoutSrc(iframe));

                iframe.contentDocument.open();

                ok(!domUtils.isIframeWithoutSrc(iframe));

                iframe.contentDocument.write('<h1>test</h1>');
                ok(!domUtils.isIframeWithoutSrc(iframe));

                iframe.contentDocument.close();
                ok(!domUtils.isIframeWithoutSrc(iframe));

                iframe.parentNode.removeChild(iframe);
                start();
            });
        document.body.appendChild(iframe);
    });
}

test('should return "false" after calling document.open, document.write, document.close for the iframe with javascript src (GH-815)', function () {
    var iframe = document.createElement('iframe');

    iframe.src = 'javascript:false;';
    iframe.id  = 'test_unique_id_p3ebtcyk7';

    document.body.appendChild(iframe);

    ok(domUtils.isIframeWithoutSrc(iframe));

    iframe.contentDocument.open();

    ok(domUtils.isIframeWithoutSrc(iframe));

    iframe.contentDocument.write('<h1>test</h1>');
    ok(domUtils.isIframeWithoutSrc(iframe));

    iframe.contentDocument.close();
    ok(domUtils.isIframeWithoutSrc(iframe));

    iframe.parentNode.removeChild(iframe);
});

asyncTest('changed location 2', function () {
    var iframe  = document.createElement('iframe');
    var handler = function () {
        this.removeEventListener('load', handler);
        this.addEventListener('load', function () {
            this[INTERNAL_PROPS.processedContext] = window;
            ok(!domUtils.isIframeWithoutSrc(this));
            ok(!domUtils.isCrossDomainIframe(this));
            this.parentNode.removeChild(this);
            start();
        });

        this.contentWindow.location = 'http://' + location.host + '/';
    };

    iframe.id = 'test7';
    iframe.setAttribute('src', 'about:blank');
    iframe.addEventListener('load', handler);
    document.body.appendChild(iframe);
});

asyncTest('crossdomain src', function () {
    var iframe = document.createElement('iframe');

    iframe.id  = 'test8';
    iframe.src = window.getCrossDomainPageUrl('../../data/cross-domain/simple-page.html');
    window.QUnitGlobals.waitForIframe(iframe)
        .then(function () {
            iframe[INTERNAL_PROPS.processedContext] = window;
            ok(!domUtils.isIframeWithoutSrc(iframe));
            ok(domUtils.isCrossDomainIframe(iframe));
            iframe.parentNode.removeChild(iframe);

            start();
        });
    document.body.appendChild(iframe);
});

asyncTest('samedomain src', function () {
    var iframe = document.createElement('iframe');

    iframe.id  = 'test9';
    iframe.src = 'http://' + location.host + '/';

    ok(!domUtils.isIframeWithoutSrc(iframe));

    window.QUnitGlobals.waitForIframe(iframe)
        .then(function () {
            iframe[INTERNAL_PROPS.processedContext] = window;
            ok(!domUtils.isIframeWithoutSrc(iframe));
            ok(!domUtils.isCrossDomainIframe(iframe));
            iframe.parentNode.removeChild(iframe);

            start();
        });
    document.body.appendChild(iframe);

    ok(!domUtils.isIframeWithoutSrc(iframe));
});

asyncTest('without src attribute', function () {
    var iframe = document.createElement('iframe');

    iframe.id = 'test10';
    window.QUnitGlobals.waitForIframe(iframe)
        .then(function () {
            iframe[INTERNAL_PROPS.processedContext] = window;
            ok(domUtils.isIframeWithoutSrc(iframe));
            ok(!domUtils.isCrossDomainIframe(iframe));
            iframe.parentNode.removeChild(iframe);
            start();
        });
    document.body.appendChild(iframe);
});

asyncTest('about:blank', function () {
    var iframe = document.createElement('iframe');

    iframe.id  = 'test11';
    iframe.src = 'about:blank';
    window.QUnitGlobals.waitForIframe(iframe)
        .then(function () {
            iframe[INTERNAL_PROPS.processedContext] = window;
            ok(domUtils.isIframeWithoutSrc(iframe));
            ok(!domUtils.isCrossDomainIframe(iframe));
            iframe.parentNode.removeChild(iframe);
            start();
        });
    document.body.appendChild(iframe);
});

module('isCrossDomainIframe');

asyncTest('location is changed to cross-domain', function () {
    expect(4);

    var iteration = 0;
    var iframe    = document.createElement('iframe');

    iframe.id  = 'test12';
    iframe.src = 'http://' + location.host + '/';
    iframe.addEventListener('load', function () {
        if (!iteration) {
            ok(!domUtils.isCrossDomainIframe(iframe));
            ok(!domUtils.isCrossDomainIframe(iframe, true));
            iframe.contentDocument.location.href = window.getCrossDomainPageUrl('../../data/cross-domain/simple-page.html');
            iteration++;
        }
        else {
            ok(domUtils.isCrossDomainIframe(iframe));
            ok(!domUtils.isCrossDomainIframe(iframe, true));
            iframe.parentNode.removeChild(iframe);
            start();
        }
    });
    document.body.appendChild(iframe);
});

asyncTest('empty src attribute', function () {
    var iframe = document.createElement('iframe');

    iframe.id  = 'test13';
    iframe.src = '';
    window.QUnitGlobals.waitForIframe(iframe)
        .then(function () {
            iframe[INTERNAL_PROPS.processedContext] = window;
            ok(domUtils.isIframeWithoutSrc(iframe));
            ok(!domUtils.isCrossDomainIframe(iframe));
            iframe.parentNode.removeChild(iframe);
            start();
        });
    document.body.appendChild(iframe);
});

module('class manipulation');

test('addClass', function () {
    var div = document.createElement('div');

    document.body.appendChild(div);

    domUtils.addClass(null, 'test');
    strictEqual(div.className, '');

    domUtils.addClass(div, 'test');
    strictEqual(div.className, 'test');

    div.className = 'test1';
    domUtils.addClass(div, 'test2 test3');
    strictEqual(div.className, 'test1 test2 test3');

    div.className = 'test1 test2';
    domUtils.addClass(div, 'test2 test3');
    strictEqual(div.className, 'test1 test2 test3');

    div.parentNode.removeChild(div);
});

test('removeClass', function () {
    var div = document.createElement('div');

    document.body.appendChild(div);

    domUtils.removeClass(null, 'test');
    domUtils.removeClass(div, 'test');
    strictEqual(div.className, '');

    div.className = 'test';
    domUtils.removeClass(div, 'test');
    strictEqual(div.className, '');

    div.className = 'test1 test2 test3';
    domUtils.removeClass(div, 'test1');
    strictEqual(div.className, 'test2 test3');

    div.className = 'test1 test2 test3';
    domUtils.removeClass(div, 'test2');
    strictEqual(div.className, 'test1 test3');

    div.className = 'test1 test2 test3';
    domUtils.removeClass(div, 'test3');
    strictEqual(div.className, 'test1 test2');

    div.className = 'test1 test2 test3';
    domUtils.removeClass(div, 'test1 test3');
    strictEqual(div.className, 'test2');

    div.parentNode.removeChild(div);
});

test('hasClass', function () {
    var div = document.createElement('div');

    document.body.appendChild(div);

    ok(!domUtils.hasClass(null, 'test'));

    div.className = 'test';
    ok(domUtils.hasClass(div, 'test'));

    div.className = 'test1 test2 test3';
    ok(domUtils.hasClass(div, 'test1'));
    ok(domUtils.hasClass(div, 'test2'));
    ok(domUtils.hasClass(div, 'test3'));

    div.parentNode.removeChild(div);
});

asyncTest('isElementFocusable', function () {
    var iframe = document.createElement('iframe');
    var src    = window.QUnitGlobals.getResourceUrl('../../data/is-focusable/iframe.html', 'is-focusable/iframe.html');

    iframe.setAttribute('src', src);

    iframe.id           = 'test_unique' + Date.now();
    iframe.style.width  = '500px';
    iframe.style.height = '500px';

    window.QUnitGlobals.waitForIframe(iframe)
        .then(function () {
            var iframeDocument          = iframe.contentDocument;
            var allElements             = iframeDocument.querySelectorAll('*');
            var expectedFocusedElements = toArray(iframeDocument.querySelectorAll('.expected'));
            var focusedElements         = [];

            if (browserUtils.isIE) {
                expectedFocusedElements = expectedFocusedElements.filter(function (el) {
                    if (browserUtils.version <= 10 && domUtils.isAnchorElement(el) && el.getAttribute('href') === '')
                        return false;

                    return !domUtils.isOptionElement(el);
                });
            }
            else {
                expectedFocusedElements = expectedFocusedElements.filter(function (el) {
                    return !domUtils.isTableDataElement(el);
                });
            }

            for (var i = 0; i < allElements.length; i++) {
                if (domUtils.isElementFocusable(allElements[i]))
                    focusedElements.push(allElements[i]);
            }

            deepEqual(expectedFocusedElements, focusedElements);

            document.body.removeChild(iframe);
            start();
        });

    document.body.appendChild(iframe);
});

module('regression');

test('isDocument infinite recursion (GH-923)', function () {
    var obj = eval(processScript('({ toString: function () { this.location = 1; } })'));

    ok(!domUtils.isDocument(obj));
});

asyncTest('isDocument for a cross-domain object (GH-467)', function () {
    var iframe = document.createElement('iframe');

    iframe.src = window.getCrossDomainPageUrl('../../data/cross-domain/target-url.html');
    iframe.id  = 'test_467';

    window.QUnitGlobals.waitForIframe(iframe)
        .then(function () {
            ok(!domUtils.isDocument(iframe.contentWindow));

            document.body.removeChild(iframe);
            start();
        });

    document.body.appendChild(iframe);
});

test('isDomElement for <object> tag (B252941)', function () {
    var objectElement = document.createElement('object');

    document.body.appendChild(objectElement);

    ok(domUtils.isDomElement(objectElement));

    objectElement.parentNode.removeChild(objectElement);
});

test('isDomElement for object that simulate HTMLInputElement (T230802)', function () {
    /* eslint-disable no-unused-vars */
    var obj = {
        size:    null,
        tagName: 'input',
        type:    'text',
        value:   ''
    };

    strictEqual(eval(processScript('obj.value')), '');
    /* eslint-enable no-unused-vars */
});

test('isDomElement for plain object (T198784)', function () {
    /* eslint-disable no-unused-vars */
    var obj = {
        target:  'ok',
        tagName: -1
    };

    strictEqual(eval(processScript('obj.target')), 'ok');
    /* eslint-enable no-unused-vars */
});

asyncTest('cross domain iframe that contains iframe without src should not throw the security error (GH-114)', function () {
    var iframe = document.createElement('iframe');

    iframe.src = window.getCrossDomainPageUrl('../../data/cross-domain/page-with-iframe-with-js-protocol.html');

    window.addEventListener('message', function (e) {
        strictEqual(e.data, 'ok');

        document.body.removeChild(iframe);

        start();
    });

    document.body.appendChild(iframe);
});

if (!browserUtils.isFirefox) {
    asyncTest('getIframeByElement', function () {
        var parentIframe = document.createElement('iframe');

        parentIframe.id = 'test_parent';

        window.QUnitGlobals.waitForIframe(parentIframe)
            .then(function () {
                var parentIframeUtils = parentIframe.contentWindow['%hammerhead%'].utils.dom;
                var childIframe       = parentIframe.contentDocument.createElement('iframe');

                childIframe.id = 'test_child';

                window.QUnitGlobals.waitForIframe(childIframe)
                    .then(function () {
                        var childIframeUtils = childIframe.contentWindow['%hammerhead%'].utils.dom;

                        strictEqual(domUtils.getIframeByElement(parentIframe.contentDocument.body), parentIframe);
                        strictEqual(domUtils.getIframeByElement(childIframe.contentDocument.body), childIframe);
                        strictEqual(childIframeUtils.getIframeByElement(parentIframe.contentDocument.body), parentIframe);
                        strictEqual(childIframeUtils.getIframeByElement(childIframe.contentDocument.body), childIframe);
                        strictEqual(parentIframeUtils.getIframeByElement(parentIframe.contentDocument.body), parentIframe);
                        strictEqual(parentIframeUtils.getIframeByElement(childIframe.contentDocument.body), childIframe);

                        parentIframe.parentNode.removeChild(parentIframe);
                        start();
                    });

                parentIframe.contentDocument.body.appendChild(childIframe);
            });

        document.body.appendChild(parentIframe);
    });
}

test("An object with the 'tagName' property shouldn't be recognized as a dom element", function () {
    notOk(domUtils.isIframeElement({ tagName: 'iframe' }));
    notOk(domUtils.isImgElement({ tagName: 'img' }));
    notOk(domUtils.isInputElement({ tagName: 'input' }));
    notOk(domUtils.isHtmlElement({ tagName: 'html' }));
    notOk(domUtils.isBodyElement({ tagName: 'body' }));
    notOk(domUtils.isHeadElement({ tagName: 'head' }));
    notOk(domUtils.isBaseElement({ tagName: 'base' }));
    notOk(domUtils.isScriptElement({ tagName: 'script' }));
    notOk(domUtils.isStyleElement({ tagName: 'style' }));
    notOk(domUtils.isLabelElement({ tagName: 'label' }));
    notOk(domUtils.isTextAreaElement({ tagName: 'textarea' }));
    notOk(domUtils.isOptionElement({ tagName: 'option' }));
    notOk(domUtils.isSelectElement({ tagName: 'select' }));
    notOk(domUtils.isFormElement({ tagName: 'form' }));
    notOk(domUtils.isMapElement({ tagName: 'map' }));
    notOk(domUtils.isAnchorElement({ tagName: 'a' }));
    notOk(domUtils.isTableElement({ tagName: 'table' }));
    notOk(domUtils.isTableDataElement({ tagName: 'td' }));
});
