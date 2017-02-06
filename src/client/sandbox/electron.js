import SandboxBase from './base';
import { processScript } from '../../processing/script';

export default class ElectronSandbox extends SandboxBase {
    static _createFnWrapper (vm, nativeFn) {
        return (...args) => {
            if (typeof args[0] === 'string')
                args[0] = processScript(args[0]);

            return nativeFn.apply(vm, args);
        };
    }

    attach (window) {
        super.attach(window);

        if (!window.require)
            return;

        var vm = window.require('vm');

        if (!vm)
            return;

        var nativeMethods = this.nativeMethods;

        if (nativeMethods.refreshElectronMeths(vm)) {
            vm.createScript      = ElectronSandbox._createFnWrapper(vm, nativeMethods.createScript);
            vm.runInDebugContext = ElectronSandbox._createFnWrapper(vm, nativeMethods.runInDebugContext);
            vm.runInContext      = ElectronSandbox._createFnWrapper(vm, nativeMethods.runInContext);
            vm.runInNewContext   = ElectronSandbox._createFnWrapper(vm, nativeMethods.runInNewContext);
            vm.runInThisContext  = ElectronSandbox._createFnWrapper(vm, nativeMethods.runInThisContext);
        }
    }
}
