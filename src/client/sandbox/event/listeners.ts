import INTERNAL_PROPS from '../../../processing/dom/internal-properties';
import nativeMethods from '../native-methods';
import EventEmitter from '../../utils/event-emitter';
import * as listeningCtx from './listening-context';
import { preventDefault, stopPropagation, DOM_EVENTS, isValidEventListener, callEventListener } from '../../utils/event';
import { isWindow } from '../../utils/dom';
import { isIE11 } from '../../utils/browser';

const LISTENED_EVENTS = [
    'click', 'mousedown', 'mouseup', 'dblclick', 'contextmenu', 'mousemove', 'mouseover', 'mouseout',
    'pointerdown', 'pointermove', 'pointerover', 'pointerout', 'pointerup',
    'MSPointerDown', 'MSPointerMove', 'MSPointerOver', 'MSPointerOut', 'MSPointerUp',
    'touchstart', 'touchmove', 'touchend',
    'keydown', 'keypress', 'keyup',
    'change', 'focus', 'blur', 'focusin', 'focusout'
];

const EVENT_SANDBOX_DISPATCH_EVENT_FLAG = 'hammerhead|event-sandbox-dispatch-event-flag';

export default class Listeners extends EventEmitter {
    EVENT_LISTENER_ATTACHED_EVENT: string = 'hammerhead|event|event-listener-attached';
    EVENT_LISTENER_DETACHED_EVENT: string = 'hammerhead|event|event-listener-detached';

    listeningCtx: any;

    addInternalEventListener: Function;
    addFirstInternalHandler: Function;
    removeInternalEventListener: Function;

    constructor () {
        super();

        this.listeningCtx = listeningCtx;

        this.addInternalEventListener    = this.listeningCtx.addInternalHandler;
        this.addFirstInternalHandler     = this.listeningCtx.addFirstInternalHandler;
        this.removeInternalEventListener = this.listeningCtx.removeInternalHandler;
    }

    private static _getBodyEventListenerWrapper (documentEventCtx, listener: Function) {
        return function (e: Event) {
            if (documentEventCtx.cancelOuterHandlers)
                return null;

            return listener.call(this, e);
        };
    }

    private static _getNativeAddEventListener (el: any) {
        if (isIE11) {
            if (isWindow(el))
                return nativeMethods.windowAddEventListener;

            return el.body !== void 0 ? nativeMethods.documentAddEventListener : nativeMethods.addEventListener;
        }
        else
            return nativeMethods.eventTargetAddEventListener;
    }

    private static _getNativeRemoveEventListener (el) {
        if (isIE11) {
            if (isWindow(el))
                return nativeMethods.windowRemoveEventListener;

            return el.body !== void 0 ? nativeMethods.documentRemoveEventListener : nativeMethods.removeEventListener;
        }
        else
            return nativeMethods.eventTargetRemoveEventListener;

    }

