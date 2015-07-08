import * as DOM from '../../util/dom';
import * as Event from '../../util/event';
import * as ListeningCtx from './listening-context';
import NativeMethods from '../native-methods';
import * as Service from '../../util/service';

export const EVENT_LISTENER_ATTACHED_EVENT = 'eventListenerAttached';

const LISTENED_EVENTS = [
    'click', 'mousedown', 'mouseup', 'dblclick', 'contextmenu', 'mousemove', 'mouseover', 'mouseout',
    'pointerdown', 'pointermove', 'pointerover', 'pointerout', 'pointerup',
    'MSPointerDown', 'MSPointerMove', 'MSPointerOver', 'MSPointerOut', 'MSPointerUp',
    'touchstart', 'touchmove', 'touchend',
    'keydown', 'keypress', 'keyup',
    'change', 'focus', 'blur', 'focusin', 'focusout'
];

const EVENT_SANDBOX_DISPATCH_EVENT_FLAG = 'tc-sdef-310efb6b';

var eventEmitter = new Service.EventEmitter();

function eventHandler (e) {
    //NOTE: fix for the bug in firefox (https://bugzilla.mozilla.org/show_bug.cgi?id=1161548).
    //An exception is raised when try to get any property from the event object in some cases.
    var type = '';

    try {
        type = e.type;
    }
    catch (err) {
        return;
    }

    var el                    = this;
    var eventPrevented        = false;
    var handlersCancelled     = false;
    var stopPropagationCalled = false;
    var eventCtx              = ListeningCtx.getEventCtx(el, type);
    var internalHandlers      = eventCtx ? eventCtx.internalHandlers : [];

    eventCtx.cancelOuterHandlers = false;

    var preventEvent = function () {
        eventPrevented = true;
        Event.preventDefault(e);
    };

    var cancelHandlers = function () {
        if (!handlersCancelled)
            eventCtx.cancelOuterHandlers = true;

        handlersCancelled = true;
    };

    var stopPropagation = function () {
        stopPropagationCalled = true;

        Event.stopPropagation(e);
    };

    for (var i = 0; i < internalHandlers.length; i++) {
        internalHandlers[i].call(el, e, !!window[EVENT_SANDBOX_DISPATCH_EVENT_FLAG], preventEvent, cancelHandlers, stopPropagation);

        if (eventPrevented || stopPropagationCalled)
            break;
    }
}

function getEventListenerWrapper (eventCtx, listener) {
    return function (e) {
        if (eventCtx.cancelOuterHandlers)
            return null;

        if (typeof eventCtx.outerHandlersWrapper === 'function')
            return eventCtx.outerHandlersWrapper.call(this, e, listener);

        if (typeof listener === 'object' && typeof listener.handleEvent === 'function')
            return listener.handleEvent.call(listener, e);

        return listener.call(this, e);
    };
}

function getBodyEventListenerWrapper (documentEventCtx, listener) {
    return function (e) {
        if (documentEventCtx.cancelOuterHandlers)
            return null;

        return listener.call(this, e);
    };
}

function getNativeAddEventListener (el) {
    if (DOM.isWindowInstance(el))
        return NativeMethods.windowAddEventListener;

    return typeof el.body !== 'undefined' ? NativeMethods.documentAddEventListener : NativeMethods.addEventListener;
}

function getNativeRemoveEventListener (el) {
    if (DOM.isWindowInstance(el))
        return NativeMethods.windowRemoveEventListener;

    return typeof el.body !==
           'undefined' ? NativeMethods.documentRemoveEventListener : NativeMethods.removeEventListener;
}

export var on  = eventEmitter.on.bind(eventEmitter);
export var off = eventEmitter.off.bind(eventEmitter);

