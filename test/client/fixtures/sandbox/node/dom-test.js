var urlUtils = hammerhead.utils.url;

var nativeMethods  = hammerhead.nativeMethods;
var nodeMutation   = hammerhead.sandbox.node.mutation;
var eventSimulator = hammerhead.sandbox.event.eventSimulator;
var listeners      = hammerhead.sandbox.event.listeners;

asyncTest('prevent "error" event during image reloading', function () {
    var storedGetProxyUrl      = urlUtils.getProxyUrl;
    var storedResolveUrlAsDest = urlUtils.resolveUrlAsDest;
    var errorEventRised        = false;
    var realImageUrl           = getSameDomainPageUrl('../../../data/node-sandbox/image.png');
    var fakeIamgeUrl           = 'fakeIamge.gif';

    urlUtils.overrideGetProxyUrl(function () {
        return storedGetProxyUrl.call(urlUtils, realImageUrl);
    });

    urlUtils.overrideResolveUrlAsDest(function (url) {
        return url;
    });

    var img = document.createElement('img');

    img.onerror = function () {
        errorEventRised = true;
    };

    nativeMethods.htmlElementOnloadSetter.call(img, function () {
        ok(!errorEventRised);
        strictEqual(nativeMethods.imageSrcGetter.call(img), storedGetProxyUrl.call(urlUtils, realImageUrl));

        document.body.removeChild(img);
        urlUtils.overrideGetProxyUrl(storedGetProxyUrl);
        urlUtils.overrideResolveUrlAsDest(storedResolveUrlAsDest);

        start();
    });

    img.src = fakeIamgeUrl;

    document.body.appendChild(img);
});

asyncTest('reload image through the proxy', function () {
    var realImageUrl  = window.QUnitGlobals.getResourceUrl('../../../data/node-sandbox/image.png');
    var fakeIamgeUrl  = 'fakeIamge.gif';
    var proxyIamgeUrl = urlUtils.getProxyUrl(fakeIamgeUrl);
    var img1          = document.createElement('img');
    var img2          = document.createElement('img');

    img1.setAttribute('src', realImageUrl);
    document.body.appendChild(img1);
    document.body.appendChild(img2);

    nativeMethods.htmlElementOnloadSetter.call(img2, function () {
        nativeMethods.htmlElementOnloadSetter.call(img2, null);

        notEqual(nativeMethods.imageSrcGetter.call(img1).indexOf(realImageUrl), -1);
        notEqual(nativeMethods.imageSrcGetter.call(img2).indexOf(realImageUrl), -1);

        img1.parentNode.removeChild(img1);
        img2.parentNode.removeChild(img2);

        img1.setAttribute('src', fakeIamgeUrl);
        document.body.appendChild(img1);
        document.body.appendChild(img2);

        img2.onerror = function () {
            img2.onerror = null;

            strictEqual(nativeMethods.imageSrcGetter.call(img1), proxyIamgeUrl);
            strictEqual(nativeMethods.imageSrcGetter.call(img2), proxyIamgeUrl);

            img1.parentNode.removeChild(img1);
            img2.parentNode.removeChild(img2);

            img1.setAttribute('src', '');
            document.body.appendChild(img1);

            img1.onerror = function () {
                img1.onerror = null;
                strictEqual(nativeMethods.imageSrcGetter.call(img1), 'about:blank');
                img1.parentNode.removeChild(img1);

                start();
            };

            img1.src = 'about:blank';
        };

        img2.src = fakeIamgeUrl;
    });

    img2.src = realImageUrl;
});

test('html fragment', function () {
    var table = $('<table><tr></tr></table>')[0];
    var tbody = table.childNodes[0];

    tbody.childNodes[0].insertAdjacentHTML('beforebegin', '<tr><td><div></div></td></tr>');

    strictEqual(tbody.childNodes.length, 2);
    strictEqual(tbody.childNodes[0].tagName.toLowerCase(), 'tr');
    strictEqual(tbody.childNodes[1].tagName.toLowerCase(), 'tr');
    strictEqual(tbody.childNodes[0].childNodes[0].tagName.toLowerCase(), 'td');
    strictEqual(tbody.childNodes[0].childNodes[0].childNodes[0].tagName.toLowerCase(), 'div');
});

test('process a text node when it is appended to script', function () {
    var storedGetProxyUrl = urlUtils.getProxyUrl;
    var proxyUrl          = 'http://example.proxy.com/';

    urlUtils.overrideGetProxyUrl(function () {
        return proxyUrl;
    });

    var url      = 'http://example.com';
    var scriptEl = document.createElement('script');
    var textNode = document.createTextNode(
        'window.testAnchor = document.createElement("a");' +
        'window.testAnchor.href = "' + url + '";' // eslint-disable-line comma-dangle
    );

    scriptEl.appendChild(textNode);
    document.head.appendChild(scriptEl);

    ok(window.testAnchor);
    ok(window.testAnchor.tagName && window.testAnchor.tagName.toLowerCase() === 'a');
    strictEqual(nativeMethods.anchorHrefGetter.call(window.testAnchor), proxyUrl);

    urlUtils.overrideGetProxyUrl(storedGetProxyUrl);
});

