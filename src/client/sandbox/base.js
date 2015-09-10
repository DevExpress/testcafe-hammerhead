import EventEmitter from '../utils/event-emitter';

export default class SandboxBase {
    constructor (sandbox) {
        this.eventEmitter = new EventEmitter();
        this.sandbox      = sandbox;
        this.window       = null;
    }

    _emit (event, arg) {
        return this.eventEmitter.emit(event, arg);
    }

    on (event, handler) {
        return this.eventEmitter.on(event, handler);
    }

    off (event, handler) {
        return this.eventEmitter.off(event, handler);
    }

    attach (window, document) {
        this.window   = window;
        this.document = document;
    }
}
