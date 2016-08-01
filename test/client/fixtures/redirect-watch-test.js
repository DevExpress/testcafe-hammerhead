var urlUtils = hammerhead.get('./utils/url');
var settings = hammerhead.get('./settings');

var storageSandbox = hammerhead.sandbox.storageSandbox;
var Promise        = hammerhead.Promise;
var formatUrl      = urlUtils.formatUrl;

var iframeLocation  = 'http://example.com/redirect-watch/';
var storedSessionId = settings.get().sessionId;

QUnit.testStart(function () {
    settings.get().sessionId = 'unchangeableUrlSession';
    storageSandbox.attach(window);
});

QUnit.testDone(function () {
    settings.get().sessionId = storedSessionId;
});

function redirectIframe (redirectScript, stayIframe, iframeName) {
    return new Promise(function (resolve, reject) {
        var iframe = document.createElement('iframe');

        iframe.id   = 'test' + Date.now();
        iframe.src  = location.protocol + '//' + location.host + '/unchangeableUrlSession!i/' + iframeLocation;
        iframe.name = iframeName || 'iframeName';

        window.QUnitGlobals.waitForIframe(iframe)
            .then(function () {
                var iframeHammerhead = iframe.contentWindow['%hammerhead%'];
                var timerId          = null;
                var finish           = function () {
                    if (!stayIframe && iframe.parentNode)
                        iframe.parentNode.removeChild(iframe);
                };

                iframeHammerhead.on(iframeHammerhead.EVENTS.redirectDetected, function (e) {
                    clearTimeout(timerId);
                    finish();
                    resolve(e);
                });

                iframe.contentWindow.eval(processScript(redirectScript));

                timerId = window.setTimeout(function () {
                    finish();
                    reject();
                }, 100);
            });

        document.body.appendChild(iframe);
    });
}

module('Location changed');

asyncTest('location.href = ...', function () {
    redirectIframe('location.href = "./index.html";').then(function (e) {
        strictEqual(e, iframeLocation + 'index.html');
        start();
    });
});

asyncTest('location = ...', function () {
    redirectIframe('location = "./index.html";').then(function (e) {
        strictEqual(e, iframeLocation + 'index.html');
        start();
    });
});

asyncTest('window.location = ...', function () {
    redirectIframe('window.location = "./index.html";').then(function (e) {
        strictEqual(e, iframeLocation + 'index.html');
        start();
    });
});

asyncTest('location.assing(...)', function () {
    redirectIframe('location.assign("./index.html");').then(function (e) {
        strictEqual(e, iframeLocation + 'index.html');
        start();
    });
});

asyncTest('location.replace(...)', function () {
    redirectIframe('location.replace("./index.html");').then(function (e) {
        strictEqual(e, iframeLocation + 'index.html');
        start();
    });
});

asyncTest('location.reload(...)', function () {
    redirectIframe('location.reload();').then(function (e) {
        strictEqual(e, iframeLocation);
        start();
    });
});

asyncTest('Hash', function () {
    redirectIframe('location.href += "#hash";').then(function () {
        ok(!true);
        start();
    }, function () {
        redirectIframe('location.hash = "hash";').then(function () {
            ok(!true);
            start();
        }, function () {
            ok(true);
            start();
        });
    });
});

asyncTest('location.port = ...', function () {
    redirectIframe('location.port = "8080";').then(function (e) {
        var parsedIframeLocation = urlUtils.parseUrl(iframeLocation);

        parsedIframeLocation.host += ':8080';
        strictEqual(e, formatUrl(parsedIframeLocation));

        start();
    });
});

asyncTest('location.host = ...', function () {
    redirectIframe('location.host = "host";').then(function (e) {
        var parsedIframeLocation = urlUtils.parseUrl(iframeLocation);

        parsedIframeLocation.host = 'host';
        strictEqual(e, formatUrl(parsedIframeLocation));

        start();
    });
});

asyncTest('location.hostname = ...', function () {
    redirectIframe('location.hostname = "hostname";').then(function (e) {
        var parsedIframeLocation = urlUtils.parseUrl(iframeLocation);

        parsedIframeLocation.hostname = parsedIframeLocation.host = 'hostname';
        strictEqual(e, formatUrl(parsedIframeLocation));

        start();
    });
});

asyncTest('location.pathname = ...', function () {
    redirectIframe('location.pathname = "/pathname/pathname";').then(function (e) {
        var parsedIframeLocation = urlUtils.parseUrl(iframeLocation);

        parsedIframeLocation.partAfterHost = '/pathname/pathname';
        strictEqual(e, formatUrl(parsedIframeLocation));

        start();
    });
});

asyncTest('location.protocol = ...', function () {
    redirectIframe('location.protocol = "https:";').then(function (e) {
        var parsedIframeLocation = urlUtils.parseUrl(iframeLocation);

        parsedIframeLocation.protocol = 'https:';
        strictEqual(e, formatUrl(parsedIframeLocation));

        start();
    });
});

asyncTest('location.search = ...', function () {
    redirectIframe('location.search = "?a=b";').then(function (e) {
        var parsedIframeLocation = urlUtils.parseUrl(iframeLocation);

        parsedIframeLocation.partAfterHost += '?a=b';
        strictEqual(e, formatUrl(parsedIframeLocation));

        start();
    });
});

module('Click by link');

