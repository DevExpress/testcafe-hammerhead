var Browser        = Hammerhead.get('./util/browser');
var Element        = Hammerhead.get('./sandboxes/dom/element');
var EventSimulator = Hammerhead.get('./sandboxes/event/simulator');
var IFrameSandbox  = Hammerhead.get('./sandboxes/iframe');
var NativeMethods  = Hammerhead.get('./sandboxes/native-methods');
var UrlUtil        = Hammerhead.get('./util/url');

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

asyncTest('prevent "error" event during image reloading', function () {
    var storedGetOriginUrlObj    = UrlUtil.getProxyUrl;
    var storedResolveUrlAsOrigin = UrlUtil.resolveUrlAsOrigin;
    var errorEventRised          = false;
    var realImageUrl             = '/data/dom-sandbox/image.png';
    var fakeIamgeUrl             = 'fakeIamge.gif';

    UrlUtil.getProxyUrl = function () {
        return storedGetOriginUrlObj(realImageUrl);
    };

    UrlUtil.resolveUrlAsOrigin = function (url) {
        return url;
    };

    var img = document.createElement('img');

    img.onerror = function () {
        errorEventRised = true;
    };

    img.onload = function () {
        ok(!errorEventRised);
        strictEqual(img.src, storedGetOriginUrlObj(realImageUrl));

        $(img).remove();
        UrlUtil.getProxyUrl        = storedGetOriginUrlObj;
        UrlUtil.resolveUrlAsOrigin = storedResolveUrlAsOrigin;

        start();
    };

    eval(processScript('img.src="' + fakeIamgeUrl + '";'));
    document.body.appendChild(img);
});

asyncTest('reload image through the proxy', function () {
    var realImageUrl  = '/data/dom-sandbox/image.png';
    var fakeIamgeUrl  = 'fakeIamge.gif';
    var proxyIamgeUrl = UrlUtil.getProxyUrl(fakeIamgeUrl);

    var $img1 = $('<img src="' + realImageUrl + '">').appendTo('body');
    var $img2 = $('<img>').appendTo('body');

    $img2[0].onload = function () {
        $img2[0].onload = null;

        notEqual($img1[0].src.indexOf(realImageUrl), -1);
        notEqual($img2[0].src.indexOf(realImageUrl), -1);

        $img1.remove();
        $img2.remove();

        $img1 = $('<img src="' + fakeIamgeUrl + '">').appendTo('body');
        $img2 = $('<img>').appendTo('body');

        $img2[0].onerror = function () {
            $img2[0].onerror = null;

            strictEqual($img1[0].src, proxyIamgeUrl);
            strictEqual($img2[0].src, proxyIamgeUrl);

            $img1.remove();
            $img2.remove();

            $img1 = $('<img src="">').appendTo('body');

            $img1[0].onerror = function () {
                $img1[0].onerror = null;
                strictEqual($img1[0].src, 'about:blank');
                $img1.remove();

                start();
            };

            eval(processScript('$img1[0].src="about:blank";'));
        };

        eval(processScript('$img2[0].src="' + fakeIamgeUrl + '";'));
    };

    eval(processScript('$img2[0].src="' + realImageUrl + '";'));
});

// IE9 does not support insertAdjacentHTML for the 'tr'
if (!Browser.isIE9) {
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
}

test('process a text node when it is appended to script', function () {
    var originGetProxyUrl = UrlUtil.getProxyUrl;
    var proxyUrl          = 'http://example.proxy.com/';

    UrlUtil.getProxyUrl = function () {
        return proxyUrl;
    };

    var url      = 'http://example.com';
    var scriptEl = document.createElement('script');
    var textNode = document.createTextNode('window.testLink = document.createElement("a"); window.testLink.href="' +
                                           url + '";');

    scriptEl.appendChild(textNode);
    document.head.appendChild(scriptEl);

    ok(window.testLink);
    ok(window.testLink.tagName && window.testLink.tagName.toLowerCase() === 'a');
    strictEqual(window.testLink.href, proxyUrl);

    UrlUtil.getProxyUrl = originGetProxyUrl;
});

test('iframe added to dom event', function () {
    var firstIframe  = null;
    var secondIframe = null;
    var count        = 0;

    Element.on(Element.IFRAME_ADDED, function (e) {
        if (e.iframe === firstIframe || e.iframe === secondIframe)
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

asyncTest('body created event', function () {
    var iframe = document.createElement('iframe');

    iframe.src = '/data/dom-sandbox/body-created-event.html';

    iframe.addEventListener('load', function () {
        ok(this.contentWindow.testOk);
        iframe.parentNode.removeChild(iframe);
        start();
    });

    document.body.appendChild(iframe);
});

//B237402 - overrideEventListeners: one listener for several events
test('overrideEventListeners: one listener for several events', function () {
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
    EventSimulator['mousemove'](div, {});
    EventSimulator['mouseup'](div, {});
    ok(mousemoved, 'mousemove has been handled');
    ok(mouseuped, 'mouseup has been handled');
    mousemoved  = mouseuped = false;
    div.removeEventListener('mousemove', handler, false);
    div.removeEventListener('mouseup', handler, false);
    EventSimulator['mousemove'](div, {});
    EventSimulator['mouseup'](div, {});
    ok(!mousemoved, 'mousemove has not been handled');
    ok(!mouseuped, 'mouseup has not been handled');

    div.parentNode.removeChild(div);
});
