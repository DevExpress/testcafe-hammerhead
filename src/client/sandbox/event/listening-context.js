// NOTE: For internal usage of Listeners.
import { isIE, version as browserVersion } from '../../utils/browser';

const ELEMENT_LISTENING_EVENTS_STORAGE_PROP = 'hammerhead|element-listening-events-storage-prop';

export function getElementCtx (el) {
    return el[ELEMENT_LISTENING_EVENTS_STORAGE_PROP];
}

export function getEventCtx (el, event) {
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
                wrappers:             [],
                cancelOuterHandlers:  false
            };
        }
    }

    if (!isElementListening(el))
        Object.defineProperty(el, ELEMENT_LISTENING_EVENTS_STORAGE_PROP, { value: elementCtx, writable: true });
}

export function removeListeningElement (el) {
    delete el[ELEMENT_LISTENING_EVENTS_STORAGE_PROP];
}

export function addFirstInternalHandler (el, events, handler) {
    const elementCtx = getElementCtx(el);

    for (let i = 0; i < events.length; i++)
        elementCtx[events[i]].internalHandlers.unshift(handler);
}

export function addInternalHandler (el, events, handler) {
    const elementCtx = getElementCtx(el);

    for (let i = 0; i < events.length; i++)
        elementCtx[events[i]].internalHandlers.push(handler);
}

export function removeInternalHandler (el, events, handler) {
    const elementCtx = getElementCtx(el);

    for (let i = 0; i < events.length; i++) {
        const internalHandlers = elementCtx[events[i]].internalHandlers;
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
