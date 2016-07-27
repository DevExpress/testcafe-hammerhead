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
                var unload           = false;

                iframe.contentWindow.addEventListener('unload', function () {
                    unload = true;
                });

                var finish = function () {
                    if (!stayIframe && iframe.parentNode)
                        iframe.parentNode.removeChild(iframe);
                };

                iframeHammerhead.on(iframeHammerhead.EVENTS.redirectDetected, function (e) {
                    clearTimeout(timerId);
                    if (unload)
                        ok(false);

                    finish();
                    resolve(e);
                });

                iframe.contentWindow.eval(processScript(redirectScript));

                timerId = window.setTimeout(function () {
                    finish();
                    reject();
                }, 500);
            });

        document.body.appendChild(iframe);
    });
}


module('Location changed');

asyncTest('location.href = ...', function () {
    redirectIframe('location.href = "./index.html";')
        .then(function (e) {
            strictEqual(e, iframeLocation + 'index.html');
            start();
        })
        .catch(function () {
            ok(false);
            start();
        });
});

asyncTest('location = ...', function () {
    redirectIframe('location = "./index.html";')
        .then(function (e) {
            strictEqual(e, iframeLocation + 'index.html');
            start();
        })
        .catch(function () {
            ok(false);
            start();
        });
});

asyncTest('window.location = ...', function () {
    redirectIframe('window.location = "./index.html";')
        .then(function (e) {
            strictEqual(e, iframeLocation + 'index.html');
            start();
        })
        .catch(function () {
            ok(false);
            start();
        });
});

asyncTest('location.assing(...)', function () {
    redirectIframe('location.assign("./index.html");')
        .then(function (e) {
            strictEqual(e, iframeLocation + 'index.html');
            start();
        })
        .catch(function () {
            ok(false);
            start();
        });
});

asyncTest('location.replace(...)', function () {
    redirectIframe('location.replace("./index.html");')
        .then(function (e) {
            strictEqual(e, iframeLocation + 'index.html');
            start();
        })
        .catch(function () {
            ok(false);
            start();
        });
});

asyncTest('location.reload(...)', function () {
    redirectIframe('location.reload();')
        .then(function (e) {
            strictEqual(e, iframeLocation);
            start();
        })
        .catch(function () {
            ok(false);
            start();
        });
});

asyncTest('Hash', function () {
    redirectIframe('location.href += "#hash";')
        .then(function () {
            ok(!true);
            start();
        })
        .catch(function () {
            redirectIframe('location.hash = "hash";')
                .then(function () {
                    ok(!true);
                    start();
                })
                .catch(function () {
                    ok(true);
                    start();
                });
        });
});

asyncTest('location.port = ...', function () {
    redirectIframe('location.port = "8080";')
        .then(function (e) {
            var parsedIframeLocation = urlUtils.parseUrl(iframeLocation);

            parsedIframeLocation.host += ':8080';
            strictEqual(e, formatUrl(parsedIframeLocation));

            start();
        })
        .catch(function () {
            ok(false);
            start();
        });
});

asyncTest('location.host = ...', function () {
    redirectIframe('location.host = "host";')
        .then(function (e) {
            var parsedIframeLocation = urlUtils.parseUrl(iframeLocation);

            parsedIframeLocation.host = 'host';
            strictEqual(e, formatUrl(parsedIframeLocation));

            start();
        })
        .catch(function () {
            ok(false);
            start();
        });
});

asyncTest('location.hostname = ...', function () {
    redirectIframe('location.hostname = "hostname";')
        .then(function (e) {
            var parsedIframeLocation = urlUtils.parseUrl(iframeLocation);

            parsedIframeLocation.hostname = parsedIframeLocation.host = 'hostname';
            strictEqual(e, formatUrl(parsedIframeLocation));

            start();
        })
        .catch(function () {
            ok(false);
            start();
        });
});

