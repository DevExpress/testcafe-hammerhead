var INTERNAL_PROPS = hammerhead.get('../processing/dom/internal-properties');
var domProcessor   = hammerhead.get('./dom-processor');
var urlUtils       = hammerhead.get('./utils/url');

var browserUtils  = hammerhead.utils.browser;
var nativeMethods = hammerhead.nativeMethods;
var iframeSandbox = hammerhead.sandbox.iframe;

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
    strictEqual(parentDiv.firstChild.href, urlUtils.getProxyUrl(url + 1));

    childDiv.insertAdjacentHTML('afterend', '<a href="' + url + '2"></a>');

    strictEqual(parentDiv.lastChild[INTERNAL_PROPS.processedContext], window);
    strictEqual(parentDiv.lastChild.href, urlUtils.getProxyUrl(url + 2));

    parentDiv.insertAdjacentHTML('afterbegin', '<a href="' + url + '3"></a>');

    strictEqual(parentDiv.firstChild[INTERNAL_PROPS.processedContext], window);
    strictEqual(parentDiv.firstChild.href, urlUtils.getProxyUrl(url + 3));

    parentDiv.insertAdjacentHTML('beforeend', '<a href="' + url + '4"></a>');

    strictEqual(parentDiv.lastChild[INTERNAL_PROPS.processedContext], window);
    strictEqual(parentDiv.lastChild.href, urlUtils.getProxyUrl(url + 4));
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
    var storedAttr = domProcessor.getStoredAttrName(attr);
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

test('element.getAttributeNS, element.setAttributeNS', function () {
    var image = document.createElementNS('xlink', 'image');

    wrapNativeFn('setAttributeNS');

    image.setAttributeNS('xlink', 'href', 'image.png');

    ok(nativeMethodCalled);
    strictEqual(nativeMethods.getAttributeNS.call(image, 'xlink', 'href'), urlUtils.getProxyUrl('image.png'));
    strictEqual(nativeMethods.getAttributeNS.call(image, 'xlink', domProcessor.getStoredAttrName('href')), 'image.png');

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
    var iframe = document.createElement('iframe');

    iframe.id   = 'test_unique_id_27lkj6j79';
    iframe.name = 'test-window';
    window.QUnitGlobals.waitForIframe(iframe)
        .then(function () {
            var form             = iframe.contentDocument.createElement('form');
            var iframeHammerhead = iframe.contentWindow['%hammerhead%'];
            var handler          = function (e) {
                strictEqual(e.form, form);
                iframeHammerhead.off(iframeHammerhead.EVENTS.beforeFormSubmit, handler);
                iframe.parentNode.removeChild(iframe);
                start();
            };

            iframeHammerhead.on(iframeHammerhead.EVENTS.beforeFormSubmit, handler);

            form.target = 'test-window';
            form.submit();
        });
    document.body.appendChild(iframe);
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
                return img.src === crossDomainUrl;
            }
        },
        {
            description: 'image with local url',
            args:        [localImg, 4, 3, 2, 1],
            testImgFn:   function (img) {
                return img.src === urlUtils.getProxyUrl(localUrl);
            }
        },
        {
            description: 'image created with Image constructor',
            args:        [imgCreatedViaConstr, 4, 3, 2],
            testImgFn:   function (img) {
                return img === imgCreatedViaConstr;
            }
        },
        {
            description: 'canvas element',
            args:        [otherCanvas, 1, 3, 5, 7, 2, 4, 6, 8],
            testImgFn:   function (img) {
                return img === otherCanvas;
            }
        },
        {
            description: 'canvas context',
            args:        [otherCanvasContext, 11, 12],
            testImgFn:   function (img) {
                return img === otherCanvasContext;
            }
        }
    ];

    crossDomainImg.src = crossDomainUrl;
    localImg.src       = localUrl;

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

if (window.navigator.serviceWorker) {
    test('window.navigator.serviceWorker.register (GH-797)', function () {
        var storedNative = nativeMethods.registerServiceWorker;
        var scriptUrl    = '/serviceWorker.js';
        var scopeUrl     = '/';

        nativeMethods.registerServiceWorker = function (url, options) {
            strictEqual(url, urlUtils.getProxyUrl(scriptUrl));
            strictEqual(options.scope, urlUtils.getProxyUrl(scopeUrl));

            nativeMethods.registerServiceWorker = storedNative;
        };

        window.navigator.serviceWorker.register(scriptUrl, { scope: scopeUrl });
    });
}

