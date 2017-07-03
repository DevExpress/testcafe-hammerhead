var iframeSandbox = hammerhead.sandbox.iframe;

QUnit.testStart(function () {
    iframeSandbox.on(iframeSandbox.RUN_TASK_SCRIPT_EVENT, initIframeTestHandler);
    iframeSandbox.off(iframeSandbox.RUN_TASK_SCRIPT_EVENT, iframeSandbox.iframeReadyToInitHandler);
});

QUnit.testDone(function () {
    iframeSandbox.off(iframeSandbox.RUN_TASK_SCRIPT_EVENT, initIframeTestHandler);
});

module('regression');

asyncTest('"string-trim" should not use the "String.prototype.trim" method (GH-609)', function () {
    /* eslint-disable no-extend-native */
    var iframe     = document.createElement('iframe');
    var storedTrim = String.prototype.trim;

    String.prototype.trim = function () {
        return 'overrided';
    };

    iframe.id = 'test';
    window.QUnitGlobals.waitForIframe(iframe)
        .then(function () {
            strictEqual(iframe.contentWindow['%hammerhead%'].utils.trim(' text '), 'text');

            iframe.parentNode.removeChild(iframe);
            String.prototype.trim = storedTrim;

            start();
        });

    document.body.appendChild(iframe);
    /* eslint-enable no-extend-native */
});
