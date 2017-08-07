var INTERNAL_PROPS = hammerhead.get('../processing/dom/internal-properties');

var domUtils      = hammerhead.utils.dom;
var browserUtils  = hammerhead.utils.browser;
var iframeSandbox = hammerhead.sandbox.iframe;
var nativeMethods = hammerhead.nativeMethods;
var Promise       = hammerhead.Promise;

QUnit.testStart(function () {
    iframeSandbox.on(iframeSandbox.RUN_TASK_SCRIPT_EVENT, initIframeTestHandler);
    iframeSandbox.off(iframeSandbox.RUN_TASK_SCRIPT_EVENT, iframeSandbox.iframeReadyToInitHandler);
});

QUnit.testDone(function () {
    iframeSandbox.off(iframeSandbox.RUN_TASK_SCRIPT_EVENT, initIframeTestHandler);
});

function toArray (arg) {
    var arr    = [];
    var length = arg.length;

    for (var i = 0; i < length; i++)
        arr.push(arg[i]);

    return arr;
}

module('isCrossDomainWindows', function () {
    test('self', function () {
        ok(!domUtils.isCrossDomainWindows(window, window));
    });

    test('iframe with empty src', function () {
        return window.createTestIframe('')
            .then(function (iframe) {
                ok(!domUtils.isCrossDomainWindows(window, iframe.contentWindow));
            });
    });

    test('iframe with about blank src', function () {
        return window.createTestIframe('about:blank')
            .then(function (iframe) {
                ok(!domUtils.isCrossDomainWindows(window, iframe.contentWindow));
            });
    });

    test('iframe with cross domain src', function () {
        return window.createTestIframe(window.getCrossDomainPageUrl('../../data/cross-domain/get-message.html'))
            .then(function (iframe) {
                ok(!domUtils.isCrossDomainWindows(window, iframe.contentWindow));
            });
    });
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

test('isDomElement for iframe elements', function () {
    return window.createTestIframe('')
        .then(function (iframe) {
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
        });
});

test('getTopSameDomainWindow', function () {
    return window.createTestIframe()
        .then(function (iframe) {
            strictEqual(domUtils.getTopSameDomainWindow(window.top), window.top);
            strictEqual(domUtils.getTopSameDomainWindow(iframe.contentWindow), window.top);
        });
});

test('isWindow', function () {
    ok(domUtils.isWindow(window));
    ok(!domUtils.isWindow({ top: '' }));

    var storedToString = window.toString;

    window.toString = function () {
        throw 'eid library overrides window.toString() method';
    };

    ok(domUtils.isWindow(window));
    ok(!domUtils.isWindow([
        {
            toString: function () {
                ok(false);
            }
        }
    ]));

    window.toString = storedToString;
});

test('isWindow for a cross-domain window', function () {
    return window.createTestIframe(window.getCrossDomainPageUrl('../../data/cross-domain/simple-page.html'))
        .then(function (iframe) {
            var iframeWindow = iframe.contentWindow;

            ok(domUtils.isWindow(iframeWindow));

            // NOTE: The firefox does not provide access to the cross-domain location.
            if (!browserUtils.isFirefox)
                ok(!domUtils.isWindow(iframeWindow.location));
        });
});

test('isXMLHttpRequest', function () {
    ok(domUtils.isXMLHttpRequest(new XMLHttpRequest()));
    ok(!domUtils.isXMLHttpRequest({ responseTest: '' }));

    var iframe = document.createElement('iframe');

    iframe.id = 'test087';
    document.body.appendChild(iframe);

    ok(domUtils.isXMLHttpRequest(new iframe.contentWindow.XMLHttpRequest()));
    ok(!domUtils.isXMLHttpRequest([
        {
            toString: function () {
                ok(false);
            }
        }
    ]));

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

test('isSVGElement for iframe elements', function () {
    return window.createTestIframe()
        .then(function (iframe) {
            var iframeDocument = iframe.contentDocument;

            ok(!domUtils.isSVGElement(null));
            ok(!domUtils.isSVGElement(iframeDocument));
            ok(!domUtils.isSVGElement(iframeDocument.documentElement));
            ok(domUtils.isSVGElement(iframeDocument.createElementNS('http://www.w3.org/2000/svg', 'svg')));
            ok(domUtils.isSVGElement(iframeDocument.createElementNS('http://www.w3.org/2000/svg', 'use')));
            ok(!domUtils.isSVGElement(iframeDocument.createElement('div')));
        });
});

if (window.fetch) {
    test('isFetchHeaders', function () {
        ok(!domUtils.isFetchHeaders(null));
        ok(!domUtils.isFetchHeaders(document));
        ok(!domUtils.isFetchHeaders(document.documentElement));
        ok(!domUtils.isFetchHeaders(window.Headers));
        ok(domUtils.isFetchHeaders(new window.Headers()));
    });

    test('isFetchHeaders in iframe', function () {
        return window.createTestIframe()
            .then(function (iframe) {
                var iframeDocument = iframe.contentDocument;
                var iframeWindow   = iframe.contentWindow;

                ok(!domUtils.isFetchHeaders(null));
                ok(!domUtils.isFetchHeaders(iframeDocument));
                ok(!domUtils.isFetchHeaders(iframeDocument.documentElement));
                ok(!domUtils.isFetchHeaders(iframeWindow.Headers));
                ok(domUtils.isFetchHeaders(new iframeWindow.Headers()));
            });
    });

    test('isFetchRequest', function () {
        ok(!domUtils.isFetchRequest(null));
        ok(!domUtils.isFetchRequest(document));
        ok(!domUtils.isFetchRequest(document.documentElement));
        ok(!domUtils.isFetchRequest(window.Request));
        ok(domUtils.isFetchRequest(new window.Request('http://domain.com')));
    });

    test('isFetchRequest in iframe', function () {
        return window.createTestIframe()
            .then(function (iframe) {
                var iframeDocument = iframe.contentDocument;
                var iframeWindow   = iframe.contentWindow;

                ok(!domUtils.isFetchRequest(null));
                ok(!domUtils.isFetchRequest(iframeDocument));
                ok(!domUtils.isFetchRequest(iframeDocument.documentElement));
                ok(!domUtils.isFetchRequest(iframeWindow.Request));
                ok(domUtils.isFetchRequest(new iframeWindow.Request('http://domain.com')));
            });
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

test('after the location is set to an iframe without src isIframeWithoutSrc should return "false"', function () {
    return window.createTestIframe()
        .then(function (iframe) {
            var src = window.QUnitGlobals.getResourceUrl('../../data/same-domain/service-message-from-removed-iframe.html');

            ok(domUtils.isIframeWithoutSrc(iframe));

            return new Promise(function (resolve) {
                iframe.addEventListener('load', function () {
                    resolve(iframe);
                });
                iframe.contentWindow.location = src;
            });
        })
        .then(function (iframe) {
            ok(!domUtils.isIframeWithoutSrc(iframe));
        });
});

// NOTE: https://developer.microsoft.com/en-us/microsoft-edge/platform/issues/8187450/
if (!browserUtils.isIE) {
    test('should return "false" after calling document.open, document.write, document.close for the same-domain iframe (GH-703) (GH-704)', function () {
        return window.createTestIframe(window.QUnitGlobals.getResourceUrl('../../data/code-instrumentation/iframe.html'))
            .then(function (iframe) {
                ok(!domUtils.isIframeWithoutSrc(iframe));

                iframe.contentDocument.open();

                ok(!domUtils.isIframeWithoutSrc(iframe));

                iframe.contentDocument.write('<h1>test</h1>');
                ok(!domUtils.isIframeWithoutSrc(iframe));

                iframe.contentDocument.close();
                ok(!domUtils.isIframeWithoutSrc(iframe));
            });
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

test('changed location 2', function () {
    return window.createTestIframe('about:blank')
        .then(function (iframe) {
            return new Promise(function (resolve) {
                iframe.addEventListener('load', function () {
                    resolve(iframe);
                });
                iframe.contentWindow.location = 'http://' + location.host + '/';
            });
        })
        .then(function (iframe) {
            iframe[INTERNAL_PROPS.processedContext] = window;
            ok(!domUtils.isIframeWithoutSrc(iframe));
            ok(!domUtils.isCrossDomainIframe(iframe));
        });
});

test('crossdomain src', function () {
    return window.createTestIframe(window.getCrossDomainPageUrl('../../data/cross-domain/simple-page.html'))
        .then(function (iframe) {
            iframe[INTERNAL_PROPS.processedContext] = window;
            ok(!domUtils.isIframeWithoutSrc(iframe));
            ok(domUtils.isCrossDomainIframe(iframe));
        });
});

test('samedomain src', function () {
    var iframe = document.createElement('iframe');

    iframe.id  = 'test' + Date.now();
    iframe.src = 'http://' + location.host + '/';

    ok(!domUtils.isIframeWithoutSrc(iframe));

    var promise = window.QUnitGlobals.waitForIframe(iframe)
        .then(function () {
            iframe[INTERNAL_PROPS.processedContext] = window;
            ok(!domUtils.isIframeWithoutSrc(iframe));
            ok(!domUtils.isCrossDomainIframe(iframe));
            iframe.parentNode.removeChild(iframe);
        });

    document.body.appendChild(iframe);

    ok(!domUtils.isIframeWithoutSrc(iframe));

    return promise;
});

test('without src attribute', function () {
    return window.createTestIframe()
        .then(function (iframe) {
            iframe[INTERNAL_PROPS.processedContext] = window;
            ok(domUtils.isIframeWithoutSrc(iframe));
            ok(!domUtils.isCrossDomainIframe(iframe));
        });
});

test('about:blank', function () {
    return window.createTestIframe('about:blank')
        .then(function (iframe) {
            iframe[INTERNAL_PROPS.processedContext] = window;
            ok(domUtils.isIframeWithoutSrc(iframe));
            ok(!domUtils.isCrossDomainIframe(iframe));
        });
});

module('isCrossDomainIframe');

test('location is changed to cross-domain', function () {
    return window.createTestIframe('http://' + location.host + '/')
        .then(function (iframe) {
            ok(!domUtils.isCrossDomainIframe(iframe));
            ok(!domUtils.isCrossDomainIframe(iframe, true));

            return new Promise(function (resolve) {
                iframe.addEventListener('load', function () {
                    resolve(iframe);
                });
                iframe.contentDocument.location.href = window.getCrossDomainPageUrl('../../data/cross-domain/simple-page.html');
            });
        })
        .then(function (iframe) {
            ok(domUtils.isCrossDomainIframe(iframe));
            ok(!domUtils.isCrossDomainIframe(iframe, true));
        });
});

test('empty src attribute', function () {
    return window.createTestIframe('')
        .then(function (iframe) {
            iframe[INTERNAL_PROPS.processedContext] = window;
            ok(domUtils.isIframeWithoutSrc(iframe));
            ok(!domUtils.isCrossDomainIframe(iframe));
        });
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

test('isElementFocusable', function () {
    var src = window.QUnitGlobals.getResourceUrl('../../data/is-focusable/iframe.html', 'is-focusable/iframe.html');

    return window.createTestIframe(src)
        .then(function (iframe) {
            iframe.style.width  = '500px';
            iframe.style.height = '500px';

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
                    return !domUtils.isTableDataCellElement(el);
                });
            }

            for (var i = 0; i < allElements.length; i++) {
                if (domUtils.isElementFocusable(allElements[i]))
                    focusedElements.push(allElements[i]);
            }

            deepEqual(expectedFocusedElements, focusedElements);
        });
});

test('isTextEditableInput', function () {
    var editableTypes = {
        'color':          false,
        'date':           false,
        'datetime-local': false,
        'email':          true,
        'month':          false,
        'number':         true,
        'password':       true,
        'range':          false,
        'search':         true,
        'tel':            true,
        'text':           true,
        'time':           false,
        'url':            true,
        'week':           false
    };

    var input = nativeMethods.createElement.call(document, 'input');

    // NOTE: check element with empty "type" attribute
    ok(domUtils.isTextEditableInput(input));

    for (var type in editableTypes) {
        if (editableTypes.hasOwnProperty(type)) {
            input.setAttribute('type', type);
            strictEqual(domUtils.isTextEditableInput(input), editableTypes[type]);
        }
    }
});

test('isElementReadOnly', function () {
    var input = document.createElement('input');

    ok(!domUtils.isElementReadOnly(input));

    input.readOnly = true;

    ok(domUtils.isElementReadOnly(input));

    input.readOnly = false;

    ok(!domUtils.isElementReadOnly(input));

    input.setAttribute('readOnly', 'readOnly');

    ok(domUtils.isElementReadOnly(input));
});

module('regression');

test('isDocument infinite recursion (GH-923)', function () {
    var obj = eval(processScript('({ toString: function () { this.location = 1; } })'));

    ok(!domUtils.isDocument(obj));
});

test('isDocument for a cross-domain object (GH-467)', function () {
    return window.createTestIframe(window.getCrossDomainPageUrl('../../data/cross-domain/target-url.html'))
        .then(function (iframe) {
            ok(!domUtils.isDocument(iframe.contentWindow));
        });
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
    test('getIframeByElement', function () {
        var parentIframe = null;
        var childIframe  = null;

        return window.createTestIframe()
            .then(function (iframe) {
                parentIframe = iframe;

                return window.createTestIframe(null, parentIframe.contentDocument.body);
            })
            .then(function (iframe) {
                childIframe = iframe;

                var parentIframeUtils = parentIframe.contentWindow['%hammerhead%'].utils.dom;
                var childIframeUtils  = childIframe.contentWindow['%hammerhead%'].utils.dom;

                strictEqual(domUtils.getIframeByElement(parentIframe.contentDocument.body), parentIframe);
                strictEqual(domUtils.getIframeByElement(childIframe.contentDocument.body), childIframe);
                strictEqual(childIframeUtils.getIframeByElement(parentIframe.contentDocument.body), parentIframe);
                strictEqual(childIframeUtils.getIframeByElement(childIframe.contentDocument.body), childIframe);
                strictEqual(parentIframeUtils.getIframeByElement(parentIframe.contentDocument.body), parentIframe);
                strictEqual(parentIframeUtils.getIframeByElement(childIframe.contentDocument.body), childIframe);
            });
    });
}

test("An object with the 'tagName' and 'nodeName' properties shouldn't be recognized as a dom element", function () {
    notOk(domUtils.isIframeElement({ tagName: 'iframe', nodeName: 'iframe' }), 'iframe');
    notOk(domUtils.isImgElement({ tagName: 'img', nodeName: 'img' }), 'img');
    notOk(domUtils.isInputElement({ tagName: 'input', nodeName: 'input' }), 'input');
    notOk(domUtils.isHtmlElement({ tagName: 'html', nodeName: 'html' }), 'html');
    notOk(domUtils.isBodyElement({ tagName: 'body', nodeName: 'body' }), 'body');
    notOk(domUtils.isHeadElement({ tagName: 'head', nodeName: 'head' }), 'head');
    notOk(domUtils.isBaseElement({ tagName: 'base', nodeName: 'base' }), 'base');
    notOk(domUtils.isScriptElement({ tagName: 'script', nodeName: 'script' }), 'script');
    notOk(domUtils.isStyleElement({ tagName: 'style', nodeName: 'style' }), 'style');
    notOk(domUtils.isLabelElement({ tagName: 'label', nodeName: 'label' }), 'label');
    notOk(domUtils.isTextAreaElement({ tagName: 'textarea', nodeName: 'textarea' }), 'textarea');
    notOk(domUtils.isOptionElement({ tagName: 'option', nodeName: 'option' }), 'option');
    notOk(domUtils.isSelectElement({ tagName: 'select', nodeName: 'select' }), 'select');
    notOk(domUtils.isFormElement({ tagName: 'form', nodeName: 'form' }), 'form');
    notOk(domUtils.isMapElement({ tagName: 'map', nodeName: 'map' }), 'map');
    notOk(domUtils.isMapElement({ tagName: 'area', nodeName: 'area' }), 'area');
    notOk(domUtils.isAnchorElement({ tagName: 'a', nodeName: 'a' }), 'a');
    notOk(domUtils.isTableElement({ tagName: 'table', nodeName: 'table' }), 'table');
    notOk(domUtils.isTableDataCellElement({ tagName: 'td', nodeName: 'td' }), 'td');
});

test('inspect html elements', function () {
    ok(domUtils.isIframeElement(nativeMethods.createElement.call(document, 'iframe')), 'iframe');
    ok(domUtils.isImgElement(nativeMethods.createElement.call(document, 'img')), 'img');
    ok(domUtils.isInputElement(nativeMethods.createElement.call(document, 'input')), 'input');
    ok(domUtils.isHtmlElement(nativeMethods.querySelector.call(document, 'html')), 'html');
    ok(domUtils.isBodyElement(nativeMethods.querySelector.call(document, 'body')), 'body');
    ok(domUtils.isHeadElement(nativeMethods.querySelector.call(document, 'head')), 'head');
    ok(domUtils.isBaseElement(nativeMethods.createElement.call(document, 'base')), 'base');
    ok(domUtils.isScriptElement(nativeMethods.querySelector.call(document, 'script')), 'script');
    ok(domUtils.isStyleElement(nativeMethods.createElement.call(document, 'style')), 'style');
    ok(domUtils.isLabelElement(nativeMethods.createElement.call(document, 'label')), 'label');
    ok(domUtils.isTextAreaElement(nativeMethods.createElement.call(document, 'textarea')), 'textarea');
    ok(domUtils.isOptionElement(nativeMethods.createElement.call(document, 'option')), 'option');
    ok(domUtils.isSelectElement(nativeMethods.createElement.call(document, 'select')), 'select');
    ok(domUtils.isFormElement(nativeMethods.createElement.call(document, 'form')), 'form');
    ok(domUtils.isMapElement(nativeMethods.createElement.call(document, 'map')), 'map');
    ok(domUtils.isMapElement(nativeMethods.createElement.call(document, 'area')), 'area');
    ok(domUtils.isAnchorElement(nativeMethods.createElement.call(document, 'a')), 'a');
    ok(domUtils.isTableElement(nativeMethods.createElement.call(document, 'table')), 'table');
    ok(domUtils.isTableDataCellElement(nativeMethods.createElement.call(document, 'td')), 'td');
});

if (browserUtils.isChrome) {
    test('should return active element inside shadow DOM', function () {
        var host  = document.createElement('div');
        var root  = host.createShadowRoot();
        var input = document.createElement('input');

        document.body.appendChild(host);
        root.appendChild(input);

        nativeMethods.focus.call(input);

        strictEqual(domUtils.getActiveElement(), input);

        document.body.removeChild(host);
    });

    test('should return active element inside nested shadow DOM', function () {
        var hostParent = document.createElement('div');
        var hostChild  = document.createElement('div');
        var rootParent = hostParent.createShadowRoot();
        var rootChild  = hostChild.createShadowRoot();
        var input      = document.createElement('input');

        document.body.appendChild(hostParent);
        rootParent.appendChild(hostChild);
        rootChild.appendChild(input);

        nativeMethods.focus.call(input);

        strictEqual(domUtils.getActiveElement(), input);

        document.body.removeChild(hostParent);
    });
}

