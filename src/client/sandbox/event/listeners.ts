import INTERNAL_PROPS from '../../../processing/dom/internal-properties';
import nativeMethods from '../native-methods';
import EventEmitter from '../../utils/event-emitter';
import * as listeningCtx from './listening-context';

import {
    preventDefault,
    stopPropagation,
    DOM_EVENTS,
    isValidEventListener,
    callEventListener,
} from '../../utils/event';

import { isWindow } from '../../utils/dom';
import { isIE11 } from '../../utils/browser';

import {
    isNativeFunction,
    overrideFunction,
    overrideStringRepresentation,
} from '../../utils/overriding';

const LISTENED_EVENTS = [
    'click', 'mousedown', 'mouseup', 'dblclick', 'contextmenu', 'mousemove', 'mouseover', 'mouseout',
    'pointerdown', 'pointermove', 'pointerover', 'pointerout', 'pointerup',
    'MSPointerDown', 'MSPointerMove', 'MSPointerOver', 'MSPointerOut', 'MSPointerUp',
    'touchstart', 'touchmove', 'touchend',
    'keydown', 'keypress', 'keyup',
    'change', 'focus', 'blur', 'focusin', 'focusout',
];

const EVENT_SANDBOX_DISPATCH_EVENT_FLAG = 'hammerhead|event-sandbox-dispatch-event-flag';

export default class Listeners extends EventEmitter {
    EVENT_LISTENER_ATTACHED_EVENT = 'hammerhead|event|event-listener-attached';
    EVENT_LISTENER_DETACHED_EVENT = 'hammerhead|event|event-listener-detached';

    listeningCtx: any;

    addInternalEventBeforeListener: Function;
    addFirstInternalEventBeforeListener: Function;
    addInternalEventAfterListener: Function;
    removeInternalEventBeforeListener: Function;

    constructor () {
        super();

        this.listeningCtx = listeningCtx;

        this.addInternalEventBeforeListener      = this.listeningCtx.addInternalBeforeHandler;
        this.addFirstInternalEventBeforeListener = this.listeningCtx.addFirstInternalBeforeHandler;
        this.addInternalEventAfterListener       = this.listeningCtx.addInternalAfterHandler;
        this.removeInternalEventBeforeListener   = this.listeningCtx.removeInternalBeforeHandler;
    }

    static getNativeAddEventListener (el: any) {
        if (isIE11) {
            if (isWindow(el))
                return nativeMethods.windowAddEventListener;

            return el.body !== void 0 ? nativeMethods.documentAddEventListener : nativeMethods.addEventListener;
        }

        return nativeMethods.addEventListener;
    }

    static getNativeRemoveEventListener (el) {
        if (isIE11) {
            if (isWindow(el))
                return nativeMethods.windowRemoveEventListener;

            return el.body !== void 0 ? nativeMethods.documentRemoveEventListener : nativeMethods.removeEventListener;
        }

        return nativeMethods.removeEventListener;
    }

    private static _isIEServiceHandler (listener): boolean {
        return listener.toString() === '[object FunctionWrapper]';
    }

    private static _getEventListenerWrapper (eventCtx, listener) {
        return function (this: EventTarget, e: Event) {
            // NOTE: Ignore IE11's and Edge's service handlers (GH-379)
            if (Listeners._isIEServiceHandler(listener) || eventCtx.cancelOuterHandlers)
                return null;

            if (typeof eventCtx.outerHandlersWrapper === 'function')
                return eventCtx.outerHandlersWrapper.call(this, e, listener);

            return callEventListener(this, listener, e);
        };
    }

    private static _isDifferentHandler (outerHandlers, listener, useCapture: boolean): boolean {
        for (const outerHandler of outerHandlers) {
            if (outerHandler.fn === listener && outerHandler.useCapture === useCapture)
                return false;
        }

        return true;
    }

    private static _getUseCaptureParam (optionalParam: boolean | any) {
        if (optionalParam && typeof optionalParam === 'boolean')
            return optionalParam;
        else if (optionalParam && typeof optionalParam === 'object')
            return !!optionalParam.capture;

        return false;
    }

    private _createEventHandler (): Function {
        const listeners = this;

        return function (this: EventTarget, e: Event) {
            const el                  = this as HTMLElement;
            const elWindow            = el[INTERNAL_PROPS.processedContext] || window;
            let eventPrevented        = false;
            let handlersCancelled     = false;
            let stopPropagationCalled = false;
            const eventCtx            = listeners.listeningCtx.getEventCtx(el, e.type);

            if (!eventCtx)
                return;

            const internalHandlers = eventCtx.internalBeforeHandlers;

            eventCtx.cancelOuterHandlers = false;

            const preventEvent = (allowBubbling?: boolean) => {
                eventPrevented = true;
                preventDefault(e, allowBubbling);
            };

            const cancelHandlers = () => {
                if (!handlersCancelled)
                    eventCtx.cancelOuterHandlers = true;

                handlersCancelled = true;
            };

            const stopEventPropagation = () => {
                stopPropagationCalled = true;

                stopPropagation(e);
            };

            // NOTE: Some listeners can remove itself when executed, so we need to copy the list of listeners here
            const currentInternalHandlers = nativeMethods.arraySlice.call(internalHandlers);

            for (const internalHandler of currentInternalHandlers) {
                internalHandler.call(el, e, elWindow[EVENT_SANDBOX_DISPATCH_EVENT_FLAG], preventEvent, cancelHandlers, stopEventPropagation);

                if (eventPrevented || stopPropagationCalled)
                    break;
            }
        };
    }

