import extend from '../../utils/extend';
import nativeMethods from '../native-methods';
import * as browserUtils from '../../utils/browser';
import * as domUtils from '../../utils/dom';
import * as eventUtils from '../../utils/event';
import { getOffsetPosition, offsetToClientCoords } from '../../utils/position';
import { getBordersWidth, getElementScroll } from '../../utils/style';
import { EVENT_SANDBOX_WHICH_PROPERTY_WRAPPER } from '../../../const';

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

const KEY_EVENT_NAME_RE   = /^key\w+$/;
const MOUSE_EVENT_NAME_RE = /^((mouse\w+)|((dbl)?click)|(contextmenu))$/;
const TOUCH_EVENT_NAME_RE = /^touch\w+$/;

export default class EventSimulator {
    constructor () {
        this.DISPATCHED_EVENT_FLAG = 'hammerhead|dispatched-event';

        this.touchIdentifier  = Date.now();
        this.clickedFileInput = null;
        // NOTE: (IE only) if some event dispatching raised native click function calling we should remove window.event property
        // (that was set in the raiseDispatchEvent function). Otherwise the window.event property will be equal dispatched event
        // but not native click event. After click we should restore it. (B237144)
        this.savedWindowEvents     = [];
        this.savedNativeClickCount = 0;
    }

