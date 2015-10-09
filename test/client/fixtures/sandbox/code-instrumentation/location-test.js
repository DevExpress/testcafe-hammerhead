var Browser                 = Hammerhead.get('./utils/browser');
var CodeInstrumentation     = Hammerhead.get('./sandbox/code-instrumentation');
var LocationInstrumentation = Hammerhead.get('./sandbox/code-instrumentation/location');
var UrlUtil                 = Hammerhead.get('./utils/url');
var Promise                 = Hammerhead.get('es6-promise').Promise;

var iframeSandbox = Hammerhead.sandbox.iframe;

QUnit.testStart(function () {
    iframeSandbox.on(iframeSandbox.IFRAME_READY_TO_INIT_EVENT, initIFrameTestHandler);
    iframeSandbox.off(iframeSandbox.IFRAME_READY_TO_INIT_EVENT, iframeSandbox.iframeReadyToInitHandler);
});

QUnit.testDone(function () {
    iframeSandbox.off(iframeSandbox.IFRAME_READY_TO_INIT_EVENT, initIFrameTestHandler);
});

asyncTest('iframe with empty src', function () {
    var $iframe1 = $('<iframe id="test1">');
    var $iframe2 = $('<iframe id="test2" src="">');
    var $iframe3 = $('<iframe id="test3" src="about:blank">');

    function assert ($iframe) {
        return new Promise(function (resolve) {
            $iframe.bind('load', function () {
                new CodeInstrumentation({}, {}).attach(this.contentWindow);

                var hyperlink = this.contentDocument.createElement('a');

                hyperlink.setAttribute('href', '/test');
                this.contentDocument.body.appendChild(hyperlink);

                strictEqual(
                    eval(processScript('hyperlink.href')),
                    'https://example.com/test'
                );

                strictEqual(
                    eval(processScript('this.contentDocument.location.href')),
                    'about:blank'
                );

                resolve();
            });
            $iframe.appendTo('body');
        });
    }

    assert($iframe1)
        .then(function () {
            return assert($iframe2);
        })
        .then(function () {
            return assert($iframe3);
        })
        .then(function () {
            $iframe1.remove();
            $iframe2.remove();
            $iframe3.remove();

            start();
        });
});

//// Only Chrome raises 'load' event for iframes with 'javascript:' src and creates window instance
if (Browser.isWebKit) {
    asyncTest('iframe with "javascript:" src', function () {
        var $iframe = $('<iframe id="test3" src="javascript:void(0);">');

        $iframe.bind('load', function () {
            new CodeInstrumentation({}, {}).attach(this.contentWindow);

            var hyperlink = this.contentDocument.createElement('a');

            hyperlink.setAttribute('href', '/test');
            this.contentDocument.body.appendChild(hyperlink);

            strictEqual(eval(processScript('hyperlink.href')), 'https://example.com/test');
            strictEqual(eval(processScript('this.contentDocument.location.href')), 'about:blank');

            $iframe.remove();
            start();
        });

        $iframe.appendTo('body');
    });
}

test('iframe', function () {
    var checkProp = function (prop, value) {
        var windowMock                                               = {
            location: UrlUtil.getProxyUrl('http://google.net:90/'),

            top: {
                document: document
            },

            document: {}
        };

        new CodeInstrumentation({}, {}).attach(windowMock);
        LocationInstrumentation.getLocationWrapper(windowMock)[prop] = value;
        strictEqual(UrlUtil.getProxyUrl(windowMock.location).resourceType, UrlUtil.Iframe);
    };

    var checkFunc = function (func, value) {
        var windowMock = {
            location: {
                toString: function () {
                    return UrlUtil.getProxyUrl('http://google.net:90/');
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
        strictEqual(UrlUtil.getProxyUrl(windowMock.location[func + 'Value']).resourceType, UrlUtil.Iframe);
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
    var $iframe = $('<iframe id="test001">').appendTo('body');

    ok(!!eval(processScript('$iframe[0].contentWindow.location')));
    ok(!!eval(processScript('$iframe[0].contentDocument.location')));

    $iframe.remove();
});
