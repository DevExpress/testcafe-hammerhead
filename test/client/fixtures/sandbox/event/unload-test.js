var INSTRUCTION  = hammerhead.get('../processing/script/instruction');
var browserUtils = hammerhead.utils.browser;

asyncTest('BEFORE_UNLOAD_EVENT must be called last (GH-400)', function () {
    createTestIframe({ src: getSameDomainPageUrl('../../../data/unload/iframe.html') })
        .then(function (iframe) {
            var iframeWindow       = iframe.contentWindow;
            var unloadSandbox      = iframeWindow['%hammerhead%'].sandbox.event.unload;
            var uploadEventCounter = 0;

            unloadSandbox.on(unloadSandbox.BEFORE_UNLOAD_EVENT, function () {
                // NOTE: Removing an iframe on executing the beforeUnload
                // handler occasionally causes problems with SourceLab
                window.setTimeout(function () {
                    strictEqual(uploadEventCounter, 2);

                    start();
                }, 0);
            });

            iframeWindow.addEventListener(unloadSandbox.beforeUnloadEventName, function () {
                uploadEventCounter++;
            });

            iframeWindow[INSTRUCTION.setProperty](iframeWindow, 'on' + unloadSandbox.beforeUnloadEventName, function () {
                uploadEventCounter++;
            });

            iframeWindow.location.reload();
        });
});

if (browserUtils.isSafari && !browserUtils.isIOS) {
    asyncTest('onbeforeunload handler must be called in iframe (GH-698)', function () {
        var iframe = document.createElement('iframe');

        iframe.setAttribute('src', getSameDomainPageUrl('../../../data/unload/iframe-with-reload-button.html'));

        var finish = function () {
            document.body.removeChild(iframe);

            start();
        };

        var timeoutId = setTimeout(function () {
            ok(false);
            finish();
        }, 5000);

        var onMessage = function () {
            ok(true);
            clearTimeout(timeoutId);
            finish();
        };

        window.addEventListener('message', onMessage);
        document.body.appendChild(iframe);
    });
}