    private static _getEventListenerWrapper (eventCtx, listener) {
        return function (e: Event) {
            const isIEServiceHandler = listener.toString() === '[object FunctionWrapper]';

            // NOTE: Ignore IE11's and Edge's service handlers (GH-379)
            if (isIEServiceHandler)
                return null;

            if (eventCtx.cancelOuterHandlers)
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

        return function (e: Event) {
            const el                  = this as HTMLElement;
            //@ts-ignore
            const elWindow            = el[INTERNAL_PROPS.processedContext] || window;
            let eventPrevented        = false;
            let handlersCancelled     = false;
            let stopPropagationCalled = false;
            const eventCtx            = listeners.listeningCtx.getEventCtx(el, e.type);

            if (!eventCtx)
                return;

            const internalHandlers = eventCtx.internalHandlers;

            eventCtx.cancelOuterHandlers = false;

            const preventEvent = () => {
                eventPrevented = true;
                preventDefault(e);
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

    private _createElementOverridedMethods (el: HTMLElement|Window|Document) {
        const listeners = this;

        return {
            addEventListener: function (...args: any[]) {
                const type                   = args[0];
                const listener               = args[1];
                const useCapture             = Listeners._getUseCaptureParam(args[2]);
                const eventListeningInfo     = listeningCtx.getEventCtx(el, type);
                const nativeAddEventListener = Listeners._getNativeAddEventListener(el);

                if (!eventListeningInfo || !isValidEventListener(listener))
                    return nativeAddEventListener.apply(el, args);

                // NOTE: T233158
                const isDifferentHandler = Listeners._isDifferentHandler(eventListeningInfo.outerHandlers, listener, useCapture);

                if (!isDifferentHandler)
                    return null;

                const wrapper = Listeners._getEventListenerWrapper(eventListeningInfo, listener);

                listeningCtx.wrapEventListener(eventListeningInfo, listener, wrapper, useCapture);

                //@ts-ignore
                args[1] = wrapper;

                const res = nativeAddEventListener.apply(el, args);

                listeners.emit(listeners.EVENT_LISTENER_ATTACHED_EVENT, { el, listener, eventType: type });

                return res;
            },

            removeEventListener: function (...args: any[]) {
                const type                      = args[0];
                const listener                  = args[1];
                const useCapture                = Listeners._getUseCaptureParam(args[2]);
                const nativeRemoveEventListener = Listeners._getNativeRemoveEventListener(el);
                const eventCtx                  = listeningCtx.getEventCtx(el, type);

                if (!eventCtx || !isValidEventListener(listener))
                    return nativeRemoveEventListener.apply(el, args);

                args[1] = listeningCtx.getWrapper(eventCtx, listener, useCapture);

                const res = nativeRemoveEventListener.apply(el, args);

                listeners.emit(listeners.EVENT_LISTENER_DETACHED_EVENT, { el, listener, eventType: type });

                return res;
            }
        };
    }

    private _createDocumentBodyOverridedMethods (doc: Document) {
        const listeners                 = this;
        const nativeAddEventListener    = (() => doc.body.addEventListener)();
        const nativeRemoveEventListener = (() => doc.body.removeEventListener)();

        return {
            addEventListener: function (...args: any[]) {
                const type                  = args[0];
                const listener              = args[1];
                const useCapture            = Listeners._getUseCaptureParam(args[2]);
                const docEventListeningInfo = listeningCtx.getEventCtx(doc, type);
                const eventListeningInfo    = listeningCtx.getEventCtx(this, type);

                if (!docEventListeningInfo || !isValidEventListener(listener))
                    return nativeAddEventListener.apply(this, args);

                // NOTE: T233158
                const isDifferentHandler = Listeners._isDifferentHandler(eventListeningInfo.outerHandlers, listener, useCapture);

                if (!isDifferentHandler)
                    return null;

                const wrapper = Listeners._getBodyEventListenerWrapper(docEventListeningInfo, listener);

                listeningCtx.wrapEventListener(eventListeningInfo, listener, wrapper, useCapture);

                const res = nativeAddEventListener.call(this, type, wrapper, useCapture);

                listeners.emit(listeners.EVENT_LISTENER_ATTACHED_EVENT, {
                    el:        this,
                    eventType: type,
                    listener:  listener
                });

                return res;
            },

            removeEventListener: function (...args: any[]) {
                const type       = args[0];
                const listener   = args[1];
                const useCapture = Listeners._getUseCaptureParam(args[2]);

                const eventListeningInfo = listeningCtx.getEventCtx(this, type);

                if (!eventListeningInfo || !isValidEventListener(listener))
                    return nativeRemoveEventListener.call(this, type, listener, useCapture);

                return nativeRemoveEventListener.call(this, type, listeningCtx.getWrapper(eventListeningInfo, listener, useCapture), useCapture);
            }
        };
    }

    createEventTargetOverriddenMethods () {
        const listeners = this;

        return {
            addEventListener: function (...args: any[]) {
                const type                   = args[0];
                const listener               = args[1];
                const useCapture             = Listeners._getUseCaptureParam(args[2]);
                const eventListeningInfo     = listeningCtx.getEventCtx(this, type);
                const nativeAddEventListener = nativeMethods.eventTargetAddEventListener;

                if (!eventListeningInfo || !isValidEventListener(listener))
                    return nativeAddEventListener.apply(this, args);

                // NOTE: T233158
                const isDifferentHandler = Listeners._isDifferentHandler(eventListeningInfo.outerHandlers, listener, useCapture);

                if (!isDifferentHandler)
                    return null;

                const wrapper = Listeners._getEventListenerWrapper(eventListeningInfo, listener);

                args[1] = wrapper;

                listeningCtx.wrapEventListener(eventListeningInfo, listener, wrapper, useCapture);

                const res = nativeAddEventListener.apply(this, args);

                listeners.emit(listeners.EVENT_LISTENER_ATTACHED_EVENT, {
                    el:        this,
                    eventType: type,
                    listener:  listener
                });

                return res;
            },
            removeEventListener: function (...args: any[]) {
                const type                      = args[0];
                const listener                  = args[1];
                const useCapture                = Listeners._getUseCaptureParam(args[2]);
                const nativeRemoveEventListener = nativeMethods.eventTargetRemoveEventListener;
                const eventListeningInfo        = listeningCtx.getEventCtx(this, type);

                if (!eventListeningInfo || !isValidEventListener(listener))
                    return nativeRemoveEventListener.apply(this, args);

                const wrapper = listeningCtx.getWrapper(eventListeningInfo, listener, useCapture);

                args[1] = wrapper;

                const res = nativeRemoveEventListener.apply(this, args);

                listeners.emit(listeners.EVENT_LISTENER_DETACHED_EVENT, { el: this, listener, eventType: type });

                return res;
            }
        };
    }

    initElementListening (el: HTMLElement|Window|Document, events: string[] = LISTENED_EVENTS) {
        const nativeAddEventListener = Listeners._getNativeAddEventListener(el);

        for (const event of events) {
            if (!this.listeningCtx.getEventCtx(el, event))
                nativeAddEventListener.call(el, event, this._createEventHandler(), true);
        }

        this.listeningCtx.addListeningElement(el, events);

        if (isIE11) {
            if (!el.addEventListener || nativeMethods.isNativeCode(el.addEventListener)) {
                const overridedMethods = this._createElementOverridedMethods(el);

                el.addEventListener    = overridedMethods.addEventListener;
                el.removeEventListener = overridedMethods.removeEventListener;
            }
        }
    }

    initDocumentBodyListening (doc: Document) {
        listeningCtx.addListeningElement(doc.body, DOM_EVENTS);

        if (isIE11) {
            const overridedMethods = this._createDocumentBodyOverridedMethods(doc);

            doc.body.addEventListener    = overridedMethods.addEventListener;
            doc.body.removeEventListener = overridedMethods.removeEventListener;
        }
    }

    restartElementListening (el: HTMLElement) {
        const nativeAddEventListener = Listeners._getNativeAddEventListener(el);
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
        // @ts-ignore
        const elWindow = el[INTERNAL_PROPS.processedContext] || window;

        elWindow[EVENT_SANDBOX_DISPATCH_EVENT_FLAG] = (elWindow[EVENT_SANDBOX_DISPATCH_EVENT_FLAG] || 0) + 1;
    }

    static afterDispatchEvent (el: HTMLElement) {
        // @ts-ignore
        const elWindow = el[INTERNAL_PROPS.processedContext] || window;

        elWindow[EVENT_SANDBOX_DISPATCH_EVENT_FLAG]--;

        if (!elWindow[EVENT_SANDBOX_DISPATCH_EVENT_FLAG])
            delete elWindow[EVENT_SANDBOX_DISPATCH_EVENT_FLAG];
    }

    setEventListenerWrapper (el: Window | HTMLElement, events: string[], wrapper) {
        if (!this.listeningCtx.isElementListening(el))
            this.initElementListening(el, events);

        for (const event of events) {
            const eventListeningInfo = this.listeningCtx.getEventCtx(el, event);

            eventListeningInfo.outerHandlersWrapper = wrapper;
        }
    }

    getEventListeners (el: HTMLElement, event: string) {
        const eventCtx = this.listeningCtx.getEventCtx(el, event);

        if (!eventCtx)
            return null;

        return nativeMethods.arrayMap.call(eventCtx.outerHandlers, handler => handler.fn);
    }
}