asyncTest('location.pathname = ...', function () {
    redirectIframe('location.pathname = "/pathname/pathname";')
        .then(function (e) {
            var parsedIframeLocation = urlUtils.parseUrl(iframeLocation);

            parsedIframeLocation.partAfterHost = '/pathname/pathname';
            strictEqual(e, formatUrl(parsedIframeLocation));

            start();
        })
        .catch(function () {
            ok(false);
            start();
        });
});

asyncTest('location.protocol = ...', function () {
    redirectIframe('location.protocol = "https:";')
        .then(function (e) {
            var parsedIframeLocation = urlUtils.parseUrl(iframeLocation);

            parsedIframeLocation.protocol = 'https:';
            strictEqual(e, formatUrl(parsedIframeLocation));

            start();
        })
        .catch(function () {
            ok(false);
            start();
        });
});

asyncTest('location.search = ...', function () {
    redirectIframe('location.search = "?a=b";')
        .then(function (e) {
            var parsedIframeLocation = urlUtils.parseUrl(iframeLocation);

            parsedIframeLocation.partAfterHost += '?a=b';
            strictEqual(e, formatUrl(parsedIframeLocation));

            start();
        })
        .catch(function () {
            ok(false);
            start();
        });
});


module('Click by link');

asyncTest('Click by mouse', function () {
    var redirectScript = 'var link = document.createElement("a");' +
                         'link.href = "./index.html";' +
                         'document.body.appendChild(link);' +
                         'window["%hammerhead%"].eventSandbox.eventSimulator.click(link);';

    redirectIframe(redirectScript)
        .then(function (e) {
            strictEqual(e, iframeLocation + 'index.html');
            start();
        })
        .catch(function () {
            ok(false);
            start();
        });
});

asyncTest('Click via js', function () {
    var redirectScript = 'var link = document.createElement("a");' +
                         'link.href = "./index.html";' +
                         'document.body.appendChild(link);' +
                         'link.click(link);';

    redirectIframe(redirectScript)
        .then(function (e) {
            strictEqual(e, iframeLocation + 'index.html');
            start();
        })
        .catch(function () {
            ok(false);
            start();
        });
});

asyncTest('Link with the target attribute', function () {
    var redirectScript = 'var link = window.top.document.createElement("a");' +
                         'link.setAttribute("href", location.toString() + "index.html");' +
                         'link.setAttribute("target", "linkIframe");' +
                         'window.top.document.body.appendChild(link);' +
                         'link.click();';

    redirectIframe(redirectScript, true, 'linkIframe')
        .then(function (e) {
            strictEqual(e, iframeLocation + 'index.html');
            start();
        })
        .catch(function () {
            ok(false);
            start();
        });
});

asyncTest('Click raised by child node', function () {
    var redirectScript = 'var link = document.createElement("a");' +
                         'var child = document.createElement("div");' +
                         'link.setAttribute("href", location.toString() + "index.html");' +
                         'link.appendChild(child);' +
                         'document.body.appendChild(link);' +
                         'child.click();';

    redirectIframe(redirectScript)
        .then(function (e) {
            strictEqual(e, iframeLocation + 'index.html');
            start();
        })
        .catch(function () {
            ok(false);
            start();
        });
});

asyncTest('Click raised by child node - prevented', function () {
    var redirectScript = 'var link = document.createElement("a");' +
                         'var child = document.createElement("div");' +
                         'var parentEl = document.createElement("div");' +
                         'link.setAttribute("href", location.toString() + "index.html");' +
                         'link.appendChild(child);' +
                         'parentEl.appendChild(link);' +
                         'parentEl.addEventListener("click", function(e) {e.preventDefault();});' +
                         'document.body.appendChild(parentEl);' +
                         'child.click();';

    redirectIframe(redirectScript)
        .then(function () {
            ok(false);
            start();
        })
        .catch(function () {
            ok(true);
            start();
        });
});

