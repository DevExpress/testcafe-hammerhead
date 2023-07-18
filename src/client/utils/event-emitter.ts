import nativeMethods from '../sandbox/native-methods';

export default class EventEmitter {
    eventsListeners: any;

    constructor () {
        this.eventsListeners = nativeMethods.objectCreate(null);
    }

    emit (evt, ...args) {
        const listeners = this.eventsListeners[evt];

        if (!listeners)
            return;

        let index  = 0;

        while (listeners[index])
            listeners[index++].apply(this, args);
    }

    off (evt: string, listener?): void {
        const listeners = this.eventsListeners[evt];

        if (!listeners)
            return;

        this.eventsListeners[evt] = nativeMethods.arrayFilter.call(listeners, currentListener => currentListener !== listener);
    }

    on (evt: string, listener) {
        this.eventsListeners[evt] = this.eventsListeners[evt] || [];

        if (this.eventsListeners[evt].indexOf(listener) === -1)
            this.eventsListeners[evt].push(listener);

        return listener;
    }
}
