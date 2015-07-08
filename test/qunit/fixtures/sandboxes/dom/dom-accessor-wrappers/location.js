var Browser             = Hammerhead.get('./util/browser');
var DomAccessorWrappers = Hammerhead.get('./sandboxes/dom-accessor-wrappers');
var IFrameSandbox       = Hammerhead.get('./sandboxes/iframe');
var UrlUtil             = Hammerhead.get('./util/url');

QUnit.testStart = function () {
    IFrameSandbox.on(IFrameSandbox.IFRAME_READY_TO_INIT, initIFrameTestHandler);
    IFrameSandbox.off(IFrameSandbox.IFRAME_READY_TO_INIT, IFrameSandbox.iframeReadyToInitHandler);
};

QUnit.testDone = function () {
    IFrameSandbox.off(IFrameSandbox.IFRAME_READY_TO_INIT, initIFrameTestHandler);
};

asyncTest('iframe with empty src', function () {
    var $iframe1 = $('<iframe id="test1">');
    var $iframe2 = $('<iframe id="test2" src="">');
    var $iframe3 = $('<iframe id="test3" src="about:blank">');

    function assert ($iframe, callback) {
        $iframe.bind('load', function () {
            DomAccessorWrappers.init(this.contentWindow, this.contentDocument);

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

            callback();
        });
        $iframe.appendTo('body');
    }

    assert($iframe1, function () {
        assert($iframe2, function () {
            assert($iframe3, function () {
                $iframe1.remove();
                $iframe2.remove();
                $iframe3.remove();

                start();
            });
        });
    });
});

//// Only Chrome raises 'load' event for iframes with 'javascript:' src and creates window instance
if (Browser.isWebKit) {
    asyncTest('iframe with "javascript:" src', function () {
        var $iframe = $('<iframe id="test3" src="javascript:void(0);">');

        $iframe.bind('load', function () {
            DomAccessorWrappers.init(this.contentWindow, this.contentDocument);

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
        var windowMock                                         = {
            location: UrlUtil.getProxyUrl('http://google.net:90/'),

            top: {
                document: document
            }
        };

        DomAccessorWrappers.init(windowMock, {});
        windowMock[DomAccessorWrappers.LOCATION_WRAPPER][prop] = value;
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

            top: { document: document }
        };

        DomAccessorWrappers.init(windowMock, {});
        windowMock[DomAccessorWrappers.LOCATION_WRAPPER][func](value);
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
