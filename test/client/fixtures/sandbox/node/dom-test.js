var urlUtils = hammerhead.get('./utils/url');

var browserUtils   = hammerhead.utils.browser;
var nativeMethods  = hammerhead.nativeMethods;
var iframeSandbox  = hammerhead.sandbox.iframe;
var nodeMutation   = hammerhead.sandbox.node.mutation;
var eventSimulator = hammerhead.sandbox.event.eventSimulator;

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

asyncTest('prevent "error" event during image reloading', function () {
    var storedGetOriginUrlObj    = urlUtils.getProxyUrl;
    var storedResolveUrlAsOrigin = urlUtils.resolveUrlAsOrigin;
    var errorEventRised          = false;
    var realImageUrl             = window.QUnitGlobals.getResourceUrl('../../../data/node-sandbox/image.png');
    var fakeIamgeUrl             = 'fakeIamge.gif';

    urlUtils.getProxyUrl = function () {
        return storedGetOriginUrlObj.call(urlUtils, realImageUrl);
    };

    urlUtils.resolveUrlAsOrigin = function (url) {
        return url;
    };

    var img = document.createElement('img');

    img.onerror = function () {
        errorEventRised = true;
    };

    img.onload = function () {
        ok(!errorEventRised);
        strictEqual(img.src, storedGetOriginUrlObj.call(urlUtils, realImageUrl));

        $(img).remove();
        urlUtils.getProxyUrl        = storedGetOriginUrlObj;
        urlUtils.resolveUrlAsOrigin = storedResolveUrlAsOrigin;

        start();
    };

    eval(processScript('img.src="' + fakeIamgeUrl + '";'));
    document.body.appendChild(img);
});

asyncTest('reload image through the proxy', function () {
    var realImageUrl  = window.QUnitGlobals.getResourceUrl('../../../data/node-sandbox/image.png');
    var fakeIamgeUrl  = 'fakeIamge.gif';
    var proxyIamgeUrl = urlUtils.getProxyUrl(fakeIamgeUrl);

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

// NOTE: IE9 does not support insertAdjacentHTML for the 'tr' element.
if (!browserUtils.isIE9) {
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
    var originGetProxyUrl = urlUtils.getProxyUrl;
    var proxyUrl          = 'http://example.proxy.com/';

    urlUtils.getProxyUrl = function () {
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

    urlUtils.getProxyUrl = originGetProxyUrl;
});

test('iframe added to dom event', function () {
    var firstIframe  = null;
    var secondIframe = null;
    var count        = 0;

    nodeMutation.on(nodeMutation.IFRAME_ADDED_TO_DOM_EVENT, function (e) {
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

    iframe.src = window.QUnitGlobals.getResourceUrl('../../../data/node-sandbox/body-created-event.html');

    iframe.addEventListener('load', function () {
        ok(this.contentWindow.testOk);
        iframe.parentNode.removeChild(iframe);
        start();
    });

    document.body.appendChild(iframe);
});

module('resgression');

test('one handler for several events must be overriden correctly (B237402)', function () {
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
    mousemoved  = mouseuped = false;
    div.removeEventListener('mousemove', handler, false);
    div.removeEventListener('mouseup', handler, false);
    eventSimulator['mousemove'](div, {});
    eventSimulator['mouseup'](div, {});
    ok(!mousemoved, 'mousemove has not been handled');
    ok(!mouseuped, 'mouseup has not been handled');

    div.parentNode.removeChild(div);
});
