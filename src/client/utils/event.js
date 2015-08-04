export const BUTTON = {
    LEFT:   0,
    MIDDLE: 1,
    RIGHT:  2
};

export const BUTTONS_PARAMETER = {
    NO_BUTTON:    0,
    LEFT_BUTTON:  1,
    RIGHT_BUTTON: 2
};

export const WHICH_PARAMETER = {
    NO_BUTTON:     0,
    LEFT_BUTTON:   1,
    MIDDLE_BUTTON: 2,
    RIGHT_BUTTON:  3
};

export const DOM_EVENTS = ['click', 'mousedown', 'mouseup', 'dblclick', 'contextmenu', 'mousemove', 'mouseover',
    'mouseout', 'touchstart', 'touchmove', 'touchend', 'keydown', 'keypress', 'input', 'keyup', 'change', 'focus', 'blur',
    'MSPointerDown', 'MSPointerMove', 'MSPointerOver', 'MSPointerOut', 'MSPointerUp', 'pointerdown',
    'pointermove', 'pointerover', 'pointerout', 'pointerup', 'focusin', 'focusout', 'mouseenter', 'mouseleave',
    'pointerenter', 'pointerleave'];

export function preventDefault (ev, allowBubbling) {
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

