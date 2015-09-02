import SandboxBase from '../base';
import NativeMethods from '../native-methods';
import Unload from './unload';
import extend from '../../utils/extend';
import * as Browser from '../../utils/browser';
import * as DOM from '../../utils/dom';
import * as Event from '../../utils/event';
import * as EventSimulator from './simulator';
import * as FocusBlur from './focus-blur';
import * as Listeners from './listeners';
import * as Timeout from './timeout';
import * as Selection from './selection';
import * as ElementEditingWatcher from './element-editing-watcher';
import { getSandboxFromStorage } from '../../sandbox/storage';

export default class EventSandbox extends SandboxBase {
    constructor (sandbox) {
        super(sandbox);

        this.ELEMENT_HAS_ADDITIONAL_EVENT_METHODS = Browser.isIE && Browser.version < 11;

        this.listeners             = Listeners;             // TODO:
        this.unload                = new Unload(sandbox);
        this.selection             = Selection;             // TODO:
        this.eventSimulator        = EventSimulator;        // TODO:
        this.elementEditingWatcher = ElementEditingWatcher; // TODO:
        this.focusBlur             = FocusBlur;             // TODO:
    }

    //wrappers
    _overridedDispatchEvent (ev) {
        Listeners.beforeDispatchEvent();

        var res = NativeMethods.dispatchEvent.call(this, ev);

        Listeners.afterDispatchEvent();

        return res;
    }

    _overridedFireEvent (eventName, ev) {
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
                ev = extend(document.createEvent(createEventType), ev);
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

    _overridedAttachEvent (eventName, handler) {
        NativeMethods.addEventListener.call(this, eventName.substring(2), handler);
    }

    _overridedDetachEvent (eventName, handler) {
        NativeMethods.removeEventListener.call(this, eventName.substring(2), handler);
    }

    _overridedClick () {
        Listeners.beforeDispatchEvent();

        if (DOM.isFileInput(this))
            EventSimulator.setClickedFileInput(this);

        var res = EventSimulator.nativeClick(this, NativeMethods.click);

        Listeners.afterDispatchEvent();

        return res;
    }

    _overridedSetSelectionRange () {
        return Selection.setSelectionRangeWrapper.apply(this, arguments);
    }

    _overridedSelect () {
        return Selection.selectWrapper.call(this);
    }

    _overridedFocus () {
        return FocusBlur.focus(this, null, false, false, true);
    }

    _overridedBlur () {
        return FocusBlur.blur(this, null, false, true);
    }

    _overrideElementOrHTMLElementMethod (methodName, overridedMethod) {
        if (window.Element && methodName in window.Element.prototype)
            window.Element.prototype[methodName] = overridedMethod;
        else if (window.HTMLElement && methodName in window.HTMLElement.prototype)
            window.HTMLElement.prototype[methodName] = overridedMethod;

        if (window.Document && methodName in window.Document.prototype)
            window.Document.prototype[methodName] = overridedMethod;
    }

    // internal handlers
    _onFocus (e) {
        var focusedEl = e.target;
        var activeEl  = DOM.getActiveElement(document);

        if (!DOM.isShadowUIElement(focusedEl) && !DOM.isShadowUIElement(activeEl)) {
            var sandbox = getSandboxFromStorage(window);

            sandbox.shadowUI.setLastActiveElement(activeEl);
        }
    }

    _cancelInternalEvents (e, dispatched, preventEvent, cancelHandlers, stopPropagation) {
        // NOTE: we should cancel events raised by native function calling (focus, blur) only if the element has the flag.
        // If event is dispatched, we shouldn't cancel it.
        var target            = e.target || e.srcElement;
        var internalEventFlag = FocusBlur.getInternalEventFlag(e.type);

        if (target[internalEventFlag] && !e[EventSimulator.DISPATCHED_EVENT_FLAG])
            stopPropagation();
    }

    attach (window) {
        super.attach(window);

        window.HTMLInputElement.prototype.setSelectionRange    = this._overridedSetSelectionRange;
        window.HTMLTextAreaElement.prototype.setSelectionRange = this._overridedSetSelectionRange;

        this._overrideElementOrHTMLElementMethod('focus', this._overridedFocus);
        this._overrideElementOrHTMLElementMethod('blur', this._overridedBlur);
        this._overrideElementOrHTMLElementMethod('dispatchEvent', this._overridedDispatchEvent);

        if (this.ELEMENT_HAS_ADDITIONAL_EVENT_METHODS) {
            this._overrideElementOrHTMLElementMethod('fireEvent', this._overridedFireEvent);
            this._overrideElementOrHTMLElementMethod('attachEvent', this._overridedAttachEvent);
            this._overrideElementOrHTMLElementMethod('detachEvent', this._overridedDetachEvent);
        }

        if (window.TextRange && window.TextRange.prototype.select)
            window.TextRange.prototype.select = this._overridedSelect;


        this.initDocumentListening();

        Listeners.initElementListening(window, Event.DOM_EVENTS.concat(['beforeunload', 'unload', 'message']));

        Listeners.addInternalEventListener(window, ['focus'], this._onFocus);
        Listeners.addInternalEventListener(window, ['focus', 'blur', 'change'], this._cancelInternalEvents);

        this.unload.attach(window);
        Timeout.init(window);
        FocusBlur.init(window);
    }

    overrideElement (el, overridePrototypeMeths) {
        if ('click' in el)
            el.click = this._overridedClick;

        if (overridePrototypeMeths) {
            el.dispatchEvent = this._overridedDispatchEvent;

            if ('focus' in el) {
                el.focus = this._overridedFocus;
                el.blur  = this._overridedBlur;
            }

            if ('setSelectionRange' in el)
                el.setSelectionRange = this._overridedSetSelectionRange;

            if (this.ELEMENT_HAS_ADDITIONAL_EVENT_METHODS) {
                el.fireEvent   = this._overridedFireEvent;
                el.attachEvent = this._overridedAttachEvent;
                el.detachEvent = this._overridedDetachEvent;
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

    initDocumentListening () {
        Listeners.initElementListening(document, Event.DOM_EVENTS);
    }
}

