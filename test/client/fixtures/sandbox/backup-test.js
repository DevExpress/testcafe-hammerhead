var backup = hammerhead.get('./sandbox/backup');

var iframeSandbox = hammerhead.sandbox.iframe;
var browserUtils  = hammerhead.utils.browser;

QUnit.testStart(function () {
    iframeSandbox.on(iframeSandbox.RUN_TASK_SCRIPT, initIframeTestHandler);
    iframeSandbox.off(iframeSandbox.RUN_TASK_SCRIPT, iframeSandbox.iframeReadyToInitHandler);
});

QUnit.testDone(function () {
    iframeSandbox.off(iframeSandbox.RUN_TASK_SCRIPT, initIframeTestHandler);
});

if (browserUtils.isIE) {
    test('backup.get should return the latest sandbox backup', function () {
        var iframe = document.createElement('iframe');

        iframe.id = 'test';
        document.body.appendChild(iframe);

        iframe.contentDocument.open();
        iframe.contentDocument.write('Hello!');
        iframe.contentDocument.close();

        strictEqual(backup.get(iframe.contentWindow), iframe.contentWindow['%hammerhead%'].sandbox);
    });
}
