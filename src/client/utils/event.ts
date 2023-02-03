import nativeMethods from '../sandbox/native-methods';
import { isFunction } from './types';

const COMPOSED_EVENTS = [
    'blur',
    'focus',
    'focusin',
    'focusout',
    'click',
    'dblclick',
    'mousedown',
    'mousemove',
    'mouseout',
    'mouseover',
    'mouseup',
    'beforeinput',
    'input',
    'keydown',
    'keyup',
];

export const BUTTON = {
    left:   0,
    middle: 1,
    right:  2,
};

export const BUTTONS_PARAMETER = {
    noButton:    0,
    leftButton:  1,
    rightButton: 2,
};

export const WHICH_PARAMETER = {
    noButton:     0,
    leftButton:   1,
    middleButton: 2,
    rightButton:  3,
};

export const KEYBOARD_MODIFIERS_PARAMETER = {
    altKey:   'Alt',
    ctrlKey:  'Control',
    shiftKey: 'Shift',
    metaKey:  'Meta',
};

export const DOM_EVENTS = [
    'click', 'dblclick', 'contextmenu',
    'mousedown', 'mouseup', 'mousemove', 'mouseover', 'mouseout', 'mouseenter', 'mouseleave',
    'touchstart', 'touchmove', 'touchend',
    'keydown', 'keypress', 'keyup',
    'textInput', 'textinput', 'input', 'change',
    'focus', 'blur',
    'MSPointerDown', 'MSPointerMove', 'MSPointerOver', 'MSPointerOut', 'MSPointerUp',
    'pointerdown', 'pointermove', 'pointerover', 'pointerout', 'pointerup', 'pointerenter', 'pointerleave',
    'dragstart', 'drop',
    'focusin', 'focusout',
];

export function preventDefault (ev, allowBubbling?: boolean) {
    if (ev.preventDefault)
        ev.preventDefault();
    else
        ev.returnValue = false;

    if (!allowBubbling)
        stopPropagation(ev);
}

export function stopPropagation (ev) {
    if (ev.stopImmediatePropagation)
        ev.stopImmediatePropagation();
    else if (ev.stopPropagation)
        ev.stopPropagation();

    ev.cancelBubble = true;
}

export function isObjectEventListener (listener) {
    return typeof listener === 'object' && listener && isFunction(listener.handleEvent);
}

export function isValidEventListener (listener) {
    return isFunction(listener) || isObjectEventListener(listener);
}

export function callEventListener (ctx, listener, e) {
    if (isObjectEventListener(listener))
        return listener.handleEvent.call(listener, e);

    return listener.call(ctx, e);
}

export function isComposedEvent (event) {
    return COMPOSED_EVENTS.indexOf(event) !== -1;
}

export const hasPointerEvents = !!(nativeMethods.WindowPointerEvent || nativeMethods.WindowMSPointerEvent);

