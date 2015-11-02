var processScript = hammerhead.get('../processing/script').processScript;

asyncTest('cross domain messaging between windows', function () {
    expect(4);

    var iframe = document.createElement('iframe');

    iframe.src = window.getCrossDomainPageUrl('../data/cross-domain/target-url.html');
    document.body.appendChild(iframe);

    var messageCounter = 0;

    /* eslint-disable no-unused-vars*/
    var onMessageHandler = function (e) {
        strictEqual(e.origin, 'http://target_url');

        messageCounter += parseInt(e.data, 10);

        if (messageCounter >= 4) {
            iframe.parentNode.removeChild(iframe);
            eval(processScript('window.onmessage = null;', true, false));
            start();
        }
    };

    /* eslint-enable no-unused-vars*/

    eval(processScript('window.onmessage = onMessageHandler;', true, false));
});

