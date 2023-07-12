var urlUtils = hammerhead.utils.url;
var settings = hammerhead.settings;

var storageSandbox      = hammerhead.sandbox.storageSandbox;
var Promise             = hammerhead.Promise;
var formatUrl           = urlUtils.formatUrl;
var parseUrl            = urlUtils.parseUrl;
var browserUtils        = hammerhead.utils.browser;
var pageNavigationWatch = hammerhead.pageNavigationWatch;

var iframeLocation  = 'http://example.com/page-navigation-watch/';
var storedSessionId = settings.get().sessionId;

var iframe = null;

QUnit.testStart(function () {
    settings.get().sessionId = 'unchangeableUrlSession';
    storageSandbox.attach(window);
});

QUnit.testDone(function () {
    settings.get().sessionId = storedSessionId;

    if (iframe && iframe.parentNode)
        iframe.parentNode.removeChild(iframe);

    iframe = null;
});

function navigateIframe (navigationScript, opts) {
    iframe      = document.createElement('iframe');
    iframe.id   = 'test' + Date.now();
    iframe.src  = location.protocol + '//' + location.host + '/unchangeableUrlSession!i/' + iframeLocation;
    iframe.name = opts && opts.iframeName || 'iframeName';

    var promise = window.QUnitGlobals.waitForIframe(iframe)
        .then(function () {
            return new Promise(function (resolve, reject) {
                var iframeHammerhead = iframe.contentWindow['%hammerhead%'];

                iframe.contentWindow.addEventListener('unload', function () {
                    reject('unload was raised before the pageNavigationTriggered event');
                });

                iframeHammerhead.on(iframeHammerhead.EVENTS.pageNavigationTriggered, resolve);
                iframe.contentWindow.eval(window.processScript(navigationScript));

                if (opts && opts.timeout) {
                    window.setTimeout(function () {
                        reject('timeout exceeded');
                    }, opts.timeout);
                }
            });
        });

    document.body.appendChild(iframe);

    return promise;
}

module('Location changed');

test('location.href = ...', function () {
    return navigateIframe('location.href = "./index.html";')
        .then(function (url) {
            strictEqual(url, iframeLocation + 'index.html');
        });
});

test('location = ...', function () {
    return navigateIframe('location = "./index.html";')
        .then(function (url) {
            strictEqual(url, iframeLocation + 'index.html');
        });
});

test('window.location = ...', function () {
    return navigateIframe('window.location = "./index.html";')
        .then(function (url) {
            strictEqual(url, iframeLocation + 'index.html');
        });
});

test('location.assing(...)', function () {
    return navigateIframe('location.assign("./index.html");')
        .then(function (url) {
            strictEqual(url, iframeLocation + 'index.html');
        });
});

test('location.replace(...)', function () {
    return navigateIframe('location.replace("./index.html");')
        .then(function (url) {
            strictEqual(url, iframeLocation + 'index.html');
        });
});

test('location.reload(...)', function () {
    return navigateIframe('location.reload();')
        .then(function (url) {
            strictEqual(url, iframeLocation);
        });
});

test('Hash via location.href', function () {
    return navigateIframe('location.href += "#hash";', { timeout: 500 })
        .then(function () {
            ok(false, 'event should not be triggered');
        })
        .catch(function (reason) {
            ok(reason === 'timeout exceeded', reason);
        });
});

test('javascript protocol via location.href (GH-1289)', function () {
    return navigateIframe('location.href = "javascript:var i = 0;";', { timeout: 500 })
        .then(function () {
            ok(false, 'event should not be triggered');
        })
        .catch(function (reason) {
            ok(reason === 'timeout exceeded', reason);
        });
});

test('Hash via location.hash', function () {
    return navigateIframe('location.hash = "hash";', { timeout: 500 })
        .then(function () {
            ok(false, 'event should not be triggered');
        })
        .catch(function (reason) {
            ok(reason === 'timeout exceeded', reason);
        });
});

test('location.port = ...', function () {
    return navigateIframe('location.port = "8080";')
        .then(function (url) {
            var parsedIframeLocation = parseUrl(iframeLocation);

            parsedIframeLocation.host += ':8080';
            strictEqual(url, formatUrl(parsedIframeLocation));
        });
});