asyncTest('Click prevented in the parent node', function () {
    var redirectScript = 'var link = document.createElement("a");' +
                         'var parentEl = document.createElement("div");' +
                         'link.setAttribute("href", location.toString() + "index.html");' +
                         'parentEl.addEventListener("click", function(e) {e.preventDefault();});' +
                         'document.body.appendChild(parentEl);' +
                         'parentEl.appendChild(link);' +
                         'link.click();';

    redirectIframe(redirectScript)
        .then(function () {
            ok(false);
            start();
        })
        .catch(function () {
            ok(true);
            start();
        });
});

asyncTest('Click prevented in the onclick attribute', function () {
    var redirectScript = 'var link = document.createElement("a");' +
                         'link.setAttribute("href", location.toString() + "index.html");' +
                         'link.setAttribute("onclick", "event.preventDefault();");' +
                         'document.body.appendChild(link);' +
                         'link.click();';

    redirectIframe(redirectScript)
        .then(function () {
            ok(false);
            start();
        })
        .catch(function () {
            ok(true);
            start();
        });
});

asyncTest('Click prevented in the onclick property handler', function () {
    var redirectScript = 'var link = document.createElement("a");' +
                         'link.setAttribute("href", location.toString() + "index.html");' +
                         'link.onclick = function(e) { e.preventDefault(); };' +
                         'document.body.appendChild(link);' +
                         'link.click();';

    redirectIframe(redirectScript)
        .then(function () {
            ok(false);
            start();
        })
        .catch(function () {
            ok(true);
            start();
        });
});

asyncTest('Click prevented in the window', function () {
    var redirectScript = 'var link = document.createElement("a");' +
                         'link.setAttribute("href", location.toString() + "index.html");' +
                         'window.addEventListener("click", function(e) {e.preventDefault();});' +
                         'document.body.appendChild(link);' +
                         'link.click();';

    redirectIframe(redirectScript)
        .then(function () {
            ok(false);
            start();
        })
        .catch(function () {
            ok(true);
            start();
        });
});

asyncTest('Click prevented in the html "onclick" handler', function () {
    var redirectScript = 'var container = document.createElement("div");' +
                         'container.innerHTML += \'<a id="link" href="./index.html" onclick="event.preventDefault();">Link</a>\';' +
                         'document.body.appendChild(container);' +
                         'link.click();';

    redirectIframe(redirectScript)
        .then(function () {
            ok(false);
            start();
        }, function () {
            ok(true);
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

    redirectIframe(redirectScript)
        .then(function (e) {
            strictEqual(e, iframeLocation + 'index.html');
            start();
        });
});

asyncTest('Submit form via js', function () {
    var redirectScript = 'var form = document.createElement("form");' +
                         'form.action = "./index.html";' +
                         'document.body.appendChild(form);' +
                         'form.submit();';

    redirectIframe(redirectScript)
        .then(function (e) {
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

    redirectIframe(redirectScript, true, 'submitIframe')
        .then(function (e) {
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

    redirectIframe(redirectScript)
        .then(function () {
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

    redirectIframe(redirectScript)
        .then(function () {
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
                         'form.onsubmit = function() { return true; };' +
                         'form.setAttribute("onsubmit", "return false;");' +
                         'submit.type = "submit";' +
                         'form.appendChild(submit);' +
                         'document.body.appendChild(form);' +
                         'submit.click();';

    redirectIframe(redirectScript)
        .then(function () {
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

    redirectIframe(redirectScript)
        .then(function () {
            ok(false);
            start();
        }, function () {
            ok(true);
            start();
        });
});

asyncTest('Submission canceled in the window', function () {
    var redirectScript = 'var form = document.createElement("form");' +
                         'var submit = document.createElement("input");' +
                         'window.addEventListener("submit", function (e) { e.preventDefault(); });' +
                         'form.action = "./index.html";' +
                         'submit.type = "submit";' +
                         'form.appendChild(submit);' +
                         'document.body.appendChild(form);' +
                         'submit.click();';

    redirectIframe(redirectScript)
        .then(function () {
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

    redirectIframe(redirectScript)
        .then(function () {
            ok(true);
            start();
        });
});
