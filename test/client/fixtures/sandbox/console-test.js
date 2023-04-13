var nativeMethods = hammerhead.nativeMethods;

if (window.console && typeof window.console.log !== 'undefined') {
    test('must convert `log`, `warn`, `error` and `info` methods arguments to string lines (GH-1750)', function () {
        var handledConsoleMethodLines = [];

        var testCases = [
            true,
            false,
            null,
            void 0,
            42,
            'string',
            {},
            Object.create(null),
            {
                toString: function () {
                    return Object.create(null);
                },
            },
        ];

        var expectedHandledConsoleMethodLines = ['true', 'false', 'null', 'undefined', '42', 'string', '[object Object]',
            'object', 'object'];

        testCases.push(Symbol('foo'));
        expectedHandledConsoleMethodLines.push('Symbol(foo)');

        function onConsoleMethCalled (e) {
            handledConsoleMethodLines.push(e.line);
        }

        hammerhead.on(hammerhead.EVENTS.consoleMethCalled, onConsoleMethCalled);

        [
            window.console.log,
            window.console.warn,
            window.console.error,
            window.console.info,
        ]
            .forEach(function (consoleMeth) {
                handledConsoleMethodLines = [];

                testCases.forEach(function (testCase) {
                    consoleMeth(testCase);
                });

                deepEqual(handledConsoleMethodLines, expectedHandledConsoleMethodLines);
            });

        hammerhead.off(hammerhead.EVENTS.consoleMethCalled, onConsoleMethCalled);
    });

    test('consoleMethCalled event', function () {
        var log                       = [];
        var handledConsoleMethodNames = [];
        var handledConsoleMethodLines = [];

        var emptyObj        = {};
        var objWithToString = {
            toString: function () {
                return '123';
            },
        };

        var originMethods = {
            log:   nativeMethods.consoleMeths.log,
            warn:  nativeMethods.consoleMeths.warn,
            error: nativeMethods.consoleMeths.error,
            info:  nativeMethods.consoleMeths.info,
        };

        function addToLog () {
            log = log.concat(Array.prototype.slice.call(arguments));
        }

        nativeMethods.consoleMeths = {
            log:   addToLog,
            warn:  addToLog,
            error: addToLog,
            info:  addToLog,
        };

        function onConsoleMethCalled (e) {
            handledConsoleMethodNames.push(e.meth);
            handledConsoleMethodLines.push(e.line);
        }

        hammerhead.on(hammerhead.EVENTS.consoleMethCalled, onConsoleMethCalled);

        /* eslint-disable no-console */
        window.console.log(1, 2);
        window.console.warn(3, 4);
        window.console.error(5, 6);
        window.console.info(7, 8);
        window.console.log(void 0, null, emptyObj, objWithToString);
        /* eslint-enable no-console */

        deepEqual(handledConsoleMethodNames, ['log', 'warn', 'error', 'info', 'log']);
        deepEqual(log, [1, 2, 3, 4, 5, 6, 7, 8, void 0, null, emptyObj, objWithToString]);
        deepEqual(handledConsoleMethodLines, ['1 2', '3 4', '5 6', '7 8', 'undefined null [object Object] 123']);

        nativeMethods.consoleMeths = {
            log:   originMethods.log,
            warn:  originMethods.warn,
            error: originMethods.error,
            info:  originMethods.info,
        };

        hammerhead.off(hammerhead.EVENTS.consoleMethCalled, onConsoleMethCalled);
    });

    test('`consoleMethCalled event` should be raised after document.write in an iframe', function () {
        var lastLine   = '';
        var lastMeth   = '';
        var testIframe = '';

        hammerhead.on(hammerhead.EVENTS.consoleMethCalled, onConsoleMethCalled);

        function onConsoleMethCalled (e) {
            lastLine = e.line;
            lastMeth = e.meth;
        }

        return createTestIframe({ src: getSameDomainPageUrl('../../data/console-sandbox/iframe.html') })
            .then(function (iframe) {
                testIframe = iframe;

                iframe.contentWindow.console.log('msg1');

                return window.wait(50);
            })
            .then(function () {
                equal(lastLine, 'msg1');
                equal(lastMeth, 'log');

                testIframe.contentDocument.write('<div>dummy</div>');
                testIframe.contentWindow.console.info('msg2');

                return window.wait(50);
            })
            .then(function () {
                equal(lastLine, 'msg2');
                equal(lastMeth, 'info');

                hammerhead.off(hammerhead.EVENTS.consoleMethCalled, onConsoleMethCalled);
            });
    });

    test('wrappers of native functions should return the correct string representations', function () {
        window.checkStringRepresentation(window.console.log, nativeMethods.consoleMeths.log, 'console.log');
        window.checkStringRepresentation(window.console.warn, nativeMethods.consoleMeths.warn, 'console.warn');
        window.checkStringRepresentation(window.console.error, nativeMethods.consoleMeths.error, 'console.error');
        window.checkStringRepresentation(window.console.info, nativeMethods.consoleMeths.info, 'console.info');
    });

    module('regression');

    test('console message with circular structure object from iframe (GH-1546)', function () {
        return createTestIframe()
            .then(function (iframe) {
                return new Promise(function (resolve) {
                    var circularStructure = {};

                    circularStructure.prop = circularStructure;

                    iframe.contentWindow.console.log(circularStructure);

                    hammerhead.on(hammerhead.EVENTS.consoleMethCalled, resolve);
                });
            })
            .then(function (consoleEvent) {
                strictEqual(consoleEvent.line, '[object Object]');
            });
    });
}
