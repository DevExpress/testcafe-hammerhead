import extend from '../../utils/extend';
import nativeMethods from '../native-methods';
import * as browserUtils from '../../utils/browser';
import * as domUtils from '../../utils/dom';
import * as eventUtils from '../../utils/event';
import { isTouchDevice } from '../../utils/feature-detection';

import {
    getOffsetPosition,
    offsetToClientCoords,
    shouldIgnoreEventInsideIframe,
} from '../../utils/position';

import { getBordersWidth } from '../../utils/style';
import { HammerheadStorageEventInit } from '../../../typings/client';

const TOUCH_EVENT_RADIUS = 25;
const TOUCH_EVENT_FORCE  = 0.5;

const POINTER_EVENT_BUTTON = {
    noButton:    -1,
    leftButton:  0,
    rightButton: 2,
};

const DEFAULT_MOUSE_EVENT_DETAIL_PROP_VALUE = {
    click:     1,
    dblclick:  2,
    mousedown: 1,
    mouseup:   1,
};

const KEY_EVENT_NAME_RE          = /^key\w+$/;
const MOUSE_EVENT_NAME_RE        = /^((mouse\w+)|((dbl)?click)|(contextmenu)|(drag\w*)|(drop))$/;
const TOUCH_EVENT_NAME_RE        = /^touch\w+$/;
const FOCUS_IN_OUT_EVENT_NAME_RE = /^focus(in|out)$/;

const MOUSE_EVENTS_TO_FORCE_POINTER_EVENTS = [
    'mouseover',
    'mouseenter',
    'mouseout',
];

const MOUSE_TO_POINTER_EVENT_TYPE_MAP = {
    mousedown:  'pointerdown',
    mouseup:    'pointerup',
    mousemove:  'pointermove',
    mouseover:  'pointerover',
    mouseenter: 'pointerenter',
    mouseout:   'pointerout',
};

const TOUCH_TO_POINTER_EVENT_TYPE_MAP = {
    touchstart: 'pointerdown',
    touchend:   'pointerup',
    touchmove:  'pointermove',
};

const DISABLEABLE_HTML_ELEMENT_TYPE_CHECKERS = [
    domUtils.isButtonElement,
    domUtils.isFieldSetElement,
    domUtils.isInputElement,
    domUtils.isOptGroupElement,
    domUtils.isOptionElement,
    domUtils.isSelectElement,
    domUtils.isTextAreaElement,
];

export default class EventSimulator {
    DISPATCHED_EVENT_FLAG = 'hammerhead|dispatched-event';

    touchIdentifier: any;

    constructor () {
        this.touchIdentifier = nativeMethods.dateNow();
    }

    static _dispatchStorageEvent (el, args) {
        const ev = nativeMethods.documentCreateEvent.call(document, 'StorageEvent');

        ev.initStorageEvent('storage', args.canBubble, args.cancelable, args.key, args.oldValue,
            args.newValue, args.url, null);

        nativeMethods.objectDefineProperty(ev, 'storageArea', {
            get:          () => args.storageArea,
            configurable: true,
        });

        if (args.key === null) {
            nativeMethods.objectDefineProperty(ev, 'key', {
                get:          () => null,
                configurable: true,
            });
        }

        return el.dispatchEvent(ev);
    }

