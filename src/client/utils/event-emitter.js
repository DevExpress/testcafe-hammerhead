export default class EventEmitter {
    constructor () {
        this.eventsListeners = [];
    }

    emit (evt) {
        var listeners = this.eventsListeners[evt];

        if (listeners) {
            for (var i = 0; i < listeners.length; i++) {
                try {
                    if (listeners[i])
                        listeners[i].apply(this, Array.prototype.slice.apply(arguments, [1]));
                }
                catch (e) {
                    // Hack for IE: after document.write calling IFrameSandbox event handlers
                    // rises 'Can't execute code from a freed script' exception because document has been
                    // recreated
                    if (e.message && e.message.indexOf('freed script') > -1)
                        listeners[i] = null;
                    else
                        throw e;
                }
            }
        }
    }

    off (evt, listener) {
        var listeners = this.eventsListeners[evt];

        if (listeners)
            this.eventsListeners[evt] = listeners.filter(item => item !== listener);
    }

    on (evt, listener) {
        if (!this.eventsListeners[evt])
            this.eventsListeners[evt] = [];

        this.eventsListeners[evt].push(listener);
    }
}