test('iframe added to dom event', function () {
    var firstIframe  = null;
    var secondIframe = null;
    var count        = 0;

    nodeMutation.on(nodeMutation.IFRAME_ADDED_TO_DOM_EVENT, function (iframe) {
        if (iframe === firstIframe || iframe === secondIframe)
            count++;
    });

    firstIframe     = document.createElement('iframe');
    firstIframe.id  = 'test101';
    secondIframe    = document.createElement('iframe');
    secondIframe.id = 'test102';

    var container = document.createElement('div');

    container.appendChild(firstIframe);
    container.appendChild(secondIframe);
    strictEqual(count, 0);

    document.body.appendChild(container);
    container.parentNode.removeChild(container);
    strictEqual(count, 2);

    document.body.insertBefore(container, document.body.childNodes[0]);
    container.parentNode.removeChild(container);
    strictEqual(count, 4);
});

test('body created event', function () {
    return createTestIframe({ src: getSameDomainPageUrl('../../../data/node-sandbox/body-created-event.html') })
        .then(function (iframe) {
            ok(iframe.contentWindow.testOk);
        });
});

test('parameters passed to the native dom element function in its original form', function () {
    var el = document.createElement('body');

    checkNativeFunctionArgs('appendChild', 'appendChild', el);
    checkNativeFunctionArgs('insertBefore', 'insertBefore', el);
    checkNativeFunctionArgs('replaceChild', 'replaceChild', el);
    checkNativeFunctionArgs('cloneNode', 'cloneNode', el);
    checkNativeFunctionArgs('getElementsByClassName', 'elementGetElementsByClassName', el);
    checkNativeFunctionArgs('getElementsByTagName', 'elementGetElementsByTagName', el);
    checkNativeFunctionArgs('querySelector', 'elementQuerySelector', el);
    checkNativeFunctionArgs('querySelectorAll', 'elementQuerySelectorAll', el);
    checkNativeFunctionArgs('getAttribute', 'getAttribute', el);
    checkNativeFunctionArgs('getAttributeNS', 'getAttributeNS', el);
    checkNativeFunctionArgs('insertCell', 'insertCell', document.createElement('tr'));
    checkNativeFunctionArgs('insertRow', 'insertTableRow', document.createElement('table'));
    checkNativeFunctionArgs('insertRow', 'insertTBodyRow', document.createElement('tbody'));
    checkNativeFunctionArgs('removeAttribute', 'removeAttribute', el);
    checkNativeFunctionArgs('removeAttributeNS', 'removeAttributeNS', el);
    checkNativeFunctionArgs('removeChild', 'removeChild', el);
    checkNativeFunctionArgs('setAttribute', 'setAttribute', el);
    checkNativeFunctionArgs('setAttributeNS', 'setAttributeNS', el);
    checkNativeFunctionArgs('dispatchEvent', 'dispatchEvent', el);

    listeners.initElementListening(el, ['click']);

    checkNativeFunctionArgs('addEventListener', 'addEventListener', el);
    checkNativeFunctionArgs('removeEventListener', 'removeEventListener', el);
});

module('regression');

test('one handler for several events must be overridden correctly (B237402)', function () {
    var div        = document.body.appendChild(document.createElement('div'));
    var mousemoved = false;
    var mouseuped  = false;

    var handler = function (e) {
        if (e.type === 'mousemove')
            mousemoved = true;
        if (e.type === 'mouseup')
            mouseuped = true;
    };

    div.addEventListener('mousemove', handler, false);
    div.addEventListener('mouseup', handler, false);
    eventSimulator['mousemove'](div, {});
    eventSimulator['mouseup'](div, {});
    ok(mousemoved, 'mousemove has been handled');
    ok(mouseuped, 'mouseup has been handled');
    mousemoved = mouseuped = false;
    div.removeEventListener('mousemove', handler, false);
    div.removeEventListener('mouseup', handler, false);
    eventSimulator['mousemove'](div, {});
    eventSimulator['mouseup'](div, {});
    ok(!mousemoved, 'mousemove has not been handled');
    ok(!mouseuped, 'mouseup has not been handled');

    div.parentNode.removeChild(div);
});

test('an element should correctly be added to a nested body (T1020710)', function () {
    var nestedBody = document.createElement('body');

    nestedBody.appendChild(document.createElement('a'));
    nestedBody.appendChild(document.createElement('p'));
    document.body.appendChild(nestedBody);
    nestedBody.appendChild(document.createElement('div'));

    strictEqual(nestedBody.children[0].nodeName, 'A');
    strictEqual(nestedBody.children[1].nodeName, 'P');
    strictEqual(nestedBody.children[2].nodeName, 'DIV');

    document.body.removeChild(nestedBody);
});