if (!browserUtils.isFirefox) {
    asyncTest('document.write exception', function () {
        var iframe      = document.createElement('iframe');
        var checkIframe = function () {
            return iframe.contentWindow.test &&
                   iframe.contentDocument.getElementById('div1');
        };

        iframe.id = 'test10';
        document.body.appendChild(iframe);

        eval(processScript([
            'iframe.contentDocument.write("<html><body><div id=\'div1\'></div></body></html>");',
            'iframe.contentDocument.write("<script>window.test = true;<\/script>");'
        ].join('')));

        window.QUnitGlobals.wait(checkIframe)
            .then(function () {
                ok(true);
                iframe.parentNode.removeChild(iframe);
                start();
            });
    });
}

if (window.DOMParser && !browserUtils.isIE9) {
    test('DOMParser.parseFromString', function () {
        var htmlStr        = '<a href="/path">Link</a>';
        var domParser      = new DOMParser();
        var parsedDocument = domParser.parseFromString(htmlStr, 'text/html');
        var proxyUrl       = 'http://' + location.host + '/sessionId/https://example.com/path';

        strictEqual(parsedDocument.querySelector('a').href, proxyUrl);

        throws(function () {
            domParser.parseFromString(htmlStr);
        }, TypeError);

        parsedDocument = domParser.parseFromString(htmlStr, 'application/xml');

        strictEqual(nativeMethods.getAttribute.call(parsedDocument.querySelector('a'), 'href'), '/path');

        parsedDocument = domParser.parseFromString(htmlStr, 'text/html', 'third argument');

        strictEqual(parsedDocument.querySelector('a').href, proxyUrl);
    });
}

module('regression');

asyncTest('script must be executed after it is added to head tag (B237231)', function () {
    var scriptText       = 'window.top.testField = true;';
    var script           = document.createElement('script');
    var isScriptExecuted = function () {
        return window.top.testField;
    };

    script.src = '/get-script/' + scriptText;

    ok(!window.top.testField);
    document.head.appendChild(script);

    window.QUnitGlobals.wait(isScriptExecuted)
        .then(function () {
            ok(true, 'script was executed');
            start();
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
    var link        = $('<a href="">').appendTo('body');
    var resolvedUrl = getProperty(link[0], 'href');

    strictEqual(resolvedUrl, 'https://example.com');
    link.remove();
});

test('document.createDocumentFragment must be overriden (B237717)', function () {
    var fragment = document.createDocumentFragment();

    fragment.appendChild(document.createElement('div'));

    var clone = fragment.cloneNode(true);

    notEqual(fragment.firstChild.getAttribute, nativeMethods.getAttribute);
    notEqual(clone.firstChild.getAttribute, nativeMethods.getAttribute);
});

if (!browserUtils.isIE || browserUtils.version > 9) {
    test('Range.createContextualFragment must be overriden (GH-535)', function () {
        var tagString = '<a href="http://some.domain.com/index.html"></a>';
        var range     = document.createRange();
        var container = document.createElement('div');

        document.body.appendChild(container);

        range.selectNode(container);

        var fragment = range.createContextualFragment(tagString);

        strictEqual(fragment.childNodes[0].href, urlUtils.getProxyUrl('http://some.domain.com/index.html'));
    });
}

if (window.navigator.serviceWorker) {
    asyncTest('navigator.serviceWorker in the iframe is not available (GH-277)', function () {
        var iframe = document.createElement('iframe');

        iframe.sandbox = 'allow-scripts';
        iframe.src     = window.getCrossDomainPageUrl('../../../data/cross-domain/service-worker-not-available.html');

        var onMessageHandler = function (e) {
            window.removeEventListener('message', onMessageHandler);

            var isRegisterServiceWorker = e.data;

            if (browserUtils.isFirefox)
                ok(isRegisterServiceWorker);
            else
                ok(!isRegisterServiceWorker);

            document.body.removeChild(iframe);

            start();
        };

        window.addEventListener('message', onMessageHandler);

        document.body.appendChild(iframe);
    });
}
