var INTERNAL_PROPS      = hammerhead.PROCESSING_INSTRUCTIONS.dom.internal_props;
var DomProcessor        = hammerhead.processors.DomProcessor;
var urlUtils            = hammerhead.utils.url;
var SHADOW_UI_CLASSNAME = hammerhead.SHADOW_UI_CLASS_NAME;

var browserUtils  = hammerhead.utils.browser;
var nativeMethods = hammerhead.nativeMethods;

var nativeMethodCalled;

function wrapNativeFn (fnName) {
    var storedFn = nativeMethods[fnName];

    nativeMethodCalled    = false;
    nativeMethods[fnName] = function () {
        nativeMethodCalled    = true;
        nativeMethods[fnName] = storedFn;

        return storedFn.apply(this, arguments);
    };
}

test('document.createElement', function () {
    wrapNativeFn('createElement');

    var div = document.createElement('div');

    ok(nativeMethodCalled);
    strictEqual(div[INTERNAL_PROPS.processedContext], window);
});

test('element.insertAdjacentHTML', function () {
    var parentDiv = document.createElement('div');
    var childDiv  = parentDiv.appendChild(document.createElement('div'));
    var url       = '/test';

    wrapNativeFn('insertAdjacentHTML');

    childDiv.insertAdjacentHTML('beforebegin', '<a href="' + url + '1"></a>');

    ok(nativeMethodCalled);
    strictEqual(parentDiv.firstChild[INTERNAL_PROPS.processedContext], window);
    strictEqual(nativeMethods.anchorHrefGetter.call(parentDiv.firstChild), urlUtils.getProxyUrl(url + 1));

    childDiv.insertAdjacentHTML('afterend', '<a href="' + url + '2"></a>');

    strictEqual(parentDiv.lastChild[INTERNAL_PROPS.processedContext], window);
    strictEqual(nativeMethods.anchorHrefGetter.call(parentDiv.lastChild), urlUtils.getProxyUrl(url + 2));

    parentDiv.insertAdjacentHTML('afterbegin', '<a href="' + url + '3"></a>');

    strictEqual(parentDiv.firstChild[INTERNAL_PROPS.processedContext], window);
    strictEqual(nativeMethods.anchorHrefGetter.call(parentDiv.firstChild), urlUtils.getProxyUrl(url + 3));

    parentDiv.insertAdjacentHTML('beforeend', '<a href="' + url + '4"></a>');

    strictEqual(parentDiv.lastChild[INTERNAL_PROPS.processedContext], window);
    strictEqual(nativeMethods.anchorHrefGetter.call(parentDiv.lastChild), urlUtils.getProxyUrl(url + 4));
});

test('element.insertBefore', function () {
    var parentDiv    = document.createElement('div');
    var lastChildDiv = parentDiv.appendChild(document.createElement('div'));
    var nativeDiv    = nativeMethods.createElement.call(document, 'div');

    wrapNativeFn('insertBefore');

    var result = parentDiv.insertBefore(nativeDiv, lastChildDiv);

    ok(nativeMethodCalled);
    strictEqual(nativeDiv[INTERNAL_PROPS.processedContext], window);
    strictEqual(result, nativeDiv);
});

test('element.appendChild', function () {
    var parentDiv = document.createElement('div');
    var nativeDiv = nativeMethods.createElement.call(document, 'div');

    wrapNativeFn('appendChild');

    var result = parentDiv.appendChild(nativeDiv);

    ok(nativeMethodCalled);
    strictEqual(nativeDiv[INTERNAL_PROPS.processedContext], window);
    strictEqual(result, nativeDiv);
});

