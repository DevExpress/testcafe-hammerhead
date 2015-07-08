var Browser       = Hammerhead.get('./util/browser');
var DomProcessor  = Hammerhead.get('./dom-processor/dom-processor');
var IFrameSandbox = Hammerhead.get('./sandboxes/iframe');
var NativeMethods = Hammerhead.get('./sandboxes/native-methods');
var Const         = Hammerhead.get('../const');
var UrlUtil       = Hammerhead.get('./util/url');

QUnit.testStart = function () {
    // 'window.open' method uses in the QUnit
    window.open       = NativeMethods.windowOpen;
    window.setTimeout = NativeMethods.setTimeout;
    IFrameSandbox.on(IFrameSandbox.IFRAME_READY_TO_INIT, initIFrameTestHandler);
    IFrameSandbox.off(IFrameSandbox.IFRAME_READY_TO_INIT, IFrameSandbox.iframeReadyToInitHandler);
};

QUnit.testDone = function () {
    IFrameSandbox.off(IFrameSandbox.IFRAME_READY_TO_INIT, initIFrameTestHandler);
};

function checkInnerHtmlOverrided (el) {
    el.innerHtml = '<div></div>';

    notEqual(el.insertBefore, NativeMethods.insertBefore);
    notEqual(el.appendChild, NativeMethods.appendChild);
}

test('document.createElement', function () {
    var el = document.createElement('div');

    notEqual(el.insertBefore, NativeMethods.insertBefore);
    notEqual(el.appendChild, NativeMethods.appendChild);
    checkInnerHtmlOverrided(el);
});

test('element.insertAdjacentHTML', function () {
    var el = document.createElement('DIV');

    el.insertAdjacentHTML('afterbegin', '<div></div>');

    var firstChild = el.childNodes[0];

    notEqual(firstChild.insertBefore, NativeMethods.insertBefore);
    notEqual(firstChild.appendChild, NativeMethods.appendChild);
    checkInnerHtmlOverrided(firstChild);

    el.childNodes[0].insertAdjacentHTML('beforebegin', '<span></span>');

    strictEqual(el.childNodes[0].tagName, 'SPAN');
    strictEqual(el.childNodes.length, 2);

    notEqual(el.childNodes[0].insertBefore, NativeMethods.insertBefore);
    notEqual(el.childNodes[0].appendChild, NativeMethods.appendChild);
    checkInnerHtmlOverrided(el.childNodes[0]);
});

test('element.insertBefore', function () {
    var el          = document.createElement('div');
    var firstChild  = NativeMethods.createElement.call(document, 'div');
    var secondChild = NativeMethods.createElement.call(document, 'div');

    ok(el.appendChild(secondChild), 'appended');
    ok(el.insertBefore(firstChild, secondChild), 'inserted');

    notEqual(firstChild.insertBefore, NativeMethods.insertBefore);
    notEqual(firstChild.appendChild, NativeMethods.appendChild);
    checkInnerHtmlOverrided(firstChild);
});

test('element.appendChild', function () {
    var el = document.createElement('DIV');

    ok(el.appendChild(NativeMethods.createElement.call(document, 'div')), 'appended');

    var child = el.childNodes[0];

    notEqual(child.insertBefore, NativeMethods.insertBefore);
    notEqual(child.appendChild, NativeMethods.appendChild);
    checkInnerHtmlOverrided(child);
});

//B237231 - Scripts are not executed when added into a header in IE9
asyncTest('head.appendChild for script', function () {
    var scriptText = 'window.top.testField = true;';
    var head       = document.getElementsByTagName('head')[0];
    var script     = document.createElement('script');

    script.src = '/get-script/' + scriptText;

    ok(!window.top.testField);
    head.appendChild(script);

    window.setTimeout(function () {
        ok(window.top.testField);
        $(script).remove();
        start();
    }, 500);
});

//(B234291)
test('element.cloneNode', function () {
    var el    = document.createElement('div');
    var clone = el.cloneNode();

    notEqual(clone.appendChild, NativeMethods.appendChild);
    checkInnerHtmlOverrided(clone);
});

test('element.removeAttribute, element.removeAttributeNS', function () {
    var el         = document.createElement('a');
    var attr       = 'href';
    var storedAttr = DomProcessor.getStoredAttrName(attr);
    var namespace  = 'http://www.w3.org/1999/xhtml';
    var urlExample = '/test.html';

    el.setAttribute(attr, urlExample);
    el.setAttributeNS(namespace, attr, urlExample);
    ok(NativeMethods.getAttribute.call(el, attr));
    ok(NativeMethods.getAttribute.call(el, storedAttr));
    ok(NativeMethods.getAttributeNS.call(el, namespace, attr));
    ok(NativeMethods.getAttributeNS.call(el, namespace, storedAttr));

    el.removeAttributeNS(namespace, attr);
    ok(NativeMethods.getAttribute.call(el, attr));
    ok(NativeMethods.getAttribute.call(el, storedAttr));
    ok(!NativeMethods.getAttributeNS.call(el, namespace, attr));
    ok(!NativeMethods.getAttributeNS.call(el, namespace, storedAttr));

    el.removeAttribute(attr);
    ok(!NativeMethods.getAttribute.call(el, attr));
    ok(!NativeMethods.getAttribute.call(el, storedAttr));
    ok(!NativeMethods.getAttributeNS.call(el, namespace, attr));
    ok(!NativeMethods.getAttributeNS.call(el, namespace, storedAttr));
});