export function initElementListening (el, events) {
    var nativeAddEventListener    = getNativeAddEventListener(el);
    var nativeRemoveEventListener = getNativeRemoveEventListener(el);

    events = events || LISTENED_EVENTS;

    ListeningCtx.addListeningElement(el, events);

    for (var i = 0; i < events.length; i++)
        nativeAddEventListener.call(el, events[i], eventHandler, true);

    el.addEventListener = function (type, listener, useCapture) {
        var eventListeningInfo = ListeningCtx.getEventCtx(el, type);

        if (!eventListeningInfo)
            return nativeAddEventListener.call(this, type, listener, useCapture);

        //T233158 - Wrong test run for mouse click in IE
        var isDifferentHandler = eventListeningInfo.outerHandlers.every(function (value) {
            return value.fn !== listener || value.useCapture !== useCapture;
        });

        if (!isDifferentHandler)
            return null;

        var wrapper = getEventListenerWrapper(eventListeningInfo, listener);

        ListeningCtx.wrapEventListener(eventListeningInfo, listener, wrapper, useCapture);

        var res = nativeAddEventListener.call(this, type, wrapper, useCapture);

        eventEmitter.emit(EVENT_LISTENER_ATTACHED_EVENT, {
            el:        this,
            eventType: type,
            listener:  listener
        });

        return res;
    };

    el.removeEventListener = function (type, listener, useCapture) {
        var eventCtx = ListeningCtx.getEventCtx(this, type);

        if (!eventCtx)
            return nativeRemoveEventListener.call(this, type, listener, useCapture);

        return nativeRemoveEventListener.call(this, type, ListeningCtx.getWrapper(eventCtx, listener, useCapture), useCapture);
    };
}

export function restartElementListening (el) {
    var nativeAddEventListener = getNativeAddEventListener(el);
    var elementCtx             = ListeningCtx.getElementCtx(el);

    if (elementCtx) {
        Object.keys(elementCtx).forEach(function (event) {
            nativeAddEventListener.call(el, event, eventHandler, true);
        });
    }
}

export function initDocumentBodyListening (doc) {
    var events = Event.DOM_EVENTS;

    var nativeAddEventListener = (function () {
        return doc.body.addEventListener;
    })();

    var nativeRemoveEventListener = (function () {
        return doc.body.removeEventListener;
    })();

    ListeningCtx.addListeningElement(doc.body, events);

    doc.body.addEventListener = function (type, listener, useCapture) {
        var docEventListeningInfo = ListeningCtx.getEventCtx(doc, type);
        var eventListeningInfo    = ListeningCtx.getEventCtx(this, type);

        if (!docEventListeningInfo)
            return nativeAddEventListener.call(this, type, listener, useCapture);

        //T233158 - Wrong test run for mouse click in IE
        var isDifferentHandler = eventListeningInfo.outerHandlers.every(function (value) {
            return value.fn !== listener || value.useCapture !== useCapture;
        });

        if (!isDifferentHandler)
            return null;

        var wrapper = getBodyEventListenerWrapper(docEventListeningInfo, listener);

        ListeningCtx.wrapEventListener(eventListeningInfo, listener, wrapper, useCapture);

        var res = nativeAddEventListener.call(this, type, wrapper, useCapture);

        eventEmitter.emit(EVENT_LISTENER_ATTACHED_EVENT, {
            el:        this,
            eventType: type,
            listener:  listener
        });

        return res;
    };

    doc.body.removeEventListener = function (type, listener, useCapture) {
        var eventListeningInfo = ListeningCtx.getEventCtx(this, type);

        if (!eventListeningInfo)
            return nativeRemoveEventListener.call(this, type, listener, useCapture);

        return nativeRemoveEventListener.call(this, type, ListeningCtx.getWrapper(eventListeningInfo, listener, useCapture), useCapture);
    };
}

export function cancelElementListening (el) {
    ListeningCtx.removeListeningElement(el);

    if (el.body)
        ListeningCtx.removeListeningElement(el.body);
}

export function beforeDispatchEvent () {
    window[EVENT_SANDBOX_DISPATCH_EVENT_FLAG] = (window[EVENT_SANDBOX_DISPATCH_EVENT_FLAG] || 0) + 1;
}

export function afterDispatchEvent () {
    window[EVENT_SANDBOX_DISPATCH_EVENT_FLAG]--;

    if (!window[EVENT_SANDBOX_DISPATCH_EVENT_FLAG])
        delete window[EVENT_SANDBOX_DISPATCH_EVENT_FLAG];
}

export function setEventListenerWrapper (el, events, wrapper) {
    if (!ListeningCtx.isElementListening(el))
        initElementListening(el, events);

    for (var i = 0; i < events.length; i++) {
        var eventListeningInfo = ListeningCtx.getEventCtx(el, events[i]);

        eventListeningInfo.outerHandlersWrapper = wrapper;
    }
}

export var addInternalEventListener    = ListeningCtx.addInternalHandler;
export var addFirstInternalHandler     = ListeningCtx.addFirstInternalHandler;
export var removeInternalEventListener = ListeningCtx.removeInternalHandler;
