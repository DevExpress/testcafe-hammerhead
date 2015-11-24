var INTERNAL_PROPS = hammerhead.get('../processing/dom/internal-properties');
var urlUtils       = hammerhead.get('./utils/url');
var settings       = hammerhead.get('./settings');

var iframeSandbox = hammerhead.sandbox.iframe;
var browserUtils  = hammerhead.utils.browser;
var nativeMethods = hammerhead.nativeMethods;

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

test('event should not raise before iframe is appended to DOM', function () {
    var eventRaised = false;

    var handler = function () {
        eventRaised = true;
    };

    iframeSandbox.on(iframeSandbox.IFRAME_READY_TO_INIT_EVENT, handler);

    document.createElement('iframe');

    ok(!eventRaised);
    iframeSandbox.off(iframeSandbox.IFRAME_READY_TO_INIT_EVENT, handler);
});

test('event should not raise if a cross-domain iframe is appended', function () {
    var eventRaised = false;

    var handler = function () {
        eventRaised = true;
    };

    iframeSandbox.on(iframeSandbox.IFRAME_READY_TO_INIT_EVENT, handler);

    var $iframe = $('<iframe id="test7" src="http://cross.domain.com">').appendTo('body');

    ok(!eventRaised);
    iframeSandbox.off(iframeSandbox.IFRAME_READY_TO_INIT_EVENT, handler);
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

// NOTE: This test must be the last (IE11 hack).
asyncTest('element.setAttribute', function () {
    var src = browserUtils.isFirefox ? ' src="javascript:&quot;<html><body></body></html>&quot;"' : '';

    expect(12);

    $('<iframe id="test20"' + src + '>').load(function () {
        var iframe     = this;
        var iframeBody = iframe.contentDocument.body;

        // NOTE: IE hack part 1: catch hammerhead initialization exception.
        var iframeSandbox = this.contentWindow['%hammerhead%'].sandbox.iframe;
        var storedMeth    = iframeSandbox.constructor.isIframeInitialized;

        iframeSandbox.constructor.isIframeInitialized = function (iframe) {
            iframe.contentWindow[INTERNAL_PROPS.overrideDomMethodName] =
                iframe.contentWindow[INTERNAL_PROPS.overrideDomMethodName] || function () { };

            return storedMeth.call(iframeSandbox, iframe);
        };
        // --------------------------------------------------------

        $('<iframe id="test21">').load(function () {
            // NOTE: IE hack part 2: initialize hammerhead manually.
            if (this.contentDocument.createElement.toString().indexOf('native') !== -1)
                initIframeTestHandler({ iframe: this });

            var iframeDocument = this.contentDocument;
            var subIframeBody  = iframeDocument.body;

            var testData = [
                [document.body, 'a', 'href', null, null],
                [iframeBody, 'a', 'href', null, 'iframe'],
                [document.body, 'form', 'action', null, null],
                [iframeBody, 'form', 'action', null, 'iframe'],
                [document.body, 'area', 'href', null, null],
                [iframeBody, 'area', 'href', null, null],
                [document.body, 'a', 'href', '_top', null],
                [iframeBody, 'a', 'href', '_top', null],
                [subIframeBody, 'a', 'href', '_top', null],
                [document.body, 'a', 'href', '_parent', null],
                [iframeBody, 'a', 'href', '_parent', null],
                [subIframeBody, 'a', 'href', '_parent', 'iframe']
            ];

            var testIframeFlag = function (body, tag, urlAttr, target, resultFlag) {
                var element = iframeDocument.createElement(tag);

                body.appendChild(element);
                if (target)
                    element.setAttribute('target', target);
                element.setAttribute(urlAttr, '/index.html');

                strictEqual(urlUtils.parseProxyUrl(element[urlAttr]).resourceType, resultFlag);

                body.removeChild(element);
            };

            for (var i = 0; i < testData.length; i++)
                testIframeFlag.apply(null, testData[i]);

            start();
            $(iframe).remove();
        }).appendTo(iframeBody);
    }).appendTo('body');
});

module('regression');

asyncTest('ready to init event must not raise for added iframe(B239643)', function () {
    var $container               = $('<div><iframe id="test1"></iframe></div>').appendTo('body');
    var iframeLoadingEventRaised = false;

    // NOTE: Waiting until the iframe is loaded.
    window.setTimeout(function () {
        var handler = function () {
            iframeLoadingEventRaised = true;
        };

        iframeSandbox.on(iframeSandbox.IFRAME_READY_TO_INIT_EVENT, handler);

        /* eslint-disable no-unused-vars */
        var dummy = $container[0].innerHTML;

        /* eslint-enable no-unused-vars */
        ok(!iframeLoadingEventRaised);
        iframeSandbox.off(iframeSandbox.IFRAME_READY_TO_INIT_EVENT, handler);
        $container.remove();
        start();
    }, 100);
});

asyncTest('the AMD module loader damages proxing an iframe without src (GH-127)', function () {
    var amdModuleLoaderMock = function () {
    };

    amdModuleLoaderMock.amd = {};
    window.define           = amdModuleLoaderMock;

    var iframe = document.createElement('iframe');

    iframe.id = 'test_iframe_unique_id_jlsuie56598o';
    iframe.addEventListener('load', function () {
        ok(this.contentWindow['%hammerhead%']);
        delete window.define;
        iframe.parentNode.removeChild(iframe);
        start();
    });
    document.body.appendChild(iframe);
});

asyncTest('iframe initialization must be synchronous (for iframes with an empty src) (GH-184)', function () {
    iframeSandbox.off(iframeSandbox.IFRAME_READY_TO_INIT_EVENT, initIframeTestHandler);
    iframeSandbox.on(iframeSandbox.IFRAME_READY_TO_INIT_EVENT, iframeSandbox.iframeReadyToInitHandler);

    var storedServiceMsgUrl  = settings.get().serviceMsgUrl;
    var testIframeTaskScript = [
        '"window[\'' + INTERNAL_PROPS.overrideDomMethodName + '\'] = function () {',
        '    window.isIframeInitialized = true;',
        '};"'
    ].join('');

    settings.get().serviceMsgUrl = '/get-script/' + testIframeTaskScript;

    var iframe = document.createElement('iframe');

    iframe.id = 'test_unique_id_96sfs8d69ba';
    iframe.addEventListener('load', function () {
        ok(this.contentWindow[INTERNAL_PROPS.overrideDomMethodName]);
        ok(this.contentWindow.isIframeInitialized);

        this.parentNode.removeChild(this);
        settings.get().serviceMsgUrl = storedServiceMsgUrl;
        iframeSandbox.off(iframeSandbox.IFRAME_READY_TO_INIT_EVENT, iframeSandbox.iframeReadyToInitHandler);
        iframeSandbox.on(iframeSandbox.IFRAME_READY_TO_INIT_EVENT, initIframeTestHandler);
        start();
    });
    document.body.appendChild(iframe);
});

asyncTest('native methods are properly initialized in an iframe without src (GH-279)', function () {
    var iframe = document.createElement('iframe');

    iframe.id = 'test_unique_id_lkjlosjkf';
    iframe.addEventListener('load', function () {
        var iframeDocument         = this.contentDocument;
        var iframeWindow           = this.contentWindow;
        var iframeHammerhead       = iframeWindow['%hammerhead%'];
        var nativeCreateElement    = iframeHammerhead.sandbox.nativeMethods.createElement.toString();
        var nativeAppendChild      = iframeHammerhead.sandbox.nativeMethods.appendChild.toString();
        var nativeImage            = iframeHammerhead.sandbox.nativeMethods.Image.toString();
        var overridedCreateElement = iframeDocument.createElement.toString();
        var overridedAppendChild   = iframeDocument.createElement('div').appendChild.toString();
        var overridedImage         = iframeWindow.Image.toString();

        ok(nativeCreateElement !== overridedCreateElement);
        ok(nativeAppendChild !== overridedAppendChild);
        ok(nativeImage !== overridedImage);
        iframe.parentNode.removeChild(iframe);
        start();
    });
    document.body.appendChild(iframe);
});
