const ElectronSandbox = hammerhead.get('./sandbox/electron');
const overriding      = hammerhead.get('./utils/overriding');

const nativeEval = window.eval;

QUnit.testStart(function () {
    const vmMock = {
        createScript:      window.noop,
        runInContext:      window.noop,
        runInNewContext:   window.noop,
        runInThisContext:  window.noop,
        runInDebugContext: window.noop
    };

    window.windowMock = {
        require: function () {
            return vmMock;
        }
    };

    window.nativeMethodsMock = {
        refreshElectronMeths: function () {
            return true;
        }
    };

    window.eval = function () {
        return window.noop;
    };
});

QUnit.testDone(function () {
    delete window.windowMock;
    delete window.nativeMethodsMock;

    window.eval = nativeEval;
});

module('vm.runInDebugContext');

test('should not be overwritten if it doesn\'t exist', function () {
    const vmMock = window.windowMock.require('vm');

    delete vmMock.runInDebugContext;

    const electronSandbox = new ElectronSandbox();

    electronSandbox.nativeMethods = window.nativeMethodsMock;
    electronSandbox.attach(window.windowMock);

    notOk(vmMock.runInDebugContext);
});

test('should be overwritten if it exists', function () {
    const vmMock = window.windowMock.require('vm');

    const electronSandbox = new ElectronSandbox();

    electronSandbox.nativeMethods = window.nativeMethodsMock;

    ok(overriding.isNativeFunction(vmMock.runInDebugContext), 'should be native before overriding');

    electronSandbox.attach(window.windowMock);

    ok(vmMock.runInDebugContext, 'should exist');
    notOk(overriding.isNativeFunction(vmMock.runInDebugContext), 'should be overwritten');
});
