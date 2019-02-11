import nativeMethods from '../sandbox/native-methods';
import { isIE } from './browser';

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

        while (listeners[index]) {
            // HACK: For IE: after calling document.write, the IFrameSandbox event handler throws the
            // 'Can't execute code from a freed script' exception because the document has been
            // recreated.
            if (isIE) {
                try {
                    listeners[index].toString();
                }
                catch (e) {
                    nativeMethods.arraySplice.call(listeners, index, 1);
                    continue;
                }
            }

            listeners[index++].apply(this, args);
        }
    }

    off (evt, listener) {
        const listeners = this.eventsListeners[evt];

        if (!listeners)
            return;

        this.eventsListeners[evt] = nativeMethods.arrayFilter.call(listeners, currentListener => currentListener !== listener);
    }

    on (evt, listener) {
        this.eventsListeners[evt] = this.eventsListeners[evt] || [];

        if (this.eventsListeners[evt].indexOf(listener) === -1)
            this.eventsListeners[evt].push(listener);

        return listener;
    }
}
