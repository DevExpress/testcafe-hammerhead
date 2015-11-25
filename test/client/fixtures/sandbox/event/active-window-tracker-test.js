var Promise             = hammerhead.Promise;
var activeWindowTracker = hammerhead.sandbox.event.focusBlur.activeWindowTracker;
var iframeSandbox       = hammerhead.sandbox.iframe;

function nextTick () {
    return new Promise(function (resolve) {
        setTimeout(resolve, 100);
    });
}

function createIframe () {
    var iframeSrc = window.QUnitGlobals.getResourceUrl('../../../data/active-window-tracker/active-window-tracker.html');
    var iframe    = document.createElement('iframe');

    iframe.setAttribute('src', iframeSrc);

    iframe.addEventListener('load', function () {
        iframe.contentWindow.loaded = true;
    });

    return iframe;
}

QUnit.testStart(function () {
    iframeSandbox.on(iframeSandbox.IFRAME_READY_TO_INIT_EVENT, initIframeTestHandler);
    iframeSandbox.off(iframeSandbox.IFRAME_READY_TO_INIT_EVENT, iframeSandbox.iframeReadyToInitHandler);
});

QUnit.testDone(function () {
    iframeSandbox.off(iframeSandbox.IFRAME_READY_TO_INIT_EVENT, initIframeTestHandler);

    document.body.focus();
});

asyncTest('check changing active window', function () {
    var iframe = createIframe();

    iframe.addEventListener('load', function () {
        var iframeWindow = this.contentWindow;

        nextTick()
            .then(function () {
                ok(activeWindowTracker.isCurrentWindowActive());
                notOk(iframeWindow.activeWindowTracker.isCurrentWindowActive());

                iframeWindow.document.body.focus();
            })
            .then(function () {
                return window.QUnitGlobals.wait(function () {
                    return activeWindowTracker.activeWindow === iframeWindow;
                });
            })
            .then(function () {
                notOk(activeWindowTracker.isCurrentWindowActive());
                ok(iframeWindow.activeWindowTracker.isCurrentWindowActive());

                document.body.focus();
            })
            .then(function () {
                return window.QUnitGlobals.wait(function () {
                    return activeWindowTracker.activeWindow === window.top &&
                           !iframeWindow.activeWindowTracker.isCurrentWindowActive();
                });
            })
            .then(function () {
                ok(activeWindowTracker.isCurrentWindowActive());
                notOk(iframeWindow.activeWindowTracker.isCurrentWindowActive());

                document.body.removeChild(iframe);

                start();
            });
    });

    document.body.appendChild(iframe);
});

asyncTest('check switching active window (between two iframes)', function () {
    var firstIframe        = createIframe();
    var secondIframe       = createIframe();
    var firstIframeWindow  = null;
    var secondIframeWindow = null;

    document.body.appendChild(firstIframe);
    document.body.appendChild(secondIframe);

    nextTick()
        .then(function () {
            return window.QUnitGlobals.wait(function () {
                return firstIframe.contentWindow && firstIframe.contentWindow.loaded &&
                       secondIframe.contentWindow && secondIframe.contentWindow.loaded;
            });
        })
        .then(function () {
            firstIframeWindow  = firstIframe.contentWindow;
            secondIframeWindow = secondIframe.contentWindow;

            firstIframeWindow.document.body.focus();
        })
        .then(function () {
            return window.QUnitGlobals.wait(function () {
                return activeWindowTracker.activeWindow === firstIframeWindow;
            });
        })
        .then(function () {
            notOk(activeWindowTracker.isCurrentWindowActive());
            ok(firstIframeWindow.activeWindowTracker.isCurrentWindowActive());
            notOk(secondIframeWindow.activeWindowTracker.isCurrentWindowActive());

            secondIframeWindow.document.body.focus();
        })
        .then(function () {
            return window.QUnitGlobals.wait(function () {
                return activeWindowTracker.activeWindow === secondIframeWindow &&
                       !firstIframeWindow.activeWindowTracker.isCurrentWindowActive();
            });
        })
        .then(function () {
            notOk(activeWindowTracker.isCurrentWindowActive());
            notOk(firstIframeWindow.activeWindowTracker.isCurrentWindowActive());
            ok(secondIframeWindow.activeWindowTracker.isCurrentWindowActive());

            document.body.removeChild(firstIframe);
            document.body.removeChild(secondIframe);

            start();
        });
});

module('regression');

asyncTest('check that an error does not rise when trying to send serviceMessage to the removed iframe (GH-206)', function () {
    var iframe     = createIframe();
    var link       = document.createElement('a');
    var withError  = false;

    link.setAttribute('href', '#');
    link.innerHTML = 'Link';

    iframe.addEventListener('load', function () {
        iframe.contentDocument.body.focus();

        nextTick()
            .then(function () {
                return window.QUnitGlobals.wait(function () {
                    return activeWindowTracker.activeWindow === iframe.contentWindow;
                });
            })
            .then(function () {
                document.body.removeChild(iframe);

                link.focus();
            })
            .catch(function () {
                withError = true;
            })
            .then(function () {
                ok(!withError);

                document.body.removeChild(link);
                start();
            });
    });

    document.body.appendChild(link);
    document.body.appendChild(iframe);
});

asyncTest('no error occurs when a focused iframe is removed and a different iframe gets focus afterwards (GH-271)', function () {
    var firstIframe  = createIframe();
    var secondIframe = createIframe();
    var withError    = false;

    hammerhead.on(hammerhead.EVENTS.uncaughtJsError, function () {
        withError = true;
    });

    document.body.appendChild(firstIframe);
    document.body.appendChild(secondIframe);

    nextTick()
        .then(function () {
            return window.QUnitGlobals.wait(function () {
                return firstIframe.contentWindow && firstIframe.contentWindow.loaded &&
                       secondIframe.contentWindow && secondIframe.contentWindow.loaded;
            });
        })
        .then(function () {
            firstIframe.contentDocument.body.focus();
        })
        .then(function () {
            document.body.removeChild(firstIframe);

            secondIframe.contentDocument.body.focus();
        })
        .then(function () {
            return window.QUnitGlobals.wait(function () {
                return activeWindowTracker.activeWindow === secondIframe.contentWindow;
            });
        })
        .then(function () {
            ok(!withError);

            document.body.removeChild(secondIframe);
            start();
        });
});
