import EventEmitter from '../utils/event-emitter';
import nativeMethods from './native-methods';

export default class SandboxBase extends EventEmitter {
    constructor () {
        super();

        this.window        = null;
        this.nativeMethods = nativeMethods;
    }

    attach (window, document) {
        this.window   = window;
        this.document = document || window.document;
    }
}
