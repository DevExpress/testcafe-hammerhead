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

module('regression');

asyncTest('"permission denied" error is raised when an iframe with a nested iframe is reloaded (GH-727)', function () {
    var iframe = document.createElement('iframe');

    iframe.src = window.QUnitGlobals.getResourceUrl('../../data/window-storage/iframe.html');

    window.QUnitGlobals.waitForIframe(iframe)
        .then(function () {
            iframe.contentWindow.location.reload();

            window.QUnitGlobals.wait(function () {
                if (iframe.contentDocument) {
                    var nestedIframe = iframe.contentDocument.getElementById('nestedIframe');

                    if (nestedIframe && nestedIframe.contentWindow)
                        return !!nestedIframe.contentWindow['%hammerhead%'];
                }

                return false;
            })
                .then(function () {
                    var nestedIframe = iframe.contentDocument.getElementById('nestedIframe');

                    ok(nestedIframe.contentWindow['%hammerhead%']);
                    iframe.parentElement.removeChild(iframe);

                    start();
                });
        });

    document.body.appendChild(iframe);
});

asyncTest('should not raise an error for a cross-domain iframe (GH-669)', function () {
    var sameDomainIframe  = document.createElement('iframe');
    var crossDomainIframe = document.createElement('iframe');
    var form              = document.createElement('form');
    var src               = '../../data/code-instrumentation/iframe.html';

    crossDomainIframe.src = window.getCrossDomainPageUrl(src);
    crossDomainIframe.id  = 'test_unique_id_foimb9ad9';
    window.QUnitGlobals.waitForIframe(crossDomainIframe)
        .then(function () {
            sameDomainIframe.src  = window.QUnitGlobals.getResourceUrl(src);
            sameDomainIframe.id   = 'test_unique_id_dwbu9x663';
            sameDomainIframe.name = 'test_name_dwbu9x663';

            var sameDomainIframePromise = window.QUnitGlobals.waitForIframe(sameDomainIframe);

            document.body.appendChild(sameDomainIframe);

            return sameDomainIframePromise;
        })
        .then(function () {
            try {
                form.setAttribute('target', 'test_name_dwbu9x663');
            }
            catch (e) {
                ok(false, 'exception raised');
            }
            strictEqual(form.target, 'test_name_dwbu9x663');

            sameDomainIframe.parentNode.removeChild(sameDomainIframe);
            crossDomainIframe.parentNode.removeChild(crossDomainIframe);
            form.parentNode.removeChild(form);

            start();
        });
    document.body.appendChild(crossDomainIframe);
    document.body.appendChild(form);
});
