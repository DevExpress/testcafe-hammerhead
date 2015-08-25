var iframeSandbox       = Hammerhead.get('./sandboxes/iframe');
var activeWindowTracker = Hammerhead.get('./sandboxes/event/active-window-tracker');
var Promise             = Hammerhead.get('es6-promise').Promise;


function nextTick () {
    return new Promise(function (resolve) {
        setTimeout(resolve, 50);
    });
}

QUnit.testStart(function () {
    iframeSandbox.on(iframeSandbox.IFRAME_READY_TO_INIT, initIFrameTestHandler);
    iframeSandbox.off(iframeSandbox.IFRAME_READY_TO_INIT, iframeSandbox.iframeReadyToInitHandler);
});

QUnit.testDone(function () {
    iframeSandbox.off(iframeSandbox.IFRAME_READY_TO_INIT, initIFrameTestHandler);
});

asyncTest('check changing active window', function () {
    var $iFrame      = $('<iframe>');
    var iFrameWindow = null;

    $iFrame[0].src = window.QUnitGlobals.getResourceUrl('../../../data/active-window-tracker/active-window-tracker.html');
    $iFrame.appendTo('body');

    $iFrame.bind('load', function () {
        iFrameWindow = this.contentWindow;

        nextTick()
            .then(function () {
                ok(activeWindowTracker.isCurrentWindowActive());
                notOk(iFrameWindow.activeWindowTracker.isCurrentWindowActive());

                iFrameWindow.document.body.focus();
            })
            .then(nextTick)
            .then(function () {
                notOk(activeWindowTracker.isCurrentWindowActive());
                ok(iFrameWindow.activeWindowTracker.isCurrentWindowActive());

                document.body.focus();
            })
            .then(nextTick)
            .then(function () {
                ok(activeWindowTracker.isCurrentWindowActive());
                notOk(iFrameWindow.activeWindowTracker.isCurrentWindowActive());

                $iFrame.remove();
                start();
            });
    });
});

asyncTest('check switching active window (between two iFrames)', function () {
    var $firstIFrame       = $('<iframe>');
    var $secondIFrame      = $('<iframe>');
    var firstIFrameWindow  = null;
    var secondIFrameWindow = null;

    $firstIFrame[0].src  = window.QUnitGlobals.getResourceUrl('../../../data/active-window-tracker/active-window-tracker.html');
    $firstIFrame.appendTo('body');
    $secondIFrame[0].src = window.QUnitGlobals.getResourceUrl('../../../data/active-window-tracker/active-window-tracker.html');
    $secondIFrame.appendTo('body');

    $secondIFrame.bind('load', function () {
        firstIFrameWindow  = $firstIFrame[0].contentWindow;
        secondIFrameWindow = $secondIFrame[0].contentWindow;

        nextTick()
            .then(function () {
                firstIFrameWindow.document.body.focus();
            })
            .then(nextTick)
            .then(function () {
                notOk(activeWindowTracker.isCurrentWindowActive());
                ok(firstIFrameWindow.activeWindowTracker.isCurrentWindowActive());
                notOk(secondIFrameWindow.activeWindowTracker.isCurrentWindowActive());

                secondIFrameWindow.document.body.focus();
            })
            .then(nextTick)
            .then(function () {
                notOk(activeWindowTracker.isCurrentWindowActive());
                notOk(firstIFrameWindow.activeWindowTracker.isCurrentWindowActive());
                ok(secondIFrameWindow.activeWindowTracker.isCurrentWindowActive());

                $firstIFrame.remove();
                $secondIFrame.remove();
                start();
            });
    });
});
