var INSTRUCTION = hammerhead.get('../processing/script/instruction');

asyncTest('BEFORE_UNLOAD_EVENT must be called last (GH-400)', function () {
    var iframe = document.createElement('iframe');

    iframe.src = window.QUnitGlobals.getResourceUrl('../../../data/unload/iframe.html');

    window.QUnitGlobals.waitForIframe(iframe)
        .then(function () {
            var window = iframe.contentWindow;
            var unloadSandbox = window['%hammerhead%'].sandbox.event.unload;
            var result = '';

            unloadSandbox.on(unloadSandbox.BEFORE_UNLOAD_EVENT, function () {
                strictEqual(result, 'handler1 handler2');

                start();
            });

            window.addEventListener(unloadSandbox.beforeUnloadEventName, function () {
                result += 'handler1';
            });

            window[INSTRUCTION.setProperty](window, 'on' + unloadSandbox.beforeUnloadEventName, function () {
                result += ' handler2';
            });

            window.location.reload();
        });

    document.body.appendChild(iframe);
});
