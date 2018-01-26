import INTERNAL_PROPS from '../../../processing/dom/internal-properties';
import extend from '../../utils/extend';
import nativeMethods from '../native-methods';
import * as browserUtils from '../../utils/browser';
import * as domUtils from '../../utils/dom';
import * as eventUtils from '../../utils/event';
import { getOffsetPosition, offsetToClientCoords } from '../../utils/position';
import { getBordersWidth } from '../../utils/style';

const TOUCH_EVENT_RADIUS = 25;
const TOUCH_EVENT_FORCE  = 0.5;

const POINTER_EVENT_BUTTON = {
    noButton:    -1,
    leftButton:  0,
    rightButton: 2
};

const KEY_EVENT_NAME_RE          = /^key\w+$/;
const MOUSE_EVENT_NAME_RE        = /^((mouse\w+)|((dbl)?click)|(contextmenu)|(drag\w*)|(drop))$/;
const TOUCH_EVENT_NAME_RE        = /^touch\w+$/;
const FOCUS_IN_OUT_EVENT_NAME_RE = /^focus(in|out)$/;

export default class EventSimulator {
    constructor () {
        this.DISPATCHED_EVENT_FLAG = 'hammerhead|dispatched-event';

        this.touchIdentifier = nativeMethods.dateNow();
        // NOTE: (IE only) If event dispatching calls a native click function, we should clear the window.event
        // property (which was set in the raiseDispatchEvent function). Otherwise, the window.event property will
        // contain the dispatched event, not the native click event. We should restore the window.event value after
        // the click is handled. (B237144)
        this.savedWindowEvents     = [];
        this.savedNativeClickCount = 0;
    }

    static _dispatchStorageEvent (el, args) {
        const ev = nativeMethods.documentCreateEvent.call(document, 'StorageEvent');

        ev.initStorageEvent('storage', args.canBubble, args.cancelable, args.key, args.oldValue,
            args.newValue, args.url, null);

        nativeMethods.objectDefineProperty.call(window.Object, ev, 'storageArea', {
            get:          () => args.storageArea,
            configurable: true
        });

        if (args.key === null) {
            nativeMethods.objectDefineProperty.call(window.Object, ev, 'key', {
                get:          () => null,
                configurable: true
            });
        }

        return el.dispatchEvent(ev);
    }