    _dispatchTouchEvent (el, args) {
        if (shouldIgnoreEventInsideIframe(el, args.clientX, args.clientY))
            return true;

        let ev = nativeMethods.documentCreateEvent.call(document, 'TouchEvent');

        // HACK: A test for iOS by using initTouchEvent arguments.
        // TODO: Replace it with a user agent analysis later.
        if (ev.initTouchEvent) {
            if (browserUtils.isIOS) {
                ev.initTouchEvent(args.type, args.canBubble, args.cancelable, args.view,
                    args.detail, args.screenX, args.screenY, args.pageX, args.pageY, args.ctrlKey,
                    args.altKey, args.shiftKey, args.metaKey, args.touches, args.targetTouches,
                    args.changedTouches,
                    args.scale === void 0 ? 1.0 : args.scale,
                    // NOTE: B237995
                    args.rotation === void 0 ? 0.0 : args.rotation);

            }
            else if (ev.initTouchEvent.length === 12) {
                // NOTE: The Firefox.
                ev.initTouchEvent(args.type, args.canBubble, args.cancelable, args.view,
                    args.detail, args.ctrlKey, args.altKey, args.shiftKey, args.metaKey, args.touches,
                    args.targetTouches, args.changedTouches);
            }
            else {
                // NOTE: The default Android browser, Dolphin.
                ev.initTouchEvent(args.touches, args.targetTouches, args.changedTouches, args.type, args.view,
                    args.screenX, args.screenY, args.pageX - args.view.pageXOffset, args.pageY - args.view.pageYOffset,
                    args.ctrlKey, args.altKey, args.shiftKey, args.metaKey);
            }
        }
        else {
            ev = new nativeMethods.WindowTouchEvent(args.type, {
                touches:          args.touches,
                targetTouches:    args.targetTouches,
                changedTouches:   args.changedTouches,
                ctrlKey:          args.ctrlKey,
                altKey:           args.altKey,
                shiftKey:         args.shiftKey,
                metaKey:          args.metaKey,
                bubbles:          args.canBubble,
                cancelable:       args.cancelable,
                cancelBubble:     false,
                defaultPrevented: false,
                detail:           args.detail,
                view:             args.view,
            });
        }

        if (eventUtils.hasPointerEvents)
            this._dispatchPointerEvent(el, args);

        return el.dispatchEvent(ev);
    }

    static _getUIEventArgs (type, options: any = {}) {
        const detail = 'detail' in options ? options.detail : DEFAULT_MOUSE_EVENT_DETAIL_PROP_VALUE[type];

        return {
            type:       type,
            composed:   options.composed,
            canBubble:  options.canBubble !== false,
            cancelable: options.cancelable !== false,
            view:       options.view || window,
            detail:     detail || 0,
            ctrlKey:    options.ctrlKey || false,
            altKey:     options.altKey || false,
            shiftKey:   options.shiftKey || false,
            metaKey:    options.metaKey || false,
        };
    }

    static _getStorageEventArgs (options: any = {}) {
        return extend(options, {
            canBubble:  options.canBubble !== false,
            cancelable: options.cancelable !== false,
        });
    }

    static _getMouseEventArgs (type, options: any = {}) {
        return extend(EventSimulator._getUIEventArgs(type, options), {
            screenX:       options.screenX || 0,
            screenY:       options.screenY || 0,
            clientX:       options.clientX || 0,
            clientY:       options.clientY || 0,
            button:        options.button === void 0 ? eventUtils.BUTTON.left : options.button,
            buttons:       options.buttons === void 0 ? eventUtils.BUTTONS_PARAMETER.leftButton : options.buttons,
            relatedTarget: options.relatedTarget || null,
            which:         options.which,
        });
    }

    static _getKeyEventArgs (type, options) {
        const keyOptions: any = {
            keyCode:  options.keyCode || 0,
            charCode: options.charCode || 0,
            which:    type === 'press' ? options.charCode : options.keyCode,
        };

        if ('keyIdentifier' in options)
            keyOptions.keyIdentifier = options.keyIdentifier;

        if ('key' in options)
            keyOptions.key = options.key;

        return extend(EventSimulator._getUIEventArgs(type, options), keyOptions);
    }

    static _getModifiersAsString (args) {
        let modifiersString = '';

        for (const modifier in eventUtils.KEYBOARD_MODIFIERS_PARAMETER) {
            if (nativeMethods.objectHasOwnProperty.call(eventUtils.KEYBOARD_MODIFIERS_PARAMETER, modifier) && args[modifier])
                modifiersString += eventUtils.KEYBOARD_MODIFIERS_PARAMETER[modifier] + ' ';
        }

        return modifiersString;
    }

    static _prepareMouseEventOptions (options: any = {}) {
        const buttons = options.buttons === void 0 ? eventUtils.BUTTONS_PARAMETER.noButton : options.buttons;
        const button  = eventUtils.BUTTON.left;

        options.buttons = buttons;
        options.button  = options.button || button;

        if (browserUtils.isWebKit) {
            options.which = eventUtils.WHICH_PARAMETER.leftButton;

            if (options.buttons === eventUtils.BUTTONS_PARAMETER.noButton)
                options.which = eventUtils.WHICH_PARAMETER.noButton;
            if (options.buttons === eventUtils.BUTTONS_PARAMETER.rightButton)
                options.which = eventUtils.WHICH_PARAMETER.rightButton;
        }

        return options;
    }

