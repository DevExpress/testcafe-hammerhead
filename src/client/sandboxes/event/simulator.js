import * as Browser from '../../util/browser';
import * as DOM from '../../util/dom';
import * as Event from '../../util/event';
import * as Service from '../../util/service';
import NativeMethods from '../native-methods';
import * as Position from '../../util/position';
import Const from '../../../const';
import * as Style from '../../util/style';

export const DISPATCHED_EVENT_FLAG = Const.PROPERTY_PREFIX + 'def';

const IE_BUTTONS_MAP       = {
    0: 1,
    1: 4,
    2: 2
};
const POINTER_EVENT_BUTTON = {
    NO_BUTTON:    -1,
    LEFT_BUTTON:  0,
    RIGHT_BUTTON: 2
};
const KEY_EVENT_NAME_RE    = /^key\w+$/;
const MOUSE_EVENT_NAME_RE  = /^((mouse\w+)|((dbl)?click)|(contextmenu))$/;
const TOUCH_EVENT_NAME_RE  = /^touch\w+$/;

var touchIdentifier  = Date.now();
var clickedFileInput = null;
// NOTE: (IE only) if some event dispatching raised native click function calling we should remove window.event property
// (that was set in the raiseDispatchEvent function). Otherwise the window.event property will be equal dispatched event
// but not native click event. After click we should restore it. (B237144)
var savedWindowEvents     = [];
var savedNativeClickCount = 0;

function simulateEvent (el, event, userOptions, options) {
    var args     = null;
    var dispatch = null;
    // NOTE: we don't emulate click on link with modifiers (ctrl, shift, ctrl+shift, alt),
    // because it causes the opening of additional tabs and window in browser or loading files
    var isClickOnLink = event === 'click' && el.tagName && el.tagName.toLocaleLowerCase() === 'a';
    var opts          = Service.extend(
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
            opts = Service.extend(opts, { button: userOptions.button });

        args     = getMouseEventArgs(event, opts);
        dispatch = dispatchMouseEvent;
    }

    else if (KEY_EVENT_NAME_RE.test(event)) {
        if (userOptions &&
            (typeof userOptions.keyCode !== 'undefined' || typeof userOptions.charCode !== 'undefined')) {
            opts = Service.extend(opts, {
                keyCode:  userOptions.keyCode || 0,
                charCode: userOptions.charCode || 0
            });
        }

        args     = getKeyEventArgs(event, opts);
        dispatch = dispatchKeyEvent;
    }

    else if (TOUCH_EVENT_NAME_RE.test(event)) {
        args     = getTouchEventArgs(event, Service.extend(opts, { target: el }));
        dispatch = dispatchTouchEvent;
    }

    return dispatch(el, args);
}

function getMouseEventArgs (type, options) {
    var opts = options || {};

    return Service.extend(getUIEventArgs(type, options), {
        screenX:       opts.screenX || 0,
        screenY:       opts.screenY || 0,
        clientX:       opts.clientX || 0,
        clientY:       opts.clientY || 0,
        button:        typeof opts.button === 'undefined' ? Event.BUTTON.LEFT : opts.button,
        buttons:       typeof opts.buttons === 'undefined' ? Event.BUTTONS_PARAMETER.LEFT_BUTTON : opts.buttons,
        relatedTarget: opts.relatedTarget || null,
        which:         typeof opts.which === 'undefined' ? Event.WHICH_PARAMETER.LEFT_BUTTON : opts.which
    });
}

function getKeyEventArgs (type, options) {
    var opts = options || {};

    return Service.extend(getUIEventArgs(type, options), {
        keyCode:  opts.keyCode || 0,
        charCode: opts.charCode || 0,
        which:    type === 'press' ? opts.charCode : opts.keyCode
    });
}

