var Promise       = hammerhead.Promise;
var nativeMethods = hammerhead.nativeMethods;
var browserUtils  = hammerhead.utils.browser;


function wait (ms) {
    return new Promise(function (resolve) {
        window.setTimeout(resolve, ms);
    });
}

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

        function onConsoleMethCalled (e) {
            handledConsoleMethodNames.push(e.meth);
            handledConsoleMethodArgs = handledConsoleMethodArgs.concat(Array.prototype.slice.call(e.args));
        }

        hammerhead.on(hammerhead.EVENTS.consoleMethCalled, onConsoleMethCalled);

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

        hammerhead.off(hammerhead.EVENTS.consoleMethCalled, onConsoleMethCalled);
    });

    if (!browserUtils.isIE && !browserUtils.isMSEdge) { //TODO: remove this with the #1326 issue fix.
        test('`consoleMethCalled event` should be raised after document.write in an iframe', function () {
            var lastMsg    = '';
            var lastMeth   = '';
            var testIframe = '';

            hammerhead.on(hammerhead.EVENTS.consoleMethCalled, onConsoleMethCalled);

            function onConsoleMethCalled (e) {
                lastMsg  = e.args[0];
                lastMeth = e.meth;
            }

            return createTestIframe({ src: getSameDomainPageUrl('../../data/console-sandbox/iframe.html') })
                .then(function (iframe) {
                    testIframe = iframe;

                    iframe.contentWindow.console.log('msg1');

                    return wait(50);
                })
                .then(function () {
                    equal(lastMsg, 'msg1');
                    equal(lastMeth, 'log');

                    testIframe.contentDocument.write('<div>dummy</div>');
                    testIframe.contentWindow.console.info('msg2');

                    return wait(50);
                })
                .then(function () {
                    equal(lastMsg, 'msg2');
                    equal(lastMeth, 'info');

                    hammerhead.off(hammerhead.EVENTS.consoleMethCalled, onConsoleMethCalled);
                });
        });
    }
}
