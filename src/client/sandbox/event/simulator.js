import INTERNAL_PROPS from '../../../processing/dom/internal-properties';
import extend from '../../utils/extend';
import nativeMethods from '../native-methods';
import * as browserUtils from '../../utils/browser';
import * as domUtils from '../../utils/dom';
import * as eventUtils from '../../utils/event';
import { getOffsetPosition, offsetToClientCoords } from '../../utils/position';
import { getBordersWidth, getElementScroll } from '../../utils/style';

const IE_BUTTONS_MAP = {
    0: 1,
    1: 4,
    2: 2
};

const POINTER_EVENT_BUTTON = {
    noButton:    -1,
    leftButton:  0,
    rightButton: 2
};

const KEY_EVENT_NAME_RE       = /^key\w+$/;
const MOUSE_EVENT_NAME_RE     = /^((mouse\w+)|((dbl)?click)|(contextmenu))$/;
const TOUCH_EVENT_NAME_RE     = /^touch\w+$/;
const MSPOINTER_EVENT_NAME_RE = /^MSPointer(Down|Up|Move|Over|Out)$/;

export default class EventSimulator {
    constructor () {
        this.DISPATCHED_EVENT_FLAG = 'hammerhead|dispatched-event';

        this.touchIdentifier  = nativeMethods.dateNow();
        this.clickedFileInput = null;
        // NOTE: (IE only) If event dispatching calls a native click function, we should clear the window.event
        // property (which was set in the raiseDispatchEvent function). Otherwise, the window.event property will
        // contain the dispatched event, not the native click event. We should restore the window.event value after
        // the click is handled. (B237144)
        this.savedWindowEvents     = [];
        this.savedNativeClickCount = 0;
    }

    static _dispatchStorageEvent (el, args) {
        var ev = document.createEvent('StorageEvent');

        ev.initStorageEvent('storage', args.canBubble, args.cancelable, args.key, args.oldValue,
            args.newValue, args.url, null);

        Object.defineProperty(ev, 'storageArea', {
            get:          () => args.storageArea,
            configurable: true
        });

        if (args.key === null) {
            Object.defineProperty(ev, 'key', {
                get:          () => null,
                configurable: true
            });
        }

        return el.dispatchEvent(ev);
    }

    static _dispatchTouchEvent (el, args) {
        var ev = document.createEvent('TouchEvent');

        // HACK: A test for iOS by using initTouchEvent arguments.
        // TODO: Replace it with a user agent analysis later.
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

        return el.dispatchEvent(ev);
    }

    static _getUIEventArgs (type, options) {
        var opts = options || {};

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
        var opts = options || {};

        return extend(opts, {
            canBubble:  opts.canBubble !== false,
            cancelable: opts.cancelable !== false
        });
    }

    static _getMouseEventArgs (type, options) {
        var opts = options || {};

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
        var opts = options || {};

        return extend(EventSimulator._getUIEventArgs(type, options), {
            keyCode:  opts.keyCode || 0,
            charCode: opts.charCode || 0,
            which:    type === 'press' ? opts.charCode : opts.keyCode
        });
    }