function getTouchEventArgs (type, options) {
    var opts = options || {};
    var args = Service.extend(getUIEventArgs(type, opts), {
        screenX: opts.screenX || 0,
        screenY: opts.screenY || 0,
        clientX: opts.clientX || 0,
        clientY: opts.clientY || 0,
        pageX:   opts.clientX || 0,
        pageY:   opts.clientY || 0
    });

    if (Browser.isIOS) {
        args.touch = document.createTouch(args.view, options.target, getTouchIdentifier(args.type),
            args.clientX, args.clientY, 0, 0);
    }

    else {
        args.touch = document.createTouch(args.view, options.target, getTouchIdentifier(args.type), args.pageX,
            args.pageY, args.screenX, args.screenY, args.clientX, args.clientY, null, null,
            typeof args.rotation === 'undefined' ? 0 : args.rotation); //B237995
    }

    args.changedTouches = document.createTouchList(args.touch);
    args.touches        = args.type === 'touchend' ? document.createTouchList() : args.changedTouches; //T170088
    args.targetTouches = args.touches;

    return args;
}

function getUIEventArgs (type, options) {
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

function getTouchIdentifier (type) {
    //NOTE: a touch point is created on 'touchstart' event. When it's moved its id should not be changed (T112153)
    if (type === 'touchstart')
        touchIdentifier++;

    return touchIdentifier;
}

function raiseNativeClick (el, originClick) {
    //B254199
    var curWindow = DOM.isElementInIframe(el) ? DOM.getIFrameByElement(el).contentWindow : window;

    if (Browser.isIE && Browser.version < 11)
        delete curWindow.event;

    originClick.call(el);

    if (Browser.isIE && Browser.version < 11) {
        if (savedNativeClickCount--)
            savedWindowEvents.shift();

        if (savedWindowEvents.length) {
            Object.defineProperty(curWindow, 'event', {
                get: function () {
                    return savedWindowEvents[0];
                },

                configurable: true
            });
        }
    }
}

function dispatchEvent (el, name, flag) {
    var ev = null;

    if (document.createEvent) {
        ev = document.createEvent('Events');

        // NOTE: the dispatchEvent funciton is used for events specific to one element (focus, blur, change, input, submit),
        // so we set the 'bubbling' (the second) argument to false (T229732)
        ev.initEvent(name, false, true);

        if (flag)
            ev[flag] = true;

        return raiseDispatchEvent(el, ev);
    }
}

function dispatchMouseEvent (el, args) {
    var ev            = null;
    var pointerRegExp = /mouse(down|up|move|over|out)/;

    //NOTE: in IE submit doesn't work if a click is emulated for some submit button's children (for example img, B236676)
    //In addition, if a test is being recorded in IE, the target of a click event is always a button, not a child, so child does not receive click event at all
    if (Browser.isIE) {
        if (args.type === 'click' || args.type === 'mouseup' || args.type === 'mousedown')
            if (el.parentNode && DOM.closest(el.parentNode, 'button')) {
                var closestButton = DOM.closest(el.parentNode, 'button');

                if (NativeMethods.getAttribute.call(closestButton, 'type') === 'submit')
                    el = closestButton;
            }
    }

    if (pointerRegExp.test(args.type) && (window.PointerEvent || window.MSPointerEvent)) {
        var pointEvent       = Browser.version >
                               10 ? document.createEvent('PointerEvent') : document.createEvent('MSPointerEvent');
        var elPosition       = Position.getOffsetPosition(el);
        var elBorders        = Style.getBordersWidth(el);
        var elClientPosition = Position.offsetToClientCoords({
            x: elPosition.left + elBorders.left,
            y: elPosition.top + elBorders.top
        });
        var eventShortType   = args.type.replace('mouse', '');
        var pArgs            = Service.extend({
            widthArg:       Browser.version > 10 ? 1 : 0,
            heightArg:      Browser.version > 10 ? 1 : 0,
            pressure:       0,
            rotation:       0,
            tiltX:          0,
            tiltY:          0,
            pointerIdArg:   1, //NOTE: this parameter must be "1" for mouse
            pointerType:    Browser.version > 10 ? 'mouse' : 4,
            hwTimestampArg: Date.now(),
            isPrimary:      true
        }, args);

        pArgs.type       = Browser.version > 10 ? 'pointer' + eventShortType : 'MSPointer' +
                                                                               eventShortType.charAt(0).toUpperCase() +
                                                                               eventShortType.substring(1);
        pArgs.offsetXArg = args.clientX - elClientPosition.x;
        pArgs.offsetYArg = args.clientY - elClientPosition.y;
        pArgs.button     = args.buttons ===
                           Event.BUTTONS_PARAMETER.NO_BUTTON ? POINTER_EVENT_BUTTON.NO_BUTTON : pArgs.button;

        //NOTE: we send null as a relatedTarget argument because IE has memory leak
        pointEvent.initPointerEvent(pArgs.type, pArgs.canBubble, pArgs.cancelable, window, pArgs.detail, pArgs.screenX,
            pArgs.screenY, pArgs.clientX, pArgs.clientY, pArgs.ctrlKey, pArgs.altKey, pArgs.shiftKey, pArgs.metaKey,
            pArgs.button, null, pArgs.offsetXArg, pArgs.offsetYArg, pArgs.widthArg, pArgs.heightArg,
            pArgs.pressure, pArgs.rotation, pArgs.tiltX, pArgs.tiltY, pArgs.pointerIdArg, pArgs.pointerType,
            pArgs.hwTimestampArg, pArgs.isPrimary);

        //NOTE: after dispatching pointer event doesn't contain 'target' and 'relatedTarget' property
        Object.defineProperty(pointEvent, 'target', {
            get: function () {
                return el;
            },

            configurable: true
        });

        Object.defineProperty(pointEvent, 'relatedTarget', {
            get: function () {
                return args.relatedTarget;
            },

            configurable: true
        });

        Object.defineProperty(pointEvent, 'buttons', {
            get: function () {
                return args.buttons;
            }
        });

        raiseDispatchEvent(el, pointEvent, pArgs);
    }

    ev = document.createEvent('MouseEvents');
    ev.initMouseEvent(args.type, args.canBubble, args.cancelable, window, args.detail, args.screenX,
        args.screenY, args.clientX, args.clientY, args.ctrlKey, args.altKey, args.shiftKey, args.metaKey,
        args.button, args.relatedTarget);

    if (Browser.isMozilla || Browser.isIE) {
        Object.defineProperty(ev, 'buttons', {
            get: function () {
                return args.buttons;
            }
        });
    }

    //T188166 - act.hover trigger "mouseenter" event with "which" parameter 1
    if (typeof args.which !== 'undefined' && Browser.isWebKit) {
        Object.defineProperty(ev, Const.EVENT_SANDBOX_WHICH_PROPERTY_WRAPPER, {
            get: function () {
                return args.which;
            }
        });
    }

    //NOTE: After the MouseEvent was created by using initMouseEvent method pageX and pageY properties equal zero (only in IE9).
    //We can set them only by defineProperty method (B253930)
    if (Browser.isIE9) {
        var currentDocument = DOM.findDocument(el);
        var documentScroll  = Style.getElementScroll(currentDocument);

        Object.defineProperty(ev, 'pageX', {
            get: function () {
                return ev.clientX + documentScroll.left;
            }
        });

        Object.defineProperty(ev, 'pageY', {
            get: function () {
                return ev.clientY + documentScroll.top;
            }
        });
    }

    return raiseDispatchEvent(el, ev, args);
}

function raiseDispatchEvent (el, ev, args) {
    // NOTE: in IE  when we raise event via the dispatchEvent function, the window.event object is null.
    // After a real event happened there is the window.event object but it is not identical with the first argument
    // of event handler. The window.Event object is identical with the object that is created when we raise event
    // via the fireEvent function. So, when we raise event via the dispatchEvent function we should set the
    // window.event object malually.
    // Except IE11 - window.event is not null and its the same as in event handler (only in window.top.event).
    // Also in iE11 window.event has not returnValue property and
    // impossible to prevent event via assigning window.event.returnValue = false
    var isElementInIFrame = DOM.isElementInIframe(el);

    if (DOM.isFileInput(el) && ev.type === 'click')
        clickedFileInput = el;

    if (Browser.isIE && Browser.version < 11) {
        args = args || { type: ev.type };

        var returnValue = true;
        //B254199
        var curWindow      = isElementInIFrame ? DOM.getIFrameByElement(el).contentWindow : window;
        var curWindowEvent = null;
        var onEvent        = 'on' + (Browser.isIE10 &&
                                     /MSPointer(Down|Up|Move|Over|Out)/.test(ev.type) ? ev.type.toLowerCase() : ev.type);
        var inlineHandler  = el[onEvent];
        var button         = args.button;

        //NOTE: if window.event generated after native click raised
        if (typeof curWindow.event === 'object' && savedWindowEvents.length &&
            curWindow.event !== savedWindowEvents[0]) {
            savedNativeClickCount++;
            savedWindowEvents.unshift(curWindow.event);
        }

        delete curWindow.event;

        var saveWindowEventObject = function (e) {
            curWindowEvent = curWindow.event || ev;
            savedWindowEvents.unshift(curWindowEvent);
            Event.preventDefault(e);
        };

        if (el.parentNode) {  // NOTE: fireEvent raises error when el.parentNode === null
            el[onEvent] = saveWindowEventObject;
            args.button = IE_BUTTONS_MAP[button];

            NativeMethods.fireEvent.call(el, onEvent, Service.extend(DOM.findDocument(el).createEventObject(), args));

            el[onEvent] = inlineHandler;
            args.button = button;
        }

        Object.defineProperty(curWindow, 'event', {
            get: function () {
                return savedWindowEvents[0];
            },

            configurable: true
        });

        var cancelBubble = false;

        if (curWindowEvent) {
            Object.defineProperty(curWindowEvent, 'returnValue', {
                get: function () {
                    return returnValue;
                },

                set: function (value) {
                    if (value === false)
                        ev.preventDefault();

                    returnValue = value;
                },

                configurable: true
            });

            Object.defineProperty(curWindowEvent, 'cancelBubble', {
                get: function () {
                    return cancelBubble;
                },

                set: function (value) {
                    ev.cancelBubble = cancelBubble = value;
                },

                configurable: true
            });

            if (curWindowEvent.type === 'mouseout' || curWindowEvent.type === 'mouseover') {
                Object.defineProperty(curWindowEvent, 'fromElement', {
                    get: function () {
                        return curWindowEvent.type === 'mouseout' ? el : args.relatedTarget;
                    },

                    configurable: true
                });
                Object.defineProperty(curWindowEvent, 'toElement', {
                    get: function () {
                        return curWindowEvent.type === 'mouseover' ? el : args.relatedTarget;
                    },

                    configurable: true
                });
            }
        }

        returnValue = el.dispatchEvent(ev) && returnValue;

        if (curWindowEvent && curWindowEvent === savedWindowEvents[0])
            savedWindowEvents.shift();

        if (!savedWindowEvents.length)
            delete curWindow.event;

        return returnValue;
    }
    //NOTE: In IE11 iframe's window.event object is null.
    // So we should set iframe's window.event object malually by window.event (B254199).
    else if (Browser.isIE && Browser.version > 10 && isElementInIFrame) {
        Object.defineProperty(DOM.getIFrameByElement(el).contentWindow, 'event', {
            get: function () {
                return window.event;
            },

            configurable: true
        });
    }

    return el.dispatchEvent(ev);
}

function dispatchKeyEvent (el, args) {
    var ev = null;

    if (document.createEvent) {
        ev = document.createEvent('Events');
        ev.initEvent(args.type, args.canBubble, args.cancelable);
        ev = Service.extend(ev, {
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

        return raiseDispatchEvent(el, ev, args);
    }
}

function dispatchTouchEvent (el, args) {
    var ev = document.createEvent('TouchEvent');

    // HACK: test for iOS using initTouchEvent args count (TODO:replace it with user agent analyzis later)
    if (Browser.isIOS) {
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


/* NOTE: options = {
     [clientX: integer,]
     [clientY: integer,]
     [alt: true|false,]
     [ctrl: true|false,]
     [shift: true|false,]
     [meta: true|false,]
     [button: Util.BUTTON]
 } */

export function click (el, options) {
    return simulateEvent(el, 'click', options, {
        button:  Event.BUTTON.LEFT,
        buttons: Event.BUTTONS_PARAMETER.LEFT_BUTTON
    });
}

export function nativeClick (el, originClick) {
    raiseNativeClick(el, originClick);
}

export function dblclick (el, options) {
    return simulateEvent(el, 'dblclick', options, {
        button:  Event.BUTTON.LEFT,
        buttons: Event.BUTTONS_PARAMETER.LEFT_BUTTON
    });
}

export function rightclick (el, options) {
    return simulateEvent(el, 'click', options, {
        button:  Event.BUTTON.RIGHT,
        buttons: Event.BUTTONS_PARAMETER.RIGHT_BUTTON
    });
}

export function contextmenu (el, options) {
    return simulateEvent(el, 'contextmenu', options, {
        button:  Event.BUTTON.RIGHT,
        which:   Event.WHICH_PARAMETER.RIGHT_BUTTON,
        buttons: Event.BUTTONS_PARAMETER.RIGHT_BUTTON
    });
}

export function mousedown (el, options) {
    options = options || {};

    options.button  = typeof options.button === 'undefined' ? Event.BUTTON.LEFT : options.button;
    options.which   = typeof options.which === 'undefined' || options.button !== Event.BUTTON.RIGHT ?
                      Event.WHICH_PARAMETER.LEFT_BUTTON : Event.WHICH_PARAMETER.RIGHT_BUTTON;
    options.buttons = typeof options.buttons ===
                      'undefined' ? Event.BUTTONS_PARAMETER.LEFT_BUTTON : options.buttons;

    return simulateEvent(el, 'mousedown', options);
}

export function mouseup (el, options) {
    options = options || {};

    options.button  = typeof options.button === 'undefined' ? Event.BUTTON.LEFT : options.button;
    options.which   = typeof options.which === 'undefined' || options.button !== Event.BUTTON.RIGHT ?
                      Event.WHICH_PARAMETER.LEFT_BUTTON : Event.WHICH_PARAMETER.RIGHT_BUTTON;
    options.buttons = typeof options.buttons ===
                      'undefined' ? Event.BUTTONS_PARAMETER.LEFT_BUTTON : options.buttons;

    return simulateEvent(el, 'mouseup', options);
}

export function mouseover (el, options) {
    return simulateEvent(el, 'mouseover', options);
}

export function mousemove (el, options) {
    return simulateEvent(el, 'mousemove', options, { cancelable: false });
}

export function mouseout (el, options) {
    return simulateEvent(el, 'mouseout', options);
}

// NOTE: keyboard events
export function keypress (el, options) {
    return simulateEvent(el, 'keypress', options);
}

export function keyup (el, options) {
    return simulateEvent(el, 'keyup', options);
}

export function keydown (el, options) {
    return simulateEvent(el, 'keydown', options);
}

export function input (el) {
    return dispatchEvent(el, 'input');
}

// NOTE: control events
export function blur (el) {
    return dispatchEvent(el, 'blur', DISPATCHED_EVENT_FLAG);
}

export function focus (el) {
    return dispatchEvent(el, 'focus', DISPATCHED_EVENT_FLAG);
}

export function change (el) {
    return dispatchEvent(el, 'change', DISPATCHED_EVENT_FLAG);
}

export function submit (el) {
    return dispatchEvent(el, 'submit');
}

export function selectionchange (el) {
    return dispatchEvent(el, 'selectionchange');
}

// NOTE: touch events
export function touchstart (el, options) {
    return simulateEvent(el, 'touchstart', options);
}

export function touchend (el, options) {
    return simulateEvent(el, 'touchend', options);
}

export function touchmove (el, options) {
    return simulateEvent(el, 'touchmove', options);
}

export function isSavedWindowsEventsExists () {
    return savedWindowEvents && savedWindowEvents.length;
}

// todo: remove this methods
export function getClickedFileInput () {
    return clickedFileInput;
}

export function setClickedFileInput (input) {
    clickedFileInput = input;
}