test('element.removeAttribute, element.removeAttributeNS', function () {
    var el         = document.createElement('a');
    var attr       = 'href';
    var storedAttr = DomProcessor.getStoredAttrName(attr);
    var namespace  = 'http://www.w3.org/1999/xhtml';
    var url        = '/test.html';

    el.setAttribute(attr, url);
    el.setAttributeNS(namespace, attr, url);

    ok(nativeMethods.getAttribute.call(el, attr));
    ok(nativeMethods.getAttribute.call(el, storedAttr));
    ok(nativeMethods.getAttributeNS.call(el, namespace, attr));
    ok(nativeMethods.getAttributeNS.call(el, namespace, storedAttr));

    wrapNativeFn('removeAttributeNS');

    el.removeAttributeNS(namespace, attr);

    ok(nativeMethodCalled);
    ok(nativeMethods.getAttribute.call(el, attr));
    ok(nativeMethods.getAttribute.call(el, storedAttr));
    ok(!nativeMethods.getAttributeNS.call(el, namespace, attr));
    ok(!nativeMethods.getAttributeNS.call(el, namespace, storedAttr));

    wrapNativeFn('removeAttribute');

    el.removeAttribute(attr);

    ok(nativeMethodCalled);
    ok(!nativeMethods.getAttribute.call(el, attr));
    ok(!nativeMethods.getAttribute.call(el, storedAttr));
    ok(!nativeMethods.getAttributeNS.call(el, namespace, attr));
    ok(!nativeMethods.getAttributeNS.call(el, namespace, storedAttr));
});

test('element.removeAttributeNode', function () {
    var el         = document.createElement('a');
    var attr       = 'href';
    var storedAttr = DomProcessor.getStoredAttrName(attr);
    var namespace  = 'http://www.w3.org/1999/xhtml';
    var url        = '/test.html';

    el.setAttribute(attr, url);
    el.setAttributeNS(namespace, attr, url);

    ok(nativeMethods.getAttributeNode.call(el, attr));
    ok(nativeMethods.getAttributeNode.call(el, storedAttr));
    ok(nativeMethods.getAttributeNodeNS.call(el, namespace, attr));
    ok(nativeMethods.getAttributeNodeNS.call(el, namespace, storedAttr));

    wrapNativeFn('removeAttributeNode');

    let node = nativeMethods.getAttributeNodeNS.call(el, namespace, attr);

    const attributes = el.attributes;

    strictEqual(attributes.length, 2);

    el.removeAttributeNode(node);

    strictEqual(attributes.length, 1);

    ok(nativeMethodCalled);
    ok(nativeMethods.getAttribute.call(el, attr));
    ok(nativeMethods.getAttribute.call(el, storedAttr));
    ok(!nativeMethods.getAttributeNS.call(el, namespace, attr));
    ok(!nativeMethods.getAttributeNS.call(el, namespace, storedAttr));

    wrapNativeFn('removeAttributeNode');

    node = nativeMethods.getAttributeNode.call(el, attr);

    el.removeAttributeNode(node);

    strictEqual(attributes.length, 0);

    ok(nativeMethodCalled);
    ok(!nativeMethods.getAttributeNode.call(el, attr));
    ok(!nativeMethods.getAttributeNode.call(el, storedAttr));
    ok(!nativeMethods.getAttributeNodeNS.call(el, namespace, attr));
    ok(!nativeMethods.getAttributeNodeNS.call(el, namespace, storedAttr));
});

test('element.getAttributeNS, element.setAttributeNS', function () {
    var image = document.createElementNS('xlink', 'image');

    wrapNativeFn('setAttributeNS');

    image.setAttributeNS('xlink', 'href', 'image.png');

    ok(nativeMethodCalled);
    strictEqual(nativeMethods.getAttributeNS.call(image, 'xlink', 'href'), urlUtils.getProxyUrl('image.png'));
    strictEqual(nativeMethods.getAttributeNS.call(image, 'xlink', DomProcessor.getStoredAttrName('href')), 'image.png');

    wrapNativeFn('getAttributeNS');

    strictEqual(image.getAttributeNS('xlink', 'href'), 'image.png');
    ok(nativeMethodCalled);
});