test('location.host = ...', function () {
    return navigateIframe('location.host = "host";')
        .then(function (url) {
            var parsedIframeLocation = parseUrl(iframeLocation);

            parsedIframeLocation.host = 'host';
            strictEqual(url, formatUrl(parsedIframeLocation));
        });
});

test('location.hostname = ...', function () {
    return navigateIframe('location.hostname = "hostname";')
        .then(function (url) {
            var parsedIframeLocation = parseUrl(iframeLocation);

            parsedIframeLocation.hostname = parsedIframeLocation.host = 'hostname';
            strictEqual(url, formatUrl(parsedIframeLocation));
        });
});

test('location.pathname = ...', function () {
    return navigateIframe('location.pathname = "/pathname/pathname";')
        .then(function (url) {
            var parsedIframeLocation = parseUrl(iframeLocation);

            parsedIframeLocation.partAfterHost = '/pathname/pathname';
            strictEqual(url, formatUrl(parsedIframeLocation));
        });
});

test('location.protocol = ...', function () {
    return navigateIframe('location.protocol = "https:";')
        .then(function (url) {
            var parsedIframeLocation = parseUrl(iframeLocation);

            parsedIframeLocation.protocol = 'https:';
            strictEqual(url, formatUrl(parsedIframeLocation));
        });
});

test('location.search = ...', function () {
    return navigateIframe('location.search = "?a=b";')
        .then(function (url) {
            var parsedIframeLocation = parseUrl(iframeLocation);

            parsedIframeLocation.partAfterHost += '?a=b';
            strictEqual(url, formatUrl(parsedIframeLocation));
        });
});

module('Click by link');

test('Click by mouse', function () {
    var navigationScript = 'var link = document.createElement("a");' +
                           'link.href = "./index.html";' +
                           'document.body.appendChild(link);' +
                           'window["%hammerhead%"].eventSandbox.eventSimulator.click(link);';

    return navigateIframe(navigationScript)
        .then(function (url) {
            strictEqual(url, iframeLocation + 'index.html');
        });
});

test('Click via js', function () {
    var navigationScript = 'var link = document.createElement("a");' +
                           'link.href = "./index.html";' +
                           'document.body.appendChild(link);' +
                           'link.click(link);';

    return navigateIframe(navigationScript)
        .then(function (url) {
            strictEqual(url, iframeLocation + 'index.html');
        });
});

test('Link with target attribute', function () {
    var navigationScript = 'var link = window.top.document.createElement("a");' +
                           'link.setAttribute("href", location.toString() + "index.html");' +
                           'link.setAttribute("target", "linkIframe");' +
                           'window.top.document.body.appendChild(link);' +
                           'link.click();';

    return navigateIframe(navigationScript, { iframeName: 'linkIframe' })
        .then(function (url) {
            strictEqual(url, iframeLocation + 'index.html');
        });
});

test('Click raised by child node', function () {
    var navigationScript = 'var link = document.createElement("a");' +
                           'var child = document.createElement("div");' +
                           'link.setAttribute("href", location.toString() + "index.html");' +
                           'link.appendChild(child);' +
                           'document.body.appendChild(link);' +
                           'child.click();';

    return navigateIframe(navigationScript)
        .then(function (url) {
            strictEqual(url, iframeLocation + 'index.html');
        });
});

test('Click raised by child node - prevented', function () {
    var navigationScript = 'var link = document.createElement("a");' +
                           'var child = document.createElement("div");' +
                           'var parentEl = document.createElement("div");' +
                           'link.setAttribute("href", location.toString() + "index.html");' +
                           'link.appendChild(child);' +
                           'parentEl.appendChild(link);' +
                           'link.addEventListener("click", function(e) {e.preventDefault();});' +
                           'document.body.appendChild(parentEl);' +
                           'child.click();';

    return navigateIframe(navigationScript, { timeout: 500 })
        .then(function () {
            ok(false, 'event should not be triggered');
        })
        .catch(function (reason) {
            ok(reason === 'timeout exceeded', reason);
        });
});

