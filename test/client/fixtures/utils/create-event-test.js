var nativeMethods = hammerhead.nativeMethods;

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
            var nativeEventObjOwnProperties = Object.getOwnPropertyNames(nativeEventObj).sort();
            var overridenEventObjOwnProperties = Object.getOwnPropertyNames(eventObj).sort();

            deepEqual(nativeEventObjOwnProperties, overridenEventObjOwnProperties);
            deepEqual(Object.keys(nativeEventObj).sort(), Object.keys(eventObj).sort());

            // NOTE: Browser Android 5.1 cannot stringify a native "message" event.
            // It fails with 'Converting circular structure to JSON' error.
            try {
                // NOTE: Browser Safari 9.0 stringify a 'data' property.
                // The overriden event has a wrapped 'data' property. So, we need to trim 'data' to perform comparison.
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
