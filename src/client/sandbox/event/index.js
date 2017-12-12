import FocusBlurSandbox from './focus-blur';
import HoverSandbox from './hover';
import Listeners from './listeners';
import Selection from './selection';
import SandboxBase from '../base';
import nativeMethods from '../native-methods';
import * as domUtils from '../../utils/dom';
import { DOM_EVENTS } from '../../utils/event';
import DataTransfer from './drag-and-drop/data-transfer';
import DragDataStore from './drag-and-drop/drag-data-store';

export default class EventSandbox extends SandboxBase {
    constructor (listeners, eventSimulator, elementEditingWatcher, unloadSandbox, messageSandbox, shadowUI, timerSandbox) {
        super();

        this.EVENT_PREVENTED_EVENT = 'hammerhead|event|event-prevented';

        this.listeners             = listeners;
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

        this.overriddenMethods = null;

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

        this.overriddenMethods = {
            dispatchEvent: function () {
                Listeners.beforeDispatchEvent(this);

                const isWindow = domUtils.isWindow(this);
                const res      = isWindow ? nativeMethods.windowDispatchEvent.apply(this, arguments) :
                                 nativeMethods.dispatchEvent.apply(this, arguments);

                Listeners.afterDispatchEvent(this);

                return res;
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

        window.HTMLInputElement.prototype.setSelectionRange    = this.overriddenMethods.setSelectionRange;
        window.HTMLTextAreaElement.prototype.setSelectionRange = this.overriddenMethods.setSelectionRange;
        window.Window.prototype.dispatchEvent                  = this.overriddenMethods.dispatchEvent;
        window.Document.prototype.dispatchEvent                = this.overriddenMethods.dispatchEvent;
        window.HTMLElement.prototype.dispatchEvent             = this.overriddenMethods.dispatchEvent;
        window.SVGElement.prototype.dispatchEvent              = this.overriddenMethods.dispatchEvent;
        window.HTMLElement.prototype.focus                     = this.overriddenMethods.focus;
        window.HTMLElement.prototype.blur                      = this.overriddenMethods.blur;
        window.HTMLElement.prototype.click                     = this.overriddenMethods.click;
        window.Window.focus                                    = this.overriddenMethods.focus;
        window.Window.blur                                     = this.overriddenMethods.blur;
        window.Event.prototype.preventDefault                  = this.overriddenMethods.preventDefault;

        if (window.TextRange && window.TextRange.prototype.select)
            window.TextRange.prototype.select = this.overriddenMethods.select;

        this.initDocumentListening(window.document);

        this.listeners.initElementListening(window, DOM_EVENTS.concat(['load', 'beforeunload', 'pagehide', 'unload', 'message']));

        this.listeners.addInternalEventListener(window, ['focus'], this.onFocus);
        this.listeners.addInternalEventListener(window, ['focus', 'blur', 'change', 'focusin', 'focusout'], this.cancelInternalEvents);

        this.unload.attach(window);
        this.message.attach(window);
        this.timers.attach(window);
        this.focusBlur.attach(window);
        this.hover.attach(window);
    }

    initDocumentListening (document) {
        this.listeners.initElementListening(document, DOM_EVENTS);
    }
}

