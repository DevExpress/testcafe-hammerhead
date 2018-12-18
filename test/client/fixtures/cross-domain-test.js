var nativeMethods = hammerhead.nativeMethods;

asyncTest('cross domain messaging between windows', function () {
    var iframe = document.createElement('iframe');

    iframe.src = getCrossDomainPageUrl('../data/cross-domain/target-url.html');
    document.body.appendChild(iframe);

    var results = [];

    window.onmessage = function (e) {
        strictEqual(e.origin, 'http://target_url');

        results.push(e.data.description);
    };

    var nativeMessageCounter = 0;

    nativeMethods.windowAddEventListener.call(window, 'message', function nativeHandler (e) {
        if (e.data.type === 'messaging test')
            ++nativeMessageCounter;

        if (nativeMessageCounter === 5) {
            nativeMethods.windowRemoveEventListener.call(window, 'message', nativeHandler);
            iframe.parentNode.removeChild(iframe);
            window.onmessage = null;
            deepEqual(results.sort(), ['*', 'same origin']);
            start();
        }
    });
});
