var iframeSandbox = hammerhead.sandbox.iframe;

QUnit.testStart(function () {
    iframeSandbox.on(iframeSandbox.RUN_TASK_SCRIPT_EVENT, initIframeTestHandler);
    iframeSandbox.off(iframeSandbox.RUN_TASK_SCRIPT_EVENT, iframeSandbox.iframeReadyToInitHandler);
});

QUnit.testDone(function () {
    iframeSandbox.off(iframeSandbox.RUN_TASK_SCRIPT_EVENT, initIframeTestHandler);
});

module('regression');

asyncTest('should prevent navigation from the about:blank page to the relative url (GH-645)', function () {
    var iframe  = document.createElement('iframe');
    var handler = function () {
        var iframeHammerhead = iframe.contentWindow['%hammerhead%'];
        var timeoutId        = null;
        var finalize         = function () {
            if (timeoutId)
                clearTimeout(timeoutId);


            iframe.parentNode.removeChild(iframe);
            start();
        };

        iframe.removeEventListener('load', handler);
        iframe.addEventListener('load', function () {
            ok(false, 'should prevent navigation');
            finalize();
        });

        iframeHammerhead.navigateTo('/test.html');
        timeoutId = setTimeout(function () {
            ok(true);
            finalize();
        }, 5000);
    };

    iframe.id = 'test_unique_id_tizo9xnrn';
    iframe.setAttribute('src', 'about:blank');
    iframe.addEventListener('load', handler);
    document.body.appendChild(iframe);
});
