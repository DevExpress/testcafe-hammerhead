var INSTRUCTION             = hammerhead.PROCESSING_INSTRUCTIONS.dom.script;
var CodeInstrumentation     = hammerhead.sandboxUtils.CodeInstrumentation;
var LocationInstrumentation = hammerhead.sandboxUtils.LocationInstrumentation;
var LocationWrapper         = hammerhead.sandboxUtils.LocationWrapper;
var urlUtils                = hammerhead.utils.url;
var sharedUrlUtils          = hammerhead.sharedUtils.url;
var destLocation            = hammerhead.utils.destLocation;
var urlResolver             = hammerhead.utils.urlResolver;
var extend                  = hammerhead.utils.extend;

var Promise       = hammerhead.Promise;
var nativeMethods = hammerhead.nativeMethods;
var browserUtils  = hammerhead.utils.browser;
var domUtils      = hammerhead.utils.dom;

var messageSandbox = hammerhead.sandbox.event.message;

var getWindowMock = function (opts) {
    opts = opts || {};

    var winMock = {
        location: {
            href:     opts.url || '',
            search:   '',
            origin:   '',
            hash:     '',
            port:     '',
            host:     '',
            hostname: '',
            pathname: '',
            protocol: '',
            valueOf:  window.noop,
            reload:   window.noop,

            toString: function () {
                return this.href;
            },

            assign: function (url) {
                this.href = url;
            },

            replace: function (url) {
                this.href = url;
            },
        },

        Location: Location,
        document: document,
    };

    winMock.top = opts.isTop ? winMock : { document: document };


    return winMock;
};

var ENSURE_URL_TRAILING_SLASH_TEST_CASES = [
    {
        url:                   'http://example.com',
        shoudAddTrailingSlash: true,
    },
    {
        url:                   'https://localhost:8080',
        shoudAddTrailingSlash: true,
    },
    {
        url:                   'about:blank',
        shoudAddTrailingSlash: false,
    },
    {
        url:                   'http://example.com/page.html',
        shoudAddTrailingSlash: false,
    },
    {
        url:                   'file://localhost/etc/fstab', // Unix file URI scheme
        shoudAddTrailingSlash: false,
    },
    {
        url:                   'file:///etc/fstab', // Unix file URI scheme
        shoudAddTrailingSlash: false,
    },
    {
        url:                   'file://localhost/c:/WINDOWS/clock.avi', // Windows file URI scheme
        shoudAddTrailingSlash: false,
    },
    {
        url:                   'file:///c:/WINDOWS/clock.avi', // Windows file URI scheme
        shoudAddTrailingSlash: false,
    },
];

test('location native behavior', function () {
    var locationWrapper = getLocation(location);

    strictEqual(locationWrapper.constructor.name, Location.name);
    strictEqual(locationWrapper.constructor.toString(), location.constructor.toString());
    strictEqual(locationWrapper instanceof Location, true);

    if (typeof Location === 'function')
        strictEqual(Function.prototype.toString.apply(locationWrapper.constructor), Function.prototype.toString.apply(Location));
});

test('"isLocation" (GH-1863)', function () {
    var locationCopy = extend({}, window.location);

    ok(domUtils.isLocation(window.location));
    ok(!domUtils.isLocation(locationCopy));
});

if (browserUtils.isChrome) {
    test('"isLocation" in the case of the "iPhone" Chrome emulation mode (GH-2080)', function () {
        var storedIsSafariValue = browserUtils.isSafari;

        browserUtils.isSafari = true; // NOTE: we set it to "true" to test the "iPhone" Chrome emulation mode (GH-2080)

        var locationCopy = extend({}, window.location);

        ok(domUtils.isLocation(window.location));
        ok(!domUtils.isLocation(locationCopy));

        browserUtils.isSafari = storedIsSafariValue;
    });
}

