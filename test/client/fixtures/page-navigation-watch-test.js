var urlUtils = hammerhead.get('./utils/url');
var settings = hammerhead.get('./settings');

var storageSandbox = hammerhead.sandbox.storageSandbox;
var Promise        = hammerhead.Promise;
var formatUrl      = urlUtils.formatUrl;
var parseUrl       = urlUtils.parseUrl;
var browserUtils   = hammerhead.utils.browser;

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

function navigateIframe (navigationScript, iframeName) {
    return new Promise(function (resolve, reject) {
        if (!iframe)
            iframe = document.createElement('iframe');

        iframe.id   = 'test' + Date.now();
        iframe.src  = location.protocol + '//' + location.host + '/unchangeableUrlSession!i/' + iframeLocation;
        iframe.name = iframeName || 'iframeName';

        window.QUnitGlobals.waitForIframe(iframe)
            .then(function () {
                // NOTE: wait for iframe initializing
                return window.QUnitGlobals.wait(function () {
                    return !!iframe.contentWindow['%hammerhead%'];
                }, 5000);
            })
            .then(function () {
                var iframeHammerhead = iframe.contentWindow['%hammerhead%'];
                var timerId          = null;
                var unload           = false;

                iframe.contentWindow.addEventListener('unload', function () {
                    unload = true;
                });

                iframeHammerhead.on(iframeHammerhead.EVENTS.pageNavigationTriggered, function (url) {
                    clearTimeout(timerId);

                    if (unload)
                        ok(false, 'unload was raised before the pageNavigationTriggered event');

                    resolve(url);
                });

                iframe.contentWindow.eval(window.processScript(navigationScript));

                timerId = window.setTimeout(reject, 500);
            });

        document.body.appendChild(iframe);
    });
}

module('Location changed');

asyncTest('location.href = ...', function () {
    navigateIframe('location.href = "./index.html";')
        .then(function (e) {
            strictEqual(e, iframeLocation + 'index.html');
            start();
        })
        .catch(function () {
            ok(false, 'timeout exceeded');
            start();
        });
});

asyncTest('location = ...', function () {
    navigateIframe('location = "./index.html";')
        .then(function (e) {
            strictEqual(e, iframeLocation + 'index.html');
            start();
        })
        .catch(function () {
            ok(false, 'timeout exceeded');
            start();
        });
});

asyncTest('window.location = ...', function () {
    navigateIframe('window.location = "./index.html";')
        .then(function (e) {
            strictEqual(e, iframeLocation + 'index.html');
            start();
        })
        .catch(function () {
            ok(false, 'timeout exceeded');
            start();
        });
});

asyncTest('location.assing(...)', function () {
    navigateIframe('location.assign("./index.html");')
        .then(function (e) {
            strictEqual(e, iframeLocation + 'index.html');
            start();
        })
        .catch(function () {
            ok(false, 'timeout exceeded');
            start();
        });
});

asyncTest('location.replace(...)', function () {
    navigateIframe('location.replace("./index.html");')
        .then(function (e) {
            strictEqual(e, iframeLocation + 'index.html');
            start();
        })
        .catch(function () {
            ok(false, 'timeout exceeded');
            start();
        });
});

asyncTest('location.reload(...)', function () {
    navigateIframe('location.reload();')
        .then(function (e) {
            strictEqual(e, iframeLocation);
            start();
        })
        .catch(function () {
            ok(false, 'timeout exceeded');
            start();
        });
});

asyncTest('Hash via location.href', function () {
    navigateIframe('location.href += "#hash";')
        .then(function () {
            ok(false);
            start();
        })
        .catch(function () {
            ok(true);
            start();
        });
});

asyncTest('Hash via location.hash', function () {
    navigateIframe('location.hash = "hash";')
        .then(function () {
            ok(false);
            start();
        })
        .catch(function () {
            ok(true);
            start();
        });
});

