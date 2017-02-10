import SandboxBase from './base';
import { processScript } from '../../processing/script';
import * as destinationLocation from '../utils/destination-location';

export default class ElectronSandbox extends SandboxBase {
    static _createFnWrapper (vm, nativeFn) {
        return (...args) => {
            if (typeof args[0] === 'string')
                args[0] = processScript(args[0]);

            return nativeFn.apply(vm, args);
        };
    }

    static _fixModuleName (window) {
        // NOTE: Need this to avoid Webmake require
        /* eslint-disable no-eval */
        var electronRequire = eval('require');
        /* eslint-enable no-eval */

        var path        = electronRequire('path');
        var destination = destinationLocation.getParsed();

        if (destination.protocol !== 'file:')
            return;

        var pathname = window.process.platform === 'win32' && destination.pathname[0] === '/' ? destination.pathname.substr(1) : destination.pathname;

        window.__filename = path.normalize(decodeURIComponent(pathname));
        window.__dirname = path.dirname(window.__filename);

        window.module.filename = window.__filename;

        window.module.paths = window.module.paths.concat(electronRequire('module')._nodeModulePaths(window.__dirname));
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

            ElectronSandbox._fixModuleName(window);
        }
    }
}
