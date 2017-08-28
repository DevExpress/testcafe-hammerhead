var iframeSandbox = hammerhead.sandbox.iframe;
var nativeMethods = hammerhead.nativeMethods;

QUnit.testStart(function () {
    iframeSandbox.on(iframeSandbox.RUN_TASK_SCRIPT_EVENT, initIframeTestHandler);
    iframeSandbox.off(iframeSandbox.RUN_TASK_SCRIPT_EVENT, iframeSandbox.iframeReadyToInitHandler);
});

QUnit.testDone(function () {
    iframeSandbox.off(iframeSandbox.RUN_TASK_SCRIPT_EVENT, initIframeTestHandler);
});

function getOwnProperties (obj) {
    var props = [];

    for (var prop in obj) {
        if (obj.hasOwnProperty(prop))
            props.push(prop);
    }

    return props;
}

module('regression');

test('the "message" event object should be correctly overridden (GH-1277)', function () {
    var eventObj       = null;
    var nativeEventObj = null;

    window.addEventListener('message', function (e) {
        eventObj = e;
    });

    nativeMethods.windowAddEventListener.call(window, 'message', function (e) {
        nativeEventObj = e;
    });

    return createTestIframe()
        .then(function (iframe) {
            var iframeWindow = iframe.contentWindow;

            iframeWindow['%hammerhead%'].sandbox.event.message.postMessage(window, ['message', '*']);

            return window.QUnitGlobals.wait(function () {
                return eventObj && nativeEventObj;
            });
        })
        .then(function () {
            strictEqual(getOwnProperties(nativeEventObj).sort().join(), getOwnProperties(eventObj).sort().join());
            strictEqual(Object.keys(nativeEventObj).sort().join(), Object.keys(eventObj).sort().join());

            try {
                var nativeEventObjJson = JSON.stringify(nativeEventObj).replace(/"data":\{[^}]*}/, '"data":"message"');

                strictEqual(nativeEventObjJson, JSON.stringify(eventObj));
            }
            catch (e) {
                try {
                    var obj = {};

                    obj.x = obj;
                    JSON.stringify(obj);
                }
                catch (circularJsonErr) {
                    throws(function () {
                        JSON.stringify(nativeEventObj);
                    }, circularJsonErr);

                    throws(function () {
                        JSON.stringify(eventObj);
                    }, circularJsonErr);
                }
            }
        });
});
