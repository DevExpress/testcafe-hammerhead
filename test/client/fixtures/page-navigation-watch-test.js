var urlUtils = hammerhead.get('./utils/url');
var settings = hammerhead.get('./settings');

var storageSandbox = hammerhead.sandbox.storageSandbox;
var Promise        = hammerhead.Promise;
var formatUrl      = urlUtils.formatUrl;

var iframeLocation  = 'http://example.com/page-navigation-watch/';
var storedSessionId = settings.get().sessionId;

QUnit.testStart(function () {
    settings.get().sessionId = 'unchangeableUrlSession';
    storageSandbox.attach(window);
});

QUnit.testDone(function () {
    settings.get().sessionId = storedSessionId;
});

function changeLocation (locationChangeScript) {
    return new Promise(function (resolve, reject) {
        var iframe   = document.createElement('iframe');
        var resolved = false;

        iframe.id  = 'test' + Date.now();
        iframe.src = location.protocol + '//' + location.host + '/unchangeableUrlSession!i/' + iframeLocation;

        window.QUnitGlobals.waitForIframe(iframe)
            .then(function () {
                var iframeHammerhead = iframe.contentWindow['%hammerhead%'];

                iframeHammerhead.on(iframeHammerhead.EVENTS.pageNavigationTriggered, function (e) {
                    resolved = true;
                    document.body.removeChild(iframe);
                    resolve(e);
                });
                iframe.contentWindow.eval(processScript(locationChangeScript));

                window.setTimeout(function () {
                    if (!resolved) {
                        document.body.removeChild(iframe);
                        reject();
                    }
                }, 200);
            });

        document.body.appendChild(iframe);
    });
}

module('Location changed');

asyncTest('location.href = ...', function () {
    changeLocation('location.href = "./index.html";').then(function (e) {
        strictEqual(e, iframeLocation + 'index.html');
        start();
    });
});

asyncTest('location = ...', function () {
    changeLocation('location = "./index.html";').then(function (e) {
        strictEqual(e, iframeLocation + 'index.html');
        start();
    });
});

asyncTest('window.location = ...', function () {
    changeLocation('window.location = "./index.html";').then(function (e) {
        strictEqual(e, iframeLocation + 'index.html');
        start();
    });
});

asyncTest('location.assing(...)', function () {
    changeLocation('location.assign("./index.html");').then(function (e) {
        strictEqual(e, iframeLocation + 'index.html');
        start();
    });
});

asyncTest('location.replace(...)', function () {
    changeLocation('location.replace("./index.html");').then(function (e) {
        strictEqual(e, iframeLocation + 'index.html');
        start();
    });
});

asyncTest('location.reload(...)', function () {
    changeLocation('location.reload();').then(function (e) {
        strictEqual(e, iframeLocation);
        start();
    });
});

asyncTest('Hash', function () {
    changeLocation('location.href += "#hash";').then(function () {
        ok(!true);
        start();
    }, function () {
        changeLocation('location.hash = "hash";').then(function () {
            ok(!true);
            start();
        }, function () {
            ok(true);
            start();
        });
    });
});

asyncTest('location.port = ...', function () {
    changeLocation('location.port = "8080";').then(function (e) {
        var parsedIframeLocation = urlUtils.parseUrl(iframeLocation);

        parsedIframeLocation.host += ':8080';
        strictEqual(e, formatUrl(parsedIframeLocation));

        start();
    });
});

asyncTest('location.host = ...', function () {
    changeLocation('location.host = "host";').then(function (e) {
        var parsedIframeLocation = urlUtils.parseUrl(iframeLocation);

        parsedIframeLocation.host = 'host';
        strictEqual(e, formatUrl(parsedIframeLocation));

        start();
    });
});

asyncTest('location.hostname = ...', function () {
    changeLocation('location.hostname = "hostname";').then(function (e) {
        var parsedIframeLocation = urlUtils.parseUrl(iframeLocation);

        parsedIframeLocation.hostname = parsedIframeLocation.host = 'hostname';
        strictEqual(e, formatUrl(parsedIframeLocation));

        start();
    });
});

