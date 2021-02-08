// NOTE: For internal usage of Listeners.
import { isIE, version as browserVersion } from '../../utils/browser';
import nativeMethods from '../native-methods';

const ELEMENT_LISTENING_EVENTS_STORAGE_PROP = 'hammerhead|element-listening-events-storage-prop';

export function getElementCtx (el) {
    return el[ELEMENT_LISTENING_EVENTS_STORAGE_PROP];
}

export function getEventCtx (el: Window | Document | HTMLElement, event: string) {
    event = isIE && browserVersion > 10 && /MSPointer/.test(event) ? event.replace('MS', '').toLowerCase() : event;

    const elementCtx = getElementCtx(el);

    return elementCtx && elementCtx[event];
}

export function isElementListening (el) {
    return !!el[ELEMENT_LISTENING_EVENTS_STORAGE_PROP];
}

export function addListeningElement (el, events) {
    const elementCtx = getElementCtx(el) || {};

    for (let i = 0; i < events.length; i++) {
        if (!elementCtx[events[i]]) {
            elementCtx[events[i]] = {
                internalHandlers:     [],
                outerHandlers:        [],
                outerHandlersWrapper: null,
                postHandlers:         [],
                wrappers:             [],
                cancelOuterHandlers:  false
            };
        }
    }

    if (!isElementListening(el)) {
        nativeMethods.objectDefineProperty(el, ELEMENT_LISTENING_EVENTS_STORAGE_PROP, {
            value:    elementCtx,
            writable: true
        });
    }
}

export function removeListeningElement (el) {
    delete el[ELEMENT_LISTENING_EVENTS_STORAGE_PROP];
}

export function addPostHandler (el, events, handler) {
    const elementCtx = getElementCtx(el);

    for (const event of events) {
        elementCtx[event].postHandlers.unshift(handler);
        nativeMethods.addEventListener.call(el, event, handler);
    }
}

export function addFirstInternalHandler (el, events, handler) {
    const elementCtx = getElementCtx(el);

    for (const event of events)
        elementCtx[event].internalHandlers.unshift(handler);
}

export function addInternalHandler (el, events, handler) {
    const elementCtx = getElementCtx(el);

    for (const event of events)
        elementCtx[event].internalHandlers.push(handler);
}

export function removeInternalHandler (el, events, handler) {
    const elementCtx = getElementCtx(el);

    for (const event of events) {
        const internalHandlers = elementCtx[event].internalHandlers;
        const handlerIndex     = internalHandlers.indexOf(handler);

        if (handlerIndex > -1)
            internalHandlers.splice(handlerIndex, 1);
    }
}

export function wrapEventListener (eventCtx, listener, wrapper, useCapture) {
    eventCtx.outerHandlers.push({
        fn:         listener,
        useCapture: useCapture || false
    });
    eventCtx.wrappers.push(wrapper);
}

export function getWrapper (eventCtx, listener, useCapture) {
    const originListeners = eventCtx.outerHandlers;
    const wrappers        = eventCtx.wrappers;
    let wrapper           = null;

    for (let i = 0; i < originListeners.length; i++) {
        const curListener = originListeners[i];

        if (curListener.fn === listener && (curListener.useCapture || false) === (useCapture || false)) {
            wrapper = wrappers[i];

            wrappers.splice(i, 1);
            originListeners.splice(i, 1);

            return wrapper;
        }
    }

    return null;
}

export function updatePostHandlers (el, eventType) {
    const elementCtx = getElementCtx(el);

    for (const handler of elementCtx[eventType].postHandlers) {
        nativeMethods.removeEventListener.call(el, eventType, handler);
        nativeMethods.addEventListener.call(el, eventType, handler);
    }
}
