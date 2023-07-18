import SandboxBase from '../base';
import nativeMethods from '../native-methods';
import createPropertyDesc from '../../utils/create-property-desc.js';
import { isFirefox, isIOS } from '../../utils/browser';
import { overrideDescriptor } from '../../utils/overriding';
import Listeners from './listeners';
import { isFunction } from '../../utils/types';

interface EventProperties {
    storedReturnValue: string;
    prevented: boolean;
    storedHandler: any;
    nativeEventName: string;
    eventName: string;
    eventPropSetter: any;
}

export default class UnloadSandbox extends SandboxBase {
    BEFORE_UNLOAD_EVENT = 'hammerhead|event|before-unload';
    BEFORE_BEFORE_UNLOAD_EVENT = 'hammerhead|event|before-before-unload';
    UNLOAD_EVENT = 'hammerhead|event|unload';

    beforeUnloadProperties: EventProperties;
    unloadProperties: EventProperties;

    constructor (private readonly _listeners: Listeners) { //eslint-disable-line no-unused-vars
        super();

        this.beforeUnloadProperties = {
            storedReturnValue: '',
            prevented:         false,
            storedHandler:     null,
            nativeEventName:   UnloadSandbox._getBeforeUnloadEventName(),
            eventName:         this.BEFORE_UNLOAD_EVENT,
            eventPropSetter:   UnloadSandbox._getBeforeUnloadPropSetter(),
        };

        this.unloadProperties = {
            storedReturnValue: '',
            prevented:         false,
            storedHandler:     null,
            nativeEventName:   'unload',
            eventName:         this.UNLOAD_EVENT,
            eventPropSetter:   nativeMethods.winOnUnloadSetter,
        };
    }

    private static _getBeforeUnloadEventName (): string {
        // NOTE: the ios devices do not support beforeunload event
        // https://developer.apple.com/library/ios/documentation/AppleApplications/Reference/SafariWebContent/HandlingEvents/HandlingEvents.html#//apple_ref/doc/uid/TP40006511-SW5
        return isIOS ? 'pagehide' : 'beforeunload';
    }

    private static _getBeforeUnloadPropSetter (): any {
        // NOTE: the ios devices do not support beforeunload event
        // https://developer.apple.com/library/ios/documentation/AppleApplications/Reference/SafariWebContent/HandlingEvents/HandlingEvents.html#//apple_ref/doc/uid/TP40006511-SW5
        return isIOS ? nativeMethods.winOnPageHideSetter : nativeMethods.winOnBeforeUnloadSetter;
    }

    // NOTE: This handler has to be called after others.
    private _emitEvent (eventProperties: EventProperties): void {
        this.emit(eventProperties.eventName, {
            returnValue: eventProperties.storedReturnValue,
            prevented:   eventProperties.prevented,
        });
    }

    private static _prepareStoredReturnValue (returnValue: unknown): string {
        if (typeof returnValue === 'string')
            return returnValue;

        try {
            return String(returnValue);
        }
        catch {
            return '';
        }
    }

    private _createEventHandler (eventProperties: EventProperties): Function {
        return function (e, originListener): void {
            // NOTE: Overriding the returnValue property to prevent a native dialog.
            nativeMethods.objectDefineProperty(e, 'returnValue', createPropertyDesc({
                get: () => eventProperties.storedReturnValue,
                set: value => {
                    // NOTE: In all browsers, if the property is set to any value, unload is prevented. In FireFox,
                    // only if a value is set to an empty string, the unload operation is prevented.
                    eventProperties.storedReturnValue = UnloadSandbox._prepareStoredReturnValue(value);

                    eventProperties.prevented = isFirefox ? value !== '' : true;
                },
            }));

            nativeMethods.objectDefineProperty(e, 'preventDefault', createPropertyDesc({
                get: () => () => {
                    eventProperties.prevented = true;

                    return true;
                },

                set: () => void 0,
            }));

            // NOTE: need to pass `this` scope for https://github.com/DevExpress/testcafe/issues/6563
            const res = originListener.call(this, e);

            if (res !== void 0) {
                eventProperties.storedReturnValue = UnloadSandbox._prepareStoredReturnValue(res);
                eventProperties.prevented         = true;
            }

            return void 0;
        };
    }

    private _reattachListener (eventProperties: EventProperties) {
        const nativeAddEventListener    = nativeMethods.addEventListener;
        const nativeRemoveEventListener = nativeMethods.removeEventListener;

        // NOTE: reattach the Listener, it'll be the last in the queue.
        nativeRemoveEventListener.call(this.window, eventProperties.nativeEventName, this);
        nativeAddEventListener.call(this.window, eventProperties.nativeEventName, this);
    }

    private _setEventListenerWrapper (eventProperties: EventProperties) {
        this._listeners.setEventListenerWrapper(window, [eventProperties.nativeEventName], this._createEventHandler(eventProperties));
    }

    private _addEventListener (eventProperties: EventProperties) {
        const nativeAddEventListener = nativeMethods.addEventListener;

        nativeAddEventListener.call(window, eventProperties.nativeEventName, this);

        this._listeners.on(this._listeners.EVENT_LISTENER_ATTACHED_EVENT, e => {
            if (e.el === window && e.eventType === eventProperties.nativeEventName)
                this._reattachListener(eventProperties);
        });
    }

    private _overrideEventDescriptor (eventProperties: EventProperties) {
        // @ts-ignore
        overrideDescriptor(window, 'on' + eventProperties.nativeEventName, {
            getter: () => eventProperties.storedHandler,
            setter: handler => this.setOnEvent(eventProperties, window, handler),
        });
    }

    private _attachEvent (eventProperties: EventProperties) {
        this._setEventListenerWrapper(eventProperties);
        this._addEventListener(eventProperties);
        this._overrideEventDescriptor(eventProperties);
    }

    attach (window: Window & typeof globalThis) {
        super.attach(window);

        this._attachEvent(this.beforeUnloadProperties);
        this._attachEvent(this.unloadProperties);

        this._listeners.addInternalEventBeforeListener(window, [this.beforeUnloadProperties.nativeEventName], () => this.emit(this.BEFORE_BEFORE_UNLOAD_EVENT));
    }

    setOnEvent (eventProperties: EventProperties, window: Window, handler) {
        if (isFunction(handler)) {
            eventProperties.storedHandler = handler;

            eventProperties.eventPropSetter.call(window, e => this._createEventHandler(eventProperties)(e, handler));

            this._reattachListener(eventProperties);
        }
        else {
            eventProperties.storedHandler = null;

            eventProperties.eventPropSetter.call(window, null);
        }
    }

    handleEvent (e) {
        if (e.type === this.beforeUnloadProperties.nativeEventName)
            this._emitEvent(this.beforeUnloadProperties);
        else if (e.type === this.unloadProperties.nativeEventName)
            this._emitEvent(this.unloadProperties);
    }
}