test('iframe with empty src', function () {
    function assert (iframe) {
        new CodeInstrumentation({}, messageSandbox).attach(iframe.contentWindow);

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

test('location object of iframe with empty src should have properties with correct values', function () {
    function assert (iframe) {
        const iframeSrcAttribute = iframe.getAttribute('src');

        const nativeIframe = nativeMethods.createElement.call(iframe.contentDocument, 'iframe');

        if (iframeSrcAttribute)
            nativeMethods.setAttribute.call(nativeIframe, 'src', iframeSrcAttribute);

        nativeMethods.appendChild.call(iframe.contentDocument.body, nativeIframe);

        return window.QUnitGlobals.waitForIframe(nativeIframe)
            .then(function () {
                iframe.contentWindow['%hammerhead%'].utils.destLocation.forceLocation(null);

                strictEqual(
                    eval(processScript('iframe.contentDocument.location.protocol')),
                    nativeIframe.contentDocument.location.protocol,
                    'protocol property in iframe with "' + iframeSrcAttribute + '" src attribute' //eslint-disable-line comma-dangle
                );
                strictEqual(
                    eval(processScript('iframe.contentDocument.location.port')),
                    nativeIframe.contentDocument.location.port,
                    'port property in iframe with "' + iframeSrcAttribute + '" src attribute' //eslint-disable-line comma-dangle
                );
                strictEqual(
                    eval(processScript('iframe.contentDocument.location.host')),
                    nativeIframe.contentDocument.location.host,
                    'host property in iframe with "' + iframeSrcAttribute + '" src attribute' //eslint-disable-line comma-dangle
                );
                strictEqual(
                    eval(processScript('iframe.contentDocument.location.hostname')),
                    nativeIframe.contentDocument.location.hostname,
                    'hostname property in iframe with "' + iframeSrcAttribute + '" src attribute' //eslint-disable-line comma-dangle
                );
                strictEqual(
                    eval(processScript('iframe.contentDocument.location.pathname')),
                    nativeIframe.contentDocument.location.pathname,
                    'pathname property in iframe with "' + iframeSrcAttribute + '" src attribute' //eslint-disable-line comma-dangle
                );
                strictEqual(
                    eval(processScript('iframe.contentDocument.location.hash')),
                    nativeIframe.contentDocument.location.hash,
                    'hash property in iframe with "' + iframeSrcAttribute + '" src attribute' //eslint-disable-line comma-dangle
                );
                strictEqual(
                    eval(processScript('iframe.contentDocument.location.search')),
                    nativeIframe.contentDocument.location.search,
                    'search property in iframe with "' + iframeSrcAttribute + '" src attribute' //eslint-disable-line comma-dangle
                );
            });
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
                new CodeInstrumentation({}, messageSandbox).attach(iframe.contentWindow);

                var anchor = iframe.contentDocument.createElement('a');

                anchor.setAttribute('href', '/test');
                iframe.contentDocument.body.appendChild(anchor);

                strictEqual(anchor.href, 'https://example.com/test');
                strictEqual(eval(processScript('iframe.contentDocument.location.href')), 'about:blank');
            });
    });
}

test('iframe', function () {
    var getProxy = function (url) {
        return urlUtils.getProxyUrl(url, { resourceType: 'i' });
    };

    var windowMock = getWindowMock({ url: urlUtils.getProxyUrl('http://domain.com:90/') });

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

    windowMock = getWindowMock({ url: urlUtils.getProxyUrl('http://domain.com:90/') });
    new CodeInstrumentation({}, {}).attach(windowMock);
    wrapper = LocationInstrumentation.getLocationWrapper(windowMock);

    wrapper.assign('http://new.domain.com:1444');
    strictEqual(windowMock.location.toString(), getProxy('http://new.domain.com:1444/'));

    wrapper.replace('https://domain.com:1555/index.html');
    strictEqual(windowMock.location.toString(), getProxy('https://domain.com:1555/index.html'));
});

test('get location origin', function () {
    strictEqual(getLocation(location).origin, 'https://example.com');
});

test('create location wrapper before iframe loading', function () {
    var iframe = document.createElement('iframe');

    iframe.id  = 'test001';
    iframe.src = getSameDomainPageUrl('../../../data/iframe/simple-iframe.html');
    document.body.appendChild(iframe);

    ok(!!eval(processScript('iframe.contentWindow.location')));
    ok(!!eval(processScript('iframe.contentDocument.location')));

    iframe.parentNode.removeChild(iframe);
});

test('special pages (GH-339)', function () {
    var storedForcedLocation = destLocation.getLocation();

    sharedUrlUtils.SPECIAL_PAGES.forEach(function (specialPageUrl) {
        destLocation.forceLocation(urlUtils.getProxyUrl(specialPageUrl));

        var locationWrapper = new LocationWrapper(getWindowMock(), null, window.noop);

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
            expectedUrl: 'https://example.com/null',
        },
        {
            url:         void 0,
            expectedUrl: 'https://example.com/undefined',
        },
        {
            url:         { url: '/some-path' },
            expectedUrl: 'https://example.com/[object%20Object]',
        },
        {
            url: {
                url:      '/some-path',
                toString: function () {
                    return this.url;
                },
            },
            expectedUrl: 'https://example.com/some-path',
        },
    ];

    testCases.push({
        url:         new URL('https://example.com/some-path'),
        expectedUrl: 'https://example.com/some-path',
    });

    var windowMock      = getWindowMock({ isTop: true });
    var locationWrapper = new LocationWrapper(windowMock, null, window.noop);

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
    expect(3);

    var invalidUrlObject = {
        toString: function () {
            return {};
        },
    };

    var windowMock      = getWindowMock({ isTop: true });
    var locationWrapper = new LocationWrapper(windowMock, null, window.noop);

    try {
        locationWrapper.href = invalidUrlObject;
        strictEqual(windowMock.location.href, urlUtils.getProxyUrl(''));
    }
    catch (e) {
        ok(true, 'href');
    }

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
            },
        }, '{' +
           '    toString: function () {\n' +
           '        return "/some-path";\n' +
           '    }' +
           '}'),
    ];

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

    var windowMock      = getWindowMock({ isTop: true });
    var locationWrapper = new LocationWrapper(windowMock, null, window.noop);

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

    hammerhead.win = getWindowMock();

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

    var windowMock      = getWindowMock({ isTop: true });
    var locationWrapper = new LocationWrapper(windowMock, null, window.noop);

    hammerhead.win = {
        location: '',
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
                var getLocation           = nestedIframe.contentWindow[INSTRUCTION.getLocation];
                var locationWrapper       = getLocation(nestedIframe.contentWindow.location);
                var ancestorOrigins       = locationWrapper.ancestorOrigins;
                var nativeAncestorOrigins = nestedIframe.contentWindow.location.ancestorOrigins;

                nestedIframe.contentWindow.parent.parent = {
                    location: {
                        toString: function () {
                            return destLocation.getLocation();
                        },
                    },
                    'hammerhead|location-wrapper': locationWrapper,
                    frameElement:                  null,
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
                    },
                }));
                ok(!ancestorOrigins.contains('https://another-domain.com'));
                ok(!ancestorOrigins.contains({}));
                deepEqual(Object.getOwnPropertyNames(ancestorOrigins).sort(),
                    Object.getOwnPropertyNames(nativeAncestorOrigins).sort());
            });
    });

    test('cross domain iframe (GH-1342)', function () {
        return createTestIframe({ src: getCrossDomainPageUrl('../../../data/cross-domain/get-ancestor-origin.html') })
            .then(function (crossDomainIframe) {
                callMethod(crossDomainIframe.contentWindow, 'postMessage', ['get ancestorOrigin', '*']);

                return new Promise(function (resolve) {
                    window.addEventListener('message', function onMessageHandler (evt) {
                        if (evt.data.id === 'GH-1342') {
                            window.removeEventListener('message', onMessageHandler);
                            resolve(evt);
                        }
                    });
                });
            })
            .then(function (evt) {
                var message = evt.data.msg;
                var data    = JSON.parse(message);

                strictEqual(data.ancestorOriginsLength, 1);
                strictEqual(data.ancestorOrigins[0], 'https://example.com');
            });
    });

    test('cross-domain iframe with nested not loaded iframe (GH-2326)', function () {
        return createTestIframe({ src: getCrossDomainPageUrl('../../../data/cross-domain/get-ancestor-origin-of-not-loaded-iframe.html') })
            .then(function (iframe) {
                callMethod(iframe.contentWindow, 'postMessage', [{
                    type:            'get ancestorOrigin',
                    nestedIframeSrc: getCrossDomainPageUrl('../../../data/iframe/simple-iframe.html'),
                }, '*']);

                return new Promise(function (resolve) {
                    window.addEventListener('message', function onMessageHandler (evt) {
                        if (evt.data.id === 'GH-2326') {
                            window.removeEventListener('message', onMessageHandler);
                            resolve(evt);
                        }
                    });
                });
            })
            .then(function (evt) {
                deepEqual(evt.data.ancestorOrigins, { '0': 'http://origin_iframe_host', '1': void 0 });
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
                urlUtils.overrideGetProxyUrl(function () {
                    return sameDomainSrc;
                });

                return new Promise(function (resolve) {
                    iframe.onload = function () {
                        resolve(iframe);
                    };
                    eval(processScript('iframe.contentWindow.location.replace("http://same-domain-url.com/")'));
                });
            })
            .then(function (iframe) {
                ok(iframe.contentWindow.location.toString().indexOf(sameDomainSrc) !== -1);

                urlUtils.overrideGetProxyUrl(storedGetProxyUrl);
            });
    });
}