    static _isDisabled (node): boolean {
        return node && node.hasAttribute && nativeMethods.hasAttribute.call(node, 'disabled');
    }

    _simulateEvent (el, event, userOptions, options = {}) {
        let args     = null;
        let dispatch = null;
        // NOTE: We don't simulate a click on links with modifiers (ctrl, shift, ctrl+shift, alt),
        // because it causes the opening of a browser window or additional tabs in it or loading files.
        const isClickOnLink = event === 'click' && domUtils.isAnchorElement(el);
        let opts            = extend(
            userOptions ? {
                clientX:       userOptions.clientX,
                clientY:       userOptions.clientY,
                screenX:       userOptions.screenX,
                screenY:       userOptions.screenY,
                altKey:        isClickOnLink ? false : userOptions.alt,
                shiftKey:      isClickOnLink ? false : userOptions.shift,
                ctrlKey:       isClickOnLink ? false : userOptions.ctrl,
                metaKey:       userOptions.meta,
                button:        userOptions.button,
                which:         userOptions.which,
                buttons:       userOptions.buttons,
                relatedTarget: userOptions.relatedTarget,
            } : {},
            options);

        opts.composed = eventUtils.isComposedEvent(event);

        if (!opts.relatedTarget)
            opts.relatedTarget = document.body;

        if (event === 'storage') {
            opts     = extend(opts, userOptions);
            args     = EventSimulator._getStorageEventArgs(opts);
            dispatch = EventSimulator._dispatchStorageEvent;
        }

        else if (MOUSE_EVENT_NAME_RE.test(event)) {
            if (userOptions && userOptions.button !== void 0)
                opts = extend(opts, { button: userOptions.button });

            args = EventSimulator._getMouseEventArgs(event, opts);
            // eslint-disable-next-line no-shadow
            dispatch = (el, args) => this._dispatchMouseRelatedEvents(el, args, userOptions);
        }

        else if (KEY_EVENT_NAME_RE.test(event)) {
            if (userOptions &&
                (userOptions.keyCode !== void 0 || userOptions.charCode !== void 0)) {
                opts = extend(opts, {
                    key:      userOptions.key || void 0,
                    keyCode:  userOptions.keyCode || 0,
                    charCode: userOptions.charCode || 0,
                });

                if ('keyIdentifier' in userOptions)
                    opts.keyIdentifier = userOptions.keyIdentifier;

                if ('key' in userOptions)
                    opts.key = userOptions.key;
            }

            args = EventSimulator._getKeyEventArgs(event, opts);
            // eslint-disable-next-line no-shadow
            dispatch = (el, args) => this._dispatchKeyEvent(el, args);
        }

        else if (TOUCH_EVENT_NAME_RE.test(event)) {
            args     = this._getTouchEventArgs(event, extend(opts, { target: el }));
            // eslint-disable-next-line no-shadow
            dispatch = (el, args) => this._dispatchTouchEvent(el, args);
        }

        return dispatch(el, args);
    }

    _getTouchEventArgs (type, options: any = {}) {
        const args = extend(EventSimulator._getUIEventArgs(type, options), {
            screenX:    options.screenX || 0,
            screenY:    options.screenY || 0,
            clientX:    options.clientX || 0,
            clientY:    options.clientY || 0,
            pageX:      options.clientX || 0,
            pageY:      options.clientY || 0,
            identifier: this._getTouchIdentifier(type),
        });

        if (nativeMethods.documentCreateTouch) {
            if (browserUtils.isIOS)
                args.touch = nativeMethods.documentCreateTouch.call(document, args.view, options.target, args.identifier, args.clientX, args.clientY, 0, 0);
            else {
                // NOTE: B237995
                args.touch = nativeMethods.documentCreateTouch.call(document, args.view, options.target, args.identifier, args.pageX, args.pageY,
                    args.screenX, args.screenY, args.clientX, args.clientY, null, null,
                    args.rotation === void 0 ? 0 : args.rotation);
            }
        }
        else {
            args.touch = new nativeMethods.WindowTouch({
                identifier:    args.identifier,
                target:        options.target,
                clientX:       args.clientX,
                clientY:       args.clientY,
                pageX:         args.pageX,
                pageY:         args.pageY,
                screenX:       args.screenX,
                screenY:       args.screenY,
                rotationAngle: 0,
                radiusX:       TOUCH_EVENT_RADIUS,
                radiusY:       TOUCH_EVENT_RADIUS,
                force:         TOUCH_EVENT_FORCE,
            });
        }

        args.changedTouches = [args.touch];
        // NOTE: T170088
        args.touches        = args.type === 'touchend' ? [] : args.changedTouches;

        if (nativeMethods.documentCreateTouchList) {
            args.changedTouches = nativeMethods.documentCreateTouchList.call(document, ...args.changedTouches);
            args.touches        = nativeMethods.documentCreateTouchList.call(document, ...args.touches);
        }

        args.targetTouches = args.touches;

        return args;
    }

