// for internal using Listeners
import * as Browser from '../../util/browser';

const ELEMENT_LISTENING_EVENTS_STORAGE_PROP = 'tc_eles_bef23a16';

export function getElementCtx (el) {
    return el[ELEMENT_LISTENING_EVENTS_STORAGE_PROP];
}

export function getEventCtx (el, event) {
    event = Browser.isIE && Browser.version > 10 &&
            /MSPointer/.test(event) ? event.replace('MS', '').toLowerCase() : event;

    return getElementCtx(el)[event] || null;
}

export function isElementListening (el) {
    return !!el[ELEMENT_LISTENING_EVENTS_STORAGE_PROP];
}

export function addListeningElement (el, events) {
    var elementCtx = getElementCtx(el) || {};

    for (var i = 0; i < events.length; i++) {
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
        el[ELEMENT_LISTENING_EVENTS_STORAGE_PROP] = elementCtx;
}

export function removeListeningElement (el) {
    delete el[ELEMENT_LISTENING_EVENTS_STORAGE_PROP];
}

export function addFirstInternalHandler (el, events, handler) {
    var elementCtx = getElementCtx(el);

    for (var i = 0; i < events.length; i++)
        elementCtx[events[i]].internalHandlers.unshift(handler);
}

export function addInternalHandler (el, events, handler) {
    var elementCtx = getElementCtx(el);

    for (var i = 0; i < events.length; i++)
        elementCtx[events[i]].internalHandlers.push(handler);
}

export function removeInternalHandler (el, events, handler) {
    var elementCtx = getElementCtx(el);

    for (var i = 0; i < events.length; i++) {
        var internalHandlers = elementCtx[events[i]].internalHandlers;
        var handlerIndex     = internalHandlers.indexOf(handler);

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
    var originListeners = eventCtx.outerHandlers;
    var wrappers        = eventCtx.wrappers;
    var wrapper         = null;

    for (var i = 0; i < originListeners.length; i++) {
        var curListener = originListeners[i];

        if (curListener.fn === listener && (curListener.useCapture || false) === (useCapture || false)) {
            wrapper = wrappers[i];

            wrappers.splice(i, 1);
            originListeners.splice(i, 1);

            return wrapper;
        }
    }
}
