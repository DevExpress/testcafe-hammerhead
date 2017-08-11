var iframeSandbox = hammerhead.sandbox.iframe;

QUnit.testStart(function () {
    iframeSandbox.on(iframeSandbox.RUN_TASK_SCRIPT_EVENT, initIframeTestHandler);
    iframeSandbox.off(iframeSandbox.RUN_TASK_SCRIPT_EVENT, iframeSandbox.iframeReadyToInitHandler);
});

QUnit.testDone(function () {
    iframeSandbox.off(iframeSandbox.RUN_TASK_SCRIPT_EVENT, initIframeTestHandler);
});

module('regression');

test('"string-trim" should not use the "String.prototype.trim" method (GH-609)', function () {
    var storedTrim = String.prototype.trim;

    /* eslint-disable no-extend-native */
    String.prototype.trim = function () {
        return 'overrided';
    };

    return createTestIframe()
        .then(function (iframe) {
            strictEqual(iframe.contentWindow['%hammerhead%'].utils.trim(' text '), 'text');

            String.prototype.trim = storedTrim;
        });
    /* eslint-enable no-extend-native */
});
