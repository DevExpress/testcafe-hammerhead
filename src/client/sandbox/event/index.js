import FocusBlurSandbox from './focus-blur';
import Listeners from './listeners';
import Selection from './selection';
import SandboxBase from '../base';
import extend from '../../utils/extend';
import nativeMethods from '../native-methods';
import * as domUtils from '../../utils/dom';
import { isIE, version as browserVersion } from '../../utils/browser';
import { preventDefault, DOM_EVENTS } from '../../utils/event';

const ELEMENT_HAS_ADDITIONAL_EVENT_METHODS = isIE && browserVersion < 11;

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
            dispatchEvent: function (ev) {
                Listeners.beforeDispatchEvent();

                var res = nativeMethods.dispatchEvent.call(this, ev);

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
                        ev.initEvent(eventType, typeof ev.cancelBubble !== 'undefined' ? ev.cancelBubble : false, true);
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
            var target            = e.target || e.srcElement;
            var internalEventFlag = FocusBlurSandbox.getInternalEventFlag(e.type);

            if (target[internalEventFlag] && !e[eventSimulator.DISPATCHED_EVENT_FLAG])
                stopPropagation();
        };
    }

    _overrideElementOrHTMLElementMethod (methodName, overridedMethod) {
        if (this.window.Element && methodName in this.window.Element.prototype)
            this.window.Element.prototype[methodName] = overridedMethod;
        else if (this.window.HTMLElement && methodName in this.window.HTMLElement.prototype)
            this.window.HTMLElement.prototype[methodName] = overridedMethod;

        if (this.window.Document && methodName in this.window.Document.prototype)
            this.window.Document.prototype[methodName] = overridedMethod;
    }

    attach (window) {
        super.attach(window);

        window.HTMLInputElement.prototype.setSelectionRange    = this.overridedMethods.setSelectionRange;
        window.HTMLTextAreaElement.prototype.setSelectionRange = this.overridedMethods.setSelectionRange;

        this._overrideElementOrHTMLElementMethod('focus', this.overridedMethods.focus);
        this._overrideElementOrHTMLElementMethod('blur', this.overridedMethods.blur);
        this._overrideElementOrHTMLElementMethod('dispatchEvent', this.overridedMethods.dispatchEvent);

        if (ELEMENT_HAS_ADDITIONAL_EVENT_METHODS) {
            this._overrideElementOrHTMLElementMethod('fireEvent', this.overridedMethods.fireEvent);
            this._overrideElementOrHTMLElementMethod('attachEvent', this.overridedMethods.attachEvent);
            this._overrideElementOrHTMLElementMethod('detachEvent', this.overridedMethods.detachEvent);
        }

        if (window.TextRange && window.TextRange.prototype.select)
            window.TextRange.prototype.select = this.overridedMethods.select;


        this.initDocumentListening();

        this.listeners.initElementListening(window, DOM_EVENTS.concat(['beforeunload', 'unload', 'message']));

        this.listeners.addInternalEventListener(window, ['focus'], this.onFocus);
        this.listeners.addInternalEventListener(window, ['focus', 'blur', 'change'], this.cancelInternalEvents);

        this.unload.attach(window);
        this.message.attach(window);
        this.timers.attach(window);
        this.focusBlur.attach(window);
    }

    overrideElement (el, overridePrototypeMeths) {
        if ('click' in el)
            el.click = this.overridedMethods.click;

        if (overridePrototypeMeths) {
            el.dispatchEvent = this.overridedMethods.dispatchEvent;

            if ('focus' in el) {
                el.focus = this.overridedMethods.focus;
                el.blur  = this.overridedMethods.blur;
            }

            if ('setSelectionRange' in el)
                el.setSelectionRange = this.overridedMethods.setSelectionRange;

            if (ELEMENT_HAS_ADDITIONAL_EVENT_METHODS) {
                el.fireEvent   = this.overridedMethods.fireEvent;
                el.attachEvent = this.overridedMethods.attachEvent;
                el.detachEvent = this.overridedMethods.detachEvent;
            }
        }

        if (domUtils.isInputElement(el)) {
            if (isIE) {
                // NOTE: Prevent the browser's open file dialog.
                nativeMethods.addEventListener.call(el, 'click', e => {
                    if (domUtils.isFileInput(el)) {
                        if (this.eventSimulator.getClickedFileInput() === el) {
                            this.eventSimulator.setClickedFileInput(null);

                            return preventDefault(e, true);
                        }
                    }
                }, true);
            }
        }
    }

    initDocumentListening () {
        this.listeners.initElementListening(document, DOM_EVENTS);
    }
}