test('change hash for the iframe location', function () {
    var proxyUrl        = urlUtils.getProxyUrl('http://domain.com/index.html', { resourceType: 'if' });
    var windowMock      = getWindowMock({ url: proxyUrl });
    var locationWrapper = new LocationWrapper(windowMock, null, window.noop);

    var testLocation = function () {
        locationWrapper.href = 'http://domain.com/index.html#hash';
        strictEqual(windowMock.location.href, proxyUrl + '#hash');

        locationWrapper.replace('http://domain.com/index.html#hash');
        strictEqual(windowMock.location.href, proxyUrl + '#hash');

        locationWrapper.assign('http://domain.com/index.html#hash');
        strictEqual(windowMock.location.href, proxyUrl + '#hash');
    };

    testLocation();

    proxyUrl                 = urlUtils.getProxyUrl('http://domain.com/index.html');
    windowMock.location.href = proxyUrl;
    locationWrapper          = new LocationWrapper(windowMock, null, window.noop);

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
                    '*',
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
            expectedLocation: 'http://localhost:3000/',
        },
        {
            url:              'http://localhost:3000/',
            expectedLocation: 'http://localhost:3000',
        },
    ];

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
        var windowMock = getWindowMock(testCase);

        destLocation.forceLocation(windowMock.location.toString());

        var locationWrapper = new LocationWrapper(windowMock, null, window.noop);

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

