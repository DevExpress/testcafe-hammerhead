var activeWindowTracker = hammerhead.sandbox.event.focusBlur._activeWindowTracker;
var Promise             = hammerhead.Promise;
var nativeMethods       = hammerhead.nativeMethods;

QUnit.testDone(function () {
    document.body.focus();
});

test('check changing active window', function () {
    var src    = getSameDomainPageUrl('../../../data/active-window-tracker/active-window-tracker.html');
    var iframe = null;

    return createTestIframe({ src: src })
        .then(function (createdIframe) {
            iframe = createdIframe;

            ok(activeWindowTracker.isCurrentWindowActive());
            notOk(iframe.contentWindow.activeWindowTracker.isCurrentWindowActive());

            iframe.contentDocument.body.focus();
        })
        .then(function () {
            return window.QUnitGlobals.wait(function () {
                return activeWindowTracker._activeWindow === iframe.contentWindow;
            });
        })
        .then(function () {
            notOk(activeWindowTracker.isCurrentWindowActive());
            ok(iframe.contentWindow.activeWindowTracker.isCurrentWindowActive());

            document.body.focus();
        })
        .then(function () {
            return window.QUnitGlobals.wait(function () {
                return activeWindowTracker._activeWindow === window.top &&
                       !iframe.contentWindow.activeWindowTracker.isCurrentWindowActive();
            });
        })
        .then(function () {
            ok(activeWindowTracker.isCurrentWindowActive());
            notOk(iframe.contentWindow.activeWindowTracker.isCurrentWindowActive());
        });
});

test('check switching active window (between two iframes)', function () {
    var src          = getSameDomainPageUrl('../../../data/active-window-tracker/active-window-tracker.html');
    var firstIframe  = null;
    var secondIframe = null;

    return Promise.all([createTestIframe({ src: src }), createTestIframe({ src: src })])
        .then(function (iframes) {
            firstIframe  = iframes[0];
            secondIframe = iframes[1];

            firstIframe.contentWindow.document.body.focus();
        })
        .then(function () {
            return window.QUnitGlobals.wait(function () {
                return activeWindowTracker._activeWindow === firstIframe.contentWindow;
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
                return activeWindowTracker._activeWindow === secondIframe.contentWindow &&
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
    var src               = getSameDomainPageUrl('../../../data/active-window-tracker/active-window-tracker.html');
    var iframe            = null;
    var anchor            = document.createElement('a');
    var checkActiveWindow = function () {
        return activeWindowTracker._activeWindow === iframe.contentWindow;
    };

    anchor.setAttribute('href', '#');
    nativeMethods.anchorTextSetter.call(anchor, 'Link');

    document.body.appendChild(anchor);

    return createTestIframe({ src: src })
        .then(function (createdIframe) {
            iframe = createdIframe;

            iframe.contentDocument.body.focus();
        })
        .then(function () {
            return window.QUnitGlobals.wait(checkActiveWindow);
        })
        .then(function () {
            document.body.removeChild(iframe);

            anchor.focus();
        })
        .catch(function (err) {
            return err;
        })
        .then(function (err) {
            ok(!err, err);

            document.body.removeChild(anchor);
        });
});

test('no error occurs when a focused iframe is removed and a different iframe gets focus afterwards (GH-271)', function () {
    var src          = getSameDomainPageUrl('../../../data/active-window-tracker/active-window-tracker.html');
    var firstIframe  = null;
    var secondIframe = null;
    var withError           = false;

    hammerhead.on(hammerhead.EVENTS.uncaughtJsError, function () {
        withError = true;
    });

    return Promise.all([createTestIframe({ src: src }), createTestIframe({ src: src })])
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
                return activeWindowTracker._activeWindow === secondIframe.contentWindow;
            });
        })
        .then(function () {
            ok(!withError);
        });
});
