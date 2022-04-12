var browserUtils = hammerhead.utils.browser;
var postMessage  = hammerhead.sandbox.event.message.postMessage;

asyncTest('UNLOAD_EVENT must be called last (GH-400)', function () {
    createTestIframe({ src: getSameDomainPageUrl('../../../data/unload/iframe.html') })
        .then(function (iframe) {
            var iframeWindow       = iframe.contentWindow;
            var unloadSandbox      = iframeWindow['%hammerhead%'].sandbox.event.unload;
            var uploadEventCounter = 0;

            unloadSandbox.on(unloadSandbox.UNLOAD_EVENT, function () {
                // NOTE: Removing an iframe on executing the beforeUnload
                // handler occasionally causes problems with SourceLab
                window.setTimeout(function () {
                    strictEqual(uploadEventCounter, 2);

                    start();
                }, 0);
            });

            iframeWindow.addEventListener('unload', function () {
                uploadEventCounter++;
            });

            iframeWindow['onunload'] = function () {
                uploadEventCounter++;
            };

            iframeWindow.location.reload();
        });
});

test('UNLOAD_EVENT should be called', function () {
    var unloadSandbox        = hammerhead.sandbox.event.unload;
    var unloadEventWasCalled = false;
    var handler              = function () {
        unloadEventWasCalled = true;
        hammerhead.off(hammerhead.EVENTS.unload, handler);
    };
    var storedSandboxDispose = hammerhead.sandbox.dispose;

    hammerhead.sandbox.dispose = function () {
    };

    hammerhead.on(hammerhead.EVENTS.unload, handler);
    unloadSandbox.emit(unloadSandbox.UNLOAD_EVENT);
    ok(unloadEventWasCalled);

    hammerhead.sandbox.dispose = storedSandboxDispose;
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

if (!browserUtils.isSafari) {
    test('Should save the returnValue as string', function () {
        return createTestIframe({ src: getCrossDomainPageUrl('../../../data/unload/iframe.html') })
            .then(function (iframe) {
                postMessage(iframe.contentWindow, [{
                    cmd:         'reload',
                    returnValue: 'Message',
                    realReturn:  'return event object',
                }, '*']);

                return waitForMessage(window);
            })
            .then(function (returnValue) {
                strictEqual(returnValue, '[object BeforeUnloadEvent]');
            });
    });
}
