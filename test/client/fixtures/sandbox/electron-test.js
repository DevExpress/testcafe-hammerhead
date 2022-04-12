var ElectronSandbox = hammerhead.sandboxes.ElectronSandbox;
var overriding      = hammerhead.utils.overriding;

var nativeEval = window.eval;

QUnit.testStart(function () {
    window.vmMock = {
        createScript:      window.noop,
        runInContext:      window.noop,
        runInNewContext:   window.noop,
        runInThisContext:  window.noop,
        runInDebugContext: window.noop,
    };

    window.windowMock = {
        require: function () {
            return window.vmMock;
        },
    };

    window.nativeMethodsMock = {
        refreshElectronMeths: function () {
            return true;
        },
    };

    window.eval = function () {
        return window.noop;
    };
});

QUnit.testDone(function () {
    delete window.vmMock;
    delete window.windowMock;
    delete window.nativeMethodsMock;

    window.eval = nativeEval;
});

module('vm.runInDebugContext');

test('should not be overwritten if it doesn\'t exist', function () {
    delete window.vmMock.runInDebugContext;

    var electronSandbox = new ElectronSandbox();

    electronSandbox.nativeMethods = window.nativeMethodsMock;
    electronSandbox.attach(window.windowMock);

    notOk(window.vmMock.runInDebugContext);
});

test('should be overwritten if it exists', function () {
    var electronSandbox = new ElectronSandbox();

    electronSandbox.nativeMethods = window.nativeMethodsMock;

    ok(overriding.isNativeFunction(window.vmMock.runInDebugContext), 'should be native before overriding');

    electronSandbox.attach(window.windowMock);

    ok(window.vmMock.runInDebugContext, 'should exist');
    notOk(overriding.isNativeFunction(window.vmMock.runInDebugContext), 'should be overwritten');
});
