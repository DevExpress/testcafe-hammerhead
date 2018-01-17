asyncTest('cross domain messaging between windows', function () {
    expect(4);

    var iframe = document.createElement('iframe');

    iframe.src = getCrossDomainPageUrl('../data/cross-domain/target-url.html');
    document.body.appendChild(iframe);

    var messageCounter = 0;

    var onMessageHandler = function (e) {
        strictEqual(e.origin, 'http://target_url');

        messageCounter += parseInt(getProperty(e, 'data'), 10);

        if (messageCounter >= 4) {
            iframe.parentNode.removeChild(iframe);
            setProperty(window, 'onmessage', null);
            start();
        }
    };

    setProperty(window, 'onmessage', onMessageHandler);
});