    _simulateEvent (el, event, userOptions, options) {
        var args     = null;
        var dispatch = null;
        // NOTE: We don't simulate a click on links with modifiers (ctrl, shift, ctrl+shift, alt),
        // because it causes the opening of a browser window or additional tabs in it or loading files.
        var isClickOnLink = event === 'click' && domUtils.isAnchorElement(el);
        var opts          = extend(
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
            dispatch = (el, args) => this._dispatchMouseEvent(el, args);
            /* eslint-enable no-shadow */
        }

        else if (KEY_EVENT_NAME_RE.test(event)) {
            if (userOptions &&
                (userOptions.keyCode !== void 0 || userOptions.charCode !== void 0)) {
                opts = extend(opts, {
                    keyCode:  userOptions.keyCode || 0,
                    charCode: userOptions.charCode || 0
                });
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
        var opts = options || {};
        var args = extend(EventSimulator._getUIEventArgs(type, opts), {
            screenX: opts.screenX || 0,
            screenY: opts.screenY || 0,
            clientX: opts.clientX || 0,
            clientY: opts.clientY || 0,
            pageX:   opts.clientX || 0,
            pageY:   opts.clientY || 0
        });

        if (browserUtils.isIOS) {
            args.touch = document.createTouch(args.view, options.target, this._getTouchIdentifier(args.type),
                args.clientX, args.clientY, 0, 0);
        }

        else {
            // NOTE: B237995
            args.touch = document.createTouch(args.view, options.target, this._getTouchIdentifier(args.type), args.pageX,
                args.pageY, args.screenX, args.screenY, args.clientX, args.clientY, null, null,
                args.rotation === void 0 ? 0 : args.rotation);
        }

        args.changedTouches = document.createTouchList(args.touch);
        // NOTE: T170088
        args.touches       = args.type === 'touchend' ? document.createTouchList() : args.changedTouches;
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

    _raiseNativeClick (el, originClick) {
        // NOTE: B254199
        var curWindow       = domUtils.isElementInIframe(el) ? domUtils.getIframeByElement(el).contentWindow : window;
        var prevWindowEvent = curWindow.event;

        if (browserUtils.isIE && browserUtils.version <= 11)
            delete curWindow.event;

        originClick.call(el);

        if (browserUtils.isIE && browserUtils.version < 11) {
            if (this.savedNativeClickCount--)
                this.savedWindowEvents.shift();

            if (this.savedWindowEvents.length) {
                Object.defineProperty(curWindow, 'event', {
                    get:          () => this.savedWindowEvents[0],
                    configurable: true
                });
            }
        }

        // NOTE: Window.event becomes empty when the click event handler
        // triggers the click event for a different element in IE11.(GH-226).
        if (browserUtils.isIE11 && prevWindowEvent) {
            Object.defineProperty(curWindow, 'event', {
                get:          () => prevWindowEvent,
                configurable: true
            });
        }
    }

    _dispatchKeyEvent (el, args) {
        var ev = null;

        if (document.createEvent) {
            ev = document.createEvent('Events');
            ev.initEvent(args.type, args.canBubble, args.cancelable);
            ev = extend(ev, {
                view:     args.view,
                detail:   args.detail,
                ctrlKey:  args.ctrlKey,
                altKey:   args.altKey,
                shiftKey: args.shiftKey,
                metaKey:  args.metaKey,
                keyCode:  args.keyCode,
                charCode: args.charCode,
                which:    args.which
            });

            return this._raiseDispatchEvent(el, ev, args);
        }

        return null;
    }

    _dispatchMouseEvent (el, args) {
        var ev            = null;
        var pointerRegExp = /mouse(down|up|move|over|out)/;

        // NOTE: In IE, submit doesn't work if a click is simulated for some submit button's children (for example,
        // img, B236676). In addition, if a test is being recorded in IE, the target of a click event is always a
        // button, not a child, so the child does not receive the click event.
        if (browserUtils.isIE) {
            if (args.type === 'click' || args.type === 'mouseup' || args.type === 'mousedown') {
                if (el.parentNode && domUtils.closest(el.parentNode, 'button')) {
                    var closestButton = domUtils.closest(el.parentNode, 'button');

                    if (nativeMethods.getAttribute.call(closestButton, 'type') === 'submit')
                        el = closestButton;
                }
            }
        }

        if (browserUtils.isIE && browserUtils.version > 9 && pointerRegExp.test(args.type)) {
            var pointEvent       = browserUtils.version >
                                   10 ? document.createEvent('PointerEvent') : document.createEvent('MSPointerEvent');
            var elPosition       = getOffsetPosition(el);
            var elBorders        = getBordersWidth(el);
            var elClientPosition = offsetToClientCoords({
                x: elPosition.left + elBorders.left,
                y: elPosition.top + elBorders.top
            });
            var eventShortType   = args.type.replace('mouse', '');
            var pArgs            = extend({
                widthArg:       browserUtils.version > 10 ? 1 : 0,
                heightArg:      browserUtils.version > 10 ? 1 : 0,
                pressure:       0,
                rotation:       0,
                tiltX:          0,
                tiltY:          0,
                // NOTE: This parameter must be "1" for “mouse”.
                pointerIdArg:   1,
                pointerType:    browserUtils.version > 10 ? 'mouse' : 4,
                hwTimestampArg: nativeMethods.dateNow(),
                isPrimary:      true
            }, args);

            pArgs.type       = browserUtils.version > 10 ? 'pointer' + eventShortType : 'MSPointer' +
                                                                                        eventShortType.charAt(0).toUpperCase() +
                                                                                        eventShortType.substring(1);
            pArgs.offsetXArg = args.clientX - elClientPosition.x;
            pArgs.offsetYArg = args.clientY - elClientPosition.y;
            pArgs.button     = args.buttons ===
                               eventUtils.BUTTONS_PARAMETER.noButton ? POINTER_EVENT_BUTTON.noButton : pArgs.button;

            // NOTE: We set the relatedTarget argument to null because IE has a memory leak.
            pointEvent.initPointerEvent(pArgs.type, pArgs.canBubble, pArgs.cancelable, window, pArgs.detail, pArgs.screenX,
                pArgs.screenY, pArgs.clientX, pArgs.clientY, pArgs.ctrlKey, pArgs.altKey, pArgs.shiftKey, pArgs.metaKey,
                pArgs.button, null, pArgs.offsetXArg, pArgs.offsetYArg, pArgs.widthArg, pArgs.heightArg,
                pArgs.pressure, pArgs.rotation, pArgs.tiltX, pArgs.tiltY, pArgs.pointerIdArg, pArgs.pointerType,
                pArgs.hwTimestampArg, pArgs.isPrimary);

            // NOTE: After dispatching the pointer event, it doesn't contain the 'target' and 'relatedTarget' properties.
            Object.defineProperty(pointEvent, 'target', {
                get:          () => el,
                configurable: true
            });

            Object.defineProperty(pointEvent, 'relatedTarget', {
                get:          () => args.relatedTarget,
                configurable: true
            });

            Object.defineProperty(pointEvent, 'buttons', {
                get: () => args.buttons
            });

            this._raiseDispatchEvent(el, pointEvent, pArgs);
        }

        ev = document.createEvent('MouseEvents');
        ev.initMouseEvent(args.type, args.canBubble, args.cancelable, window, args.detail, args.screenX,
            args.screenY, args.clientX, args.clientY, args.ctrlKey, args.altKey, args.shiftKey, args.metaKey,
            args.button, args.relatedTarget);

        if (browserUtils.isFirefox || browserUtils.isIE) {
            Object.defineProperty(ev, 'buttons', {
                get: () => args.buttons
            });
        }

        // NOTE: T188166 (act.hover triggers the mouseenter event with the "which" parameter set to 1).
        if (args.which !== void 0 && browserUtils.isWebKit) {
            Object.defineProperty(ev, INTERNAL_PROPS.whichPropertyWrapper, {
                get: () => args.which
            });
        }

        // NOTE: After MouseEvent was created by using the initMouseEvent method, the pageX and pageY properties are
        // equal to zero (only in IE9). We can set them only by using the defineProperty method (B253930).
        if (browserUtils.isIE9) {
            var currentDocument = domUtils.findDocument(el);
            var documentScroll  = getElementScroll(currentDocument);

            Object.defineProperty(ev, 'pageX', {
                get: () => ev.clientX + documentScroll.left
            });

            Object.defineProperty(ev, 'pageY', {
                get: () => ev.clientY + documentScroll.top
            });
        }

        return this._raiseDispatchEvent(el, ev, args);
    }

    _dispatchEvent (el, name, shouldBubble, flag) {
        var ev = null;

        if (document.createEvent) {
            ev = document.createEvent('Events');

            ev.initEvent(name, shouldBubble, true);

            if (flag)
                ev[flag] = true;

            return this._raiseDispatchEvent(el, ev);
        }

        return null;
    }

    _raiseDispatchEvent (el, ev, args) {
        if (domUtils.isFileInput(el) && ev.type === 'click')
            this.clickedFileInput = el;

        if (browserUtils.isIE) {
            // NOTE: In IE, when we raise an event by using the dispatchEvent function, the window.event object is null.
            // If a real event happens, there is a window.event object, but it is not identical with the first argument
            // of the event handler. The window.Event object is identical with the object that is created when we raise
            // the event by using  the fireEvent function. So, when we raise the event by using the dispatchEvent function,
            // we need to set the window.event object manually. An exception for IE11: The window.event object is not null
            // and it’s the same as in the event handler (only in window.top.event). Also, in iE11, window.event doesn’t
            // have the returnValue property, so it’s impossible to prevent the event by assigning window.event.returnValue
            // to false.
            var isElementInIframe = domUtils.isElementInIframe(el);
            var iframe            = isElementInIframe ? domUtils.getIframeByElement(el) : null;
            var curWindow         = iframe ? iframe.contentWindow : window;

            if (browserUtils.version < 11) {
                args = args || { type: ev.type };

                var returnValue    = true;
                var curWindowEvent = null; // NOTE: B254199
                var onEvent       = 'on' + (MSPOINTER_EVENT_NAME_RE.test(ev.type) ? ev.type.toLowerCase() : ev.type);
                var inlineHandler = el[onEvent];
                var button        = args.button;

                // NOTE: If window.event is generated after the native click is raised.
                if (typeof curWindow.event === 'object' && this.savedWindowEvents.length &&
                    curWindow.event !== this.savedWindowEvents[0]) {
                    this.savedNativeClickCount++;
                    this.savedWindowEvents.unshift(curWindow.event);
                }

                delete curWindow.event;

                var saveWindowEventObject = e => {
                    curWindowEvent = curWindow.event || ev;
                    this.savedWindowEvents.unshift(curWindowEvent);
                    eventUtils.preventDefault(e);
                };

                // NOTE: fireEvent throws an error when el.parentNode === null.
                if (el.parentNode) {
                    el[onEvent] = saveWindowEventObject;
                    args.button = IE_BUTTONS_MAP[button];

                    nativeMethods.fireEvent.call(el, onEvent, extend(domUtils.findDocument(el).createEventObject(), args));

                    el[onEvent] = inlineHandler;
                    args.button = button;
                }

                Object.defineProperty(curWindow, 'event', {
                    get:          () => this.savedWindowEvents[0],
                    configurable: true
                });

                var cancelBubble = false;

                if (curWindowEvent) {
                    Object.defineProperty(curWindowEvent, 'returnValue', {
                        get: () => returnValue,
                        set: value => {
                            if (value === false)
                                ev.preventDefault();

                            returnValue = value;
                        },

                        configurable: true
                    });

                    Object.defineProperty(curWindowEvent, 'cancelBubble', {
                        get: () => cancelBubble,
                        set: value => {
                            ev.cancelBubble = cancelBubble = value;

                            return value;
                        },

                        configurable: true
                    });

                    if (curWindowEvent.type === 'mouseout' || curWindowEvent.type === 'mouseover') {
                        Object.defineProperty(curWindowEvent, 'fromElement', {
                            get:          () => curWindowEvent.type === 'mouseout' ? el : args.relatedTarget,
                            configurable: true
                        });
                        Object.defineProperty(curWindowEvent, 'toElement', {
                            get:          () => curWindowEvent.type === 'mouseover' ? el : args.relatedTarget,
                            configurable: true
                        });
                    }
                }

                returnValue = el.dispatchEvent(ev) && returnValue;

                if (curWindowEvent && curWindowEvent === this.savedWindowEvents[0])
                    this.savedWindowEvents.shift();

                if (!this.savedWindowEvents.length)
                    delete curWindow.event;

                return returnValue;
            }

            // NOTE: In IE11, iframe's window.event object is null. We need to set
            // iframe's window.event object manually by using window.event (B254199).
            if (browserUtils.version === 11 && isElementInIframe) {
                Object.defineProperty(domUtils.getIframeByElement(el).contentWindow, 'event', {
                    get:          () => window.event,
                    configurable: true
                });
            }
        }

        var res = el.dispatchEvent(ev);

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
        return this._dispatchEvent(el, 'blur', false, this.DISPATCHED_EVENT_FLAG);
    }

    focus (el) {
        return this._dispatchEvent(el, 'focus', false, this.DISPATCHED_EVENT_FLAG);
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

    isSavedWindowsEventsExists () {
        return this.savedWindowEvents && this.savedWindowEvents.length;
    }

    // TODO: Remove these methods.
    getClickedFileInput () {
        return this.clickedFileInput;
    }

    setClickedFileInput (input) {
        this.clickedFileInput = input;
    }
}
