var scriptProcessor = hammerhead.get('../processing/script');

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
            eval(scriptProcessor.process('window.onmessage = null;'));
            start();
        }
    };

    /* eslint-enable no-unused-vars*/

    eval(scriptProcessor.process('window.onmessage = onMessageHandler;'));
});

