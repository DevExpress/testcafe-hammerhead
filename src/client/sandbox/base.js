import EventEmitter from '../utils/event-emitter';

export default class SandboxBase {
    constructor (sandbox) {
        this.eventEmitter = new EventEmitter();
        this.sandbox      = sandbox;
        this.window       = null;
    }

    on (event, handler) {
        return this.eventEmitter.on(event, handler);
    }

    off (event, handler) {
        return this.eventEmitter.off(event, handler);
    }

    _emit (event, arg) {
        return this.eventEmitter.emit(event, arg);
    }

    attach (window, document) {
        this.window   = window;
        this.document = document;
    }
}
