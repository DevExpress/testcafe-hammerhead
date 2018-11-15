import SandboxBase from './base';
import { isIE } from '../utils/browser';

export default class DebugSandbox extends SandboxBase {
    constructor () {
        super();

        this._debuggerIsInitiator = false;
    }

    _createFuncWrapper (func) {
        if (typeof func === 'function') {
            return (fn, safeAssert) => {
                const debugSandbox = this;

                return function () { // eslint-disable-line consistent-return
                    debugSandbox._debuggerIsInitiator = true;

                    try {
                        const result = fn(arguments);

                        debugSandbox._debuggerIsInitiator = false;

                        return result;
                    }
                    catch (e) {
                        safeAssert(e);
                    }

                    debugSandbox._debuggerIsInitiator = false;
                };
            };
        }

        return func;
    }

    debuggerIsInitiator () {
        return this._debuggerIsInitiator;
    }

    attach (window) {
        if (!isIE)
            return;

        const descriptor = this.nativeMethods.objectGetOwnPropertyDescriptor(window, '__BROWSERTOOLS_CONSOLE_SAFEFUNC');
        let wrapper      = void 0;

        if (!descriptor || descriptor.value) { // eslint-disable-line no-restricted-properties
            if (descriptor)
                wrapper = this._createFuncWrapper(descriptor.value); // eslint-disable-line no-restricted-properties

            this.nativeMethods.objectDefineProperty(window, '__BROWSERTOOLS_CONSOLE_SAFEFUNC', {
                set: fn => {
                    wrapper = this._createFuncWrapper(fn);
                },
                get: () => wrapper
            });
        }
    }
}