asyncTest('location.pathname = ...', function () {
    changeLocation('location.pathname = "/pathname/pathname";').then(function (e) {
        var parsedIframeLocation = urlUtils.parseUrl(iframeLocation);

        parsedIframeLocation.partAfterHost = '/pathname/pathname';
        strictEqual(e, formatUrl(parsedIframeLocation));

        start();
    });
});

asyncTest('location.protocol = ...', function () {
    changeLocation('location.protocol = "https:";').then(function (e) {
        var parsedIframeLocation = urlUtils.parseUrl(iframeLocation);

        parsedIframeLocation.protocol = 'https:';
        strictEqual(e, formatUrl(parsedIframeLocation));

        start();
    });
});

asyncTest('location.search = ...', function () {
    changeLocation('location.search = "?a=b";').then(function (e) {
        var parsedIframeLocation = urlUtils.parseUrl(iframeLocation);

        parsedIframeLocation.partAfterHost += '?a=b';
        strictEqual(e, formatUrl(parsedIframeLocation));

        start();
    });
});

module('Click by link');
asyncTest('Click by mouse', function () {
    var iframe = document.createElement('iframe');

    iframe.id  = 'test' + Date.now();
    iframe.src = location.protocol + '//' + location.host + '/unchangeableUrlSession!i/' + iframeLocation;

    window.QUnitGlobals.waitForIframe(iframe)
        .then(function () {
            var iframeHammerhead = iframe.contentWindow['%hammerhead%'];

            iframeHammerhead.on(iframeHammerhead.EVENTS.pageNavigationTriggered, function (e) {
                strictEqual(e, iframeLocation + 'index.html');
                document.body.removeChild(iframe);
                start();
            });

            iframe.contentWindow.eval(
                'var link = document.createElement("a");' +
                'link.href = "./index.html";' +
                'document.body.appendChild(link);' +
                'window["%hammerhead%"].eventSandbox.eventSimulator.click(link);'
            );
        });

    document.body.appendChild(iframe);
});

asyncTest('Click via js', function () {
    var iframe = document.createElement('iframe');

    iframe.id  = 'test' + Date.now();
    iframe.src = location.protocol + '//' + location.host + '/unchangeableUrlSession!i/' + iframeLocation;

    window.QUnitGlobals.waitForIframe(iframe)
        .then(function () {
            var iframeHammerhead = iframe.contentWindow['%hammerhead%'];

            iframeHammerhead.on(iframeHammerhead.EVENTS.pageNavigationTriggered, function (e) {
                strictEqual(e, iframeLocation + 'index.html');
                document.body.removeChild(iframe);
                start();
            });

            iframe.contentWindow.eval(
                'var link = document.createElement("a");' +
                'link.href = "./index.html";' +
                'document.body.appendChild(link);' +
                'link.click();'
            );
        });

    document.body.appendChild(iframe);
});

asyncTest('Link with target attribute', function () {
    var iframe = document.createElement('iframe');

    iframe.id   = 'test' + Date.now();
    iframe.name = 'iframeName';
    iframe.src  = location.protocol + '//' + location.host + '/unchangeableUrlSession!i/' + iframeLocation;

    window.QUnitGlobals.waitForIframe(iframe)
        .then(function () {
            var iframeHammerhead = iframe.contentWindow['%hammerhead%'];
            var link             = document.createElement('a');

            iframeHammerhead.on(iframeHammerhead.EVENTS.pageNavigationTriggered, function (e) {
                strictEqual(e, iframeLocation + 'index.html');

                // NOTE: wait while all click handlers done
                window.setTimeout(function () {
                    document.body.removeChild(iframe);
                    document.body.removeChild(link);
                    start();
                }, 0);
            });

            link.textContent = 'test';
            link.setAttribute('href', iframeLocation + 'index.html');
            link.setAttribute('target', 'iframeName');
            document.body.appendChild(link);
            link.click();
        });

    document.body.appendChild(iframe);
});
