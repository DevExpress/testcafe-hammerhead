var Promise             = hammerhead.Promise;
var activeWindowTracker = hammerhead.sandbox.event.focusBlur.activeWindowTracker;
var iframeSandbox       = hammerhead.sandbox.iframe;

function nextTick () {
    return new Promise(function (resolve) {
        setTimeout(resolve, 100);
    });
}

QUnit.testStart(function () {
    iframeSandbox.on(iframeSandbox.IFRAME_READY_TO_INIT_EVENT, initIframeTestHandler);
    iframeSandbox.off(iframeSandbox.IFRAME_READY_TO_INIT_EVENT, iframeSandbox.iframeReadyToInitHandler);
});

QUnit.testDone(function () {
    iframeSandbox.off(iframeSandbox.IFRAME_READY_TO_INIT_EVENT, initIframeTestHandler);
});

asyncTest('check changing active window', function () {
    var $iframe      = $('<iframe>');
    var iframeWindow = null;

    $iframe[0].src = window.QUnitGlobals.getResourceUrl('../../../data/active-window-tracker/active-window-tracker.html');
    $iframe.appendTo('body');

    $iframe.bind('load', function () {
        iframeWindow = this.contentWindow;

        nextTick()
            .then(function () {
                ok(activeWindowTracker.isCurrentWindowActive());
                notOk(iframeWindow.activeWindowTracker.isCurrentWindowActive());

                iframeWindow.document.body.focus();
            })
            .then(nextTick)
            .then(function () {
                notOk(activeWindowTracker.isCurrentWindowActive());
                ok(iframeWindow.activeWindowTracker.isCurrentWindowActive());

                document.body.focus();
            })
            .then(nextTick)
            .then(function () {
                ok(activeWindowTracker.isCurrentWindowActive());
                notOk(iframeWindow.activeWindowTracker.isCurrentWindowActive());

                $iframe.remove();
                start();
            });
    });
});

asyncTest('check switching active window (between two iframes)', function () {
    var $firstIframe       = $('<iframe>');
    var $secondIframe      = $('<iframe>');
    var firstIframeWindow  = null;
    var secondIframeWindow = null;

    $firstIframe[0].src  = window.QUnitGlobals.getResourceUrl('../../../data/active-window-tracker/active-window-tracker.html');
    $firstIframe.appendTo('body');
    $secondIframe[0].src = window.QUnitGlobals.getResourceUrl('../../../data/active-window-tracker/active-window-tracker.html');
    $secondIframe.appendTo('body');

    $secondIframe.bind('load', function () {
        firstIframeWindow  = $firstIframe[0].contentWindow;
        secondIframeWindow = $secondIframe[0].contentWindow;

        nextTick()
            .then(function () {
                firstIframeWindow.document.body.focus();
            })
            .then(nextTick)
            .then(function () {
                notOk(activeWindowTracker.isCurrentWindowActive());
                ok(firstIframeWindow.activeWindowTracker.isCurrentWindowActive());
                notOk(secondIframeWindow.activeWindowTracker.isCurrentWindowActive());

                secondIframeWindow.document.body.focus();
            })
            .then(nextTick)
            .then(function () {
                notOk(activeWindowTracker.isCurrentWindowActive());
                notOk(firstIframeWindow.activeWindowTracker.isCurrentWindowActive());
                ok(secondIframeWindow.activeWindowTracker.isCurrentWindowActive());

                $firstIframe.remove();
                $secondIframe.remove();
                start();
            });
    });
});

module('regression');

asyncTest('check that an error does not rise when trying to send serviceMessage to the removed iframe (GH-206)', function () {
    var iframeSrc  = window.QUnitGlobals.getResourceUrl('../../../data/active-window-tracker/active-window-tracker.html');
    var iframe     = document.createElement('iframe');
    var link       = document.createElement('a');
    var withError  = false;

    link.setAttribute('href', '#');
    link.innerHTML = 'Link';

    iframe.setAttribute('src', iframeSrc);

    iframe.addEventListener('load', function () {
        iframe.contentDocument.body.focus();

        nextTick()
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
    var iframeSrc    = window.QUnitGlobals.getResourceUrl('../../../data/active-window-tracker/active-window-tracker.html');
    var firstIframe  = document.createElement('iframe');
    var secondIframe = document.createElement('iframe');
    var withError    = false;

    hammerhead.on(hammerhead.EVENTS.uncaughtJsError, function () {
        withError = true;
    });

    firstIframe.setAttribute('src', iframeSrc);
    secondIframe.setAttribute('src', iframeSrc);

    secondIframe.addEventListener('load', function () {
        nextTick()
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

    document.body.appendChild(firstIframe);
    document.body.appendChild(secondIframe);
});
