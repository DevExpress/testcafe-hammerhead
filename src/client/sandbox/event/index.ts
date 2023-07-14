import FocusBlurSandbox from './focus-blur';
import HoverSandbox from './hover';
import Listeners from './listeners';
import Selection from './selection';
import SandboxBase from '../base';
import nativeMethods from '../native-methods';
import * as domUtils from '../../utils/dom';

import { isFirefox } from '../../utils/browser';

import { DOM_EVENTS, preventDefault } from '../../utils/event';
import DataTransfer from './drag-and-drop/data-transfer';
import DragDataStore from './drag-and-drop/drag-data-store';
import EventSimulator from './simulator';
import ElementEditingWatcher from './element-editing-watcher';
import UnloadSandbox from './unload';
import MessageSandbox from './message';
import ShadowUI from '../shadow-ui';
import TimersSandbox from '../timers';
import { overrideFunction, overrideStringRepresentation } from '../../utils/overriding';

export default class EventSandbox extends SandboxBase {
    EVENT_PREVENTED_EVENT = 'hammerhead|event|event-prevented';

    listeners: Listeners;
    elementEditingWatcher: ElementEditingWatcher;
    unload: UnloadSandbox;
    timers: TimersSandbox;
    eventSimulator: EventSimulator;
    focusBlur: FocusBlurSandbox;
    selection: Selection;
    hover: HoverSandbox;
    shadowUI: ShadowUI;
    message: MessageSandbox;

    DataTransfer: any;
    DragDataStore: any;

    _overriddenMethods: any;

    _onFocus: Function | null;
    _cancelInternalEvents: Function | null;

    constructor (listeners: Listeners,
        eventSimulator: EventSimulator,
        elementEditingWatcher: ElementEditingWatcher,
        unloadSandbox: UnloadSandbox,
        messageSandbox: MessageSandbox,
        private readonly _shadowUI: ShadowUI,
        timerSandbox: TimersSandbox) {
        super();

        this.listeners             = listeners;
        this.elementEditingWatcher = elementEditingWatcher;
        this.unload                = unloadSandbox;
        this.timers                = timerSandbox;
        this.eventSimulator        = eventSimulator;
        this.focusBlur             = new FocusBlurSandbox(listeners, eventSimulator, messageSandbox, elementEditingWatcher);
        this.selection             = new Selection(this);
        this.hover                 = new HoverSandbox(listeners);
        this._shadowUI              = _shadowUI;
        this.message               = messageSandbox;

        this.DataTransfer  = DataTransfer;
        this.DragDataStore = DragDataStore;

        this._overriddenMethods = null;

        this._onFocus              = null;
        this._cancelInternalEvents = null;

        this._createOverriddenMethods();
        this._createInternalHandlers();
    }

    _createOverriddenMethods (): void {
        const selection        = this.selection;
        const focusBlurSandbox = this.focusBlur;
        const eventSimulator   = this.eventSimulator;
        const sandbox          = this;

        this._overriddenMethods = {
            dispatchEvent: function () {
                Listeners.beforeDispatchEvent(this);

                const res = nativeMethods.dispatchEvent.apply(this, arguments);

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
            },
        };
    }

    _createInternalHandlers (): void {
        const shadowUI       = this._shadowUI;
        const document       = this.document;
        const eventSimulator = this.eventSimulator;

        this._onFocus = function (e: FocusEvent) {
            const focusedEl = nativeMethods.eventTargetGetter.call(e);
            const activeEl  = domUtils.getActiveElement(document);

            if (!domUtils.isShadowUIElement(focusedEl) && !domUtils.isShadowUIElement(activeEl))
                shadowUI.setLastActiveElement(activeEl);
        };

        this._cancelInternalEvents = function (e: Event, _dispatched: boolean, _preventEvent: boolean, _cancelHandlers: Function, stopPropagation: Function) {
            // NOTE: We should cancel events raised by calling the native function (focus, blur) only if the
            // element has a flag. If an event is dispatched, we shouldn't cancel it.
            // After calling a native function two events were raised
            // .focus() -> focus, focusin
            // .blur() -> blur, focusout
            // So we should prevent both events
            const eventType         = FocusBlurSandbox.getNonBubblesEventType(e.type) || e.type;
            const internalEventFlag = FocusBlurSandbox.getInternalEventFlag(eventType);
            const target            = nativeMethods.eventTargetGetter.call(e);

            if (target[internalEventFlag] && !e[eventSimulator.DISPATCHED_EVENT_FLAG])
                stopPropagation();
        };
    }

    _preventInputNativeDialogs (window: Window): void {
        const shouldPreventClickEvents = isFirefox;

        if (!shouldPreventClickEvents)
            return;

        // NOTE: Google Chrome and Safari don't open the native browser dialog when TestCafe clicks on the input.
        // 'Click' is a complex emulated action that uses 'dispatchEvent' method internally.
        // Another browsers open the native browser dialog in this case.
        // This is why, we are forced to prevent the browser's open file dialog.
        this.listeners.addInternalEventBeforeListener(window, ['click'], (e: Event, dispatched: boolean) => {
            if (dispatched && domUtils.isInputWithNativeDialog(nativeMethods.eventTargetGetter.call(e)))
                preventDefault(e, true);
        });
    }

    attach (window: Window & typeof globalThis): void {
        super.attach(window);

        overrideFunction(window.HTMLInputElement.prototype, 'setSelectionRange', this._overriddenMethods.setSelectionRange);
        overrideFunction(window.HTMLTextAreaElement.prototype, 'setSelectionRange', this._overriddenMethods.setSelectionRange);
        overrideFunction(window.EventTarget.prototype, 'dispatchEvent', this._overriddenMethods.dispatchEvent);
        overrideFunction(window.HTMLElement.prototype, 'focus', this._overriddenMethods.focus);
        overrideFunction(window.HTMLElement.prototype, 'blur', this._overriddenMethods.blur);
        overrideFunction(window.HTMLElement.prototype, 'click', this._overriddenMethods.click);

        overrideFunction(window.Event.prototype, 'preventDefault', this._overriddenMethods.preventDefault);

        // @ts-ignore Window constructor has no the focus method
        window.Window.focus = this._overriddenMethods.focus;

        // NOTE: we cannot use 'overrideFunction' here since the focus method may not exist
        // @ts-ignore Window constructor has no the focus method
        overrideStringRepresentation(window.Window.focus, nativeMethods.focus);

        // @ts-ignore Window constructor has no the blur method
        window.Window.blur  = this._overriddenMethods.blur;

        // NOTE: we cannot use 'overrideFunction' here since the blur method may not exist
        // @ts-ignore Window constructor has no the blur method
        overrideStringRepresentation(window.Window.blur, nativeMethods.blur);

        this.listeners.initElementListening(document, DOM_EVENTS);
        this.listeners.initElementListening(window, DOM_EVENTS.concat(['load', 'beforeunload', 'pagehide', 'unload', 'message']));
        this.listeners.addInternalEventBeforeListener(window, ['focus'], this._onFocus);
        this.listeners.addInternalEventBeforeListener(window, ['focus', 'blur', 'change', 'focusin', 'focusout'], this._cancelInternalEvents);

        this._preventInputNativeDialogs(window);

        this.unload.attach(window);
        this.message.attach(window);
        this.timers.attach(window);
        this.focusBlur.attach(window);
        this.hover.attach(window);
    }

    reattach (window) {
        this.listeners.restartElementListening(window.document);
        this.listeners.restartElementListening(window);
    }
}

