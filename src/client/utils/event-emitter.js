import nativeMethods from '../sandbox/native-methods';

export default class EventEmitter {
    constructor () {
        this.eventsListeners = nativeMethods.objectCreate(null);
    }

    emit (evt) {
        const listeners = this.eventsListeners[evt];

        if (!listeners)
            return;

        for (let i = 0; i < listeners.length; i++) {
            try {
                listeners[i].apply(this, nativeMethods.arraySlice.apply(arguments, [1]));
            }
            catch (e) {
                // HACK: For IE: after calling document.write, the IFrameSandbox event handler throws the
                // 'Can't execute code from a freed script' exception because the document has been
                // recreated.
                if (e.message && e.message.indexOf('freed script') > -1)
                    listeners[i] = null;
                else
                    throw e;
            }
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