asyncTest('location.port = ...', function () {
    navigateIframe('location.port = "8080";')
        .then(function (e) {
            var parsedIframeLocation = parseUrl(iframeLocation);

            parsedIframeLocation.host += ':8080';
            strictEqual(e, formatUrl(parsedIframeLocation));

            start();
        })
        .catch(function () {
            ok(false, 'timeout exceeded');
            start();
        });
});

asyncTest('location.host = ...', function () {
    navigateIframe('location.host = "host";')
        .then(function (e) {
            var parsedIframeLocation = parseUrl(iframeLocation);

            parsedIframeLocation.host = 'host';
            strictEqual(e, formatUrl(parsedIframeLocation));

            start();
        })
        .catch(function () {
            ok(false, 'timeout exceeded');
            start();
        });
});

asyncTest('location.hostname = ...', function () {
    navigateIframe('location.hostname = "hostname";')
        .then(function (e) {
            var parsedIframeLocation = parseUrl(iframeLocation);

            parsedIframeLocation.hostname = parsedIframeLocation.host = 'hostname';
            strictEqual(e, formatUrl(parsedIframeLocation));

            start();
        })
        .catch(function () {
            ok(false, 'timeout exceeded');
            start();
        });
});

asyncTest('location.pathname = ...', function () {
    navigateIframe('location.pathname = "/pathname/pathname";')
        .then(function (e) {
            var parsedIframeLocation = parseUrl(iframeLocation);

            parsedIframeLocation.partAfterHost = '/pathname/pathname';
            strictEqual(e, formatUrl(parsedIframeLocation));

            start();
        })
        .catch(function () {
            ok(false, 'timeout exceeded');
            start();
        });
});

asyncTest('location.protocol = ...', function () {
    navigateIframe('location.protocol = "https:";')
        .then(function (e) {
            var parsedIframeLocation = parseUrl(iframeLocation);

            parsedIframeLocation.protocol = 'https:';
            strictEqual(e, formatUrl(parsedIframeLocation));

            start();
        })
        .catch(function () {
            ok(false, 'timeout exceeded');
            start();
        });
});

asyncTest('location.search = ...', function () {
    navigateIframe('location.search = "?a=b";')
        .then(function (e) {
            var parsedIframeLocation = parseUrl(iframeLocation);

            parsedIframeLocation.partAfterHost += '?a=b';
            strictEqual(e, formatUrl(parsedIframeLocation));

            start();
        })
        .catch(function () {
            ok(false, 'timeout exceeded');
            start();
        });
});

module('Click by link');
asyncTest('Click by mouse', function () {
    var navigationScript = 'var link = document.createElement("a");' +
                           'link.href = "./index.html";' +
                           'document.body.appendChild(link);' +
                           'window["%hammerhead%"].eventSandbox.eventSimulator.click(link);';

    navigateIframe(navigationScript)
        .then(function (e) {
            strictEqual(e, iframeLocation + 'index.html');
            start();
        })
        .catch(function () {
            ok(false, 'timeout exceeded');
            start();
        });
});

asyncTest('Click via js', function () {
    var navigationScript = 'var link = document.createElement("a");' +
                           'link.href = "./index.html";' +
                           'document.body.appendChild(link);' +
                           'link.click(link);';

    navigateIframe(navigationScript)
        .then(function (e) {
            strictEqual(e, iframeLocation + 'index.html');
            start();
        })
        .catch(function () {
            ok(false, 'timeout exceeded');
            start();
        });
});

asyncTest('Link with target attribute', function () {
    var navigationScript = 'var link = window.top.document.createElement("a");' +
                           'link.setAttribute("href", location.toString() + "index.html");' +
                           'link.setAttribute("target", "linkIframe");' +
                           'window.top.document.body.appendChild(link);' +
                           'link.click();';

    navigateIframe(navigationScript, 'linkIframe')
        .then(function (e) {
            strictEqual(e, iframeLocation + 'index.html');
            start();
        })
        .catch(function () {
            ok(false, 'timeout exceeded');
            start();
        });
});

