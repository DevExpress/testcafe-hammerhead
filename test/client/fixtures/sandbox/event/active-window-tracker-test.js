var Promise = hammerhead.get('es6-promise').Promise;

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
            })
            .then(nextTick)
            .then(function () {
                link.focus();
            })
            .catch(function () {
                withError = true;
            })
            .then(nextTick)
            .then(function () {
                document.body.removeChild(link);

                ok(!withError);

                start();
            });
    });

    document.body.appendChild(link);
    document.body.appendChild(iframe);
});
