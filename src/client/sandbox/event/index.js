import FocusBlurSandbox from './focus-blur';
import HoverSandbox from './hover';
import Listeners from './listeners';
import Selection from './selection';
import SandboxBase from '../base';
import extend from '../../utils/extend';
import nativeMethods from '../native-methods';
import * as domUtils from '../../utils/dom';
import { isIE } from '../../utils/browser';
import { preventDefault, DOM_EVENTS } from '../../utils/event';

export default class EventSandbox extends SandboxBase {
    constructor (listeners, eventSimulator, elementEditingWatcher, unloadSandbox, messageSandbox, shadowUI, timerSandbox) {
        super();

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

        this.overridedMethods = null;

        this.onFocus              = null;
        this.cancelInternalEvents = null;

        this._createOverridedMethods();
        this._createInternalHandlers();
    }

    _createOverridedMethods () {
        var selection        = this.selection;
        var focusBlurSandbox = this.focusBlur;
        var eventSimulator   = this.eventSimulator;

        this.overridedMethods = {
            dispatchEvent: function () {
                Listeners.beforeDispatchEvent();

                var isWindow = domUtils.isWindow(this);
                var res      = isWindow ? nativeMethods.windowDispatchEvent.apply(this, arguments) :
                               nativeMethods.dispatchEvent.apply(this, arguments);

                Listeners.afterDispatchEvent();

                return res;
            },

            fireEvent: function (eventName, ev) {
                var eventType = eventName.substring(0, 2) === 'on' ? eventName.substring(2) : eventName;
                var createEventType;
                var res;

                Listeners.beforeDispatchEvent();

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
                        ev = extend(document.createEvent(createEventType), ev);
                        ev.initEvent(eventType, ev.cancelBubble !== void 0 ? ev.cancelBubble : false, true);
                    }
                    else {
                        // NOTE: The fireEvent method can be called with no arguments.
                        ev = document.createEvent(createEventType);
                        ev.initEvent(eventType, true, true);
                    }
                }

                res = nativeMethods.dispatchEvent.call(this, ev);
                Listeners.afterDispatchEvent();

                return res;
            },

            attachEvent: function (eventName, handler) {
                nativeMethods.addEventListener.call(this, eventName.substring(2), handler);
            },

            detachEvent: function (eventName, handler) {
                nativeMethods.removeEventListener.call(this, eventName.substring(2), handler);
            },

            click: function () {
                Listeners.beforeDispatchEvent();

                if (domUtils.isFileInput(this))
                    eventSimulator.setClickedFileInput(this);

                var res = eventSimulator.nativeClick(this, nativeMethods.click);

                Listeners.afterDispatchEvent();

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
            }
        };
    }

    _createInternalHandlers () {
        var shadowUI       = this.shadowUI;
        var document       = this.document;
        var eventSimulator = this.eventSimulator;

        this.onFocus = function (e) {
            var focusedEl = e.target;
            var activeEl  = domUtils.getActiveElement(document);

            if (!domUtils.isShadowUIElement(focusedEl) && !domUtils.isShadowUIElement(activeEl))
                shadowUI.setLastActiveElement(activeEl);
        };

        this.cancelInternalEvents = function (e, dispatched, preventEvent, cancelHandlers, stopPropagation) {
            // NOTE: We should cancel events raised by calling the native function (focus, blur) only if the
            // element has a flag. If an event is dispatched, we shouldn't cancel it.
            var internalEventFlag = FocusBlurSandbox.getInternalEventFlag(e.type);

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


        this.initDocumentListening();

        this.listeners.initElementListening(window, DOM_EVENTS.concat(['beforeunload', 'pagehide', 'unload', 'message']));

        this.listeners.addInternalEventListener(window, ['focus'], this.onFocus);
        this.listeners.addInternalEventListener(window, ['focus', 'blur', 'change'], this.cancelInternalEvents);

        this.unload.attach(window);
        this.message.attach(window);
        this.timers.attach(window);
        this.focusBlur.attach(window);
        this.hover.attach(window);
    }

    processElement (el) {
        if (isIE && domUtils.isFileInput(el))
            this._preventOpenFileDialog(el);
    }

    _preventOpenFileDialog (fileInput) {
        // NOTE: Prevent the browser's open file dialog.
        nativeMethods.addEventListener.call(fileInput, 'click', e => {
            if (this.eventSimulator.getClickedFileInput() === fileInput) {
                this.eventSimulator.setClickedFileInput(null);

                return preventDefault(e, true);
            }
        }, true);
    }

    initDocumentListening () {
        this.listeners.initElementListening(document, DOM_EVENTS);
    }
}

