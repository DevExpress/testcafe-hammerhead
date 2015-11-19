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
    iframeSandbox.on(iframeSandbox.IFRAME_READY_TO_INIT_EVENT, initIframeTestHandler);
    iframeSandbox.off(iframeSandbox.IFRAME_READY_TO_INIT_EVENT, iframeSandbox.iframeReadyToInitHandler);
});

QUnit.testDone(function () {
    iframeSandbox.off(iframeSandbox.IFRAME_READY_TO_INIT_EVENT, initIframeTestHandler);
});

function checkInnerHtmlOverrided (el) {
    el.innerHtml = '<div></div>';

    notEqual(el.insertBefore, nativeMethods.insertBefore);
    notEqual(el.appendChild, nativeMethods.appendChild);
}

test('document.createElement', function () {
    var el = document.createElement('div');

    notEqual(el.insertBefore, nativeMethods.insertBefore);
    notEqual(el.appendChild, nativeMethods.appendChild);
    checkInnerHtmlOverrided(el);
});

test('element.insertAdjacentHTML', function () {
    var el = document.createElement('DIV');

    el.insertAdjacentHTML('afterbegin', '<div></div>');

    var firstChild = el.childNodes[0];

    notEqual(firstChild.insertBefore, nativeMethods.insertBefore);
    notEqual(firstChild.appendChild, nativeMethods.appendChild);
    checkInnerHtmlOverrided(firstChild);

    el.childNodes[0].insertAdjacentHTML('beforebegin', '<span></span>');

    strictEqual(el.childNodes[0].tagName, 'SPAN');
    strictEqual(el.childNodes.length, 2);

    notEqual(el.childNodes[0].insertBefore, nativeMethods.insertBefore);
    notEqual(el.childNodes[0].appendChild, nativeMethods.appendChild);
    checkInnerHtmlOverrided(el.childNodes[0]);
});

test('element.insertBefore', function () {
    var el          = document.createElement('div');
    var firstChild  = nativeMethods.createElement.call(document, 'div');
    var secondChild = nativeMethods.createElement.call(document, 'div');

    ok(el.appendChild(secondChild), 'appended');
    ok(el.insertBefore(firstChild, secondChild), 'inserted');

    notEqual(firstChild.insertBefore, nativeMethods.insertBefore);
    notEqual(firstChild.appendChild, nativeMethods.appendChild);
    checkInnerHtmlOverrided(firstChild);
});

test('element.appendChild', function () {
    var el = document.createElement('DIV');

    ok(el.appendChild(nativeMethods.createElement.call(document, 'div')), 'appended');

    var child = el.childNodes[0];

    notEqual(child.insertBefore, nativeMethods.insertBefore);
    notEqual(child.appendChild, nativeMethods.appendChild);
    checkInnerHtmlOverrided(child);
});

test('element.removeAttribute, element.removeAttributeNS', function () {
    var el         = document.createElement('a');
    var attr       = 'href';
    var storedAttr = domProcessor.getStoredAttrName(attr);
    var namespace  = 'http://www.w3.org/1999/xhtml';
    var urlExample = '/test.html';

    el.setAttribute(attr, urlExample);
    el.setAttributeNS(namespace, attr, urlExample);
    ok(nativeMethods.getAttribute.call(el, attr));
    ok(nativeMethods.getAttribute.call(el, storedAttr));
    ok(nativeMethods.getAttributeNS.call(el, namespace, attr));
    ok(nativeMethods.getAttributeNS.call(el, namespace, storedAttr));

    el.removeAttributeNS(namespace, attr);
    ok(nativeMethods.getAttribute.call(el, attr));
    ok(nativeMethods.getAttribute.call(el, storedAttr));
    ok(!nativeMethods.getAttributeNS.call(el, namespace, attr));
    ok(!nativeMethods.getAttributeNS.call(el, namespace, storedAttr));

    el.removeAttribute(attr);
    ok(!nativeMethods.getAttribute.call(el, attr));
    ok(!nativeMethods.getAttribute.call(el, storedAttr));
    ok(!nativeMethods.getAttributeNS.call(el, namespace, attr));
    ok(!nativeMethods.getAttributeNS.call(el, namespace, storedAttr));
});

test('element.getAttributeNS, element.setAttributeNS', function () {
    var savedGetProxyUrl = urlUtils.getProxyUrl;
    var elTagName        = 'image';
    var attr             = 'href';
    var storedAttr       = domProcessor.getStoredAttrName(attr);

    urlUtils.getProxyUrl = function () {
        return 'replaced';
    };

    var el = document.createElementNS('xlink', elTagName);

    strictEqual(el[INTERNAL_PROPS.processedContext], window);

    el.setAttributeNS('xlink', attr, 'image.png');
    strictEqual(nativeMethods.getAttributeNS.call(el, 'xlink', attr), 'replaced');
    strictEqual(nativeMethods.getAttributeNS.call(el, 'xlink', storedAttr), 'image.png');
    strictEqual(el.getAttributeNS('xlink', attr), 'image.png');

    urlUtils.getProxyUrl = savedGetProxyUrl;
});