    static _dispatchTouchEvent (el, args) {
        var ev = document.createEvent('TouchEvent');

        // HACK: test for iOS using initTouchEvent args count (TODO:replace it with user agent analyzis later)
        if (browserUtils.isIOS) {
            ev.initTouchEvent(args.type, args.canBubble, args.cancelable, args.view,
                args.detail, args.screenX, args.screenY, args.pageX, args.pageY, args.ctrlKey,
                args.altKey, args.shiftKey, args.metaKey, args.touches, args.targetTouches,
                args.changedTouches,
                typeof args.scale === 'undefined' ? 1.0 : args.scale,
                typeof args.rotation === 'undefined' ? 0.0 : args.rotation); //B237995

        }
        else if (ev.initTouchEvent.length === 12) {
            // FireFox
            ev.initTouchEvent(args.type, args.canBubble, args.cancelable, args.view,
                args.detail, args.ctrlKey, args.altKey, args.shiftKey, args.metaKey, args.touches,
                args.targetTouches, args.changedTouches);
        }
        else {
            // Default android browser, Dolphin
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

    static _getMouseEventArgs (type, options) {
        var opts = options || {};

        return extend(EventSimulator._getUIEventArgs(type, options), {
            screenX:       opts.screenX || 0,
            screenY:       opts.screenY || 0,
            clientX:       opts.clientX || 0,
            clientY:       opts.clientY || 0,
            button:        typeof opts.button === 'undefined' ? eventUtils.BUTTON.left : opts.button,
            buttons:       typeof opts.buttons === 'undefined' ? eventUtils.BUTTONS_PARAMETER.leftButton : opts.buttons,
            relatedTarget: opts.relatedTarget || null,
            which:         typeof opts.which === 'undefined' ? eventUtils.WHICH_PARAMETER.leftButton : opts.which
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
        // NOTE: we don't emulate click on link with modifiers (ctrl, shift, ctrl+shift, alt),
        // because it causes the opening of additional tabs and window in browser or loading files
        var isClickOnLink = event === 'click' && el.tagName && el.tagName.toLocaleLowerCase() === 'a';
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

        if (MOUSE_EVENT_NAME_RE.test(event)) {
            if (userOptions && typeof userOptions.button !== 'undefined')
                opts = extend(opts, { button: userOptions.button });

            args     = EventSimulator._getMouseEventArgs(event, opts);
            dispatch = (el, args) => this._dispatchMouseEvent(el, args);
        }

        else if (KEY_EVENT_NAME_RE.test(event)) {
            if (userOptions &&
                (typeof userOptions.keyCode !== 'undefined' || typeof userOptions.charCode !== 'undefined')) {
                opts = extend(opts, {
                    keyCode:  userOptions.keyCode || 0,
                    charCode: userOptions.charCode || 0
                });
            }

            args     = EventSimulator._getKeyEventArgs(event, opts);
            dispatch = (el, args) => this._dispatchKeyEvent(el, args);
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
            args.touch = document.createTouch(args.view, options.target, this._getTouchIdentifier(args.type), args.pageX,
                args.pageY, args.screenX, args.screenY, args.clientX, args.clientY, null, null,
                typeof args.rotation === 'undefined' ? 0 : args.rotation); //B237995
        }

        args.changedTouches = document.createTouchList(args.touch);
        args.touches        = args.type === 'touchend' ? document.createTouchList() : args.changedTouches; //T170088
        args.targetTouches = args.touches;

        return args;
    }

    _getTouchIdentifier (type) {
        //NOTE: a touch point is created on 'touchstart' event. When it's moved its id should not be changed (T112153)
        if (type === 'touchstart')
            this.touchIdentifier++;

        return this.touchIdentifier;
    }

    _raiseNativeClick (el, originClick) {
        //B254199
        var curWindow = domUtils.isElementInIframe(el) ? domUtils.getIframeByElement(el).contentWindow : window;

        if (browserUtils.isIE && browserUtils.version < 11)
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
    }

    _dispatchMouseEvent (el, args) {
        var ev            = null;
        var pointerRegExp = /mouse(down|up|move|over|out)/;

        //NOTE: in IE submit doesn't work if a click is emulated for some submit button's children (for example img, B236676)
        //In addition, if a test is being recorded in IE, the target of a click event is always a button, not a child, so child does not receive click event at all
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
                pointerIdArg:   1, //NOTE: this parameter must be "1" for mouse
                pointerType:    browserUtils.version > 10 ? 'mouse' : 4,
                hwTimestampArg: Date.now(),
                isPrimary:      true
            }, args);

            pArgs.type       = browserUtils.version > 10 ? 'pointer' + eventShortType : 'MSPointer' +
                                                                                        eventShortType.charAt(0).toUpperCase() +
                                                                                        eventShortType.substring(1);
            pArgs.offsetXArg = args.clientX - elClientPosition.x;
            pArgs.offsetYArg = args.clientY - elClientPosition.y;
            pArgs.button     = args.buttons ===
                               eventUtils.BUTTONS_PARAMETER.noButton ? POINTER_EVENT_BUTTON.noButton : pArgs.button;

            //NOTE: we send null as a relatedTarget argument because IE has memory leak
            pointEvent.initPointerEvent(pArgs.type, pArgs.canBubble, pArgs.cancelable, window, pArgs.detail, pArgs.screenX,
                pArgs.screenY, pArgs.clientX, pArgs.clientY, pArgs.ctrlKey, pArgs.altKey, pArgs.shiftKey, pArgs.metaKey,
                pArgs.button, null, pArgs.offsetXArg, pArgs.offsetYArg, pArgs.widthArg, pArgs.heightArg,
                pArgs.pressure, pArgs.rotation, pArgs.tiltX, pArgs.tiltY, pArgs.pointerIdArg, pArgs.pointerType,
                pArgs.hwTimestampArg, pArgs.isPrimary);

            //NOTE: after dispatching pointer event doesn't contain 'target' and 'relatedTarget' property
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

        //T188166 - act.hover trigger "mouseenter" event with "which" parameter 1
        if (typeof args.which !== 'undefined' && browserUtils.isWebKit) {
            Object.defineProperty(ev, EVENT_SANDBOX_WHICH_PROPERTY_WRAPPER, {
                get: () => args.which
            });
        }

        //NOTE: After the MouseEvent was created by using initMouseEvent method pageX and pageY properties equal zero (only in IE9).
        //We can set them only by defineProperty method (B253930)
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

    _dispatchEvent (el, name, flag) {
        var ev = null;

        if (document.createEvent) {
            ev = document.createEvent('Events');

            // NOTE: the dispatchEvent funciton is used for events specific to one element (focus, blur, change, input, submit),
            // so we set the 'bubbling' (the second) argument to false (T229732)
            ev.initEvent(name, false, true);

            if (flag)
                ev[flag] = true;

            return this._raiseDispatchEvent(el, ev);
        }
    }

    _raiseDispatchEvent (el, ev, args) {
        // NOTE: in IE  when we raise event via the dispatchEvent function, the window.event object is null.
        // After a real event happened there is the window.event object but it is not identical with the first argument
        // of event handler. The window.Event object is identical with the object that is created when we raise event
        // via the fireEvent function. So, when we raise event via the dispatchEvent function we should set the
        // window.event object malually.
        // Except IE11 - window.event is not null and its the same as in event handler (only in window.top.event).
        // Also in iE11 window.event has not returnValue property and
        // impossible to prevent event via assigning window.event.returnValue = false
        var isElementInIframe = domUtils.isElementInIframe(el);

        if (domUtils.isFileInput(el) && ev.type === 'click')
            this.clickedFileInput = el;

        if (browserUtils.isIE && browserUtils.version < 11) {
            args = args || { type: ev.type };

            var returnValue = true;
            //B254199
            var curWindow      = isElementInIframe ? domUtils.getIframeByElement(el).contentWindow : window;
            var curWindowEvent = null;
            var onEvent        = 'on' + (browserUtils.isIE10 &&
                                         /MSPointer(Down|Up|Move|Over|Out)/.test(ev.type) ? ev.type.toLowerCase() : ev.type);
            var inlineHandler  = el[onEvent];
            var button         = args.button;

            //NOTE: if window.event generated after native click raised
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

            if (el.parentNode) {  // NOTE: fireEvent raises error when el.parentNode === null
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
                    get:          () => cancelBubble,
                    set:          value => ev.cancelBubble = cancelBubble = value,
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
        //NOTE: In IE11 iframe's window.event object is null.
        // So we should set iframe's window.event object malually by window.event (B254199).
        else if (browserUtils.isIE && browserUtils.version > 10 && isElementInIframe) {
            Object.defineProperty(domUtils.getIframeByElement(el).contentWindow, 'event', {
                get:          () => window.event,
                configurable: true
            });
        }

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

        options.button  = typeof options.button === 'undefined' ? eventUtils.BUTTON.left : options.button;
        options.which   = typeof options.which === 'undefined' || options.button !== eventUtils.BUTTON.right ?
                          eventUtils.WHICH_PARAMETER.leftButton : eventUtils.WHICH_PARAMETER.rightButton;
        options.buttons = typeof options.buttons ===
                          'undefined' ? eventUtils.BUTTONS_PARAMETER.leftButton : options.buttons;

        return this._simulateEvent(el, 'mousedown', options);
    }

    mouseup (el, options) {
        options = options || {};

        options.button  = typeof options.button === 'undefined' ? eventUtils.BUTTON.left : options.button;
        options.which   = typeof options.which === 'undefined' || options.button !== eventUtils.BUTTON.right ?
                          eventUtils.WHICH_PARAMETER.leftButton : eventUtils.WHICH_PARAMETER.rightButton;
        options.buttons = typeof options.buttons ===
                          'undefined' ? eventUtils.BUTTONS_PARAMETER.leftButton : options.buttons;

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

    // NOTE: keyboard events
    keypress (el, options) {
        return this._simulateEvent(el, 'keypress', options);
    }

    keyup (el, options) {
        return this._simulateEvent(el, 'keyup', options);
    }

    keydown (el, options) {
        return this._simulateEvent(el, 'keydown', options);
    }

    input (el) {
        return this._dispatchEvent(el, 'input');
    }

    // NOTE: control events
    blur (el) {
        return this._dispatchEvent(el, 'blur', this.DISPATCHED_EVENT_FLAG);
    }

    focus (el) {
        return this._dispatchEvent(el, 'focus', this.DISPATCHED_EVENT_FLAG);
    }

    change (el) {
        return this._dispatchEvent(el, 'change', this.DISPATCHED_EVENT_FLAG);
    }

    submit (el) {
        return this._dispatchEvent(el, 'submit');
    }

    selectionchange (el) {
        return this._dispatchEvent(el, 'selectionchange');
    }

    // NOTE: touch events
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

    // todo: remove this methods
    getClickedFileInput () {
        return this.clickedFileInput;
    }

    setClickedFileInput (input) {
        this.clickedFileInput = input;
    }
}
