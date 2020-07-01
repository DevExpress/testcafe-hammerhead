var nativeMethods = hammerhead.nativeMethods;

asyncTest('cross domain messaging between windows', function () {
    var nativeAddEventListener    = nativeMethods.windowAddEventListener || nativeMethods.addEventListener;
    var nativeRemoveEventListener = nativeMethods.windowRemoveEventListener || nativeMethods.removeEventListener;

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
            window.onmessage = void 0;
            deepEqual(results.sort(), ['*', 'same origin']);
            start();
        }
    });
});
