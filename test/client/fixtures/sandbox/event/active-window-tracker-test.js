var activeWindowTracker = hammerhead.sandbox.event.focusBlur.activeWindowTracker;
var iframeSandbox       = hammerhead.sandbox.iframe;

function createIframe () {
    var src    = window.getSameDomainPageUrl('../../../data/active-window-tracker/active-window-tracker.html');
    var iframe = document.createElement('iframe');

    iframe.setAttribute('src', src);

    return iframe;
}

QUnit.testStart(function () {
    iframeSandbox.on(iframeSandbox.RUN_TASK_SCRIPT_EVENT, initIframeTestHandler);
    iframeSandbox.off(iframeSandbox.RUN_TASK_SCRIPT_EVENT, iframeSandbox.iframeReadyToInitHandler);
});

QUnit.testDone(function () {
    iframeSandbox.off(iframeSandbox.RUN_TASK_SCRIPT_EVENT, initIframeTestHandler);

    document.body.focus();
});

test('check changing active window', function () {
    var iframe = createIframe();
//return window.createTestIframe()
    //    .then(function (iframe) {
    //
    //    });
    var promise = window.QUnitGlobals.waitForIframe(iframe)
        .then(function () {
            ok(activeWindowTracker.isCurrentWindowActive());
            notOk(iframe.contentWindow.activeWindowTracker.isCurrentWindowActive());

            iframe.contentDocument.body.focus();
        })
        .then(function () {
            return window.QUnitGlobals.wait(function () {
                return activeWindowTracker.activeWindow === iframe.contentWindow;
            });
        })
        .then(function () {
            notOk(activeWindowTracker.isCurrentWindowActive());
            ok(iframe.contentWindow.activeWindowTracker.isCurrentWindowActive());

            document.body.focus();
        })
        .then(function () {
            return window.QUnitGlobals.wait(function () {
                return activeWindowTracker.activeWindow === window.top &&
                       !iframe.contentWindow.activeWindowTracker.isCurrentWindowActive();
            });
        })
        .then(function () {
            ok(activeWindowTracker.isCurrentWindowActive());
            notOk(iframe.contentWindow.activeWindowTracker.isCurrentWindowActive());

            document.body.removeChild(iframe);
        });

    document.body.appendChild(iframe);

    return promise;
});

test('check switching active window (between two iframes)', function () {
    var firstIframe         = createIframe();
    var secondIframe        = createIframe();
    var firstIframePromise  = window.QUnitGlobals.waitForIframe(firstIframe);
    var secondIframePromise = window.QUnitGlobals.waitForIframe(secondIframe);

//return window.createTestIframe()
    //    .then(function (iframe) {
    //
    //    });
    document.body.appendChild(firstIframe);
    document.body.appendChild(secondIframe);

    return firstIframePromise
        .then(function () {
            return secondIframePromise;
        })
        .then(function () {
            firstIframe.contentWindow.document.body.focus();
        })
        .then(function () {
            return window.QUnitGlobals.wait(function () {
                return activeWindowTracker.activeWindow === firstIframe.contentWindow;
            });
        })
        .then(function () {
            notOk(activeWindowTracker.isCurrentWindowActive());
            ok(firstIframe.contentWindow.activeWindowTracker.isCurrentWindowActive());
            notOk(secondIframe.contentWindow.activeWindowTracker.isCurrentWindowActive());

            secondIframe.contentWindow.document.body.focus();
        })
        .then(function () {
            return window.QUnitGlobals.wait(function () {
                return activeWindowTracker.activeWindow === secondIframe.contentWindow &&
                       !firstIframe.contentWindow.activeWindowTracker.isCurrentWindowActive();
            });
        })
        .then(function () {
            notOk(activeWindowTracker.isCurrentWindowActive());
            notOk(firstIframe.contentWindow.activeWindowTracker.isCurrentWindowActive());
            ok(secondIframe.contentWindow.activeWindowTracker.isCurrentWindowActive());

            document.body.removeChild(firstIframe);
            document.body.removeChild(secondIframe);
        });
});

module('regression');

test('check that an error does not rise when trying to send serviceMessage to the removed iframe (GH-206)', function () {
    var iframe            = createIframe();
    var link              = document.createElement('a');
    var withError         = false;
    var checkActiveWindow = function () {
        return activeWindowTracker.activeWindow === iframe.contentWindow;
    };

    link.setAttribute('href', '#');
    link.innerHTML = 'Link';
    iframe.id = 'GH206';
//return window.createTestIframe()
    //    .then(function (iframe) {
    //
    //    });
    var promise = window.QUnitGlobals.waitForIframe(iframe)
        .then(function () {
            iframe.contentDocument.body.focus();
        })
        .then(function () {
            return window.QUnitGlobals.wait(checkActiveWindow);
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
        });

    document.body.appendChild(link);
    document.body.appendChild(iframe);

    return promise;
});

test('no error occurs when a focused iframe is removed and a different iframe gets focus afterwards (GH-271)', function () {
    var firstIframe         = createIframe();
    var secondIframe        = createIframe();
    var firstIframePromise  = window.QUnitGlobals.waitForIframe(firstIframe);
    var secondIframePromise = window.QUnitGlobals.waitForIframe(secondIframe);
    var withError           = false;

//return window.createTestIframe()
    //    .then(function (iframe) {
    //
    //    });
    hammerhead.on(hammerhead.EVENTS.uncaughtJsError, function () {
        withError = true;
    });

    document.body.appendChild(firstIframe);
    document.body.appendChild(secondIframe);

    return firstIframePromise
        .then(function () {
            return secondIframePromise;
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
        });
});
