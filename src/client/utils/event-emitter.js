// NOTE: We should avoid using native object prototype methods,
// since they can be overriden by the client code. (GH-245)
const arraySlice = Array.prototype.slice;

export default class EventEmitter {
    constructor () {
        this.eventsListeners = [];
    }

    emit (evt) {
        const listeners = this.eventsListeners[evt];

        if (listeners) {
            for (let i = 0; i < listeners.length; i++) {
                try {
                    if (listeners[i])
                        listeners[i].apply(this, arraySlice.apply(arguments, [1]));
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
    }

    off (evt, listener) {
        const listeners = this.eventsListeners[evt];

        if (listeners) {
            const filtered = [];

            for (const currentListener of listeners) {
                if (currentListener !== listener)
                    filtered.push(currentListener);
            }

            this.eventsListeners[evt] = filtered;
        }
    }

    on (evt, listener) {
        if (!this.eventsListeners[evt])
            this.eventsListeners[evt] = [];

        this.eventsListeners[evt].push(listener);

        return listener;
    }
}
