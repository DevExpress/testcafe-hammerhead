import * as Browser from '../../util/browser';
import * as DOM from '../../util/dom';
import * as Event from '../../util/event';
import * as Service from '../../util/service';
import * as EventSimulator from './simulator';
import * as FocusBlur from './focus-blur';
import * as Listeners from './listeners';
import * as Timeout from './timeout';
import NativeMethods from '../native-methods';
import * as Selection from './selection';
import * as ShadowUI from '../shadow-ui';
import * as Unload from './unload';

const ELEMENT_HAS_ADDITIONAL_EVENT_METHODS = Browser.isIE && Browser.version < 11;

//wrappers
function overridedDispatchEvent (ev) {
    Listeners.beforeDispatchEvent();

    var res = NativeMethods.dispatchEvent.call(this, ev);

    Listeners.afterDispatchEvent();
    return res;
}

function overridedFireEvent (eventName, ev) {
    var eventType = eventName.substring(0, 2) === 'on' ? eventName.substring(2) : eventName;
    var createEventType;
    var res;

    Listeners.beforeDispatchEvent();

    //event is 'MSEventObj'
    if (!ev || !ev.target) {
        if (/(^mouse\w+$)|^(dbl)?click$|^contextmenu$/.test(eventType))
            createEventType = 'MouseEvents';
        else if (/^key\w+$/.test(eventType))
            createEventType = 'Events';
        else if (/^touch\w+$/.test(eventType))
            createEventType = 'TouchEvent';
        else
            createEventType = 'Events';

        if (ev) {
            ev = Service.extend(document.createEvent(createEventType), ev);
            ev.initEvent(eventType, typeof ev.cancelBubble !== 'undefined' ? ev.cancelBubble : false, true);
        }
        else {
            //NOTE: fire event method can be called with no arguments
            ev = document.createEvent(createEventType);
            ev.initEvent(eventType, true, true);
        }
    }

    res = NativeMethods.dispatchEvent.call(this, ev);
    Listeners.afterDispatchEvent();
    return res;
}

function overridedAttachEvent (eventName, handler) {
    NativeMethods.addEventListener.call(this, eventName.substring(2), handler);
}

function overridedDetachEvent (eventName, handler) {
    NativeMethods.removeEventListener.call(this, eventName.substring(2), handler);
}

function overridedClick () {
    Listeners.beforeDispatchEvent();

    if (DOM.isFileInput(this))
        EventSimulator.setClickedFileInput(this);

    var res = EventSimulator.nativeClick(this, NativeMethods.click);

    Listeners.afterDispatchEvent();

    return res;
}

function overridedSetSelectionRange () {
    return Selection.setSelectionRangeWrapper.apply(this, arguments);
}

function overridedSelect () {
    return Selection.selectWrapper.call(this);
}

function overridedFocus () {
    return FocusBlur.focus(this, null, false, false, true);
}

function overridedBlur () {
    return FocusBlur.blur(this, null, false, true);
}

function overrideElementOrHTMLElementMethod (methodName, overridedMethod) {
    if (window.Element && methodName in window.Element.prototype)
        window.Element.prototype[methodName] = overridedMethod;
    else if (window.HTMLElement && methodName in window.HTMLElement.prototype)
        window.HTMLElement.prototype[methodName] = overridedMethod;

    if (window.Document && methodName in window.Document.prototype)
        window.Document.prototype[methodName] = overridedMethod;
}

// internal handlers
function onFocus (e) {
    var focusedEl = e.target;
    var activeEl  = DOM.getActiveElement(document);

    if (!DOM.isShadowUIElement(focusedEl) && !DOM.isShadowUIElement(activeEl))
        ShadowUI.setLastActiveElement(activeEl);
}

function cancelInternalEvents (e, dispatched, preventEvent, cancelHandlers, stopPropagation) {
    // NOTE: we should cancel events raised by native function calling (focus, blur) only if the element has the flag.
    // If event is dispatched, we shouldn't cancel it.
    var target            = e.target || e.srcElement;
    var internalEventFlag = FocusBlur.getInternalEventFlag(e.type);

    if (target[internalEventFlag] && !e[EventSimulator.DISPATCHED_EVENT_FLAG])
        stopPropagation();
}

export function init (window, document) {
    window.HTMLInputElement.prototype.setSelectionRange    = overridedSetSelectionRange;
    window.HTMLTextAreaElement.prototype.setSelectionRange = overridedSetSelectionRange;

    overrideElementOrHTMLElementMethod('focus', overridedFocus);
    overrideElementOrHTMLElementMethod('blur', overridedBlur);
    overrideElementOrHTMLElementMethod('dispatchEvent', overridedDispatchEvent);

    if (ELEMENT_HAS_ADDITIONAL_EVENT_METHODS) {
        overrideElementOrHTMLElementMethod('fireEvent', overridedFireEvent);
        overrideElementOrHTMLElementMethod('attachEvent', overridedAttachEvent);
        overrideElementOrHTMLElementMethod('detachEvent', overridedDetachEvent);
    }

    if (window.TextRange && window.TextRange.prototype.select)
        window.TextRange.prototype.select = overridedSelect;


    initDocumentListening();

    Listeners.initElementListening(window, Event.DOM_EVENTS.concat(['beforeunload', 'unload', 'message']));

    Listeners.addInternalEventListener(window, ['focus'], onFocus);
    Listeners.addInternalEventListener(window, ['focus', 'blur', 'change'], cancelInternalEvents);

    Unload.init(window, document);
    Timeout.init(window);
    FocusBlur.init(window);
}

export function overrideElement (el, overridePrototypeMeths) {
    if ('click' in el)
        el.click = overridedClick;

    if (overridePrototypeMeths) {
        el.dispatchEvent = overridedDispatchEvent;

        if ('focus' in el) {
            el.focus = overridedFocus;
            el.blur  = overridedBlur;
        }

        if ('setSelectionRange' in el)
            el.setSelectionRange = overridedSetSelectionRange;

        if (ELEMENT_HAS_ADDITIONAL_EVENT_METHODS) {
            el.fireEvent   = overridedFireEvent;
            el.attachEvent = overridedAttachEvent;
            el.detachEvent = overridedDetachEvent;
        }
    }

    if (DOM.isInputElement(el)) {
        if (Browser.isIE) {
            // Prevent browser's open file dialog
            NativeMethods.addEventListener.call(el, 'click', function (e) {
                if (DOM.isFileInput(el)) {
                    if (EventSimulator.getClickedFileInput() === el) {
                        EventSimulator.setClickedFileInput(null);

                        return Event.preventDefault(e, true);
                    }
                }
            }, true);
        }
    }
}

export function initDocumentListening () {
    Listeners.initElementListening(document, Event.DOM_EVENTS);
}

