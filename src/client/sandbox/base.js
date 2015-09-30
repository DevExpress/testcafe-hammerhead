import EventEmitter from '../utils/event-emitter';

export default class SandboxBase extends EventEmitter {
    constructor (sandbox) {
        super();

        this.sandbox      = sandbox;
        this.window       = null;
    }

    attach (window, document) {
        this.window   = window;
        this.document = document;
    }
}
