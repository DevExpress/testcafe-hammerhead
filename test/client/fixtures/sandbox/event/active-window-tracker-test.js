var activeWindowTracker = hammerhead.sandbox.event.focusBlur.activeWindowTracker;
var iframeSandbox       = hammerhead.sandbox.iframe;
var Promise             = hammerhead.Promise;

QUnit.testStart(function () {
    iframeSandbox.on(iframeSandbox.RUN_TASK_SCRIPT_EVENT, initIframeTestHandler);
    iframeSandbox.off(iframeSandbox.RUN_TASK_SCRIPT_EVENT, iframeSandbox.iframeReadyToInitHandler);
});

QUnit.testDone(function () {
    iframeSandbox.off(iframeSandbox.RUN_TASK_SCRIPT_EVENT, initIframeTestHandler);

    document.body.focus();
});

test('check changing active window', function () {
    var src    = window.getSameDomainPageUrl('../../../data/active-window-tracker/active-window-tracker.html');
    var iframe = null;

    return window.createTestIframe(src)
        .then(function (createdIframe) {
            iframe = createdIframe;

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
        });
});

test('check switching active window (between two iframes)', function () {
    var src          = window.getSameDomainPageUrl('../../../data/active-window-tracker/active-window-tracker.html');
    var firstIframe  = null;
    var secondIframe = null;

    return Promise.all([
        window.createTestIframe(src),
        window.createTestIframe(src)
    ])
        .then(function (iframes) {
            firstIframe  = iframes[0];
            secondIframe = iframes[1];

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
        });
});

module('regression');

test('check that an error does not rise when trying to send serviceMessage to the removed iframe (GH-206)', function () {
    var src               = window.getSameDomainPageUrl('../../../data/active-window-tracker/active-window-tracker.html');
    var iframe            = null;
    var link              = document.createElement('a');
    var checkActiveWindow = function () {
        return activeWindowTracker.activeWindow === iframe.contentWindow;
    };

    link.setAttribute('href', '#');
    link.innerHTML        = 'Link';

    document.body.appendChild(link);

    return window.createTestIframe(src)
        .then(function (createdIframe) {
            iframe = createdIframe;

            iframe.contentDocument.body.focus();
        })
        .then(function () {
            return window.QUnitGlobals.wait(checkActiveWindow);
        })
        .then(function () {
            document.body.removeChild(iframe);

            link.focus();
        })
        .catch(function (err) {
            return err;
        })
        .then(function (err) {
            ok(!err, err);

            document.body.removeChild(link);
        });
});

test('no error occurs when a focused iframe is removed and a different iframe gets focus afterwards (GH-271)', function () {
    var src          = window.getSameDomainPageUrl('../../../data/active-window-tracker/active-window-tracker.html');
    var firstIframe  = null;
    var secondIframe = null;
    var withError           = false;

    hammerhead.on(hammerhead.EVENTS.uncaughtJsError, function () {
        withError = true;
    });

    return Promise.all([
        window.createTestIframe(src),
        window.createTestIframe(src)
    ])
        .then(function (iframes) {
            firstIframe  = iframes[0];
            secondIframe = iframes[1];

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
        });
});