test('element.getAttributeNS, element.setAttributeNS', function () {
    var savedGetProxyUrl = UrlUtil.getProxyUrl;
    var elTagName        = 'image';
    var attr             = 'href';
    var storedAttr       = DomProcessor.getStoredAttrName(attr);

    UrlUtil.getProxyUrl = function () {
        return 'replaced';
    };

    var el = document.createElementNS('xlink', elTagName);

    strictEqual(el[Const.DOM_SANDBOX_PROCESSED_CONTEXT], window);

    el.setAttributeNS('xlink', attr, 'image.png');
    strictEqual(NativeMethods.getAttributeNS.call(el, 'xlink', attr), 'replaced');
    strictEqual(NativeMethods.getAttributeNS.call(el, 'xlink', storedAttr), 'image.png');
    strictEqual(el.getAttributeNS('xlink', attr), 'image.png');

    UrlUtil.getProxyUrl = savedGetProxyUrl;
});

test('table.insertRow, table.insertCell', function () {
    var table    = document.createElement('table');
    var tbody    = document.createElement('tbody');
    var tableRow = table.insertRow(0);
    var tbodyRow = tbody.insertRow(0);
    var cell     = tableRow.insertCell(0);

    notEqual(tableRow.appendChild, NativeMethods.appendChild);
    notEqual(tbodyRow.appendChild, NativeMethods.appendChild);
    notEqual(cell.appendChild, NativeMethods.appendChild);
});

//Q519748 - TestCafe breaks jQuery Tabs widget
test('link.href', function () {
    var link        = $('<a href="">').appendTo('body');
    var resolvedUrl = getProperty(link[0], 'href');

    strictEqual(resolvedUrl, 'https://example.com');
    link.remove();
});

//(B237717)
test('document.createDocumentFragment', function () {
    var fragment = document.createDocumentFragment();

    fragment.appendChild(document.createElement('div'));

    var clone = fragment.cloneNode(true);

    notEqual(fragment.firstChild.getAttribute, NativeMethods.getAttribute);
    notEqual(clone.firstChild.getAttribute, NativeMethods.getAttribute);
});

test('setAttribute: img src', function () {
    var $img = $('<img>');

    overrideDomMeth($img[0]);

    $img[0].setAttribute('src', '/image.gif?param=value');

    strictEqual(NativeMethods.getAttribute.call($img[0], 'src'), UrlUtil.resolveUrlAsOrigin('/image.gif?param=value'));
    $img.remove();
});

test('canvasRenderingContext2D.drawImage', function () {
    var storedNativeMethod = NativeMethods.canvasContextDrawImage;
    var url1               = 'http://crossdomain.com/image.png';
    var url2               = 'http://' + location.host + '/';

    expect(4);

    var img           = NativeMethods.createElement.call(document, 'img');
    var convasContext = $('<canvas>')[0].getContext('2d');

    NativeMethods.canvasContextDrawImage = function (img, p1, p2) {
        ok(p1 === 2 && p2 === 3);
        strictEqual(img.src, url1);
    };

    img.src = url1;
    convasContext.drawImage(img, 2, 3);

    NativeMethods.canvasContextDrawImage = function (img, p1, p2) {
        ok(p1 === 4 && p2 === 5);
        strictEqual(img.src, UrlUtil.getProxyUrl(url2));
    };
    img.src                              = url2;
    convasContext.drawImage(img, 4, 5);

    NativeMethods.canvasContextDrawImage = storedNativeMethod;
});

if (window.navigator.serviceWorker) {
    test('window.navigator.serviceWorker.register', function () {
        var storedNative = NativeMethods.registerServiceWorker;
        var srcUrl       = '/serviceWorker.js';

        NativeMethods.registerServiceWorker = function (url) {
            strictEqual(url, UrlUtil.getProxyUrl(srcUrl));

            NativeMethods.registerServiceWorker = storedNative;
        };

        window.navigator.serviceWorker.register(srcUrl);
    });
}

if (!Browser.isMozilla) {
    test('document.write exception', function () {
        var $iframe = $('<iframe id="test10">').appendTo('body');
        var iframe  = $iframe[0];

        eval(processScript([
            'iframe.contentDocument.write("<html><body><div id=\'div1\'></div></body></html>");',
            'iframe.contentDocument.write("<script>window.test = true;<\/script>");'
        ].join('')));

        ok(iframe.contentWindow.test);
        ok(iframe.contentDocument.getElementById('div1'));

        $iframe.remove();
    });
}