test('table.insertRow, table.insertCell', function () {
    var table = document.createElement('table');
    var tbody = document.createElement('tbody');

    wrapNativeFn('insertTableRow');

    var tableRow = table.insertRow(0);

    ok(nativeMethodCalled);
    ok(tableRow instanceof HTMLTableRowElement);
    strictEqual(tableRow[INTERNAL_PROPS.processedContext], window);

    wrapNativeFn('insertTBodyRow');

    var tbodyRow = tbody.insertRow(0);

    ok(nativeMethodCalled);
    ok(tbodyRow instanceof HTMLTableRowElement);
    strictEqual(tbodyRow[INTERNAL_PROPS.processedContext], window);

    wrapNativeFn('insertCell');

    var cell = tableRow.insertCell(0);

    ok(nativeMethodCalled);
    ok(cell instanceof HTMLTableCellElement);
    strictEqual(cell[INTERNAL_PROPS.processedContext], window);
});

asyncTest('form.submit', function () {
    createTestIframe({ name: 'test-window' })
        .then(function (iframe) {
            var form             = iframe.contentDocument.createElement('form');
            var iframeHammerhead = iframe.contentWindow['%hammerhead%'];
            var handler          = function (e) {
                strictEqual(e.form, form);
                iframeHammerhead.off(iframeHammerhead.EVENTS.beforeFormSubmit, handler);
                start();
            };

            iframeHammerhead.on(iframeHammerhead.EVENTS.beforeFormSubmit, handler);

            form.target = 'test-window';
            form.submit();
        });
});

test('setAttribute: img src', function () {
    var img = nativeMethods.createElement.call(document, 'img');

    processDomMeth(img);

    img.setAttribute('src', '/image.gif?param=value');

    strictEqual(nativeMethods.getAttribute.call(img, 'src'), urlUtils.resolveUrlAsDest('/image.gif?param=value'));
});

test('canvasRenderingContext2D.drawImage', function () {
    var storedNativeMethod  = nativeMethods.canvasContextDrawImage;
    var crossDomainUrl      = 'http://crossdomain.com/image.png';
    var localUrl            = 'http://' + location.host + '/';
    var crossDomainImg      = nativeMethods.createElement.call(document, 'img');
    var localImg            = nativeMethods.createElement.call(document, 'img');
    var imgCreatedViaConstr = new Image();
    var canvasContext       = $('<canvas>')[0].getContext('2d');
    var otherCanvas         = $('<canvas>')[0];
    var otherCanvasContext  = otherCanvas.getContext('2d');
    var slice               = Array.prototype.slice;
    var testCases           = [
        {
            description: 'image with cross-domain url',
            args:        [crossDomainImg, 1, 2],
            testImgFn:   function (img) {
                return nativeMethods.imageSrcGetter.call(img) === crossDomainUrl;
            },
        },
        {
            description: 'image with local url',
            args:        [localImg, 4, 3, 2, 1],
            testImgFn:   function (img) {
                return nativeMethods.imageSrcGetter.call(img) === urlUtils.getProxyUrl(localUrl);
            },
        },
        {
            description: 'image created with Image constructor',
            args:        [imgCreatedViaConstr, 4, 3, 2],
            testImgFn:   function (img) {
                return img === imgCreatedViaConstr;
            },
        },
        {
            description: 'canvas element',
            args:        [otherCanvas, 1, 3, 5, 7, 2, 4, 6, 8],
            testImgFn:   function (img) {
                return img === otherCanvas;
            },
        },
        {
            description: 'canvas context',
            args:        [otherCanvasContext, 11, 12],
            testImgFn:   function (img) {
                return img === otherCanvasContext;
            },
        },
    ];

    nativeMethods.imageSrcSetter.call(crossDomainImg, crossDomainUrl);
    nativeMethods.imageSrcSetter.call(localImg, localUrl);

    testCases.forEach(function (testCase) {
        nativeMethods.canvasContextDrawImage = function (img) {
            ok(testCase.testImgFn(img), testCase.description);
            strictEqual(slice.call(arguments, 1).join(','), slice.call(testCase.args, 1).join(','),
                testCase.description + ' (other arguments)');
        };

        canvasContext.drawImage.apply(canvasContext, testCase.args);
    });

    nativeMethods.canvasContextDrawImage = storedNativeMethod;
});

