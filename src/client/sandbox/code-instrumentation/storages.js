import SandboxBase from '../base';
import INSTRUCTION from '../../../processing/script/instruction';
import nativeMethods from '../native-methods';

export default class StoragesAccessorsInstrumentation extends SandboxBase {
    constructor (storageSandbox) {
        super();

        this.storageSandbox = storageSandbox;
    }

    attach (window) {
        super.attach(window);

        // NOTE: In Google Chrome, iframes whose src contains html code raise the 'load' event twice.
        // So, we need to define code instrumentation functions as 'configurable' so that they can be redefined.
        nativeMethods.objectDefineProperty.call(window.Object, window, INSTRUCTION.getStorage, {
            value: storage => {
                if (storage === this.window.sessionStorage) {
                    this.storageSandbox.sessionStorage.setContext(window);

                    return this.storageSandbox.sessionStorage;
                }
                else if (storage === this.window.localStorage) {
                    this.storageSandbox.localStorage.setContext(window);

                    return this.storageSandbox.localStorage;
                }

                return storage;
            },

            configurable: true
        });
    }
}