    createOverriddenMethods () {
        const listeners = this;

        return {
            addEventListener: function (this: Window | HTMLElement | Document, ...args: any[]) {
                const [eventType, listener]  = args;
                const el                     = this;
                const useCapture             = Listeners._getUseCaptureParam(args[2]);
                const eventCtx               = listeningCtx.getEventCtx(el, eventType);
                const nativeAddEventListener = Listeners.getNativeAddEventListener(el);

                if (!eventCtx || !isValidEventListener(listener))
                    return nativeAddEventListener.apply(el, args);

                // NOTE: T233158
                const isDifferentHandler = Listeners._isDifferentHandler(eventCtx.outerHandlers, listener, useCapture);

                if (!isDifferentHandler)
                    return null;

                const wrapper = Listeners._getEventListenerWrapper(eventCtx, listener);

                args[1] = wrapper;

                listeningCtx.wrapEventListener(eventCtx, listener, wrapper, useCapture);

                const res = nativeAddEventListener.apply(el, args);

                listeningCtx.updateInternalAfterHandlers(el, eventType);

                listeners.emit(listeners.EVENT_LISTENER_ATTACHED_EVENT, { el, eventType, listener });

                return res;
            },
            removeEventListener: function (this: Window | HTMLElement | Document, ...args: any[]) {
                const [eventType, listener]     = args;
                const el                        = this;
                const useCapture                = Listeners._getUseCaptureParam(args[2]);
                const nativeRemoveEventListener = Listeners.getNativeRemoveEventListener(el);
                const eventCtx                  = listeningCtx.getEventCtx(el, eventType);

                if (!eventCtx || !isValidEventListener(listener))
                    return nativeRemoveEventListener.apply(el, args);

                const wrapper = listeningCtx.getWrapper(eventCtx, listener, useCapture);

                args[1] = wrapper;

                const res = nativeRemoveEventListener.apply(el, args);

                listeners.emit(listeners.EVENT_LISTENER_DETACHED_EVENT, { el, listener, eventType });

                return res;
            },
        };
    }

    initElementListening (el: HTMLElement|Window|Document, events: string[] = LISTENED_EVENTS) {
        const nativeAddEventListener = Listeners.getNativeAddEventListener(el);

        for (const event of events) {
            if (!this.listeningCtx.getEventCtx(el, event))
                nativeAddEventListener.call(el, event, this._createEventHandler(), true);
        }

        this.listeningCtx.addListeningElement(el, events);

        if (isIE11) {
            const overriddenMethods = this.createOverriddenMethods();

            if (!el.addEventListener) {
                // NOTE: we cannot use 'overrideFunction' here since the functions may not exist
                el.addEventListener    = overriddenMethods.addEventListener;
                el.removeEventListener = overriddenMethods.removeEventListener;

                overrideStringRepresentation(el.addEventListener, nativeMethods.addEventListener);
                overrideStringRepresentation(el.removeEventListener, nativeMethods.removeEventListener);
            }
            else if (isNativeFunction(el.addEventListener)) {
                overrideFunction(el, 'addEventListener', overriddenMethods.addEventListener);
                overrideFunction(el, 'removeEventListener', overriddenMethods.removeEventListener);
            }
        }
    }

    initDocumentBodyListening (doc: Document) {
        listeningCtx.addListeningElement(doc.body, DOM_EVENTS);

        if (isIE11) {
            const overriddenMethods = this.createOverriddenMethods();

            overrideFunction(doc.body, 'addEventListener', overriddenMethods.addEventListener);
            overrideFunction(doc.body, 'removeEventListener', overriddenMethods.removeEventListener);
        }
    }

    restartElementListening (el: HTMLElement) {
        const nativeAddEventListener = Listeners.getNativeAddEventListener(el);
        const elementCtx             = this.listeningCtx.getElementCtx(el);

        if (elementCtx) {
            const eventNames = nativeMethods.objectKeys(elementCtx);

            for (const eventName of eventNames)
                nativeAddEventListener.call(el, eventName, this._createEventHandler(), true);
        }
    }

    cancelElementListening (el: any) {
        this.listeningCtx.removeListeningElement(el);

        if (el.body)
            this.listeningCtx.removeListeningElement(el.body);
    }

    static beforeDispatchEvent (el: HTMLElement) {
        const elWindow = el[INTERNAL_PROPS.processedContext] || window;

        elWindow[EVENT_SANDBOX_DISPATCH_EVENT_FLAG] = (elWindow[EVENT_SANDBOX_DISPATCH_EVENT_FLAG] || 0) + 1;
    }

    static afterDispatchEvent (el: HTMLElement) {
        const elWindow = el[INTERNAL_PROPS.processedContext] || window;

        elWindow[EVENT_SANDBOX_DISPATCH_EVENT_FLAG]--;

        if (!elWindow[EVENT_SANDBOX_DISPATCH_EVENT_FLAG])
            delete elWindow[EVENT_SANDBOX_DISPATCH_EVENT_FLAG];
    }

    setEventListenerWrapper (el: Window | HTMLElement, events: string[], wrapper) {
        if (!this.listeningCtx.isElementListening(el))
            this.initElementListening(el, events);

        for (const event of events) {
            const eventCtx = this.listeningCtx.getEventCtx(el, event);

            eventCtx.outerHandlersWrapper = wrapper;
        }
    }

    getEventListeners (el: HTMLElement, event: string) {
        const eventCtx = this.listeningCtx.getEventCtx(el, event);

        if (!eventCtx)
            return null;

        return nativeMethods.arrayMap.call(eventCtx.outerHandlers, handler => handler.fn);
    }
}