test('Click prevented in the parent node', function () {
    var navigationScript = 'var link = document.createElement("a");' +
                           'var parentEl = document.createElement("div");' +
                           'link.setAttribute("href", location.toString() + "index.html");' +
                           'parentEl.addEventListener("click", function(e) {e.preventDefault();});' +
                           'document.body.appendChild(parentEl);' +
                           'parentEl.appendChild(link);' +
                           'link.click();';

    return navigateIframe(navigationScript, { timeout: 500 })
        .then(function () {
            ok(false, 'event should not be triggered');
        })
        .catch(function (reason) {
            ok(reason === 'timeout exceeded', reason);
        });
});

test('Click prevented in the onclick attribute', function () {
    var navigationScript = 'var link = document.createElement("a");' +
                           'link.setAttribute("href", location.toString() + "index.html");' +
                           'link.setAttribute("onclick", "event.preventDefault();");' +
                           'document.body.appendChild(link);' +
                           'link.click();';

    return navigateIframe(navigationScript, { timeout: 500 })
        .then(function () {
            ok(false, 'event should not be triggered');
        })
        .catch(function (reason) {
            ok(reason === 'timeout exceeded', reason);
        });
});

test('Click prevented in the onclick property handler', function () {
    var navigationScript = 'var link = document.createElement("a");' +
                           'link.setAttribute("href", location.toString() + "index.html");' +
                           'link.onclick = function(e) { e.preventDefault(); };' +
                           'document.body.appendChild(link);' +
                           'link.click();';

    return navigateIframe(navigationScript, { timeout: 500 })
        .then(function () {
            ok(false, 'event should not be triggered');
        })
        .catch(function (reason) {
            ok(reason === 'timeout exceeded', reason);
        });
});

test('Click prevented in the window', function () {
    var navigationScript = 'var link = document.createElement("a");' +
                           'link.setAttribute("href", location.toString() + "index.html");' +
                           'window.addEventListener("click", function(e) {e.preventDefault();});' +
                           'document.body.appendChild(link);' +
                           'link.click();';

    return navigateIframe(navigationScript, { timeout: 500 })
        .then(function () {
            ok(false, 'event should not be triggered');
        })
        .catch(function (reason) {
            ok(reason === 'timeout exceeded', reason);
        });
});

test('Click prevented in the html "onclick" handler', function () {
    var navigationScript = 'var container = document.createElement("div");' +
                           'container.innerHTML += \'<a id="link" href="./index.html" onclick="event.preventDefault();">Link</a>\';' +
                           'document.body.appendChild(container);' +
                           'link.click();';

    return navigateIframe(navigationScript, { timeout: 500 })
        .then(function () {
            ok(false, 'event should not be triggered');
        })
        .catch(function (reason) {
            ok(reason === 'timeout exceeded', reason);
        });
});

test('Click prevented via "return false" in the html "onclick" handler', function () {
    var navigationScript = 'var container = document.createElement("div");' +
                               'container.innerHTML += \'<a id="link" href="./index.html" onclick="return false;">Link</a>\';' +
                               'document.body.appendChild(container);' +
                               'link.click();';

    return navigateIframe(navigationScript, { timeout: 500 })
        .then(function () {
            ok(false, 'event should not be triggered');
        })
        .catch(function (reason) {
            ok(reason === 'timeout exceeded', reason);
        });
});

module('Form submission');

test('Submit form by submit button click', function () {
    var navigationScript = 'var form = document.createElement("form");' +
                           'var submit = document.createElement("input");' +
                           'form.action = "./index.html";' +
                           'submit.type = "submit";' +
                           'form.appendChild(submit);' +
                           'document.body.appendChild(form);' +
                           'submit.click();';

    return navigateIframe(navigationScript)
        .then(function (url) {
            strictEqual(url, iframeLocation + 'index.html');
        });
});

test('Submit form via js', function () {
    var navigationScript = 'var form = document.createElement("form");' +
                           'form.action = "./index.html";' +
                           'document.body.appendChild(form);' +
                           'form.submit();';

    return navigateIframe(navigationScript)
        .then(function (url) {
            strictEqual(url, iframeLocation + 'index.html');
        });
});

test('Submit form with the target attribute', function () {
    var navigationScript = 'var form = window.top.document.createElement("form");' +
                           'form.setAttribute("action", location.toString() + "index.html");' +
                           'form.setAttribute("target", "submitIframe");' +
                           'window.top.document.body.appendChild(form);' +
                           'form.submit();';

    return navigateIframe(navigationScript, { iframeName: 'submitIframe' })
        .then(function (url) {
            strictEqual(url, iframeLocation + 'index.html');
        });
});

