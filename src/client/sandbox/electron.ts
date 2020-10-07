import SandboxBase from './base';
import { processScript } from '../../processing/script';
import * as destinationLocation from '../utils/destination-location';
import { overrideFunction } from '../utils/overriding';

export default class ElectronSandbox extends SandboxBase {
    static _createFnWrapper (vm, nativeFn) {
        return (...args) => {
            if (typeof args[0] === 'string')
                args[0] = processScript(args[0]);

            return nativeFn.apply(vm, args);
        };
    }

    static _overrideElectronModulePaths (window) {
        // NOTE: Need this to avoid Webmake require
        // eslint-disable-next-line no-eval
        const electronRequire = eval('require');
        const path            = electronRequire('path');
        const destination     = destinationLocation.getParsed();

        /*eslint-disable no-restricted-properties*/
        if (destination.protocol !== 'file:')
            return;

        const pathname = window.process.platform === 'win32' && destination.pathname[0] === '/'
            ? destination.pathname.substr(1)
            : destination.pathname;
        /*eslint-enable no-restricted-properties*/

        window.__filename = path.normalize(decodeURIComponent(pathname));
        window.__dirname = path.dirname(window.__filename);

        window.module.filename = window.__filename;

        window.module.paths = window.module.paths.concat(electronRequire('module')._nodeModulePaths(window.__dirname));
    }

    attach (window) {
        super.attach(window);

        if (!window.require)
            return;

        const vm = window.require('vm');

        if (!vm)
            return;

        const nativeMethods = this.nativeMethods;

        if (nativeMethods.refreshElectronMeths(vm)) {
            overrideFunction(vm, 'createScript', ElectronSandbox._createFnWrapper(vm, nativeMethods.createScript));
            overrideFunction(vm, 'runInDebugContext', ElectronSandbox._createFnWrapper(vm, nativeMethods.runInDebugContext));
            overrideFunction(vm, 'runInContext', ElectronSandbox._createFnWrapper(vm, nativeMethods.runInContext));
            overrideFunction(vm, 'runInNewContext', ElectronSandbox._createFnWrapper(vm, nativeMethods.runInNewContext));
            overrideFunction(vm, 'runInThisContext', ElectronSandbox._createFnWrapper(vm, nativeMethods.runInThisContext));

            ElectronSandbox._overrideElectronModulePaths(window);
        }
    }
}
