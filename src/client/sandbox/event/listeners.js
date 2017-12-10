import INTERNAL_PROPS from '../../../processing/dom/internal-properties';
import nativeMethods from '../native-methods';
import EventEmitter from '../../utils/event-emitter';
import * as listeningCtx from './listening-context';
import { preventDefault, stopPropagation, DOM_EVENTS, isObjectEventListener } from '../../utils/event';
import { isWindow } from '../../utils/dom';

// NOTE: We should avoid using native object prototype methods,
// since they can be overriden by the client code. (GH-245)
const arrayMap = nativeMethods.arrayMap;

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
    constructor () {
        super();

        this.EVENT_LISTENER_ATTACHED_EVENT = 'hammerhead|event|event-listener-attached';
        this.EVENT_LISTENER_DETACHED_EVENT = 'hammerhead|event|event-listener-detached';

        this.listeningCtx = listeningCtx;

        this.addInternalEventListener    = this.listeningCtx.addInternalHandler;
        this.addFirstInternalHandler     = this.listeningCtx.addFirstInternalHandler;
        this.removeInternalEventListener = this.listeningCtx.removeInternalHandler;
    }

    static _getBodyEventListenerWrapper (documentEventCtx, listener) {
        return function (e) {
            if (documentEventCtx.cancelOuterHandlers)
                return null;

            return listener.call(this, e);
        };
    }

    static _getNativeAddEventListener (el) {
        if (isWindow(el))
            return nativeMethods.windowAddEventListener;

        return el.body !== void 0 ? nativeMethods.documentAddEventListener : nativeMethods.addEventListener;
    }

    static _getNativeRemoveEventListener (el) {
        if (isWindow(el))
            return nativeMethods.windowRemoveEventListener;

        return el.body !== void 0 ? nativeMethods.documentRemoveEventListener : nativeMethods.removeEventListener;
    }

    static _getEventListenerWrapper (eventCtx, listener) {
        return function (e) {
            const isIEServiceHandler = listener.toString() === '[object FunctionWrapper]';

            // NOTE: Ignore IE11's and Edge's service handlers (GH-379)
            if (isIEServiceHandler)
                return null;

            if (eventCtx.cancelOuterHandlers)
                return null;

            if (typeof eventCtx.outerHandlersWrapper === 'function')
                return eventCtx.outerHandlersWrapper.call(this, e, listener);

            if (isObjectEventListener(listener))
                return listener.handleEvent.call(listener, e);

            return listener.call(this, e);
        };
    }

    static _isDifferentHandler (outerHandlers, listener, useCapture) {
        for (const outerHandler of outerHandlers) {
            if (outerHandler.fn === listener && outerHandler.useCapture === useCapture)
                return false;
        }

        return true;
    }

    static _isValidEventListener (listener) {
        return typeof listener === 'function' || isObjectEventListener(listener);
    }

    _createEventHandler () {
        const listeners = this;

        return function (e) {
            const el                  = this;
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

            for (const internalHandler of internalHandlers) {
                internalHandler.call(el, e, elWindow[EVENT_SANDBOX_DISPATCH_EVENT_FLAG], preventEvent, cancelHandlers, stopEventPropagation);

                if (eventPrevented || stopPropagationCalled)
                    break;
            }
        };
    }

    _createElementOverridedMethods (el) {
        const listeners = this;

        return {
            addEventListener: function (...args) {
                const type                   = args[0];
                const listener               = args[1];
                const useCapture             = args[2];
                const eventListeningInfo     = listeningCtx.getEventCtx(el, type);
                const nativeAddEventListener = Listeners._getNativeAddEventListener(el);

                if (!eventListeningInfo || !Listeners._isValidEventListener(listener))
                    return nativeAddEventListener.apply(el, args);

                // NOTE: T233158
                const isDifferentHandler = Listeners._isDifferentHandler(eventListeningInfo.outerHandlers, listener, useCapture);

                if (!isDifferentHandler)
                    return null;

                const wrapper = Listeners._getEventListenerWrapper(eventListeningInfo, listener);

                listeningCtx.wrapEventListener(eventListeningInfo, listener, wrapper, useCapture);

                args[1] = wrapper;

                const res = nativeAddEventListener.apply(el, args);

                listeners.emit(listeners.EVENT_LISTENER_ATTACHED_EVENT, { el, listener, eventType: type });

                return res;
            },

            removeEventListener: function (...args) {
                const type                      = args[0];
                const listener                  = args[1];
                const useCapture                = args[2];
                const nativeRemoveEventListener = Listeners._getNativeRemoveEventListener(el);
                const eventCtx                  = listeningCtx.getEventCtx(el, type);

                if (!eventCtx || !Listeners._isValidEventListener(listener))
                    return nativeRemoveEventListener.apply(el, args);

                args[1] = listeningCtx.getWrapper(eventCtx, listener, useCapture);

                const res = nativeRemoveEventListener.apply(el, args);

                listeners.emit(listeners.EVENT_LISTENER_DETACHED_EVENT, { el, listener, eventType: type });

                return res;
            }
        };
    }

    _createDocumentBodyOverridedMethods (doc) {
        const listeners                 = this;
        const nativeAddEventListener    = (() => doc.body.addEventListener)();
        const nativeRemoveEventListener = (() => doc.body.removeEventListener)();

        return {
            addEventListener: function (type, listener, useCapture) {
                const docEventListeningInfo = listeningCtx.getEventCtx(doc, type);
                const eventListeningInfo    = listeningCtx.getEventCtx(this, type);

                if (!docEventListeningInfo || !Listeners._isValidEventListener(listener))
                    return nativeAddEventListener.call(this, type, listener, useCapture);

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

            removeEventListener: function (type, listener, useCapture) {
                const eventListeningInfo = listeningCtx.getEventCtx(this, type);

                if (!eventListeningInfo || !Listeners._isValidEventListener(listener))
                    return nativeRemoveEventListener.call(this, type, listener, useCapture);

                return nativeRemoveEventListener.call(this, type, listeningCtx.getWrapper(eventListeningInfo, listener, useCapture), useCapture);
            }
        };
    }

    initElementListening (el, events) {
        const nativeAddEventListener = Listeners._getNativeAddEventListener(el);

        events = events || LISTENED_EVENTS;

        this.listeningCtx.addListeningElement(el, events);

        for (const event of events)
            nativeAddEventListener.call(el, event, this._createEventHandler(), true);

        const overridedMethods = this._createElementOverridedMethods(el);

        el.addEventListener    = overridedMethods.addEventListener;
        el.removeEventListener = overridedMethods.removeEventListener;
    }

    initDocumentBodyListening (doc) {
        listeningCtx.addListeningElement(doc.body, DOM_EVENTS);

        const overridedMethods = this._createDocumentBodyOverridedMethods(doc);

        doc.body.addEventListener    = overridedMethods.addEventListener;
        doc.body.removeEventListener = overridedMethods.removeEventListener;
    }

    restartElementListening (el) {
        const nativeAddEventListener = Listeners._getNativeAddEventListener(el);
        const elementCtx             = this.listeningCtx.getElementCtx(el);

        if (elementCtx) {
            /*eslint-disable no-restricted-globals*/
            const eventNames = Object.keys(elementCtx);
            /*eslint-enable no-restricted-globals*/

            for (const eventName of eventNames)
                nativeAddEventListener.call(el, eventName, this._createEventHandler(), true);
        }
    }

    cancelElementListening (el) {
        this.listeningCtx.removeListeningElement(el);

        if (el.body)
            this.listeningCtx.removeListeningElement(el.body);
    }

    static beforeDispatchEvent (el) {
        const elWindow = el[INTERNAL_PROPS.processedContext] || window;

        elWindow[EVENT_SANDBOX_DISPATCH_EVENT_FLAG] = (elWindow[EVENT_SANDBOX_DISPATCH_EVENT_FLAG] || 0) + 1;
    }

    static afterDispatchEvent (el) {
        const elWindow = el[INTERNAL_PROPS.processedContext] || window;

        elWindow[EVENT_SANDBOX_DISPATCH_EVENT_FLAG]--;

        if (!elWindow[EVENT_SANDBOX_DISPATCH_EVENT_FLAG])
            delete elWindow[EVENT_SANDBOX_DISPATCH_EVENT_FLAG];
    }

    setEventListenerWrapper (el, events, wrapper) {
        if (!this.listeningCtx.isElementListening(el))
            this.initElementListening(el, events);

        for (const event of events) {
            const eventListeningInfo = this.listeningCtx.getEventCtx(el, event);

            eventListeningInfo.outerHandlersWrapper = wrapper;
        }
    }

    getEventListeners (el, event) {
        const eventCtx = this.listeningCtx.getEventCtx(el, event);

        if (!eventCtx)
            return null;

        return arrayMap.call(eventCtx.outerHandlers, handler => handler.fn);
    }
}