test('location wrapper should not contains internal enumerable properties (GH-1866)', function () {
    deepEqual(Object.getOwnPropertyNames(getLocation(location)).sort(), Object.getOwnPropertyNames(location).sort());
});

test('set a relative url to a cross-domain location', function () {
    var crossDomainUrl = getCrossDomainPageUrl('../../../data/cross-domain/simple-page.html');
    var relativeUrl    = window.QUnitGlobals.getResourceUrl('../../../data/iframe/simple-iframe.html');

    return Promise.all([
        createTestIframe({ src: crossDomainUrl }),
        createTestIframe({ src: crossDomainUrl }),
    ])
        .then(function (iframes) {
            var waitForLoad = function (iframe) {
                return new Promise(function (resolve) {
                    iframe.addEventListener('load', function () {
                        resolve(iframe);
                    });
                });
            };
            var promises    = [waitForLoad(iframes[0]), waitForLoad(iframes[1])];

            setProperty(iframes[0].contentWindow, 'location', relativeUrl);
            setProperty(iframes[1].contentWindow.location, 'href', relativeUrl);

            return Promise.all(promises);
        })
        .then(function (iframes) {
            var checkLocation = function (location) {
                var parsedUrl = urlUtils.parseProxyUrl(location);

                strictEqual(parsedUrl.proxy.port, '2000');
                strictEqual(parsedUrl.resourceType, 'i');
                strictEqual(parsedUrl.destUrl.indexOf(destLocation.getOriginHeader()), 0);
            };

            checkLocation(iframes[0].contentWindow.location);
            checkLocation(iframes[1].contentWindow.location);
        });
});

test('location.replace should not throw an error when called by iframe added dynamically (GH-2417)', function () {
    const iframe = document.createElement('iframe');

    iframe.id  = 'test001';

    document.body.appendChild(iframe);

    let err = null;

    try {
        eval(processScript('iframe.contentDocument.location.replace("./index.html");'));
    }
    catch (e) {
        err = e;
    }
    finally {
        ok(!err, err);

        document.body.removeChild(iframe);
    }
});

// NOTE: From Chrome 80 to Chrome 85, the fragmentDirective property was defined on Location.prototype.
test('we should not break a user script which uses new browser API if we are not overridden it', function () {
    const hashDescriptor = Object.getOwnPropertyDescriptor(Location.prototype, 'hash') ||
            Object.getOwnPropertyDescriptor(location, 'hash');

    hashDescriptor.configurable = true;

    Object.defineProperty(Location.prototype, 'newAPIProp', hashDescriptor);

    hashDescriptor.value = hashDescriptor.get;
    delete hashDescriptor.get;
    delete hashDescriptor.set;

    Object.defineProperty(Location.prototype, 'newAPIFn', hashDescriptor);

    var locWrapper = new LocationWrapper(window);

    locWrapper.newAPIProp = '123';

    strictEqual(locWrapper.newAPIProp, '#123');
    strictEqual(locWrapper.newAPIFn(), '#123');

    throws(function () {
        var obj = {};

        Object.defineProperty(obj, 'some', Object.getOwnPropertyDescriptor(locWrapper, 'newAPIProp'));

        obj.some; // eslint-disable-line no-unused-expressions
    });
});
