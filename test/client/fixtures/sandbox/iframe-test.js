var CONST         = Hammerhead.get('../const');
var browserUtils  = Hammerhead.get('./utils/browser');
var nativeMethods = Hammerhead.get('./sandbox/native-methods');
var urlUtils      = Hammerhead.get('./utils/url');

var iframeSandbox = Hammerhead.sandbox.iframe;

QUnit.testStart(function () {
    // 'window.open' method uses in the QUnit
    window.open       = nativeMethods.windowOpen;
    window.setTimeout = nativeMethods.setTimeout;
    iframeSandbox.on(iframeSandbox.IFRAME_READY_TO_INIT_EVENT, initIFrameTestHandler);
    iframeSandbox.off(iframeSandbox.IFRAME_READY_TO_INIT_EVENT, iframeSandbox.iframeReadyToInitHandler);
});

QUnit.testDone(function () {
    iframeSandbox.off(iframeSandbox.IFRAME_READY_TO_INIT_EVENT, initIFrameTestHandler);
});

test('event should not raise before iframe is appended to DOM', function () {
    var eventRaised = false;

    iframeSandbox.on(iframeSandbox.IFRAME_READY_TO_INIT_EVENT, function () {
        eventRaised = true;
    });

    document.createElement('iframe');

    ok(!eventRaised);
});

test('event should not raise if a cross-domain iframe is appended', function () {
    var eventRaised = false;

    iframeSandbox.on(iframeSandbox.IFRAME_READY_TO_INIT_EVENT, function () {
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

// NOTE: This test must be last (IE11 hack)
asyncTest('element.setAttribute', function () {
    var src = browserUtils.isMozilla ? ' src="javascript:&quot;<html><body></body></html>&quot;"' : '';

    expect(12);

    $('<iframe id="test20"' + src + '>').load(function () {
        var iFrame     = this;
        var iFrameBody = iFrame.contentDocument.body;

        // IE hack part1: catch hammerhead initialization exception
        var iframeSandbox = this.contentWindow.Hammerhead.sandbox.iframe;
        var storedMeth    = iframeSandbox.constructor.isIframeInitialized;

        iframeSandbox.constructor.isIframeInitialized = function (iframe) {
            iframe.contentWindow[CONST.DOM_SANDBOX_OVERRIDE_DOM_METHOD_NAME] =
                iframe.contentWindow[CONST.DOM_SANDBOX_OVERRIDE_DOM_METHOD_NAME] || function () {

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

                strictEqual(urlUtils.parseProxyUrl(element[urlAttr]).resourceType, resultFlag);

                body.removeChild(element);
            };

            for (var i = 0; i < testData.length; i++)
                testIFrameFlag.apply(null, testData[i]);

            start();
            $(iFrame).remove();
        }).appendTo(iFrameBody);
    }).appendTo('body');
});

module('regression');

asyncTest('ready to init event must not raise for added iframe(B239643)', function () {
    var $container               = $('<div><iframe id="test1"></iframe></div>').appendTo('body');
    var iframeLoadingEventRaised = false;

    //iframe loading waiting
    window.setTimeout(function () {
        iframeSandbox.on(iframeSandbox.IFRAME_READY_TO_INIT_EVENT, function () {
            iframeLoadingEventRaised = true;
        });

        /* eslint-disable no-unused-vars */
        var dummy = $container[0].innerHTML;

        /* eslint-enable no-unused-vars */
        ok(!iframeLoadingEventRaised);
        $container.remove();
        start();
    }, 100);
});

asyncTest('the AMD module loader damages proxing an iframe without src (GH-127)', function () {
    var amdModuleLoaderMock = function () {};

    amdModuleLoaderMock.amd = {};
    window.define = amdModuleLoaderMock;

    var iframe = document.createElement('iframe');

    iframe.id = 'test_iframe_unique_id_jlsuie56598o';
    iframe.addEventListener('load', function () {
        ok(this.contentWindow.Hammerhead);
        delete window.define;
        iframe.parentNode.removeChild(iframe);
        start();
    });
    document.body.appendChild(iframe);
});
