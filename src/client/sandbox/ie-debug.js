import SandboxBase from './base';
import { isIE } from '../utils/browser';

export default class IEDebugSandbox extends SandboxBase {
    constructor () {
        super();

        this._isDebuggerInitiator = false;
    }

    _createFuncWrapper (func) {
        if (typeof func === 'function') {
            return (fn, safeAssert) => {
                const ieDebugSandbox = this;

                return function () { // eslint-disable-line consistent-return
                    ieDebugSandbox._isDebuggerInitiator = true;

                    try {
                        const result = fn(arguments);

                        ieDebugSandbox._isDebuggerInitiator = false;

                        return result;
                    }
                    catch (e) {
                        safeAssert(e);
                    }

                    ieDebugSandbox._isDebuggerInitiator = false;
                };
            };
        }

        return func;
    }

    isDebuggerInitiator () {
        return this._isDebuggerInitiator;
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