test('table.insertRow, table.insertCell', function () {
    var table    = document.createElement('table');
    var tbody    = document.createElement('tbody');
    var tableRow = table.insertRow(0);
    var tbodyRow = tbody.insertRow(0);
    var cell     = tableRow.insertCell(0);

    notEqual(tableRow.appendChild, nativeMethods.appendChild);
    notEqual(tbodyRow.appendChild, nativeMethods.appendChild);
    notEqual(cell.appendChild, nativeMethods.appendChild);
});

test('setAttribute: img src', function () {
    var $img = $('<img>');

    overrideDomMeth($img[0]);

    $img[0].setAttribute('src', '/image.gif?param=value');

    strictEqual(nativeMethods.getAttribute.call($img[0], 'src'), urlUtils.resolveUrlAsDest('/image.gif?param=value'));
    $img.remove();
});

test('canvasRenderingContext2D.drawImage', function () {
    var storedNativeMethod = nativeMethods.canvasContextDrawImage;
    var crossDomainUrl     = 'http://crossdomain.com/image.png';
    var localUrl           = 'http://' + location.host + '/';
    var crossDomainImg     = nativeMethods.createElement.call(document, 'img');
    var localImg           = nativeMethods.createElement.call(document, 'img');
    var canvasContext      = $('<canvas>')[0].getContext('2d');
    var otherCanvas        = $('<canvas>')[0];
    var otherCanvasContext = otherCanvas.getContext('2d');
    var slice              = Array.prototype.slice;
    var testCases          = [
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
    test('window.navigator.serviceWorker.register', function () {
        var storedNative = nativeMethods.registerServiceWorker;
        var srcUrl       = '/serviceWorker.js';

        nativeMethods.registerServiceWorker = function (url) {
            strictEqual(url, urlUtils.getProxyUrl(srcUrl));

            nativeMethods.registerServiceWorker = storedNative;
        };

        window.navigator.serviceWorker.register(srcUrl);
    });
}

if (!browserUtils.isFirefox) {
    asyncTest('document.write exception', function () {
        var $iframe = $('<iframe id="test10">').appendTo('body');
        var iframe  = $iframe[0];

        eval(processScript([
            'iframe.contentDocument.write("<html><body><div id=\'div1\'></div></body></html>");',
            'iframe.contentDocument.write("<script>window.test = true;<\/script>");'
        ].join('')));

        var intervalId = window.setInterval(function () {
            if (iframe.contentWindow.test && iframe.contentDocument.getElementById('div1')) {
                ok(true);
                $iframe.remove();
                clearInterval(intervalId);
                start();
            }
        }, 100);

    });
}

module('regression');

asyncTest('script must be executed after it is added to head tag (B237231)', function () {
    var scriptText = 'window.top.testField = true;';
    var head       = document.getElementsByTagName('head')[0];
    var script     = document.createElement('script');

    script.src = '/get-script/' + scriptText;

    ok(!window.top.testField);
    head.appendChild(script);

    var maxIterationCount     = 10;
    var iterationCount        = 0;
    var clearCheckingInterval = function (id) {
        window.clearInterval(id);
        $(script).remove();
        start();
    };

    var intervalId = window.setInterval(function () {
        iterationCount++;

        if (window.top.testField) {
            ok(true);
            clearCheckingInterval(intervalId);
        }

        if (iterationCount > maxIterationCount) {
            ok(false);
            clearCheckingInterval(intervalId);
        }
    }, 500);

});

test('element.cloneNode must be overridden (B234291)', function () {
    var el    = document.createElement('div');
    var clone = el.cloneNode();

    notEqual(clone.appendChild, nativeMethods.appendChild);
    checkInnerHtmlOverrided(clone);
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

if (window.navigator.serviceWorker) {
    asyncTest('navigator.serviceWorker in the iframe is not available (GH-277)', function () {
        var iframe = document.createElement('iframe');

        iframe.setAttribute('sandbox', '');
        iframe.src = window.getCrossDomainPageUrl('../../../data/cross-domain/service-worker-not-available.html');

        var onMessageHandler = function (e) {
            window.removeEventListener('message', onMessageHandler);

            ok(e.data === 'success');

            document.body.removeChild(iframe);

            start();
        };

        window.addEventListener('message', onMessageHandler);

        document.body.appendChild(iframe);
    });
}
