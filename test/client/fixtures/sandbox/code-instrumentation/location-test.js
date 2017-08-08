var CodeInstrumentation     = hammerhead.get('./sandbox/code-instrumentation');
var LocationInstrumentation = hammerhead.get('./sandbox/code-instrumentation/location');
var LocationWrapper         = hammerhead.get('./sandbox/code-instrumentation/location/wrapper');
var urlUtils                = hammerhead.get('./utils/url');
var sharedUrlUtils          = hammerhead.get('../utils/url');
var destLocation            = hammerhead.get('./utils/destination-location');

var Promise       = hammerhead.Promise;
var iframeSandbox = hammerhead.sandbox.iframe;
var browserUtils  = hammerhead.utils.browser;


QUnit.testStart(function () {
    iframeSandbox.on(iframeSandbox.RUN_TASK_SCRIPT_EVENT, initIframeTestHandler);
    iframeSandbox.off(iframeSandbox.RUN_TASK_SCRIPT_EVENT, iframeSandbox.iframeReadyToInitHandler);
});

QUnit.testDone(function () {
    iframeSandbox.off(iframeSandbox.RUN_TASK_SCRIPT_EVENT, initIframeTestHandler);
});

test('iframe with empty src', function () {
    function assert (iframe) {
        new CodeInstrumentation({}, {}).attach(iframe.contentWindow);

        var hyperlink = iframe.contentDocument.createElement('a');

        hyperlink.setAttribute('href', '/test');
        iframe.contentDocument.body.appendChild(hyperlink);

        strictEqual(eval(processScript('hyperlink.href')), 'https://example.com/test');
        strictEqual(eval(processScript('iframe.contentDocument.location.href')), 'about:blank');
    }

    return window.createTestIframe()
        .then(assert)
        .then(function () {
            return window.createTestIframe('');
        })
        .then(assert)
        .then(function () {
            return window.createTestIframe('about:blank');
        })
        .then(assert);
});

// NOTE: Only Chrome raises the 'load' event for iframes with 'javascript:' src and creates a window instance.
if (browserUtils.isWebKit) {
    test('iframe with "javascript:" src', function () {
        return window.createTestIframe('javascript:void(0);')
            .then(function (iframe) {
                new CodeInstrumentation({}, {}).attach(iframe.contentWindow);

                var hyperlink = iframe.contentDocument.createElement('a');

                hyperlink.setAttribute('href', '/test');
                iframe.contentDocument.body.appendChild(hyperlink);

                strictEqual(eval(processScript('hyperlink.href')), 'https://example.com/test');
                strictEqual(eval(processScript('iframe.contentDocument.location.href')), 'about:blank');
            });
    });
}

