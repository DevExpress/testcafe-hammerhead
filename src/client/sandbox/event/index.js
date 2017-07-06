import FocusBlurSandbox from './focus-blur';
import HoverSandbox from './hover';
import Listeners from './listeners';
import Selection from './selection';
import SandboxBase from '../base';
import extend from '../../utils/extend';
import nativeMethods from '../native-methods';
import * as domUtils from '../../utils/dom';
import { DOM_EVENTS } from '../../utils/event';
import DataTransfer from './drag-and-drop/data-transfer';
import DragDataStore from './drag-and-drop/drag-data-store';

export default class EventSandbox extends SandboxBase {
    constructor (listeners, eventSimulator, elementEditingWatcher, unloadSandbox, messageSandbox, shadowUI, timerSandbox) {
        super();

        this.EVENT_ATTACHED_EVENT  = 'hammerhead|event|event-attached';
        this.EVENT_DETACHED_EVENT  = 'hammerhead|event|event-detached';
        this.EVENT_PREVENTED_EVENT = 'hammerhead|event|event-prevented';

        this.listeners             = listeners;
        this.eventSimulator        = eventSimulator;
        this.elementEditingWatcher = elementEditingWatcher;
        this.unload                = unloadSandbox;
        this.timers                = timerSandbox;
        this.eventSimulator        = eventSimulator;
        this.focusBlur             = new FocusBlurSandbox(listeners, eventSimulator, messageSandbox, shadowUI, timerSandbox, elementEditingWatcher);
        this.selection             = new Selection(this);
        this.hover                 = new HoverSandbox(listeners);
        this.shadowUI              = shadowUI;
        this.message               = messageSandbox;

        this.DataTransfer  = DataTransfer;
        this.DragDataStore = DragDataStore;

        this.overridedMethods = null;

        this.onFocus              = null;
        this.cancelInternalEvents = null;

        this._createOverridedMethods();
        this._createInternalHandlers();
    }

    _createOverridedMethods () {
        const selection        = this.selection;
        const focusBlurSandbox = this.focusBlur;
        const eventSimulator   = this.eventSimulator;
        const sandbox          = this;

        this.overridedMethods = {
            dispatchEvent: function () {
                Listeners.beforeDispatchEvent(this);

                const isWindow = domUtils.isWindow(this);
                const res      = isWindow ? nativeMethods.windowDispatchEvent.apply(this, arguments) :
                                 nativeMethods.dispatchEvent.apply(this, arguments);

                Listeners.afterDispatchEvent(this);

                return res;
            },

            fireEvent: function (eventName, ev) {
                const eventType = eventName.substring(0, 2) === 'on' ? eventName.substring(2) : eventName;
                let createEventType;

                Listeners.beforeDispatchEvent(this);

                // NOTE: Event is 'MSEventObj'.
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
                        ev = extend(nativeMethods.documentCreateEvent.call(document, createEventType), ev);
                        ev.initEvent(eventType, ev.cancelBubble !== void 0 ? ev.cancelBubble : false, true);
                    }
                    else {
                        // NOTE: The fireEvent method can be called with no arguments.
                        ev = nativeMethods.documentCreateEvent.call(document, createEventType);
                        ev.initEvent(eventType, true, true);
                    }
                }

                const res = nativeMethods.dispatchEvent.call(this, ev);

                Listeners.afterDispatchEvent(this);

                return res;
            },

            attachEvent: function (...args) {
                if (typeof args[0] === 'string')
                    args[0] = args[0].substring(2);

                nativeMethods.addEventListener.apply(this, args);

                const type     = args[0];
                const listener = args[1];

                sandbox.emit(sandbox.EVENT_ATTACHED_EVENT, { el: this, listener, eventType: type });
            },

            detachEvent: function (...args) {
                if (typeof args[0] === 'string')
                    args[0] = args[0].substring(2);

                nativeMethods.removeEventListener.apply(this, args);

                const type     = args[0];
                const listener = args[1];

                sandbox.emit(sandbox.EVENT_DETACHED_EVENT, { el: this, listener, eventType: type });
            },

            click: function () {
                Listeners.beforeDispatchEvent(this);

                const res = eventSimulator.nativeClick(this, nativeMethods.click);

                Listeners.afterDispatchEvent(this);

                return res;
            },