if (!browserUtils.isFirefox) {
    test('document.write exception', function () {
        var iframe      = document.createElement('iframe');
        var checkIframe = function () {
            return iframe.contentWindow.test && iframe.contentDocument.getElementById('div1');
        };

        iframe.id = 'test' + Date.now();
        document.body.appendChild(iframe);

        eval(processScript([
            'iframe.contentDocument.write("<html><body><div id=\'div1\'></div></body></html>");',
            'iframe.contentDocument.write("<script>window.test = true;<' + '/script>");',
        ].join('')));

        return window.QUnitGlobals.wait(checkIframe)
            .then(function () {
                ok(true);
                iframe.parentNode.removeChild(iframe);
            });
    });
}

if (window.DOMParser) {
    module('DOMParser', function () {
        test('parseFromString', function () {
            var htmlStr        = '<a href="/path">Anchor</a>';
            var domParser      = new DOMParser();
            var parsedDocument = domParser.parseFromString(htmlStr, 'text/html');
            var proxyUrl       = 'http://' + location.host + '/sessionId/https://example.com/path';
            var anchor         = parsedDocument.querySelector('a');

            strictEqual(nativeMethods.anchorHrefGetter.call(anchor), proxyUrl);

            throws(function () {
                domParser.parseFromString(htmlStr);
            }, TypeError);

            parsedDocument = domParser.parseFromString(htmlStr, 'application/xml');
            anchor         = parsedDocument.querySelector('a');

            strictEqual(nativeMethods.getAttribute.call(anchor, 'href'), '/path');

            parsedDocument = domParser.parseFromString(htmlStr, 'text/html');
            anchor         = parsedDocument.querySelector('a');

            strictEqual(nativeMethods.anchorHrefGetter.call(anchor), proxyUrl);
        });

        test('parseFromString result Document should not contain self-removing scripts (GH-1619)', function () {
            var domParser = new DOMParser();
            var testCases = [
                '',
                '<!DOCTYPE html>',
                '<!DOCTYPE html><html><head></head><body></body></html>',
            ];

            testCases.forEach(function (html) {
                var parsedDocument      = domParser.parseFromString(html, 'text/html');
                var selfRemovingScripts = nativeMethods.querySelectorAll.call(parsedDocument,
                    '.' + SHADOW_UI_CLASSNAME.selfRemovingScript);

                strictEqual(selfRemovingScripts.length, 0);
            });
        });
    });
}

