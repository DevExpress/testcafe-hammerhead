var INSTRUCTION             = hammerhead.get('../processing/script/instruction');
var CodeInstrumentation     = hammerhead.get('./sandbox/code-instrumentation');
var LocationInstrumentation = hammerhead.get('./sandbox/code-instrumentation/location');
var LocationWrapper         = hammerhead.get('./sandbox/code-instrumentation/location/wrapper');
var urlUtils                = hammerhead.get('./utils/url');
var sharedUrlUtils          = hammerhead.get('../utils/url');
var destLocation            = hammerhead.get('./utils/destination-location');
var urlResolver             = hammerhead.get('./utils/url-resolver');

var Promise       = hammerhead.Promise;
var nativeMethods = hammerhead.nativeMethods;
var browserUtils  = hammerhead.utils.browser;
var domUtils      = hammerhead.utils.dom;

var messageSandbox = hammerhead.sandbox.event.message;

var ENSURE_URL_TRAILING_SLASH_TEST_CASES = [
    {
        url:                   'http://example.com',
        shoudAddTrailingSlash: true
    },
    {
        url:                   'https://localhost:8080',
        shoudAddTrailingSlash: true
    },
    {
        url:                   'about:blank',
        shoudAddTrailingSlash: false
    },
    {
        url:                   'http://example.com/page.html',
        shoudAddTrailingSlash: false
    },
    {
        url:                   'file://localhost/etc/fstab', // Unix file URI scheme
        shoudAddTrailingSlash: false
    },
    {
        url:                   'file:///etc/fstab', // Unix file URI scheme
        shoudAddTrailingSlash: false
    },
    {
        url:                   'file://localhost/c:/WINDOWS/clock.avi', // Windows file URI scheme
        shoudAddTrailingSlash: false
    },
    {
        url:                   'file:///c:/WINDOWS/clock.avi', // Windows file URI scheme
        shoudAddTrailingSlash: false
    }
];

test('iframe with empty src', function () {
    function assert (iframe) {
        new CodeInstrumentation({}, {}, messageSandbox).attach(iframe.contentWindow);

        var anchor = iframe.contentDocument.createElement('a');

        anchor.setAttribute('href', '/test');
        iframe.contentDocument.body.appendChild(anchor);

        strictEqual(anchor.href, 'https://example.com/test');
        strictEqual(eval(processScript('iframe.contentDocument.location.href')), 'about:blank');
    }

    return createTestIframe()
        .then(assert)
        .then(function () {
            return createTestIframe({ src: '' });
        })
        .then(assert)
        .then(function () {
            return createTestIframe({ src: 'about:blank' });
        })
        .then(assert);
});