    static _dispatchTouchEvent (el, args) {
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
                view:             args.view
            });
        }

        return el.dispatchEvent(ev);
    }

    static _getUIEventArgs (type, options) {
        const opts = options || {};

        return {
            type:       type,
            canBubble:  opts.canBubble !== false,
            cancelable: opts.cancelable !== false,
            view:       opts.view || window,
            detail:     opts.detail || 0,
            ctrlKey:    opts.ctrlKey || false,
            altKey:     opts.altKey || false,
            shiftKey:   opts.shiftKey || false,
            metaKey:    opts.metaKey || false
        };
    }

    static _getStorageEventArgs (options) {
        const opts = options || {};

        return extend(opts, {
            canBubble:  opts.canBubble !== false,
            cancelable: opts.cancelable !== false
        });
    }

    static _getMouseEventArgs (type, options) {
        const opts = options || {};

        return extend(EventSimulator._getUIEventArgs(type, options), {
            screenX:       opts.screenX || 0,
            screenY:       opts.screenY || 0,
            clientX:       opts.clientX || 0,
            clientY:       opts.clientY || 0,
            button:        opts.button === void 0 ? eventUtils.BUTTON.left : opts.button,
            buttons:       opts.buttons === void 0 ? eventUtils.BUTTONS_PARAMETER.leftButton : opts.buttons,
            relatedTarget: opts.relatedTarget || null,
            which:         opts.which === void 0 ? eventUtils.WHICH_PARAMETER.leftButton : opts.which
        });
    }

    static _getKeyEventArgs (type, options) {
        const keyOptions = {
            keyCode:  options.keyCode || 0,
            charCode: options.charCode || 0,
            which:    type === 'press' ? options.charCode : options.keyCode
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

    _simulateEvent (el, event, userOptions, options) {
        let args     = null;
        let dispatch = null;
        // NOTE: We don't simulate a click on links with modifiers (ctrl, shift, ctrl+shift, alt),
        // because it causes the opening of a browser window or additional tabs in it or loading files.
        const isClickOnLink = event === 'click' && domUtils.isAnchorElement(el);
        let opts            = extend(
            userOptions ? {
                clientX:       userOptions.clientX,
                clientY:       userOptions.clientY,
                altKey:        isClickOnLink ? false : userOptions.alt,
                shiftKey:      isClickOnLink ? false : userOptions.shift,
                ctrlKey:       isClickOnLink ? false : userOptions.ctrl,
                metaKey:       userOptions.meta,
                button:        userOptions.button,
                which:         userOptions.which,
                buttons:       userOptions.buttons,
                relatedTarget: userOptions.relatedTarget
            } : {},
            options || {});

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
            /* eslint-disable no-shadow */
            dispatch = (el, args) => this._dispatchMouseEvent(el, args, userOptions ? userOptions.dataTransfer : void 0);
            /* eslint-enable no-shadow */
        }

        else if (KEY_EVENT_NAME_RE.test(event)) {
            if (userOptions &&
                (userOptions.keyCode !== void 0 || userOptions.charCode !== void 0)) {
                opts = extend(opts, {
                    key:      userOptions.key || void 0,
                    keyCode:  userOptions.keyCode || 0,
                    charCode: userOptions.charCode || 0
                });

                if ('keyIdentifier' in userOptions)
                    opts.keyIdentifier = userOptions.keyIdentifier;

                if ('key' in userOptions)
                    opts.key = userOptions.key;
            }

            args = EventSimulator._getKeyEventArgs(event, opts);
            /* eslint-disable no-shadow */
            dispatch = (el, args) => this._dispatchKeyEvent(el, args);
            /* eslint-enable no-shadow */
        }

        else if (TOUCH_EVENT_NAME_RE.test(event)) {
            args     = this._getTouchEventArgs(event, extend(opts, { target: el }));
            dispatch = EventSimulator._dispatchTouchEvent;
        }

        return dispatch(el, args);
    }

    _getTouchEventArgs (type, options) {
        const opts = options || {};
        const args = extend(EventSimulator._getUIEventArgs(type, opts), {
            screenX:    opts.screenX || 0,
            screenY:    opts.screenY || 0,
            clientX:    opts.clientX || 0,
            clientY:    opts.clientY || 0,
            pageX:      opts.clientX || 0,
            pageY:      opts.clientY || 0,
            identifier: this._getTouchIdentifier(type)
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
                force:         TOUCH_EVENT_FORCE
            });
        }

        if (nativeMethods.documentCreateTouchList) {
            args.changedTouches = nativeMethods.documentCreateTouchList.call(document, args.touch);
            // NOTE: T170088
            args.touches        = args.type ===
                                  'touchend' ? nativeMethods.documentCreateTouchList.call(document) : args.changedTouches;
            args.targetTouches  = args.touches;
        }

        return args;
    }

    _getTouchIdentifier (type) {
        // NOTE: A touch point is created when the 'touchstart' event occurs. When the point' is moved,
        // its id must not be changed (T112153).
        if (type === 'touchstart')
            this.touchIdentifier++;

        return this.touchIdentifier;
    }

    _raiseNativeClick (el, originClick) {
        // NOTE: B254199
        const curWindow       = domUtils.isElementInIframe(el) ? domUtils.getIframeByElement(el).contentWindow : window;
        const prevWindowEvent = curWindow.event;

        if (browserUtils.isIE && browserUtils.version <= 11)
            delete curWindow.event;

        originClick.call(el);

        if (browserUtils.isIE && browserUtils.version < 11) {
            if (this.savedNativeClickCount--)
                this.savedWindowEvents.shift();

            if (this.savedWindowEvents.length) {
                nativeMethods.objectDefineProperty.call(window.Object, curWindow, 'event', {
                    get:          () => this.savedWindowEvents[0],
                    configurable: true
                });
            }
        }

        // NOTE: Window.event becomes empty when the click event handler
        // triggers the click event for a different element in IE11.(GH-226).
        if (browserUtils.isIE11 && prevWindowEvent) {
            nativeMethods.objectDefineProperty.call(window.Object, curWindow, 'event', {
                get:          () => prevWindowEvent,
                configurable: true
            });
        }
    }

    _dispatchKeyEvent (el, args) {
        let ev                          = null;
        const browserWithNewEventsStyle = !browserUtils.isIE || browserUtils.version > 11;

        if (browserWithNewEventsStyle && nativeMethods.WindowKeyboardEvent) {
            const eventArgs = {
                bubbles:          args.canBubble,
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
                which:            args.which
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
            nativeMethods.objectDefineProperty.call(window.Object, ev, 'keyCode', {
                configurable: true,
                enumerable:   true,
                get:          () => args.keyCode
            });

            nativeMethods.objectDefineProperty.call(window.Object, ev, 'charCode', {
                configurable: true,
                enumerable:   true,
                get:          () => args.charCode
            });

            nativeMethods.objectDefineProperty.call(window.Object, ev, 'which', {
                configurable: true,
                enumerable:   true,
                get:          () => args.which
            });

            if ('key' in args) {
                nativeMethods.objectDefineProperty.call(window.Object, ev, 'key', {
                    configurable: true,
                    enumerable:   true,
                    get:          () => args.key
                });
            }

            if ('keyIdentifier' in args) {
                nativeMethods.objectDefineProperty.call(window.Object, ev, 'keyIdentifier', {
                    configurable: true,
                    enumerable:   true,
                    get:          () => args.keyIdentifier
                });
            }

            let prevented   = false;
            let returnValue = true;

            // NOTE: the dispatchEvent method does not return false in the case when preventDefault
            // was raised for events that were created with the KeyboardEvent constructor
            if (browserWithNewEventsStyle) {
                nativeMethods.objectDefineProperty.call(window.Object, ev, 'preventDefault', {
                    get: () => () => {
                        prevented = true;

                        return false;
                    },

                    set: () => void 0
                });
            }

            // NOTE: the dispatchEvent method does not return false when returnValue was set to false (only in MSEdge)
            if (browserUtils.isMSEdge) {
                nativeMethods.objectDefineProperty.call(window.Object, ev, 'returnValue', {
                    get: () => returnValue,
                    set: value => {
                        if (value === false)
                            ev.preventDefault();

                        returnValue = value;
                    }
                });
            }

            const res = this._raiseDispatchEvent(el, ev, args);

            if (browserUtils.isMSEdge)
                return returnValue && !prevented;
            else if (browserUtils.isIE)
                return res;

            return !prevented;
        }

        return null;
    }

    _dispatchPointerEvent (el, args) {
        let pointEvent         = null;
        const elPosition       = getOffsetPosition(el);
        const elBorders        = getBordersWidth(el);
        const elClientPosition = offsetToClientCoords({
            x: elPosition.left + elBorders.left,
            y: elPosition.top + elBorders.top
        });
        const eventShortType   = args.type.replace('mouse', '');
        const pointerEventType = 'pointer' + eventShortType;

        const pointerArgs = extend({
            width:       1,
            height:      1,
            pressure:    0,
            tiltX:       0,
            tiltY:       0,
            // NOTE: This parameter must be "1" for “mouse”.
            pointerId:   1,
            pointerType: 'mouse',
            timeStamp:   nativeMethods.dateNow(),
            isPrimary:   true
        }, args);

        pointerArgs.type    = pointerEventType;
        pointerArgs.offsetX = args.clientX - elClientPosition.x;
        pointerArgs.offsetY = args.clientY - elClientPosition.y;
        pointerArgs.button  = args.buttons === eventUtils.BUTTONS_PARAMETER.noButton ?
                              POINTER_EVENT_BUTTON.noButton : pointerArgs.button;

        if (browserUtils.isIE) {
            pointerArgs.rotation = 0;

            pointEvent = nativeMethods.documentCreateEvent.call(document, 'PointerEvent');

            // NOTE: We set the relatedTarget argument to null because IE has a memory leak.
            pointEvent.initPointerEvent(pointerArgs.type, pointerArgs.canBubble, pointerArgs.cancelable, window,
                pointerArgs.detail, pointerArgs.screenX, pointerArgs.screenY, pointerArgs.clientX, pointerArgs.clientY,
                pointerArgs.ctrlKey, pointerArgs.altKey, pointerArgs.shiftKey, pointerArgs.metaKey, pointerArgs.button,
                null, pointerArgs.offsetX, pointerArgs.offsetY, pointerArgs.width, pointerArgs.height, pointerArgs.pressure,
                pointerArgs.rotation, pointerArgs.tiltX, pointerArgs.tiltY, pointerArgs.pointerId, pointerArgs.pointerType,
                pointerArgs.timeStamp, pointerArgs.isPrimary);

            // NOTE: After dispatching the pointer event, it doesn't contain the 'target' and 'relatedTarget' properties.
            nativeMethods.objectDefineProperty.call(window.Object, pointEvent, 'target', {
                get:          () => el,
                configurable: true
            });

            nativeMethods.objectDefineProperty.call(window.Object, pointEvent, 'relatedTarget', {
                get:          () => args.relatedTarget,
                configurable: true
            });

            nativeMethods.objectDefineProperty.call(window.Object, pointEvent, 'buttons', {
                get: () => args.buttons
            });
        }
        else {
            pointerArgs.bubbles    = true;
            pointerArgs.cancelable = true;

            pointEvent = new nativeMethods.WindowPointerEvent(pointerEventType, pointerArgs);
        }

        this._raiseDispatchEvent(el, pointEvent, pointerArgs);
    }

    _dispatchMouseEvent (el, args, dataTransfer) {
        let ev              = null;
        const pointerRegExp = /mouse(down|up|move|over|out)/;

        // NOTE: In IE, submit doesn't work if a click is simulated for some submit button's children (for example,
        // img, B236676). In addition, if a test is being recorded in IE, the target of a click event is always a
        // button, not a child, so the child does not receive the click event.
        if (browserUtils.isIE) {
            if (args.type === 'click' || args.type === 'mouseup' || args.type === 'mousedown') {
                const closestButton = domUtils.closest(el.parentNode, 'button');

                if (el.parentNode && closestButton) {
                    if (nativeMethods.getAttribute.call(closestButton, 'type') === 'submit')
                        el = closestButton;
                }
            }
        }

        if (eventUtils.hasPointerEvents && pointerRegExp.test(args.type))
            this._dispatchPointerEvent(el, args);

        ev = nativeMethods.documentCreateEvent.call(document, 'MouseEvents');
        ev.initMouseEvent(args.type, args.canBubble, args.cancelable, window, args.detail, args.screenX,
            args.screenY, args.clientX, args.clientY, args.ctrlKey, args.altKey, args.shiftKey, args.metaKey,
            args.button, args.relatedTarget);

        if (dataTransfer) {
            nativeMethods.objectDefineProperty.call(window.Object, ev, 'dataTransfer', {
                configurable: true,
                enumerable:   true,
                get:          () => dataTransfer
            });
        }

        if (browserUtils.isFirefox || browserUtils.isIE) {
            nativeMethods.objectDefineProperty.call(window.Object, ev, 'buttons', {
                get: () => args.buttons
            });
        }

        // NOTE: T188166 (act.hover triggers the mouseenter event with the "which" parameter set to 1).
        if (args.which !== void 0 && browserUtils.isWebKit) {
            nativeMethods.objectDefineProperty.call(window.Object, ev, INTERNAL_PROPS.whichPropertyWrapper, {
                get: () => args.which
            });
        }

        return this._raiseDispatchEvent(el, ev, args);
    }

    _dispatchFocusEvent (el, name) {
        const browserWithNewEventsStyle = !browserUtils.isIE || browserUtils.version > 11;
        let event                       = null;
        const bubbles                   = FOCUS_IN_OUT_EVENT_NAME_RE.test(name);

        if (browserWithNewEventsStyle && nativeMethods.WindowFocusEvent) {
            event = new nativeMethods.WindowFocusEvent(name, {
                bubbles:          bubbles,
                cancelable:       false,
                cancelBubble:     false,
                defaultPrevented: false
            });
        }
        else if (nativeMethods.documentCreateEvent) {
            event = nativeMethods.documentCreateEvent.call(document, 'FocusEvent');

            event.initEvent(name, bubbles, true);
        }

        if (event) {
            event[this.DISPATCHED_EVENT_FLAG] = true;

            return this._raiseDispatchEvent(el, event);
        }

        return null;
    }

    _dispatchEvent (el, name, shouldBubble, flag) {
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
        const isElementInIframe = domUtils.isElementInIframe(el);
        const iframe            = isElementInIframe ? domUtils.getIframeByElement(el) : null;
        const curWindow         = iframe ? iframe.contentWindow : window;

        if (browserUtils.isIE) {
            // NOTE: In IE, when we raise an event by using the dispatchEvent function, the window.event object is null.
            // If a real event happens, there is a window.event object, but it is not identical with the first argument
            // of the event handler. The window.Event object is identical with the object that is created when we raise
            // the event by using  the fireEvent function. So, when we raise the event by using the dispatchEvent function,
            // we need to set the window.event object manually. An exception for IE11: The window.event object is not null
            // and it’s the same as in the event handler (only in window.top.event). Also, in iE11, window.event doesn’t
            // have the returnValue property, so it’s impossible to prevent the event by assigning window.event.returnValue
            // to false.
            // NOTE: In IE11, iframe's window.event object is null. We need to set
            // iframe's window.event object manually by using window.event (B254199).
            if (browserUtils.version === 11 && iframe) {
                nativeMethods.objectDefineProperty.call(window.Object, iframe.contentWindow, 'event', {
                    get:          () => window.event,
                    configurable: true
                });
            }
        }

        const res = el.dispatchEvent(ev);

        // NOTE: GH-226
        if (browserUtils.isIE11)
            delete curWindow.event;

        return res;
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
            buttons: eventUtils.BUTTONS_PARAMETER.leftButton
        });
    }

    nativeClick (el, originClick) {
        this._raiseNativeClick(el, originClick);
    }

    dblclick (el, options) {
        return this._simulateEvent(el, 'dblclick', options, {
            button:  eventUtils.BUTTON.left,
            buttons: eventUtils.BUTTONS_PARAMETER.leftButton
        });
    }

    rightclick (el, options) {
        return this._simulateEvent(el, 'click', options, {
            button:  eventUtils.BUTTON.right,
            buttons: eventUtils.BUTTONS_PARAMETER.rightButton
        });
    }

    contextmenu (el, options) {
        return this._simulateEvent(el, 'contextmenu', options, {
            button:  eventUtils.BUTTON.right,
            which:   eventUtils.WHICH_PARAMETER.rightButton,
            buttons: eventUtils.BUTTONS_PARAMETER.rightButton
        });
    }

    mousedown (el, options) {
        options = options || {};

        options.button  = options.button === void 0 ? eventUtils.BUTTON.left : options.button;
        options.which   = options.which === void 0 || options.button !== eventUtils.BUTTON.right ?
                          eventUtils.WHICH_PARAMETER.leftButton : eventUtils.WHICH_PARAMETER.rightButton;
        options.buttons = options.buttons === void 0 ? eventUtils.BUTTONS_PARAMETER.leftButton : options.buttons;

        return this._simulateEvent(el, 'mousedown', options);
    }

    mouseup (el, options) {
        options = options || {};

        options.button  = options.button === void 0 ? eventUtils.BUTTON.left : options.button;
        options.which   = options.which === void 0 || options.button !== eventUtils.BUTTON.right ?
                          eventUtils.WHICH_PARAMETER.leftButton : eventUtils.WHICH_PARAMETER.rightButton;
        options.buttons = options.buttons === void 0 ? eventUtils.BUTTONS_PARAMETER.leftButton : options.buttons;

        return this._simulateEvent(el, 'mouseup', options);
    }

    mouseover (el, options) {
        return this._simulateEvent(el, 'mouseover', options);
    }

    mousemove (el, options) {
        return this._simulateEvent(el, 'mousemove', options, { cancelable: false });
    }

    mouseout (el, options) {
        return this._simulateEvent(el, 'mouseout', options);
    }

    mouseenter (el, options) {
        return this._simulateEvent(el, 'mouseenter', options, { canBubble: false });
    }

    mouseleave (el, options) {
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
    blur (el) {
        return this._dispatchFocusEvent(el, 'blur');
    }

    focus (el) {
        return this._dispatchFocusEvent(el, 'focus');
    }

    focusin (el) {
        return this._dispatchFocusEvent(el, 'focusin');
    }

    focusout (el) {
        return this._dispatchFocusEvent(el, 'focusout');
    }

    storage (window, options) {
        return this._simulateEvent(window, 'storage', options);
    }

    change (el) {
        return this._dispatchEvent(el, 'change', true, this.DISPATCHED_EVENT_FLAG);
    }

    input (el) {
        return this._dispatchEvent(el, 'input', true);
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


    isSavedWindowsEventsExists () {
        return this.savedWindowEvents && this.savedWindowEvents.length;
    }
}