    _getTouchIdentifier (type) {
        // NOTE: A touch point is created when the 'touchstart' event occurs. When the point' is moved,
        // its id must not be changed (T112153).
        if (type === 'touchstart')
            this.touchIdentifier++;

        return this.touchIdentifier;
    }

    _dispatchKeyEvent (el, args) {
        let ev = null;

        if (nativeMethods.WindowKeyboardEvent) {
            const eventArgs: any = {
                bubbles:          args.canBubble,
                composed:         args.composed,
                cancelable:       args.cancelable,
                cancelBubble:     false,
                defaultPrevented: false,
                view:             args.view,
                detail:           args.detail,
                ctrlKey:          args.ctrlKey,
                altKey:           args.altKey,
                shiftKey:         args.shiftKey,
                metaKey:          args.metaKey,
                keyCode:          args.keyCode,
                charCode:         args.charCode,
                which:            args.which,
            };

            if ('keyIdentifier' in args)
                eventArgs.keyIdentifier = args.keyIdentifier;

            if ('key' in args)
                eventArgs.key = args.key;

            ev = new nativeMethods.WindowKeyboardEvent(args.type, eventArgs);
        }
        else if (nativeMethods.documentCreateEvent) {
            ev = nativeMethods.documentCreateEvent.call(document, 'KeyboardEvent');

            ev.initKeyboardEvent(args.type, args.canBubble, args.cancelable, args.view, '', 0, EventSimulator._getModifiersAsString(args), false, '');
        }

        if (ev) {
            // NOTE: the window.event.keyCode, window.event.charCode, window.event.which and
            // window.event.key properties are not assigned after KeyboardEvent is created
            nativeMethods.objectDefineProperty(ev, 'keyCode', {
                configurable: true,
                enumerable:   true,
                get:          () => args.keyCode,
            });

            nativeMethods.objectDefineProperty(ev, 'charCode', {
                configurable: true,
                enumerable:   true,
                get:          () => args.charCode,
            });

            nativeMethods.objectDefineProperty(ev, 'which', {
                configurable: true,
                enumerable:   true,
                get:          () => args.which,
            });

            if ('key' in args) {
                nativeMethods.objectDefineProperty(ev, 'key', {
                    configurable: true,
                    enumerable:   true,
                    get:          () => args.key,
                });
            }

            if ('keyIdentifier' in args) {
                nativeMethods.objectDefineProperty(ev, 'keyIdentifier', {
                    configurable: true,
                    enumerable:   true,
                    get:          () => args.keyIdentifier,
                });
            }

            let defaultPrevented = false;

            // NOTE: the dispatchEvent method does not return false in the case when preventDefault method
            // was called for events that were created with the KeyboardEvent constructor
            ev.preventDefault = function () {
                defaultPrevented = true;
                nativeMethods.preventDefault.call(ev);

                return false;
            };

            this._raiseDispatchEvent(el, ev);

            return !defaultPrevented;
        }

        return null;
    }

    _getPointerEventTypeInfo (type: string): { eventType: string; pointerType: string } {
        if (MOUSE_TO_POINTER_EVENT_TYPE_MAP[type]) {
            return {
                eventType:   MOUSE_TO_POINTER_EVENT_TYPE_MAP[type],
                pointerType: 'mouse',
            };
        }

        if (TOUCH_TO_POINTER_EVENT_TYPE_MAP[type]) {
            return {
                eventType:   TOUCH_TO_POINTER_EVENT_TYPE_MAP[type],
                pointerType: 'touch',
            };
        }

        return null;
    }