// NOTE: Only Chrome raises the 'load' event for iframes with 'javascript:' src and creates a window instance.
if (browserUtils.isWebKit) {
    test('iframe with "javascript:" src', function () {
        return createTestIframe({ src: 'javascript:void(0);' })
            .then(function (iframe) {
                new CodeInstrumentation({}, {}, messageSandbox).attach(iframe.contentWindow);

                var anchor = iframe.contentDocument.createElement('a');

                anchor.setAttribute('href', '/test');
                iframe.contentDocument.body.appendChild(anchor);

                strictEqual(anchor.href, 'https://example.com/test');
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

    wrapper.port = 1333;
    strictEqual(windowMock.location, getProxy('http://domain.com:1333/'));

    wrapper.host = 'new.domain.com:1222';
    strictEqual(windowMock.location, getProxy('http://new.domain.com:1222/'));

    wrapper.hostname = 'domain.com';
    strictEqual(windowMock.location, getProxy('http://domain.com:1222/'));

    wrapper.pathname = '/index.html';
    strictEqual(windowMock.location, getProxy('http://domain.com:1222/index.html'));

    wrapper.protocol = 'https:';
    strictEqual(windowMock.location, getProxy('https://domain.com:1222/index.html'));

    wrapper.search = '?param=value';
    strictEqual(windowMock.location, getProxy('https://domain.com:1222/index.html?param=value'));

    windowMock = getWindowMock();
    new CodeInstrumentation({}, {}).attach(windowMock);
    wrapper = LocationInstrumentation.getLocationWrapper(windowMock);

    wrapper.assign('http://new.domain.com:1444');
    strictEqual(windowMock.location.toString(), getProxy('http://new.domain.com:1444/'));

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
    var storedForcedLocation = destLocation.getLocation();

    sharedUrlUtils.SPECIAL_PAGES.forEach(function (specialPageUrl) {
        destLocation.forceLocation(urlUtils.getProxyUrl(specialPageUrl));

        var windowMock = {
            location: {},
            document: document
        };

        var locationWrapper = new LocationWrapper(windowMock);

        strictEqual(locationWrapper.href, specialPageUrl);
        strictEqual(locationWrapper.protocol, 'about:');
        strictEqual(locationWrapper.toString(), specialPageUrl);
    });

    destLocation.forceLocation(storedForcedLocation);
});

test('different url types for locationWrapper methods (href, replace, assign) (GH-1613)', function () {
    var testCases = [
        {
            url:         null,
            expectedUrl: 'https://example.com/null'
        },
        {
            url:         void 0,
            expectedUrl: 'https://example.com/undefined'
        },
        {
            url:         { url: '/some-path' },
            expectedUrl: 'https://example.com/[object%20Object]'
        },
        {
            url: {
                url:      '/some-path',
                toString: function () {
                    return this.url;
                }
            },
            expectedUrl: 'https://example.com/some-path'
        }
    ];

    // NOTE: IE11 doesn't support 'URL()'
    if (!browserUtils.isIE11) {
        testCases.push({
            url:         new URL('https://example.com/some-path'),
            expectedUrl: 'https://example.com/some-path'
        });
    }

    var windowMock = {
        location: {
            href: '',

            replace: function (url) {
                this.href = url;
            },

            assign: function (url) {
                this.href = url;
            },

            toString: function () {
                return urlUtils.getProxyUrl(this.location.href);
            }
        }
    };

    windowMock.top = windowMock;

    var locationWrapper = new LocationWrapper(windowMock);

    testCases.map(function (testCase) {
        locationWrapper.href = testCase.url;
        strictEqual(windowMock.location.href, urlUtils.getProxyUrl(testCase.expectedUrl));

        locationWrapper.replace(testCase.url);
        strictEqual(windowMock.location.href, urlUtils.getProxyUrl(testCase.expectedUrl));

        locationWrapper.assign(testCase.url);
        strictEqual(windowMock.location.href, urlUtils.getProxyUrl(testCase.expectedUrl));
    });
});

test('throwing errors on calling locationWrapper methods (href, replace, assign) with invalid arguments', function () {
    expect(browserUtils.isIE11 ? 1 : 3);

    var invalidUrlObject = {
        toString: function () {
            return {};
        }
    };

    var windowMock = {
        location: {
            href: '',

            replace: function (url) {
                this.href = url;
            },

            assign: function (url) {
                this.href = url;
            },

            toString: function () {
                return urlUtils.getProxyUrl(this.location.href);
            }
        }
    };

    windowMock.top = windowMock;

    var locationWrapper = new LocationWrapper(windowMock);

    try {
        locationWrapper.href = invalidUrlObject;
        strictEqual(windowMock.location.href, urlUtils.getProxyUrl(''));
    }
    catch (e) {
        ok(true, 'href');
    }

    if (!browserUtils.isIE11) {
        try {
            locationWrapper.replace(invalidUrlObject);
            strictEqual(windowMock.location.href, urlUtils.getProxyUrl(''));
        }
        catch (e) {
            ok(true, 'replace');
        }

        try {
            locationWrapper.assign(invalidUrlObject);
            strictEqual(windowMock.location.href, urlUtils.getProxyUrl(''));
        }
        catch (e) {
            ok(true, 'assign');
        }
    }
});

test('different url types for "location" property (GH-1613)', function () {
    var checkLocation = function (iframe) {
        return new Promise(function (resolve) {
            iframe.addEventListener('load', function () {
                resolve(iframe.contentWindow.location.toString());
            });
        });
    };

    var checkLocationAssignment  = function (nativeIframeUrl, processedIframeUrl) {
        return Promise.all([createTestIframe(), createTestIframe()])
            .then(function (iframes) {
                var nativeIframePromise = checkLocation(iframes[0]);
                var iframePromise       = checkLocation(iframes[1]);

                iframes[0].contentWindow.location = nativeIframeUrl;
                eval(processScript('iframes[1].contentWindow.location = ' + processedIframeUrl));

                return Promise.all([nativeIframePromise, iframePromise]);
            })
            .then(function (urls) {
                var nativeIframeLocation    = urls[0].slice(urls[0].lastIndexOf('/') + 1);
                var processedIframeLocation = urls[1].slice(urls[1].lastIndexOf('/') + 1);

                strictEqual(nativeIframeLocation, processedIframeLocation);
            });
    };

    var cases = [
        checkLocationAssignment(null, 'null'),
        checkLocationAssignment(void 0, 'void 0'),
        checkLocationAssignment({}, '{}'),
        checkLocationAssignment({
            toString: function () {
                return '/some-path';
            }
        }, '{' +
           '    toString: function () {\n' +
           '        return "/some-path";\n' +
           '    }' +
           '}')
    ];

    // NOTE: IE11 doesn't support 'URL()'
    if (!browserUtils.isIE11)
        cases.push(checkLocationAssignment(new URL(location.origin + '/some-path'), 'new URL(location.origin + "/some-path")'));

    return Promise.all(cases);
});

test('should not navigate in case of invalid "location" property assigment (GH-1613)', function () {
    expect(0);

    var invalidUrlObject = '{ toString: function () { return {} } }';

    var checkLocation = function (iframe) {
        return new Promise(function () {
            iframe.addEventListener('load', function () {
                ok(false, 'should not navigate');
            });
        });
    };

    createTestIframe()
        .then(function (iframe) {
            var iframePromise = checkLocation(iframe);

            eval(processScript('iframe.contentWindow.location = ' + invalidUrlObject));

            return iframePromise;
        });
});

test('should ensure a trailing slash on page navigation using href setter, assign and replace methods (GH-1426)', function () {
    function getExpectedProxyUrl (testCase) {
        var proxiedUrl = urlUtils.getProxyUrl(testCase.url);

        return proxiedUrl + (testCase.shoudAddTrailingSlash ? '/' : '');
    }

    var windowMock = {
        location: {
            href: '',

            replace: function (url) {
                this.href = url;
            },

            assign: function (url) {
                this.href = url;
            },

            toString: function () {
                return urlUtils.getProxyUrl(this.location.href);
            }
        }
    };

    windowMock.top = windowMock;

    var locationWrapper = new LocationWrapper(windowMock);

    function testAddingTrailingSlash (testCases) {
        testCases.forEach(function (testCase) {
            locationWrapper.href = testCase.url;
            strictEqual(windowMock.location.href, getExpectedProxyUrl(testCase));

            locationWrapper.replace(testCase.url);
            strictEqual(windowMock.location.href, getExpectedProxyUrl(testCase));

            locationWrapper.assign(testCase.url);
            strictEqual(windowMock.location.href, getExpectedProxyUrl(testCase));
        });
    }

    testAddingTrailingSlash(ENSURE_URL_TRAILING_SLASH_TEST_CASES);
});

test('should ensure a trailing slash on page navigation using hammerhead.navigateTo method (GH-1426)', function () {
    var storedWindow = hammerhead.win;

    function getExpectedProxyUrl (testCase) {
        var proxiedUrl = urlUtils.getProxyUrl(testCase.url);

        return proxiedUrl + (testCase.shoudAddTrailingSlash ? '/' : '');
    }

    var windowMock = {
        location: ''
    };

    hammerhead.win = windowMock;

    function testAddingTrailingSlash (testCases) {
        testCases.forEach(function (testCase) {
            hammerhead.navigateTo(testCase.url);
            strictEqual(hammerhead.win.location, getExpectedProxyUrl(testCase));
        });
    }

    testAddingTrailingSlash(ENSURE_URL_TRAILING_SLASH_TEST_CASES);

    hammerhead.win = storedWindow;
});

test('should omit the default port on page navigation', function () {
    var storedWindow = hammerhead.win;

    var PORT_RE = /:([0-9][0-9]*)/;

    function getExpectedProxyUrl (url, shouldOmitPort) {
        var expectedUrl = shouldOmitPort ? url.replace(PORT_RE, '') : url;

        return urlUtils.getProxyUrl(expectedUrl);
    }

    var windowMock = {
        location: {
            href: '',

            replace: function (url) {
                this.href = url;
            },

            assign: function (url) {
                this.href = url;
            },

            toString: function () {
                return urlUtils.getProxyUrl(this.location.href);
            }
        }
    };

    windowMock.top = windowMock;

    var locationWrapper = new LocationWrapper(windowMock);

    hammerhead.win = {
        location: ''
    };

    function testUrl (url, shouldOmitPort) {
        locationWrapper.href = url;
        strictEqual(windowMock.location.href, getExpectedProxyUrl(url, shouldOmitPort), 'href = ' + url);

        locationWrapper.replace(url);
        strictEqual(windowMock.location.href, getExpectedProxyUrl(url, shouldOmitPort), 'replace(' + url + ')');

        locationWrapper.assign(url);
        strictEqual(windowMock.location.href, getExpectedProxyUrl(url, shouldOmitPort), 'assign(' + url + ')');

        hammerhead.navigateTo(url);
        strictEqual(hammerhead.win.location, getExpectedProxyUrl(url, shouldOmitPort), 'navigateTo(' + url + ')');
    }

    function testDefaultPortOmitting (protocol, defaultPort, defaultPortForAnotherProtocol) {
        testUrl(protocol + '//localhost:' + defaultPort + '/', true);
        testUrl(protocol + '//127.0.0.1:' + defaultPort + '/', true);
        testUrl(protocol + '//example.com:' + defaultPort + '/', true);
        testUrl(protocol + '//example.com:' + defaultPort + '/page.html', true);
        testUrl(protocol + '//localhost:' + defaultPortForAnotherProtocol + '/', false);
        testUrl(protocol + '//localhost:2343/', false);
    }

    testDefaultPortOmitting('http:', '80', '443');
    testDefaultPortOmitting('https:', '443', '80');

    hammerhead.win = storedWindow;
});

if (window.location.ancestorOrigins) {
    module('ancestorOrigins');

    test('same domain double-nested iframe (GH-1342)', function () {
        // NOTE: Firefox doesn't raise the 'load' event for double-nested iframes without src
        var src = browserUtils.isFirefox ? 'javascript:"<html><body></body></html>"' : '';

        return createTestIframe({ src: src })
            .then(function (iframe) {
                return createTestIframe({}, iframe.contentDocument.body);
            })
            .then(function (nestedIframe) {
                var getLocation     = nestedIframe.contentWindow[INSTRUCTION.getLocation];
                var locationWrapper = getLocation(nestedIframe.contentWindow.location);
                var ancestorOrigins = locationWrapper.ancestorOrigins;

                nestedIframe.contentWindow.parent.parent = {
                    location: {
                        toString: function () {
                            return destLocation.getLocation();
                        }
                    },
                    'hammerhead|location-wrapper': locationWrapper,
                    frameElement:                  null
                };

                ok(ancestorOrigins instanceof nestedIframe.contentWindow.DOMStringList);

                strictEqual(ancestorOrigins.length, 2);

                strictEqual(ancestorOrigins[0], 'https://example.com');
                strictEqual(ancestorOrigins.item(0), 'https://example.com');

                strictEqual(ancestorOrigins[1], 'https://example.com');
                strictEqual(ancestorOrigins.item(1), 'https://example.com');

                ok(ancestorOrigins.contains('https://example.com'));
                ok(ancestorOrigins.contains({
                    toString: function () {
                        return 'https://example.com';
                    }
                }));
                ok(!ancestorOrigins.contains('https://another-domain.com'));
                ok(!ancestorOrigins.contains({}));
            });
    });

    // NOTE: while we a trying to restore ancestorOrigns list using parent location,
    // we expect the following ancestorOrigins: ['cross-domain-ancestor-chain', ...]. (GH-1342)
    test('cross domain iframe (GH-1342)', function () {
        var onMessageHandler = function (evt) {
            var message = evt.data.msg;
            var data    = JSON.parse(message);

            strictEqual(data.ancestorOriginsLength, 1);
            strictEqual(data.ancestorOrigins[0], 'https://example.com');

            window.removeEventListener('message', onMessageHandler);
        };

        return createTestIframe({ src: getCrossDomainPageUrl('../../../data/cross-domain/get-ancestor-origin.html') })
            .then(function (crossDomainIframe) {
                window.addEventListener('message', onMessageHandler);
                callMethod(crossDomainIframe.contentWindow, 'postMessage', ['get ancestorOrigin', '*']);
            });
    });
}

module('regression');

if (browserUtils.compareVersions([browserUtils.webkitVersion, '603.1.30']) === -1) {
    // NOTE The Safari iOS 10.3 and later does not provide access to the cross-domain location.
    test('getting location of a cross-domain window (GH-467)', function () {
        var sameDomainSrc     = getSameDomainPageUrl('../../../data/same-domain/resolving-url-after-document-recreation.html');
        var storedGetProxyUrl = urlUtils.getProxyUrl;

        return createTestIframe({ src: getCrossDomainPageUrl('../../../data/cross-domain/target-url.html') })
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
        document: document
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

test('set cross domain location in same domain iframe', function () {
    return createTestIframe({ src: getSameDomainPageUrl('../../../data/cross-domain/set-cross-domain-location.html') })
        .then(function (iframe) {
            ok(!domUtils.isCrossDomainWindows(window, iframe.contentWindow), 'same domain');

            return new Promise(function (resolve) {
                iframe.addEventListener('load', resolve.bind(null, iframe));
                callMethod(iframe.contentWindow, 'postMessage', [
                    getCrossDomainPageUrl('../../../data/cross-domain/set-cross-domain-location.html'),
                    '*'
                ]);
            });
        })
        .then(function (iframe) {
            ok(domUtils.isCrossDomainWindows(window, iframe.contentWindow), 'cross domain');
        });
});

test('emulate a native browser behaviour related with trailing slashes for location\'s href property (GH-1362)', function () {
    var storedForcedLocation         = destLocation.getLocation();
    var storedGetResolverElementMeth = urlResolver.getResolverElement;

    var testCases = [
        {
            url:              'http://localhost:3000',
            expectedLocation: 'http://localhost:3000/'
        },
        {
            url:              'http://localhost:3000/',
            expectedLocation: 'http://localhost:3000'
        }
    ];

    var createWindowMock = function (data) {
        return {
            location: {
                toString: function () {
                    return urlUtils.getProxyUrl(data.url);
                }
            },

            top:      {},
            document: {}
        };
    };

    var overrideGetResolverElement = function (resolvedHref) {
        urlResolver.getResolverElement = function () {
            var storedAnchorHrefGetter = nativeMethods.anchorHrefGetter;
            var anchor                 = document.createElement('a');

            nativeMethods.anchorHrefGetter = function () {
                nativeMethods.anchorHrefGetter = storedAnchorHrefGetter;

                return resolvedHref;
            };

            return anchor;
        };
    };

    for (var i = 0; i < testCases.length; i++) {
        var testCase   = testCases[i];
        var windowMock = createWindowMock(testCase);

        destLocation.forceLocation(windowMock.location.toString());

        var locationWrapper = new LocationWrapper(windowMock);

        overrideGetResolverElement(testCase.expectedLocation);

        strictEqual(locationWrapper.href, testCase.expectedLocation);
    }

    destLocation.forceLocation(storedForcedLocation);
    urlResolver.getResolverElement = storedGetResolverElementMeth;
});

test('set location with "javascript:" protocol', function () {
    return createTestIframe()
        .then(function (iframe) {
            return new Promise(function (resolve) {
                iframe.addEventListener('load', resolve.bind(null, iframe));
                getProperty(iframe.contentWindow, 'location').replace('javascript:\'<a href="/some">Link</a>\'');
            });
        })
        .then(function (iframe) {
            strictEqual(nativeMethods.anchorHrefGetter.call(iframe.contentDocument.body.firstChild), urlUtils.getProxyUrl('/some', { resourceType: 'i' }));
        });
});

asyncTest('should set a proxy url to an iframe location if iframe is not initialized (GH-1531)', function () {
    var iframe = document.createElement('iframe');
    var src    = getSameDomainPageUrl('../../../data/iframe/simple-iframe.html');

    iframe.src = src;

    iframe.addEventListener('load', function () {
        var resourceType     = urlUtils.stringifyResourceType({ isIframe: true });
        var expectedLocation = urlUtils.getProxyUrl(src, { resourceType: resourceType });

        strictEqual(iframe.contentWindow.location.toString(), expectedLocation);

        document.body.removeChild(iframe);
        start();
    });

    document.body.appendChild(iframe);

    setProperty(iframe.contentWindow, 'location', src);
});
