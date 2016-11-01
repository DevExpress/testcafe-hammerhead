export const BUTTON = {
    left:   0,
    middle: 1,
    right:  2
};

export const BUTTONS_PARAMETER = {
    noButton:    0,
    leftButton:  1,
    rightButton: 2
};

export const WHICH_PARAMETER = {
    noButton:     0,
    leftButton:   1,
    middleButton: 2,
    rightButton:  3
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

export function isObjectEventListener (listener) {
    return typeof listener === 'object' && typeof listener.handleEvent === 'function';
}

export function hasPointerEvents () {
    return !!(window.PointerEvent || window.MSPointerEvent);
}