test('iframe', function () {
    var getWindowMock = function () {
        return {
            location: {
                toString: function () {
                    return this.val || urlUtils.getProxyUrl('http://domain.com:90/');
                },

                assign: function (url) {
                    this.val = url;
                },

                replace: function (url) {
                    this.val = url;
                }
            },

            top: {
                document: document
            },

            document: {}
        };
    };

    var getProxy = function (url) {
        return urlUtils.getProxyUrl(url, { resourceType: 'i' });
    };

    var windowMock = getWindowMock();

    new CodeInstrumentation({}, {}).attach(windowMock);

    var wrapper = LocationInstrumentation.getLocationWrapper(windowMock);

    wrapper.port     = 1333;
    strictEqual(windowMock.location, getProxy('http://domain.com:1333/'));
    wrapper.host     = 'new.domain.com:1222';
    strictEqual(windowMock.location, getProxy('http://new.domain.com:1222/'));
    wrapper.hostname = 'domain.com';
    strictEqual(windowMock.location, getProxy('http://domain.com:1222/'));
    wrapper.pathname = '/index.html';
    strictEqual(windowMock.location, getProxy('http://domain.com:1222/index.html'));
    wrapper.protocol = 'https:';
    strictEqual(windowMock.location, getProxy('https://domain.com:1222/index.html'));
    wrapper.search   = '?param=value';
    strictEqual(windowMock.location, getProxy('https://domain.com:1222/index.html?param=value'));

    windowMock = getWindowMock();
    new CodeInstrumentation({}, {}).attach(windowMock);
    wrapper    = LocationInstrumentation.getLocationWrapper(windowMock);

    wrapper.assign('http://new.domain.com:1444');
    strictEqual(windowMock.location.toString(), getProxy('http://new.domain.com:1444'));
    wrapper.replace('https://domain.com:1555/index.html');
    strictEqual(windowMock.location.toString(), getProxy('https://domain.com:1555/index.html'));
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

test('special pages (GH-339)', function () {
    sharedUrlUtils.SPECIAL_PAGES.forEach(function (specialPageUrl) {
        destLocation.forceLocation(urlUtils.getProxyUrl(specialPageUrl));

        var windowMock = {
            location: {}
        };

        var locationWrapper = new LocationWrapper(windowMock);

        strictEqual(locationWrapper.href, specialPageUrl);
        strictEqual(locationWrapper.protocol, 'about:');
        strictEqual(locationWrapper.toString(), specialPageUrl);
    });

    destLocation.forceLocation('http://localhost/sessionId/https://example.com');
});

module('regression');

if (browserUtils.compareVersions([browserUtils.webkitVersion, '603.1.30']) === -1) {
    // NOTE The Safari iOS 10.3 and later does not provide access to the cross-domain location.
    test('getting location of a cross-domain window (GH-467)', function () {
        var sameDomainSrc     = window.getSameDomainPageUrl('../../../data/same-domain/resolving-url-after-document-recreation.html');
        var storedGetProxyUrl = urlUtils.getProxyUrl;

        return window.createTestIframe(window.getCrossDomainPageUrl('../../../data/cross-domain/target-url.html'))
            .then(function (iframe) {
                urlUtils.getProxyUrl = function () {
                    return sameDomainSrc;
                };

                return new Promise(function (resolve) {
                    iframe.onload = function () {
                        resolve(iframe);
                    };
                    eval(processScript('iframe.contentWindow.location.replace("http://same-domain-url.com/")'));
                });
            })
            .then(function (iframe) {
                ok(iframe.contentWindow.location.toString().indexOf(sameDomainSrc) !== -1);

                urlUtils.getProxyUrl = storedGetProxyUrl;
            });
    });
}

test('change hash for the iframe location', function () {
    var setHref    = function (url) {
        this.href = url;
    };
    var proxyUrl   = urlUtils.getProxyUrl('http://domain.com/index.html', { resourceType: 'if' });
    var windowMock = {
        location: {
            replace:  setHref,
            assign:   setHref,
            toString: function () {
                return proxyUrl;
            }
        },

        top:      { document: document },
        document: {}
    };

    var locationWrapper = new LocationWrapper(windowMock);

    var testLocation = function () {
        locationWrapper.href = 'http://domain.com/index.html#hash';
        strictEqual(windowMock.location.href, proxyUrl + '#hash');
        locationWrapper.replace('http://domain.com/index.html#hash');
        strictEqual(windowMock.location.href, proxyUrl + '#hash');
        locationWrapper.assign('http://domain.com/index.html#hash');
        strictEqual(windowMock.location.href, proxyUrl + '#hash');
    };

    testLocation();

    proxyUrl            = urlUtils.getProxyUrl('http://domain.com/index.html');
    windowMock.toString = function () {
        return proxyUrl;
    };
    locationWrapper     = new LocationWrapper(windowMock);

    testLocation();

    locationWrapper.href = 'http://domain.com/index#hash';
    strictEqual(windowMock.location.href, urlUtils.getProxyUrl('http://domain.com/index#hash', { resourceType: 'i' }));
});
