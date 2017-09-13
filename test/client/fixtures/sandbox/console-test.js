var consoleSandbox = hammerhead.sandbox.console;

function argsToArray (args) {
    var res = [];
    var i   = 0;

    while (i < args.length) {
        res.push(args[i]);
        i++;
    }

    return res;
}

test('consoleMethCalled event', function () {
    var log           = '';
    var handledEvents = [];
    var logFromEvents = '';

    /* eslint-disable no-console */
    var originMethods = {
        log:   console.log,
        warn:  console.warn,
        error: console.error,
        info:  console.info
    };

    function addToLog (meth, args) {
        log += argsToArray(args).join('');

        originMethods[meth].apply(console, args);
    }

    window.console = {
        log: function () {
            addToLog('log', arguments);
        },

        warn: function () {
            addToLog('warn', arguments);
        },

        error: function () {
            addToLog('error', arguments);
        },

        info: function () {
            addToLog('info', arguments);
        }
    };

    consoleSandbox.on(consoleSandbox.CONSOLE_METH_CALLED, function (e) {
        handledEvents.push(e.meth);
        logFromEvents += argsToArray(e.args).join('');
    });

    window.console.log('1', '2');
    window.console.warn('3', '4');
    window.console.error('5', '6');
    window.console.info('7', '8');
    /* eslint-enable no-console */

    deepEqual(handledEvents, ['log', 'warn', 'error', 'info']);
    deepEqual(log, '12345678');
    deepEqual(logFromEvents, '12345678');
});