    _dispatchPointerEvent (el, args) {
        const pointerEventTypeInfo = this._getPointerEventTypeInfo(args.type);

        if (!pointerEventTypeInfo)
            return;

        const { eventType, pointerType } = pointerEventTypeInfo;

        let pointEvent         = null;
        const elPosition       = getOffsetPosition(el);
        const elBorders        = getBordersWidth(el);
        const elClientPosition = offsetToClientCoords({
            x: elPosition.left + elBorders.left,
            y: elPosition.top + elBorders.top,
        });

        const pointerArgs = extend({
            width:     1,
            height:    1,
            pressure:  0,
            tiltX:     0,
            tiltY:     0,
            // NOTE: This parameter must be "1" for “mouse”.
            pointerId: 1,
            pointerType,
            timeStamp: nativeMethods.dateNow(),
            isPrimary: true,
        }, args);

        pointerArgs.type    = eventType;
        pointerArgs.offsetX = args.clientX - elClientPosition.x;
        pointerArgs.offsetY = args.clientY - elClientPosition.y;

        if (args.type === 'mousemove' || args.type === 'mouseover' || args.type === 'mouseout')
            pointerArgs.button = args.buttons === eventUtils.BUTTONS_PARAMETER.noButton ? POINTER_EVENT_BUTTON.noButton : pointerArgs.button;

        pointerArgs.bubbles    = true;
        pointerArgs.cancelable = true;

        pointEvent = new nativeMethods.WindowPointerEvent(eventType, pointerArgs);

        this._raiseDispatchEvent(el, pointEvent);
    }

    _elementCanBeDisabled (el): boolean {
        for (const elementCanBeDisabled of DISABLEABLE_HTML_ELEMENT_TYPE_CHECKERS) {
            if (elementCanBeDisabled(el))
                return true;
        }

        return false;
    }

    _dispatchMouseRelatedEvents (el, args, userOptions = {}) {
        if (args.type !== 'mouseover' && args.type !== 'mouseenter' && shouldIgnoreEventInsideIframe(el, args.clientX, args.clientY))
            return true;

        if (eventUtils.hasPointerEvents && (!isTouchDevice || MOUSE_EVENTS_TO_FORCE_POINTER_EVENTS.includes(args.type)))
            this._dispatchPointerEvent(el, args);

        return this._dispatchMouseEvent(el, args, userOptions);
    }

    _dispatchMouseEvent (el, args, { dataTransfer, timeStamp }: any) {
        const disabledParent = domUtils.findParent(el, false, node => {
            return this._elementCanBeDisabled(node) && EventSimulator._isDisabled(node);
        });

        const shouldNotRaiseEvents =
            (disabledParent && this._elementCanBeDisabled(el)) || // eslint-disable-line @typescript-eslint/no-extra-parens
            (EventSimulator._isDisabled(el) && this._elementCanBeDisabled(el)); // eslint-disable-line @typescript-eslint/no-extra-parens

        if (shouldNotRaiseEvents)
            return null;

        let event = null;

        if (nativeMethods.WindowMouseEvent) {
            event = new nativeMethods.WindowMouseEvent(args.type, {
                bubbles:       args.canBubble,
                composed:      args.composed,
                cancelable:    args.cancelable,
                view:          window,
                detail:        args.detail,
                screenX:       args.screenX,
                screenY:       args.screenY,
                clientX:       args.clientX,
                clientY:       args.clientY,
                ctrlKey:       args.ctrlKey,
                altKey:        args.altKey,
                shiftKey:      args.shiftKey,
                metaKey:       args.metaKey,
                button:        args.button,
                buttons:       args.buttons,
                relatedTarget: args.relatedTarget,
            });
        }
        else {
            event = nativeMethods.documentCreateEvent.call(document, 'MouseEvents');

            event.initMouseEvent(args.type, args.canBubble, args.cancelable, window, args.detail, args.screenX,
                args.screenY, args.clientX, args.clientY, args.ctrlKey, args.altKey, args.shiftKey, args.metaKey,
                args.button, args.relatedTarget);

            nativeMethods.objectDefineProperty(event, 'buttons', {
                get: () => args.buttons,
            });
        }

        // NOTE: T188166 (act.hover triggers the mouseenter event with the "which" parameter set to 1).
        if (args.which !== void 0 && browserUtils.isWebKit) {
            nativeMethods.objectDefineProperty(event, 'which', {
                get: () => args.which,
            });
        }

        if (timeStamp) {
            nativeMethods.objectDefineProperty(event, 'timeStamp', {
                get: () => timeStamp,
            });
        }

        if (dataTransfer) {
            nativeMethods.objectDefineProperty(event, 'dataTransfer', {
                configurable: true,
                enumerable:   true,
                get:          () => dataTransfer,
            });
        }

        return this._raiseDispatchEvent(el, event);
    }