asyncTest('Click by mouse', function () {
    var redirectScript = 'var link = document.createElement("a");' +
                         'link.href = "./index.html";' +
                         'document.body.appendChild(link);' +
                         'window["%hammerhead%"].eventSandbox.eventSimulator.click(link);';

    redirectIframe(redirectScript).then(function (e) {
        strictEqual(e, iframeLocation + 'index.html');
        start();
    });
});

asyncTest('Click via js', function () {
    var redirectScript = 'var link = document.createElement("a");' +
                         'link.href = "./index.html";' +
                         'document.body.appendChild(link);' +
                         'link.click(link);';

    redirectIframe(redirectScript).then(function (e) {
        strictEqual(e, iframeLocation + 'index.html');
        start();
    });
});

asyncTest('Link with the target attribute', function () {
    var redirectScript = 'var link = window.top.document.createElement("a");' +
                         'link.setAttribute("href", location.toString() + "index.html");' +
                         'link.setAttribute("target", "linkIframe");' +
                         'window.top.document.body.appendChild(link);' +
                         'link.click();';

    redirectIframe(redirectScript, true, 'linkIframe').then(function (e) {
        strictEqual(e, iframeLocation + 'index.html');
        start();
    });
});

module('Form submission');

asyncTest('Submit form by submit button click', function () {
    var redirectScript = 'var form = document.createElement("form");' +
                         'var submit = document.createElement("input");' +
                         'form.action = "./index.html";' +
                         'submit.type = "submit";' +
                         'form.appendChild(submit);' +
                         'document.body.appendChild(form);' +
                         'submit.click();';

    redirectIframe(redirectScript).then(function (e) {
        strictEqual(e, iframeLocation + 'index.html');
        start();
    });
});

asyncTest('Submit form via js', function () {
    var redirectScript = 'var form = document.createElement("form");' +
                         'form.action = "./index.html";' +
                         'document.body.appendChild(form);' +
                         'form.submit();';

    redirectIframe(redirectScript).then(function (e) {
        strictEqual(e, iframeLocation + 'index.html');
        start();
    });
});

asyncTest('Submit form with the target attribute', function () {
    var redirectScript = 'var form = window.top.document.createElement("form");' +
                         'form.setAttribute("action", location.toString() + "index.html");' +
                         'form.setAttribute("target", "submitIframe");' +
                         'window.top.document.body.appendChild(form);' +
                         'form.submit();';

    redirectIframe(redirectScript, true, 'submitIframe').then(function (e) {
        strictEqual(e, iframeLocation + 'index.html');
        start();
    });
});

asyncTest('Submission canceled in the "addEventListener" method', function () {
    var redirectScript = 'var form = document.createElement("form");' +
                         'var submit = document.createElement("input");' +
                         'form.addEventListener("submit", function (e) { e.preventDefault(); });' +
                         'form.action = "./index.html";' +
                         'submit.type = "submit";' +
                         'form.appendChild(submit);' +
                         'document.body.appendChild(form);' +
                         'submit.click();';

    redirectIframe(redirectScript).then(function () {
        ok(false);
        start();
    }, function () {
        ok(true);
        start();
    });
});

asyncTest('Submission canceled in the "onsubmit" property', function () {
    var redirectScript = 'var form = document.createElement("form");' +
                         'var submit = document.createElement("input");' +
                         'form.onsubmit = function () { return false; };' +
                         'form.action = "./index.html";' +
                         'submit.type = "submit";' +
                         'form.appendChild(submit);' +
                         'document.body.appendChild(form);' +
                         'submit.click();';

    redirectIframe(redirectScript).then(function () {
        ok(false);
        start();
    }, function () {
        ok(true);
        start();
    });
});

asyncTest('Submission canceled in the "onsubmit" attribute', function () {
    var redirectScript = 'var form = document.createElement("form");' +
                         'var submit = document.createElement("input");' +
                         'form.action = "./index.html";' +
                         'form.setAttribute("onsubmit", "return false;");' +
                         'form.onsubmit = function() { return true; };' +
                         'submit.type = "submit";' +
                         'form.appendChild(submit);' +
                         'document.body.appendChild(form);' +
                         'submit.click();';

    redirectIframe(redirectScript).then(function () {
        ok(false);
        start();
    }, function () {
        ok(true);
        start();
    });
});

asyncTest('Submission canceled in the html "onsubmit" handler', function () {
    var redirectScript = 'var container = document.createElement("div");' +
                         'container.innerHTML += \'<form action="./index.html" onsubmit="return false;"><input type="submit" id="submit"/></form>\';' +
                         'document.body.appendChild(container);' +
                         'document.getElementById("submit").click();';

    redirectIframe(redirectScript).then(function () {
        ok(false);
        start();
    }, function () {
        ok(true);
        start();
    });
});

asyncTest('Set handler as a object', function () {
    var redirectScript = 'var form = document.createElement("form");' +
                         'var submit = document.createElement("input");' +
                         'form.action = "./index.html";' +
                         'form.setAttribute("onsubmit", "return true;");' +
                         'form.onsubmit = {};' +
                         'submit.type = "submit";' +
                         'form.appendChild(submit);' +
                         'document.body.appendChild(form);' +
                         'submit.click();';

    redirectIframe(redirectScript).then(function () {
        ok(true);
        start();
    });
});
