var iframeSandbox = hammerhead.sandbox.iframe;
var windowStorage = hammerhead.sandbox.windowStorage;

QUnit.testStart(function () {
    iframeSandbox.on(iframeSandbox.RUN_TASK_SCRIPT_EVENT, initIframeTestHandler);
    iframeSandbox.off(iframeSandbox.RUN_TASK_SCRIPT_EVENT, iframeSandbox.iframeReadyToInitHandler);
});

QUnit.testDone(function () {
    iframeSandbox.off(iframeSandbox.RUN_TASK_SCRIPT_EVENT, initIframeTestHandler);
});

test('iframe', function () {
    var iframe = document.createElement('iframe');

    iframe.id   = 'test_unique_id_ea366my0l';
    iframe.name = 'test_iframe';
    document.body.appendChild(iframe);

    ok(windowStorage.findByName('test_iframe'));
    ok(!windowStorage.findByName('wrong_iframe_name'));

    iframe.parentNode.removeChild(iframe);

    ok(!windowStorage.findByName('test_iframe'));
});

test('top window', function () {
    var storedWindowName = window.name;

    window.name = 'test_top_window';

    ok(windowStorage.findByName('test_top_window'));
    ok(!windowStorage.findByName('non_existing_window_name'));

    window.name = storedWindowName;
});

module('regression');

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
                ok(windowStorage.findByName('test_name_dwbu9x663'));
            }
            catch (e) {
                ok(false, 'exception raised');
            }

            sameDomainIframe.parentNode.removeChild(sameDomainIframe);
            crossDomainIframe.parentNode.removeChild(crossDomainIframe);
            form.parentNode.removeChild(form);

            start();
        });
    document.body.appendChild(crossDomainIframe);
    document.body.appendChild(form);
});