asyncTest('Click raised by child node', function () {
    var navigationScript = 'var link = document.createElement("a");' +
                           'var child = document.createElement("div");' +
                           'link.setAttribute("href", location.toString() + "index.html");' +
                           'link.appendChild(child);' +
                           'document.body.appendChild(link);' +
                           'child.click();';

    navigateIframe(navigationScript)
        .then(function (e) {
            strictEqual(e, iframeLocation + 'index.html');
            start();
        })
        .catch(function () {
            ok(false, 'timeout exceeded');
            start();
        });
});

asyncTest('Click raised by child node - prevented', function () {
    var navigationScript = 'var link = document.createElement("a");' +
                           'var child = document.createElement("div");' +
                           'var parentEl = document.createElement("div");' +
                           'link.setAttribute("href", location.toString() + "index.html");' +
                           'link.appendChild(child);' +
                           'parentEl.appendChild(link);' +
                           'link.addEventListener("click", function(e) {e.preventDefault();});' +
                           'document.body.appendChild(parentEl);' +
                           'child.click();';

    navigateIframe(navigationScript)
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
    var navigationScript = 'var link = document.createElement("a");' +
                           'var parentEl = document.createElement("div");' +
                           'link.setAttribute("href", location.toString() + "index.html");' +
                           'parentEl.addEventListener("click", function(e) {e.preventDefault();});' +
                           'document.body.appendChild(parentEl);' +
                           'parentEl.appendChild(link);' +
                           'link.click();';

    navigateIframe(navigationScript)
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
    var navigationScript = 'var link = document.createElement("a");' +
                           'link.setAttribute("href", location.toString() + "index.html");' +
                           'link.setAttribute("onclick", "event.preventDefault();");' +
                           'document.body.appendChild(link);' +
                           'link.click();';

    navigateIframe(navigationScript)
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
    var navigationScript = 'var link = document.createElement("a");' +
                           'link.setAttribute("href", location.toString() + "index.html");' +
                           'link.onclick = function(e) { e.preventDefault(); };' +
                           'document.body.appendChild(link);' +
                           'link.click();';

    navigateIframe(navigationScript)
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
    var navigationScript = 'var link = document.createElement("a");' +
                           'link.setAttribute("href", location.toString() + "index.html");' +
                           'window.addEventListener("click", function(e) {e.preventDefault();});' +
                           'document.body.appendChild(link);' +
                           'link.click();';

    navigateIframe(navigationScript)
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
    var navigationScript = 'var container = document.createElement("div");' +
                           'container.innerHTML += \'<a id="link" href="./index.html" onclick="event.preventDefault();">Link</a>\';' +
                           'document.body.appendChild(container);' +
                           'link.click();';

    navigateIframe(navigationScript)
        .then(function () {
            ok(false);
            start();
        }, function () {
            ok(true);
            start();
        });
});

if (!browserUtils.isIE || browserUtils.isMSEdge) {
    // NOTE: we don't catch event preventing via "return false" in inline handlers in IE yet
    asyncTest('Click prevented via "return false" in the html "onclick" handler', function () {
        var navigationScript = 'var container = document.createElement("div");' +
                               'container.innerHTML += \'<a id="link" href="./index.html" onclick="return false;">Link</a>\';' +
                               'document.body.appendChild(container);' +
                               'link.click();';

        navigateIframe(navigationScript)
            .then(function () {
                ok(false);
                start();
            }, function () {
                ok(true);
                start();
            });
    });
}


module('Form submission');

asyncTest('Submit form by submit button click', function () {
    var navigationScript = 'var form = document.createElement("form");' +
                           'var submit = document.createElement("input");' +
                           'form.action = "./index.html";' +
                           'submit.type = "submit";' +
                           'form.appendChild(submit);' +
                           'document.body.appendChild(form);' +
                           'submit.click();';

    navigateIframe(navigationScript)
        .then(function (e) {
            strictEqual(e, iframeLocation + 'index.html');
            start();
        });
});