if (Object.assign) {
    module('Object.assign', function () {
        test('cloning an object', function () {
            var symbol = Symbol('b');
            var obj    = { a: 1 };

            obj[symbol] = 2;

            var copy = Object.assign({}, obj);

            notEqual(copy, obj);
            strictEqual(copy.a, 1);
            strictEqual(copy[symbol], 2);
        });

        test('merging an objects', function () {
            var symbol = Symbol('d');

            var o1 = { a: 1 };
            var o2 = { b: 2 };
            var o3 = { c: 3 };
            var o4 = {};

            o4[symbol] = 4;

            var obj = Object.assign(o1, o2, o3, o4);

            strictEqual(obj, o1);
            strictEqual(obj.b, 2);
            strictEqual(obj.c, 3);
            strictEqual(obj[symbol], 4);
        });

        test('merging objects with same properties', function () {
            var symbol = Symbol('d');

            var o1 = { a: 1, b: 1, c: 1 };

            o1[symbol] = 1;

            var o2 = { b: 2, c: 2 };

            o2[symbol] = 2;

            var o3 = { c: 3 };

            o3[symbol] = 3;

            var o4 = {};

            o4[symbol] = 4;

            var obj = Object.assign({}, o1, o2, o3, o4);

            strictEqual(obj.a, 1);
            strictEqual(obj.b, 2);
            strictEqual(obj.c, 3);
            strictEqual(obj[symbol], 4);
        });

        test('properties on the prototype chain and non-enumerable properties cannot be copied', function () {
            var obj  = Object.create({ foo: 1 }, {
                bar: { value: 2 },
                baz: { value: 3, enumerable: true },
            });
            var copy = Object.assign({}, obj);

            notEqual(copy.foo, 1);
            notEqual(copy.bar, 2);
            strictEqual(copy.baz, 3);
        });

        test('primitives will be wrapped to objects', function () {
            var obj = Object.assign({}, '123', null, true, void 0, 10);

            strictEqual(JSON.stringify(obj), '{"0":"1","1":"2","2":"3"}');
        });

        test('exceptions will interrupt the ongoing copying task', function () {
            var obj = Object.defineProperty({}, 'foo', {
                set: function () {
                    throw 'Cannot assign property "foo"';
                },
                get: function () {
                    return 4;
                },
            });

            throws(
                function () {
                    Object.assign(obj, { bar: 1 }, 'hi', { foo2: 2, foo: 2, foo3: 2 }, { baz: 3 });
                },
                /Cannot assign property "foo"/ // eslint-disable-line comma-dangle
            );

            strictEqual(obj[0], 'h');
            strictEqual(obj[1], 'i');
            strictEqual(obj.bar, 1);
            strictEqual(obj.foo2, 2);
            strictEqual(obj.foo, 4);
            notEqual(obj.foo3, 2);
            notEqual(obj.baz, 3);
        });

        test('throws error when target is null or undefined', function () {
            throws(
                function () {
                    Object.assign(null, { bar: 1 });
                },
                TypeError // eslint-disable-line comma-dangle
            );

            throws(
                function () {
                    Object.assign(void 0, { bar: 1 });
                },
                TypeError // eslint-disable-line comma-dangle
            );
        });

        test('the src attribute of iframe should be processed (GH-1208)', function () {
            var iframe = document.createElement('iframe');

            strictEqual(Object.assign(iframe, { src: '/iframe1' }), iframe);
            strictEqual(nativeMethods.iframeSrcGetter.call(iframe), urlUtils.getProxyUrl('/iframe1', {
                resourceType: urlUtils.stringifyResourceType({ isIframe: true }),
                proxyPort:    2001,
            }));

            var fn = function () {
            };

            fn.src = '/iframe2';

            Object.assign(iframe, fn);
            strictEqual(nativeMethods.iframeSrcGetter.call(iframe), urlUtils.getProxyUrl('/iframe2', {
                resourceType: urlUtils.stringifyResourceType({ isIframe: true }),
                proxyPort:    2001,
            }));
        });
    });
}

module('regression');

test('script must be executed after it is added to head tag (B237231)', function () {
    var scriptText       = 'window.top.testField = true;';
    var script           = document.createElement('script');
    var isScriptExecuted = function () {
        return window.top.testField;
    };

    nativeMethods.scriptSrcSetter.call(script, '/get-script/' + scriptText);

    ok(!window.top.testField);
    document.head.appendChild(script);

    return window.QUnitGlobals.wait(isScriptExecuted)
        .then(function () {
            ok(true, 'script was executed');
        });
});

test('element.cloneNode must be overridden (B234291)', function () {
    var div = document.createElement('div');

    wrapNativeFn('cloneNode');

    var clone = div.cloneNode();

    ok(nativeMethodCalled);
    strictEqual(clone[INTERNAL_PROPS.processedContext], window);
});

test('link.href with an empty value must return root site url (Q519748)', function () {
    var anchor = document.createElement('a');

    anchor.href = '';
    document.body.appendChild(anchor);

    strictEqual(anchor.href, 'https://example.com/');

    document.body.removeChild(anchor);
});

test('document.createDocumentFragment must be overriden (B237717)', function () {
    var fragment = document.createDocumentFragment();

    fragment.appendChild(document.createElement('div'));

    var clone = fragment.cloneNode(true);

    notEqual(fragment.firstChild.getAttribute, nativeMethods.getAttribute);
    notEqual(clone.firstChild.getAttribute, nativeMethods.getAttribute);
});

test('Range.createContextualFragment must be overriden (GH-535)', function () {
    var tagString = '<a href="http://some.domain.com/index.html"></a>';
    var range     = document.createRange();
    var container = document.createElement('div');

    document.body.appendChild(container);

    range.selectNode(container);

    var fragment = range.createContextualFragment(tagString);
    var anchor   = fragment.childNodes[0];

    strictEqual(nativeMethods.anchorHrefGetter.call(anchor), urlUtils.getProxyUrl('http://some.domain.com/index.html'));
});