            setSelectionRange: function () {
                return selection.setSelectionRangeWrapper.apply(this, arguments);
            },

            select: function () {
                return selection.selectWrapper.call(this);
            },

            focus: function () {
                return focusBlurSandbox.focus(this, null, false, false, true);
            },

            blur: function () {
                return focusBlurSandbox.blur(this, null, false, true);
            },

            preventDefault: function () {
                sandbox.emit(sandbox.EVENT_PREVENTED_EVENT, this);

                return nativeMethods.preventDefault.call(this);
            }
        };
    }

    _createInternalHandlers () {
        const shadowUI       = this.shadowUI;
        const document       = this.document;
        const eventSimulator = this.eventSimulator;

        this.onFocus = function (e) {
            const focusedEl = e.target;
            const activeEl  = domUtils.getActiveElement(document);

            if (!domUtils.isShadowUIElement(focusedEl) && !domUtils.isShadowUIElement(activeEl))
                shadowUI.setLastActiveElement(activeEl);
        };

        this.cancelInternalEvents = function (e, dispatched, preventEvent, cancelHandlers, stopPropagation) {
            // NOTE: We should cancel events raised by calling the native function (focus, blur) only if the
            // element has a flag. If an event is dispatched, we shouldn't cancel it.
            // After calling a native function two events were raised
            // .focus() -> focus, focusin
            // .blur() -> blur, focusout
            // So we should prevent both events
            const eventType         = FocusBlurSandbox.getNonBubblesEventType(e.type) || e.type;
            const internalEventFlag = FocusBlurSandbox.getInternalEventFlag(eventType);

            if (e.target[internalEventFlag] && !e[eventSimulator.DISPATCHED_EVENT_FLAG])
                stopPropagation();
        };
    }

    attach (window) {
        super.attach(window);

        window.HTMLInputElement.prototype.setSelectionRange    = this.overridedMethods.setSelectionRange;
        window.HTMLTextAreaElement.prototype.setSelectionRange = this.overridedMethods.setSelectionRange;
        window.Window.prototype.dispatchEvent                  = this.overridedMethods.dispatchEvent;
        window.Document.prototype.dispatchEvent                = this.overridedMethods.dispatchEvent;
        window.HTMLElement.prototype.dispatchEvent             = this.overridedMethods.dispatchEvent;
        window.SVGElement.prototype.dispatchEvent              = this.overridedMethods.dispatchEvent;
        window.HTMLElement.prototype.focus                     = this.overridedMethods.focus;
        window.HTMLElement.prototype.blur                      = this.overridedMethods.blur;
        window.HTMLElement.prototype.click                     = this.overridedMethods.click;
        window.Window.focus                                    = this.overridedMethods.focus;
        window.Window.blur                                     = this.overridedMethods.blur;

        if (window.Document.prototype.fireEvent) {
            window.Document.prototype.fireEvent      = this.overridedMethods.fireEvent;
            window.Document.prototype.attachEvent    = this.overridedMethods.attachEvent;
            window.Document.prototype.detachEvent    = this.overridedMethods.detachEvent;
            window.HTMLElement.prototype.fireEvent   = this.overridedMethods.fireEvent;
            window.HTMLElement.prototype.attachEvent = this.overridedMethods.attachEvent;
            window.HTMLElement.prototype.detachEvent = this.overridedMethods.detachEvent;
        }

        if (window.TextRange && window.TextRange.prototype.select)
            window.TextRange.prototype.select = this.overridedMethods.select;

        window.Event.prototype.preventDefault = this.overridedMethods.preventDefault;

        this.initDocumentListening();

        this.listeners.initElementListening(window, DOM_EVENTS.concat(['beforeunload', 'pagehide', 'unload', 'message']));

        this.listeners.addInternalEventListener(window, ['focus'], this.onFocus);
        this.listeners.addInternalEventListener(window, ['focus', 'blur', 'change', 'focusin', 'focusout'], this.cancelInternalEvents);

        this.unload.attach(window);
        this.message.attach(window);
        this.timers.attach(window);
        this.focusBlur.attach(window);
        this.hover.attach(window);
    }

    initDocumentListening () {
        this.listeners.initElementListening(document, DOM_EVENTS);
    }
}