asyncTest('Submit form via js', function () {
    var navigationScript = 'var form = document.createElement("form");' +
                           'form.action = "./index.html";' +
                           'document.body.appendChild(form);' +
                           'form.submit();';

    navigateIframe(navigationScript)
        .then(function (e) {
            strictEqual(e, iframeLocation + 'index.html');
            start();
        })
        .catch(function () {
            ok(false, 'timeout exceeded');
            start();
        });
});

asyncTest('Submit form with the target attribute', function () {
    var navigationScript = 'var form = window.top.document.createElement("form");' +
                           'form.setAttribute("action", location.toString() + "index.html");' +
                           'form.setAttribute("target", "submitIframe");' +
                           'window.top.document.body.appendChild(form);' +
                           'form.submit();';

    navigateIframe(navigationScript, 'submitIframe')
        .then(function (e) {
            strictEqual(e, iframeLocation + 'index.html');
            start();
        })
        .catch(function () {
            ok(false, 'timeout exceeded');
            start();
        });
});

asyncTest('Set handler as a object', function () {
    var navigationScript = 'var form = document.createElement("form");' +
                           'var submit = document.createElement("input");' +
                           'form.action = "./index.html";' +
                           'form.setAttribute("onsubmit", "return true;");' +
                           'form.onsubmit = {};' +
                           'submit.type = "submit";' +
                           'form.appendChild(submit);' +
                           'document.body.appendChild(form);' +
                           'submit.click();';

    navigateIframe(navigationScript)
        .then(function () {
            ok(true);
            start();
        })
        .catch(function () {
            ok(false, 'timeout exceeded');
            start();
        });
});

asyncTest('Submission canceled in the "addEventListener" method', function () {
    var navigationScript = 'var form = document.createElement("form");' +
                           'var submit = document.createElement("input");' +
                           'form.addEventListener("submit", function (e) { e.preventDefault(); });' +
                           'form.action = "./index.html";' +
                           'submit.type = "submit";' +
                           'form.appendChild(submit);' +
                           'document.body.appendChild(form);' +
                           'submit.click();';

    navigateIframe(navigationScript)
        .then(function () {
            ok(false);
            start();
        })
        .catch(function () {
            ok(true);
            start();
        });
});

if (!browserUtils.isIE || browserUtils.isMSEdge) {
    // NOTE: we don't catch event preventing via "return false" in inline handlers in IE yet
    asyncTest('Submission canceled in the "onsubmit" property', function () {
        var navigationScript = 'var form = document.createElement("form");' +
                               'var submit = document.createElement("input");' +
                               'form.onsubmit = function () { return false; };' +
                               'form.action = "./index.html";' +
                               'submit.type = "submit";' +
                               'form.appendChild(submit);' +
                               'document.body.appendChild(form);' +
                               'submit.click();';

        navigateIframe(navigationScript)
            .then(function () {
                ok(false);
                start();
            })
            .catch(function () {
                ok(true);
                start();
            });
    });

    asyncTest('Submission canceled in the "onsubmit" attribute', function () {
        var navigationScript = 'var form = document.createElement("form");' +
                               'var submit = document.createElement("input");' +
                               'form.action = "./index.html";' +
                               'form.setAttribute("onsubmit", "return false;");' +
                               'submit.type = "submit";' +
                               'form.appendChild(submit);' +
                               'document.body.appendChild(form);' +
                               'submit.click();';

        navigateIframe(navigationScript)
            .then(function () {
                ok(false);
                start();
            })
            .catch(function () {
                ok(true);
                start();
            });
    });

    asyncTest('Submission canceled in the html "onsubmit" handler', function () {
        var navigationScript = 'var container = document.createElement("div");' +
                               'container.innerHTML += \'<form action="./index.html" onsubmit="return false;"><input type="submit" id="submit"/></form>\';' +
                               'document.body.appendChild(container);' +
                               'document.getElementById("submit").click();';

        navigateIframe(navigationScript)
            .then(function () {
                ok(false);
                start();
            })
            .catch(function () {
                ok(true);
                start();
            });
    });
}
