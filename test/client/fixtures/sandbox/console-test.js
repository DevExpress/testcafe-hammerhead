var nativeMethods = hammerhead.nativeMethods;

if (window.console && typeof window.console.log !== 'undefined') {
    test('consoleMethCalled event', function () {
        var log                       = [];
        var handledConsoleMethodNames = [];
        var handledConsoleMethodArgs  = [];

        var originMethods = {
            log:   nativeMethods.consoleMeths.log,
            warn:  nativeMethods.consoleMeths.warn,
            error: nativeMethods.consoleMeths.error,
            info:  nativeMethods.consoleMeths.info
        };

        function addToLog () {
            log = log.concat(Array.prototype.slice.call(arguments));
        }

        nativeMethods.consoleMeths = {
            log:   addToLog,
            warn:  addToLog,
            error: addToLog,
            info:  addToLog
        };

        hammerhead.on(hammerhead.EVENTS.consoleMethCalled, function (e) {
            handledConsoleMethodNames.push(e.meth);
            handledConsoleMethodArgs = handledConsoleMethodArgs.concat(Array.prototype.slice.call(e.args));
        });

        /* eslint-disable no-console */
        window.console.log(1, 2);
        window.console.warn(3, 4);
        window.console.error(5, 6);
        window.console.info(7, 8);
        /* eslint-enable no-console */

        deepEqual(handledConsoleMethodNames, ['log', 'warn', 'error', 'info']);
        deepEqual(log, [1, 2, 3, 4, 5, 6, 7, 8]);
        deepEqual(handledConsoleMethodArgs, [1, 2, 3, 4, 5, 6, 7, 8]);

        nativeMethods.consoleMeths = {
            log:   originMethods.log,
            warn:  originMethods.warn,
            error: originMethods.error,
            info:  originMethods.info
        };
    });

    test('consoleMethCalled event after document.write', function () {
        return createTestIframe({ src: getSameDomainPageUrl('../../data/console-sandbox/iframe.html') })
            .then(function (iframe) {
                var iframeWindow = iframe.contentWindow;

                iframeWindow.document.write('<div>dummy</div>');
                iframeWindow.console.log('consoleMsg');

                equal(iframeWindow.consoleMsg, 'consoleMsg');
            });
    });
}