test('Set handler as a object', function () {
    var navigationScript = 'var form = document.createElement("form");' +
                           'var submit = document.createElement("input");' +
                           'form.action = "./index.html";' +
                           'form.setAttribute("onsubmit", "return true;");' +
                           'form.onsubmit = {};' +
                           'submit.type = "submit";' +
                           'form.appendChild(submit);' +
                           'document.body.appendChild(form);' +
                           'submit.click();';

    return navigateIframe(navigationScript)
        .then(function () {
            ok(true);
        });
});

test('Submission canceled in the "addEventListener" method', function () {
    var navigationScript = 'var form = document.createElement("form");' +
                           'var submit = document.createElement("input");' +
                           'form.addEventListener("submit", function (e) { e.preventDefault(); });' +
                           'form.action = "./index.html";' +
                           'submit.type = "submit";' +
                           'form.appendChild(submit);' +
                           'document.body.appendChild(form);' +
                           'submit.click();';

    return navigateIframe(navigationScript, { timeout: 500 })
        .then(function () {
            ok(false, 'event should not be triggered');
        })
        .catch(function (reason) {
            ok(reason === 'timeout exceeded', reason);
        });
});

test('Submission canceled in the "onsubmit" property', function () {
    var navigationScript = 'var form = document.createElement("form");' +
                               'var submit = document.createElement("input");' +
                               'form.onsubmit = function () { return false; };' +
                               'form.action = "./index.html";' +
                               'submit.type = "submit";' +
                               'form.appendChild(submit);' +
                               'document.body.appendChild(form);' +
                               'submit.click();';

    return navigateIframe(navigationScript, { timeout: 500 })
        .then(function () {
            ok(false, 'event should not be triggered');
        })
        .catch(function (reason) {
            ok(reason === 'timeout exceeded', reason);
        });
});

test('Submission canceled in the "onsubmit" attribute', function () {
    var navigationScript = 'var form = document.createElement("form");' +
                               'var submit = document.createElement("input");' +
                               'form.action = "./index.html";' +
                               'form.setAttribute("onsubmit", "return false;");' +
                               'submit.type = "submit";' +
                               'form.appendChild(submit);' +
                               'document.body.appendChild(form);' +
                               'submit.click();';

    return navigateIframe(navigationScript, { timeout: 500 })
        .then(function () {
            ok(false, 'event should not be triggered');
        })
        .catch(function (reason) {
            ok(reason === 'timeout exceeded', reason);
        });
});

test('Submission canceled in the html "onsubmit" handler', function () {
    var navigationScript = 'var container = document.createElement("div");' +
                               'container.innerHTML += \'<form action="./index.html" onsubmit="return false;"><input type="submit" id="submit"/></form>\';' +
                               'document.body.appendChild(container);' +
                               'document.getElementById("submit").click();';

    return navigateIframe(navigationScript, { timeout: 500 })
        .then(function () {
            ok(false, 'event should not be triggered');
        })
        .catch(function (reason) {
            ok(reason === 'timeout exceeded', reason);
        });
});

if (browserUtils.isSafari && browserUtils.version >= 15) {
    test('Navigation through the opening window in the same tab', function () {
        return navigateIframe("window.open('./index.html')")
            .then(function (url) {
                strictEqual(url, iframeLocation + 'index.html');
            });
    });
}

module('regression');

test('the onNavigationTriggered function should not throw an error when receives only hash (GH-917)', function () {
    return Promise.resolve()
        .then(function () {
            pageNavigationWatch.onNavigationTriggered('#hash');
        })
        .catch(function (err) {
            return err;
        })
        .then(function (err) {
            ok(!err, err);
        });
});

if (browserUtils.isSafari && browserUtils.isOS) {
    test('Raise PAGE_NAVIGATION_TRIGGERED event for "hammerhead.navigateTo" function', function () {
        return navigateIframe('window["%hammerhead%"].navigateTo("./index.html");')
            .then(function (url) {
                strictEqual(url, iframeLocation + 'index.html');
            });
    });
}
