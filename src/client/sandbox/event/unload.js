import SandboxBase from '../base';
import nativeMethods from '../native-methods';
import createPropertyDesc from '../../utils/create-property-desc.js';
import { isMozilla, isIE9, isIE10 } from '../../utils/browser';

export default class UnloadSandbox extends SandboxBase {
    constructor (sandbox) {
        super(sandbox);

        this.BEFORE_UNLOAD_EVENT        = 'hammerhead|event|before-unload';
        this.BEFORE_BEFORE_UNLOAD_EVENT = 'hammerhead|event|before-before-unload';
        this.UNLOAD_EVENT               = 'hammerhead|event|unload';

        this.isFakeIEBeforeUnloadEvent     = false;
        this.storedBeforeUnloadReturnValue = '';
        this.prevented                     = false;
        this.storedBeforeUnloadHandler     = null;
    }

    //NOTE: this handler should be called after the others
    _emitBeforeUnloadEvent () {
        this._emit(this.BEFORE_UNLOAD_EVENT, {
            returnValue:   this.storedBeforeUnloadReturnValue,
            prevented:     this.prevented,
            isFakeIEEvent: this.isFakeIEBeforeUnloadEvent
        });

        this.isFakeIEBeforeUnloadEvent = false;
    }

    _onBeforeUnloadHandler (e, originListener) {
        //NOTE: overriding the returnValue property to prevent native dialog
        Object.defineProperty(e, 'returnValue', createPropertyDesc({
            get: () => this.storedBeforeUnloadReturnValue,
            set: value => {
                //NOTE: in all browsers if any value is set it leads to preventing unload. In Mozilla only if value
                // is an empty string it does not do it.
                this.storedBeforeUnloadReturnValue = value;

                this.prevented = isMozilla ? value !== '' : true;
            }
        }));

        Object.defineProperty(e, 'preventDefault', createPropertyDesc({
            get: () => () => this.prevented = true,
            set: () => void 0
        }));

        var res = originListener(e);

        if (typeof res !== 'undefined') {
            this.storedBeforeUnloadReturnValue = res;
            this.prevented                     = true;
        }
    }

    attach (window) {
        super.attach(window);

        var document  = window.document;
        var listeners = this.sandbox.event.listeners;

        listeners.setEventListenerWrapper(window, ['beforeunload'], () => this._onBeforeUnloadHandler);
        listeners.addInternalEventListener(window, ['unload'], () => this._emit(this.UNLOAD_EVENT));

        nativeMethods.addEventListener.call(document, 'click', e => {
            var target = e.target || e.srcElement;

            if ((isIE9 || isIE10) && target.tagName && target.tagName.toLowerCase() === 'a') {
                var href = nativeMethods.getAttribute.call(target, 'href');

                this.isFakeIEBeforeUnloadEvent = /(^javascript:)|(^mailto:)|(^tel:)|(^#)/.test(href);
            }
        });

        nativeMethods.windowAddEventListener.call(window, 'beforeunload', () => this._emitBeforeUnloadEvent());

        listeners.addInternalEventListener(window, ['beforeunload'], () =>
                this._emit(this.BEFORE_BEFORE_UNLOAD_EVENT, {
                    isFakeIEEvent: this.isFakeIEBeforeUnloadEvent
                })
        );

        listeners.on(listeners.EVENT_LISTENER_ATTACHED_EVENT, e => {
            if (e.el === window && e.eventType === 'beforeunload') {
                //NOTE: reattach listener and it'll be the last in the queue
                nativeMethods.windowRemoveEventListener.call(window, 'beforeunload', () => this._emitBeforeUnloadEvent());
                nativeMethods.windowAddEventListener.call(window, 'beforeunload', () => this._emitBeforeUnloadEvent());
            }
        });
    }

    setOnBeforeUnload (window, value) {
        if (typeof value === 'function') {

            this.storedBeforeUnloadHandler = value;

            window.onbeforeunload = e => this._onBeforeUnloadHandler(e, value);

            //NOTE: reattach listener and it'll be the last in the queue
            nativeMethods.windowRemoveEventListener.call(window, 'beforeunload', () => this._emitBeforeUnloadEvent());
            nativeMethods.windowAddEventListener.call(window, 'beforeunload', () => this._emitBeforeUnloadEvent());
        }
        else {
            this.storedBeforeUnloadHandler = null;
            window.onbeforeunload          = null;
        }
    }

    getOnBeforeUnload () {
        return this.storedBeforeUnloadHandler;
    }
}
