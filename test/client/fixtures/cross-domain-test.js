var nativeMethods = hammerhead.nativeMethods;
var browserUtils  = hammerhead.utils.browser;

asyncTest('cross domain messaging between windows', function () {
    var nativeAddEventListener    = browserUtils.isIE11
        ? nativeMethods.windowAddEventListener
        : nativeMethods.eventTargetAddEventListener;
    var nativeRemoveEventListener = browserUtils.isIE11
        ? nativeMethods.windowRemoveEventListener
        : nativeMethods.eventTargetRemoveEventListener;

    var iframe = document.createElement('iframe');

    iframe.src = getCrossDomainPageUrl('../data/cross-domain/target-url.html');
    document.body.appendChild(iframe);

    var results = [];

    window.onmessage = function (e) {
        strictEqual(e.origin, 'http://target_url');

        results.push(e.data.description);
    };

    var nativeMessageCounter = 0;

    nativeAddEventListener.call(window, 'message', function nativeHandler (e) {
        if (e.data.type === 'messaging test')
            ++nativeMessageCounter;

        if (nativeMessageCounter === 5) {
            nativeRemoveEventListener.call(window, 'message', nativeHandler);
            iframe.parentNode.removeChild(iframe);
            window.onmessage = null;
            deepEqual(results.sort(), ['*', 'same origin']);
            start();
        }
    });
});