    _dispatchFocusEvent (el, name, relatedTarget = null) {
        let event     = null;
        const bubbles = FOCUS_IN_OUT_EVENT_NAME_RE.test(name);

        if (nativeMethods.WindowFocusEvent) {
            event = new nativeMethods.WindowFocusEvent(name, {
                bubbles:          bubbles,
                composed:         eventUtils.isComposedEvent(name),
                cancelable:       false,
                cancelBubble:     false,
                relatedTarget:    relatedTarget,
                defaultPrevented: false,
            });
        }
        else if (nativeMethods.documentCreateEvent) {
            event = nativeMethods.documentCreateEvent.call(document, 'FocusEvent');

            event.initFocusEvent(name, bubbles, true, null, 0, bubbles ? relatedTarget : null);
        }

        if (event) {
            event[this.DISPATCHED_EVENT_FLAG] = true;

            return this._raiseDispatchEvent(el, event);
        }

        return null;
    }

    _dispatchTextEvent (el, text) {
        if (nativeMethods.WindowTextEvent && nativeMethods.documentCreateEvent) {
            const event = nativeMethods.documentCreateEvent.call(document, 'TextEvent');

            const args = {
                eventType:  'textInput',
                bubbles:    true,
                cancelable: true,
                view:       window,
                data:       text,
            };

            event.initTextEvent(args.eventType, args.bubbles, args.cancelable, args.view, args.data);

            return this._raiseDispatchEvent(el, event);
        }

        return null;
    }

    _dispatchInputEvent (el: EventTarget, type: string, data?: string | null) {
        if (!nativeMethods.WindowInputEvent)
            return this._dispatchEvent(el, type, true);

        const args = {
            bubbles:    true,
            composed:   eventUtils.isComposedEvent(type),
            cancelable: true,
            view:       window,
            inputType:  'insertText',
        } as InputEventInit;

        if (data !== void 0)
            args.data = data;

        const event = new nativeMethods.WindowInputEvent(type, args);

        return this._raiseDispatchEvent(el, event);
    }

    _dispatchEvent (el, name, shouldBubble, flag?: string) {
        let ev = null;

        if (nativeMethods.documentCreateEvent) {
            ev = nativeMethods.documentCreateEvent.call(document, 'Events');

            ev.initEvent(name, shouldBubble, true);
        }

        if (ev) {
            if (flag)
                ev[flag] = true;

            return this._raiseDispatchEvent(el, ev);
        }

        return null;
    }

    _raiseDispatchEvent (el, ev) {
        return el.dispatchEvent(ev);
    }

    /* NOTE: options = {
     [clientX: integer,]
     [clientY: integer,]
     [alt: true|false,]
     [ctrl: true|false,]
     [shift: true|false,]
     [meta: true|false,]
     [button: Util.BUTTON]
    } */

    click (el, options) {
        return this._simulateEvent(el, 'click', options, {
            button:  eventUtils.BUTTON.left,
            buttons: eventUtils.BUTTONS_PARAMETER.noButton,
        });
    }

    nativeClick (el, originClick) {
        originClick.call(el);
    }

    dblclick (el, options) {
        return this._simulateEvent(el, 'dblclick', options, {
            button:  eventUtils.BUTTON.left,
            buttons: eventUtils.BUTTONS_PARAMETER.noButton,
        });
    }

    rightclick (el, options) {
        return this._simulateEvent(el, 'click', options, {
            button:  eventUtils.BUTTON.right,
            buttons: eventUtils.BUTTONS_PARAMETER.rightButton,
        });
    }

    contextmenu (el, options) {
        return this._simulateEvent(el, 'contextmenu', options, {
            button:  eventUtils.BUTTON.right,
            buttons: eventUtils.BUTTONS_PARAMETER.noButton,
        });
    }

