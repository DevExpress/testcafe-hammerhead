import SandboxBase from '../base';
import INSTRUCTION from '../../../processing/script/instruction';

export default class StoragesAccessorsInstrumentation extends SandboxBase {
    constructor (storageSandbox) {
        super();

        this.storageSandbox = storageSandbox;
    }

    attach (window) {
        super.attach(window);

        window[INSTRUCTION.getStorage] = storage => {
            if (storage === this.window.sessionStorage)
                return this.storageSandbox.sessionStorage;
            else if (storage === this.window.localStorage)
                return this.storageSandbox.localStorage;

            return storage;
        };
    }
}
