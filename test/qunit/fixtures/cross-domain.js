var ScriptProcessor = Hammerhead.get('../processing/script');

asyncTest('cross domain messaging between windows', function () {
    expect(0);

    var iframe = document.createElement('iframe');

    iframe.src = window.getCrossDomainPageUrl('target-url.html');
    document.body.appendChild(iframe);

    var result      = 0;
    var checkResult = function () {
        if (result === 4) {
            iframe.parentNode.removeChild(iframe);
            eval(ScriptProcessor.process('window.onmessage = null;'));
            start();
        }
    };

    /* eslint-disable no-unused-vars*/
    var onMessageHandler = function (e) {
        if (e.origin.indexOf('target_url') === -1)
            return;

        if (parseInt(e.data, 10))
            result++;

        checkResult();
    };

    /* eslint-enable no-unused-vars*/

    eval(ScriptProcessor.process('window.onmessage = onMessageHandler;'));
});

