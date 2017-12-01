import SandboxBase from '../base';
import nativeMethods from '../native-methods';
import createPropertyDesc from '../../utils/create-property-desc.js';
import { isFirefox, isIOS } from '../../utils/browser';

export default class UnloadSandbox extends SandboxBase {
    constructor (listeners) {
        super();

        this.BEFORE_UNLOAD_EVENT        = 'hammerhead|event|before-unload';
        this.BEFORE_BEFORE_UNLOAD_EVENT = 'hammerhead|event|before-before-unload';
        this.UNLOAD_EVENT               = 'hammerhead|event|unload';

        this.listeners = listeners;

        this.storedBeforeUnloadReturnValue = '';
        this.prevented                     = false;
        this.storedBeforeUnloadHandler     = null;

        // NOTE: the ios devices do not support beforeunload event
        // https://developer.apple.com/library/ios/documentation/AppleApplications/Reference/SafariWebContent/HandlingEvents/HandlingEvents.html#//apple_ref/doc/uid/TP40006511-SW5
        this.beforeUnloadEventName = isIOS ? 'pagehide' : 'beforeunload';
    }

    // NOTE: This handler has to be called after others.
    _emitBeforeUnloadEvent () {
        this.emit(this.BEFORE_UNLOAD_EVENT, {
            returnValue: this.storedBeforeUnloadReturnValue,
            prevented:   this.prevented
        });
    }

    _onBeforeUnloadHandler (e, originListener) {
        let eventObj = e;

        // NOTE: 'window.event' required for safari 9.0 because it calls the handler without 'e' (GH-698)
        if (!e && window.event && window.event.type === this.beforeUnloadEventName)
            eventObj = window.event;

        if (eventObj) {
            // NOTE: Overriding the returnValue property to prevent a native dialog.
            nativeMethods.objectDefineProperty.call(this.window.Object, eventObj, 'returnValue', createPropertyDesc({
                get: () => this.storedBeforeUnloadReturnValue,
                set: value => {
                    // NOTE: In all browsers, if the property is set to any value, unload is prevented. In FireFox,
                    // only if a value is set to an empty string, the unload operation is prevented.
                    this.storedBeforeUnloadReturnValue = value;

                    this.prevented = isFirefox ? value !== '' : true;
                }
            }));

            nativeMethods.objectDefineProperty.call(this.window.Object, eventObj, 'preventDefault', createPropertyDesc({
                get: () => () => {
                    this.prevented = true;

                    return true;
                },

                set: () => void 0
            }));
        }

        const res = e ? originListener(e) : originListener();

        if (res !== void 0) {
            this.storedBeforeUnloadReturnValue = res;
            this.prevented                     = true;
        }
    }

    _reattachBeforeUnloadListener () {
        // NOTE: reattach the Listener, it'll be the last in the queue.
        nativeMethods.windowRemoveEventListener.call(this.window, this.beforeUnloadEventName, this);
        nativeMethods.windowAddEventListener.call(this.window, this.beforeUnloadEventName, this);
    }

    attach (window) {
        super.attach(window);

        this.listeners.setEventListenerWrapper(window, [this.beforeUnloadEventName], (e, listener) => this._onBeforeUnloadHandler(e, listener));
        this.listeners.addInternalEventListener(window, ['unload'], () => this.emit(this.UNLOAD_EVENT));

        nativeMethods.windowAddEventListener.call(window, this.beforeUnloadEventName, this);

        this.listeners.addInternalEventListener(window, [this.beforeUnloadEventName], () => this.emit(this.BEFORE_BEFORE_UNLOAD_EVENT));
        this.listeners.on(this.listeners.EVENT_LISTENER_ATTACHED_EVENT, e => {
            if (e.el === window && e.eventType === this.beforeUnloadEventName)
                this._reattachBeforeUnloadListener();
        });
    }

    setOnBeforeUnload (window, value) {
        if (typeof value === 'function') {
            this.storedBeforeUnloadHandler = value;

            window['on' + this.beforeUnloadEventName] = e => this._onBeforeUnloadHandler(e, value);

            this._reattachBeforeUnloadListener();
        }
        else {
            this.storedBeforeUnloadHandler            = null;
            window['on' + this.beforeUnloadEventName] = null;
        }
    }

    getOnBeforeUnload () {
        return this.storedBeforeUnloadHandler;
    }

    handleEvent () {
        this._emitBeforeUnloadEvent();
    }
}
