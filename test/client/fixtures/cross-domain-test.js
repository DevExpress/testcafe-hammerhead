asyncTest('cross domain messaging between windows', function () {
    expect(5);

    var iframe = document.createElement('iframe');

    iframe.src = getCrossDomainPageUrl('../data/cross-domain/target-url.html');
    document.body.appendChild(iframe);

    var messageCounter = 0;

    window.onmessage = function (e) {
        strictEqual(e.origin, 'http://target_url');

        var message = e.data.message || e.data;

        messageCounter += parseInt(message, 10);

        if (messageCounter >= 5) {
            iframe.parentNode.removeChild(iframe);
            window.onmessage = null;
            start();
        }
    };
});
