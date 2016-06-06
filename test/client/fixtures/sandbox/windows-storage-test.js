var iframeSandbox = hammerhead.sandbox.iframe;

QUnit.testStart(function () {
    iframeSandbox.on(iframeSandbox.RUN_TASK_SCRIPT, initIframeTestHandler);
    iframeSandbox.off(iframeSandbox.RUN_TASK_SCRIPT, iframeSandbox.iframeReadyToInitHandler);
});

QUnit.testDone(function () {
    iframeSandbox.off(iframeSandbox.RUN_TASK_SCRIPT, initIframeTestHandler);
});

test('iframe.name', function () {
    var iframe = document.createElement('iframe');
    var form   = document.createElement('form');

    iframe.id   = 'test_unique_id_eWRhpRV';
    iframe.name = 'test';
    document.body.appendChild(iframe);

    form.setAttribute('target', 'non_existing_window_name');
    strictEqual(form.getAttribute('target'), '_self');

    form.setAttribute('target', 'test');
    strictEqual(form.getAttribute('target'), 'test');

    iframe.parentNode.removeChild(iframe);
});

test('window.name', function () {
    var storedWindowName = window.name;
    var form             = document.createElement('form');

    window.name = 'test';
    form.setAttribute('target', 'non_existing_window_name');
    strictEqual(form.getAttribute('target'), '_self');

    form.setAttribute('target', 'test');
    strictEqual(form.getAttribute('target'), 'test');

    window.name = storedWindowName;
});

test('keyword target', function () {
    var iframe = document.createElement('iframe');
    var form   = document.createElement('form');

    iframe.id   = 'test_unique_id_6urumqy9s';
    iframe.name = 'test';
    document.body.appendChild(iframe);

    form.setAttribute('target', '_top');
    strictEqual(form.getAttribute('target'), '_top');

    form.setAttribute('target', '_Parent');
    strictEqual(form.getAttribute('target'), '_Parent');

    iframe.parentNode.removeChild(iframe);
});

test('remove iframe from DOM', function () {
    var iframe = document.createElement('iframe');
    var form   = document.createElement('form');

    iframe.id   = 'test_unique_id_ea366my0l';
    iframe.name = 'test';
    document.body.appendChild(iframe);

    form.setAttribute('target', 'test');
    strictEqual(form.getAttribute('target'), 'test');

    iframe.parentNode.removeChild(iframe);

    form.setAttribute('target', 'test');
    strictEqual(form.getAttribute('target'), '_self');
});
