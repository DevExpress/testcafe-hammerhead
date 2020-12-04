const nativeMethods = hammerhead.nativeMethods;
const browserUtils  = hammerhead.utils.browser;

if (browserUtils.isElectron) {
    const vm = window.require('vm');

    if (vm) {
        test('wrappers of native functions should return the correct string representations', function () {
            window.checkStringRepresentation(vm.createScript, nativeMethods.createScript, 'vm.createScript');

            // NOTE: DebugContext has been removed in V8 and is not available in Node.js 10+
            if (vm.runInDebugContext)
                window.checkStringRepresentation(vm.runInDebugContext, nativeMethods.runInDebugContext, 'vm.runInDebugContext');

            window.checkStringRepresentation(vm.runInContext, nativeMethods.runInContext, 'vm.runInContext');
            window.checkStringRepresentation(vm.runInNewContext, nativeMethods.runInNewContext, 'vm.runInNewContext');
            window.checkStringRepresentation(vm.runInThisContext, nativeMethods.runInThisContext, 'vm.runInThisContext');
        });
    }
}
