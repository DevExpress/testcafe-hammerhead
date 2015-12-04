var CodeInstrumentation     = hammerhead.get('./sandbox/code-instrumentation');
var LocationInstrumentation = hammerhead.get('./sandbox/code-instrumentation/location');
var urlUtils                = hammerhead.get('./utils/url');

var Promise       = hammerhead.Promise;
var iframeSandbox = hammerhead.sandbox.iframe;
var browserUtils  = hammerhead.utils.browser;


QUnit.testStart(function () {
    iframeSandbox.on(iframeSandbox.IFRAME_READY_TO_INIT_EVENT, initIframeTestHandler);
    iframeSandbox.off(iframeSandbox.IFRAME_READY_TO_INIT_EVENT, iframeSandbox.iframeReadyToInitHandler);
});

QUnit.testDone(function () {
    iframeSandbox.off(iframeSandbox.IFRAME_READY_TO_INIT_EVENT, initIframeTestHandler);
});

asyncTest('iframe with empty src', function () {
    var iframe1 = document.createElement('iframe');
    var iframe2 = document.createElement('iframe');
    var iframe3 = document.createElement('iframe');

    iframe1.id = 'test1';
    iframe2.id = 'test2';
    iframe3.id = 'test3';
    iframe2.setAttribute('src', '');
    iframe3.setAttribute('src', 'about:blank');

    function assert (iframe) {
        var promise = window.QUnitGlobals.waitForIframe(iframe);

        document.body.appendChild(iframe);
        return promise.then(function () {
            new CodeInstrumentation({}, {}).attach(iframe.contentWindow);

            var hyperlink = iframe.contentDocument.createElement('a');

            hyperlink.setAttribute('href', '/test');
            iframe.contentDocument.body.appendChild(hyperlink);

            strictEqual(
                eval(processScript('hyperlink.href')),
                'https://example.com/test'
            );

            strictEqual(
                eval(processScript('iframe.contentDocument.location.href')),
                'about:blank'
            );

            return Promise.resolve();
        });
    }

    assert(iframe1)
        .then(function () {
            return assert(iframe2);
        })
        .then(function () {
            return assert(iframe3);
        })
        .then(function () {
            iframe1.parentNode.removeChild(iframe1);
            iframe2.parentNode.removeChild(iframe2);
            iframe3.parentNode.removeChild(iframe3);

            start();
        });
});

// NOTE: Only Chrome raises the 'load' event for iframes with 'javascript:' src and creates a window instance.
if (browserUtils.isWebKit) {
    asyncTest('iframe with "javascript:" src', function () {
        var iframe = document.createElement('iframe');

        iframe.id = 'test3';
        iframe.setAttribute('src', 'javascript:void(0);');
        window.QUnitGlobals.waitForIframe(iframe)
            .then(function () {
                new CodeInstrumentation({}, {}).attach(iframe.contentWindow);

                var hyperlink = iframe.contentDocument.createElement('a');

                hyperlink.setAttribute('href', '/test');
                iframe.contentDocument.body.appendChild(hyperlink);

                strictEqual(eval(processScript('hyperlink.href')), 'https://example.com/test');
                strictEqual(eval(processScript('iframe.contentDocument.location.href')), 'about:blank');

                iframe.parentNode.removeChild(iframe);
                start();
            });
        document.body.appendChild(iframe);
    });
}

test('iframe', function () {
    var checkProp = function (prop, value) {
        var windowMock                                               = {
            location: urlUtils.getProxyUrl('http://google.net:90/'),

            top: {
                document: document
            },

            document: {}
        };

        new CodeInstrumentation({}, {}).attach(windowMock);
        LocationInstrumentation.getLocationWrapper(windowMock)[prop] = value;
        strictEqual(urlUtils.getProxyUrl(windowMock.location).resourceType, urlUtils.Iframe);
    };

    var checkFunc = function (func, value) {
        var windowMock = {
            location: {
                toString: function () {
                    return urlUtils.getProxyUrl('http://google.net:90/');
                },

                assign: function (value) {
                    windowMock.location.assignValue = value;
                },

                replace: function (value) {
                    windowMock.location.replaceValue = value;
                }
            },

            document: {},
            top:      { document: document }
        };

        new CodeInstrumentation({}, {}).attach(windowMock);
        LocationInstrumentation.getLocationWrapper(windowMock)[func](value);
        strictEqual(urlUtils.getProxyUrl(windowMock.location[func + 'Value']).resourceType, urlUtils.Iframe);
    };

    checkProp('port', 1333);
    checkProp('host', 'google.com:80');
    checkProp('hostname', 'google.com');
    checkProp('pathname', '/index.html');
    checkProp('protocol', 'https:');
    checkProp('href', 'http://google.com');
    checkProp('search', '?param=value');
    checkFunc('assign', 'http://google.com');
    checkFunc('replace', 'http://google.com');
});

test('get location origin', function () {
    var locWrapper = getLocation(location);

    strictEqual(locWrapper.origin, 'https://example.com');
});

test('create location wrapper before iframe loading', function () {
    var iframe = document.createElement('iframe');

    iframe.id = 'test001';
    document.body.appendChild(iframe);

    ok(!!eval(processScript('iframe.contentWindow.location')));
    ok(!!eval(processScript('iframe.contentDocument.location')));

    iframe.parentNode.removeChild(iframe);
});
