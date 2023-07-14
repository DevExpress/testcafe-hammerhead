// NOTE: For internal usage of Listeners.
import nativeMethods from '../native-methods';

const ELEMENT_LISTENING_EVENTS_STORAGE_PROP = 'hammerhead|element-listening-events-storage-prop';

export function getElementCtx (el) {
    return el[ELEMENT_LISTENING_EVENTS_STORAGE_PROP];
}

export function getEventCtx (el: Window | Document | HTMLElement, event: string) {
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
                internalBeforeHandlers: [],
                internalAfterHandlers:  [],
                outerHandlers:          [],
                outerHandlersWrapper:   null,
                wrappers:               [],
                cancelOuterHandlers:    false,
            };
        }
    }

    if (!isElementListening(el)) {
        nativeMethods.objectDefineProperty(el, ELEMENT_LISTENING_EVENTS_STORAGE_PROP, {
            value:    elementCtx,
            writable: true,
        });
    }
}

export function removeListeningElement (el) {
    delete el[ELEMENT_LISTENING_EVENTS_STORAGE_PROP];
}

export function addInternalAfterHandler (el, events, handler) {
    const elementCtx = getElementCtx(el);

    for (const event of events) {
        elementCtx[event].internalAfterHandlers.unshift(handler);
        nativeMethods.addEventListener.call(el, event, handler);
    }
}

export function addFirstInternalBeforeHandler (el, events, handler) {
    const elementCtx = getElementCtx(el);

    for (const event of events)
        elementCtx[event].internalBeforeHandlers.unshift(handler);
}

export function addInternalBeforeHandler (el, events, handler) {
    const elementCtx = getElementCtx(el);

    for (const event of events)
        elementCtx[event].internalBeforeHandlers.push(handler);
}

export function removeInternalBeforeHandler (el, events, handler) {
    const elementCtx = getElementCtx(el);

    for (const event of events) {
        const internalBeforeHandlers = elementCtx[event].internalBeforeHandlers;
        const handlerIndex     = internalBeforeHandlers.indexOf(handler);

        if (handlerIndex > -1)
            internalBeforeHandlers.splice(handlerIndex, 1);
    }
}

export function wrapEventListener (eventCtx, listener, wrapper, useCapture) {
    eventCtx.outerHandlers.push({
        fn:         listener,
        useCapture: useCapture || false,
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

export function updateInternalAfterHandlers (el, eventType) {
    const elementCtx = getElementCtx(el);

    for (const handler of elementCtx[eventType].internalAfterHandlers) {
        nativeMethods.removeEventListener.call(el, eventType, handler);
        nativeMethods.addEventListener.call(el, eventType, handler);
    }
}
