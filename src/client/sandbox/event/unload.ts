import SandboxBase from '../base';
import nativeMethods from '../native-methods';
import createPropertyDesc from '../../utils/create-property-desc.js';
import { isFirefox, isIOS } from '../../utils/browser';
import { overrideDescriptor } from '../../utils/property-overriding';

export default class UnloadSandbox extends SandboxBase {
    BEFORE_UNLOAD_EVENT: string = 'hammerhead|event|before-unload';
    BEFORE_BEFORE_UNLOAD_EVENT: string = 'hammerhead|event|before-before-unload';
    UNLOAD_EVENT: string = 'hammerhead|event|unload';

    listeners: any;

    storedBeforeUnloadReturnValue: string;
    prevented: boolean;
    storedBeforeUnloadHandler: any;
    beforeUnloadEventName: string;

    constructor (listeners) {
        super();

        this.listeners = listeners;

        this.storedBeforeUnloadReturnValue = '';
        this.prevented                     = false;
        this.storedBeforeUnloadHandler     = null;

        // NOTE: the ios devices do not support beforeunload event
        // https://developer.apple.com/library/ios/documentation/AppleApplications/Reference/SafariWebContent/HandlingEvents/HandlingEvents.html#//apple_ref/doc/uid/TP40006511-SW5
        this.beforeUnloadEventName = UnloadSandbox._getBeforeUnloadEventName();
    }

    static _getBeforeUnloadEventName (): string {
        // NOTE: the ios devices do not support beforeunload event
        // https://developer.apple.com/library/ios/documentation/AppleApplications/Reference/SafariWebContent/HandlingEvents/HandlingEvents.html#//apple_ref/doc/uid/TP40006511-SW5
        return isIOS ? 'pagehide' : 'beforeunload';
    }

    // NOTE: This handler has to be called after others.
    _emitBeforeUnloadEvent (): void {
        this.emit(this.BEFORE_UNLOAD_EVENT, {
            returnValue: this.storedBeforeUnloadReturnValue,
            prevented:   this.prevented
        });
    }

    _onBeforeUnloadHandler (e, originListener): void {
        // NOTE: Overriding the returnValue property to prevent a native dialog.
        nativeMethods.objectDefineProperty(e, 'returnValue', createPropertyDesc({
            get: () => this.storedBeforeUnloadReturnValue,
            set: value => {
                // NOTE: In all browsers, if the property is set to any value, unload is prevented. In FireFox,
                // only if a value is set to an empty string, the unload operation is prevented.
                this.storedBeforeUnloadReturnValue = value;

                this.prevented = isFirefox ? value !== '' : true;
            }
        }));

        nativeMethods.objectDefineProperty(e, 'preventDefault', createPropertyDesc({
            get: () => () => {
                this.prevented = true;

                return true;
            },

            set: () => void 0
        }));

        const res = originListener(e);

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

    attach (window: Window) {
        super.attach(window);

        this.listeners.setEventListenerWrapper(window, [this.beforeUnloadEventName], (e, listener) => this._onBeforeUnloadHandler(e, listener));
        this.listeners.addInternalEventListener(window, ['unload'], () => this.emit(this.UNLOAD_EVENT));

        nativeMethods.windowAddEventListener.call(window, this.beforeUnloadEventName, this);

        this.listeners.addInternalEventListener(window, [this.beforeUnloadEventName], () => this.emit(this.BEFORE_BEFORE_UNLOAD_EVENT));
        this.listeners.on(this.listeners.EVENT_LISTENER_ATTACHED_EVENT, e => {
            if (e.el === window && e.eventType === this.beforeUnloadEventName)
                this._reattachBeforeUnloadListener();
        });

        // @ts-ignore
        const eventPropsOwner = nativeMethods.isEventPropsLocatedInProto ? window.Window.prototype : window;

        overrideDescriptor(eventPropsOwner, 'on' + this.beforeUnloadEventName, {
            getter: () => this.storedBeforeUnloadHandler,
            setter: handler => this.setOnBeforeUnload(window, handler)
        });
    }

    setOnBeforeUnload (window: Window, handler) {
        const beforeUnloadEventPropSetter = isIOS
            ? nativeMethods.winOnPageHideSetter
            : nativeMethods.winOnBeforeUnloadSetter;

        if (typeof handler === 'function') {
            this.storedBeforeUnloadHandler = handler;

            beforeUnloadEventPropSetter.call(window, e => this._onBeforeUnloadHandler(e, handler));

            this._reattachBeforeUnloadListener();
        }
        else {
            this.storedBeforeUnloadHandler = null;

            beforeUnloadEventPropSetter.call(window, null);
        }
    }

    handleEvent () {
        this._emitBeforeUnloadEvent();
    }
}