    mousedown (el, options: any = {}) {
        const button  = options.button === void 0 ? eventUtils.BUTTON.left : options.button;
        const buttons = button === eventUtils.BUTTON.left ? eventUtils.BUTTONS_PARAMETER.leftButton : eventUtils.BUTTONS_PARAMETER.rightButton;

        options.button  = button;
        options.buttons = options.buttons === void 0 ? buttons : options.buttons;

        return this._simulateEvent(el, 'mousedown', options);
    }

    mouseup (el, options: any = {}) {
        const button  = options.button === void 0 ? eventUtils.BUTTON.left : options.button;

        return this._simulateEvent(el, 'mouseup', options, {
            button,
            buttons: eventUtils.BUTTONS_PARAMETER.noButton,
        });
    }

    mouseover (el, options) {
        options = EventSimulator._prepareMouseEventOptions(options);

        return this._simulateEvent(el, 'mouseover', options);
    }

    mousemove (el, options) {
        options = EventSimulator._prepareMouseEventOptions(options);

        return this._simulateEvent(el, 'mousemove', options, { cancelable: false });
    }

    mouseout (el, options) {
        options = EventSimulator._prepareMouseEventOptions(options);

        return this._simulateEvent(el, 'mouseout', options);
    }

    mouseenter (el, options) {
        options = EventSimulator._prepareMouseEventOptions(options);

        return this._simulateEvent(el, 'mouseenter', options, { canBubble: false });
    }

    mouseleave (el, options) {
        options = EventSimulator._prepareMouseEventOptions(options);

        return this._simulateEvent(el, 'mouseleave', options, { canBubble: false });
    }

    // NOTE: Keyboard events.
    keypress (el, options) {
        return this._simulateEvent(el, 'keypress', options);
    }

    keyup (el, options) {
        return this._simulateEvent(el, 'keyup', options);
    }

    keydown (el, options) {
        return this._simulateEvent(el, 'keydown', options);
    }

    // NOTE: Control events.
    // NOTE: "focus", "blur" and "selectionchange" shouldn't bubble (T229732),
    // but "input", "change" and "submit" should do it (GH-318).
    blur (el, relatedTarget?) {
        return this._dispatchFocusEvent(el, 'blur', relatedTarget);
    }

    focus (el, relatedTarget?) {
        return this._dispatchFocusEvent(el, 'focus', relatedTarget);
    }

    focusin (el, relatedTarget) {
        return this._dispatchFocusEvent(el, 'focusin', relatedTarget);
    }

    focusout (el, relatedTarget) {
        return this._dispatchFocusEvent(el, 'focusout', relatedTarget);
    }

    storage (window: Window, options: HammerheadStorageEventInit) {
        return this._simulateEvent(window, 'storage', options);
    }

    change (el) {
        return this._dispatchEvent(el, 'change', true, this.DISPATCHED_EVENT_FLAG);
    }

    textInput (el: EventTarget, data?: string | null) {
        return this._dispatchTextEvent(el, data);
    }

    beforeInput (el: EventTarget, data?: string | null) {
        return this._dispatchInputEvent(el, 'beforeinput', data);
    }

    input (el: EventTarget, data?: string | null) {
        return this._dispatchInputEvent(el, 'input', data);
    }

    submit (el) {
        return this._dispatchEvent(el, 'submit', true);
    }

    selectionchange (el) {
        return this._dispatchEvent(el, 'selectionchange', false);
    }

    // NOTE: Touch events.
    touchstart (el, options) {
        return this._simulateEvent(el, 'touchstart', options);
    }

    touchend (el, options) {
        return this._simulateEvent(el, 'touchend', options);
    }

    touchmove (el, options) {
        return this._simulateEvent(el, 'touchmove', options);
    }

    // NOTE: drag and drop
    dragstart (el, options) {
        return this._simulateEvent(el, 'dragstart', options);
    }

    drag (el, options) {
        return this._simulateEvent(el, 'drag', options);
    }

    dragenter (el, options) {
        return this._simulateEvent(el, 'dragenter', options);
    }

    dragover (el, options) {
        return this._simulateEvent(el, 'dragover', options);
    }

    dragleave (el, options) {
        return this._simulateEvent(el, 'dragleave', options);
    }

    drop (el, options) {
        return this._simulateEvent(el, 'drop', options);
    }

    dragend (el, options) {
        return this._simulateEvent(el, 'dragend', options);
    }
}
