var Browser       = Hammerhead.get('./util/browser');
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

test('event should not raise before iframe is appended to DOM', function () {
    var eventRaised = false;

    IFrameSandbox.on(IFrameSandbox.IFRAME_READY_TO_INIT, function () {
        eventRaised = true;
    });

    document.createElement('iframe');

    ok(!eventRaised);
});

test('event should not raise if a cross-domain iframe is appended', function () {
    var eventRaised = false;

    IFrameSandbox.on(IFrameSandbox.IFRAME_READY_TO_INIT, function () {
        eventRaised = true;
    });

    var $iframe = $('<iframe id="test7" src="http://cross.domain.com">').appendTo('body');

    ok(!eventRaised);

    $iframe.remove();
});

test('document.write', function () {
    var iframe = document.createElement('iframe');

    iframe.id = 'test10';
    document.body.appendChild(iframe);
    iframe.contentDocument.write('<script>window.tempTestValue = !!__call$;<\/script>');

    ok(iframe.contentWindow.tempTestValue);

    iframe.parentNode.removeChild(iframe);
});

//B239643 - The test on the http://kinopoisk.ru page doesn\'t continue after the first step
asyncTest('ready to init event', function () {
    var $container               = $('<div><iframe id="test1"></iframe></div>').appendTo('body');
    var iframeLoadingEventRaised = false;

    var onIframeLoading = function () {
        iframeLoadingEventRaised = true;
    };

    //iframe loading waiting
    window.setTimeout(function () {
        IFrameSandbox.on(IFrameSandbox.IFRAME_READY_TO_INIT, onIframeLoading);

        /* eslint-disable no-unused-vars */
        var dummy = $container[0].innerHTML;

        /* eslint-enable no-unused-vars */
        ok(!iframeLoadingEventRaised);
        $container.remove();
        start();
    }, 100);
});

// NOTE: This test must be last (IE11 hack)
asyncTest('element.setAttribute', function () {
    var src = Browser.isMozilla ? ' src="javascript:&quot;<html><body></body></html>&quot;"' : '';

    expect(12);

    $('<iframe id="test20"' + src + '>').load(function () {
        var iFrame     = this;
        var iFrameBody = iFrame.contentDocument.body;

        // IE hack part1: catch hammerhead initialization exception
        var iframeSandbox = this.contentWindow.Hammerhead.get('./sandboxes/iframe');
        var storedMeth    = iframeSandbox.isIframeInitialized;

        iframeSandbox.isIframeInitialized = function (iframe) {
            iframe.contentWindow[Const.DOM_SANDBOX_OVERRIDE_DOM_METHOD_NAME] =
                iframe.contentWindow[Const.DOM_SANDBOX_OVERRIDE_DOM_METHOD_NAME] || function () {
                };

            return storedMeth.call(iframeSandbox, iframe);
        };
        // --------------------------------------------------------

        $('<iframe id="test21">').load(function () {
            // IE hack part2: initialize hammerhead manually
            if (this.contentDocument.createElement.toString().indexOf('native') !== -1)
                initIFrameTestHandler({ iframe: this });

            var iframeDocument = this.contentDocument;
            var subIFrameBody  = iframeDocument.body;

            var testData = [
                [document.body, 'a', 'href', null, null],
                [iFrameBody, 'a', 'href', null, 'iframe'],
                [document.body, 'form', 'action', null, null],
                [iFrameBody, 'form', 'action', null, 'iframe'],
                [document.body, 'area', 'href', null, null],
                [iFrameBody, 'area', 'href', null, null],
                [document.body, 'a', 'href', '_top', null],
                [iFrameBody, 'a', 'href', '_top', null],
                [subIFrameBody, 'a', 'href', '_top', null],
                [document.body, 'a', 'href', '_parent', null],
                [iFrameBody, 'a', 'href', '_parent', null],
                [subIFrameBody, 'a', 'href', '_parent', 'iframe']
            ];

            var testIFrameFlag = function (body, tag, urlAttr, target, resultFlag) {
                var element = iframeDocument.createElement(tag);

                body.appendChild(element);
                if (target)
                    element.setAttribute('target', target);
                element.setAttribute(urlAttr, '/index.html');

                strictEqual(UrlUtil.parseProxyUrl(element[urlAttr]).resourceType, resultFlag);

                body.removeChild(element);
            };

            for (var i = 0; i < testData.length; i++)
                testIFrameFlag.apply(null, testData[i]);

            start();
            $(iFrame).remove();
        }).appendTo(iFrameBody);
    }).appendTo('body');
});
