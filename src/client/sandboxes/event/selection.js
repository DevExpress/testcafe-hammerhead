import * as Browser from '../../util/browser';
import * as DOM from '../../util/dom';
import * as EventSimulator from './simulator';
import * as FocusBlur from './focus-blur';
import * as Listeners from './listeners';
import NativeMethods from '../native-methods';
import * as Timeout from './timeout';

function needChangeInputType (el) {
    var tagName = el.tagName ? el.tagName.toLowerCase() : '';

    return tagName === 'input' && (Browser.isWebKit && /^(number|email)$/.test(el.type));
}

export function setSelectionRangeWrapper () {
    var selectionStart     = arguments[0];
    var selectionEnd       = arguments[1];
    var selectionDirection = arguments[2] || 'none';
    var element            = this;

    var isTextArea      = this.tagName && this.tagName.toLowerCase() === 'textarea';
    var fn              = isTextArea ? NativeMethods.textAreaSetSelectionRange : NativeMethods.setSelectionRange;
    var activeElement   = DOM.getActiveElement(DOM.findDocument(element));
    var isElementActive = false;

    var selectionSetter = function () {
        var changeType = needChangeInputType(element);
        var savedType  = element.type;
        var res;

        if (changeType)
            element.type = 'text';

        //NOTE: in MSEdge error raised when setSelectionRange method calls for input with 'display = none' and selectionStart !== selectionEnd
        //in other IEs error don't raise but selectionStart === selectionEnd === 0 in result
        try {
            res = fn.call(element, selectionStart, selectionEnd, selectionDirection);
        }
        catch (e) {
            res = fn.call(element, 0, 0, selectionDirection);
        }

        if (changeType) {
            element.type = savedType;
            //HACK: (the problem after Chrome update to v.33.0.1750.117, and in Mozilla 29.0 for input with type 'number' T101195)
            // To set right selection we should change input type to text if it's 'number' or 'email' and restore it after (B254340).
            // But type changing is async in this case, so we should call blur to raise it (and focus to restore activeElement).
            if (isElementActive) {
                FocusBlur.blur(element, null, true);
                FocusBlur.focus(element, null, true);
            }
        }

        //NOTE:in MSEdge event 'selectionchange' doesn't occur immediately (with some delay)
        //so we should raise it right after 'setSelectionRange' method
        if (Browser.isIE && Browser.version > 11)
            EventSimulator.selectionchange(element);

        return res;
    };

    if (activeElement === element) {
        isElementActive = true;
        return selectionSetter();
    }

    //setSelectionRange leads to element focusing only in IE
    return wrapSetterSelection(element, selectionSetter, Browser.isIE && Browser.version < 12);
}

export function setSelection (el, start, end, direction) {
    if (el.setSelectionRange)
        el.setSelectionRange(start, end, direction);
    else {
        el.selectionStart = start;
        el.selectionEnd   = end;
    }
}

export function getSelection (el) {
    var changeType      = needChangeInputType(el);
    var activeElement   = DOM.getActiveElement(DOM.findDocument(el));
    var isElementActive = activeElement === el;
    var savedType       = el.type;
    var selection       = null;

    //HACK: (the problem after Chrome update to v.33.0.1750.117, and in Mozilla 29.0 for input with type 'number' T101195)
    // To get selection we should change input type to text if it's 'number' or 'email' (B254340).
    // But type changing is async in this case, so we should call blur to raise it (and focus to restore activeElement).
    if (changeType) {
        if (isElementActive)
            FocusBlur.blur(el, null, true);

        el.type = 'text';
    }

    if (DOM.isInputWithoutSelectionPropertiesInMozilla(el)) {
        selection = {
            start:     0,
            end:       0,
            direction: 'forward'
        };
    }
    else {
        selection = {
            start:     el.selectionStart,
            end:       el.selectionEnd,
            direction: el.selectionDirection
        };
    }

    if (changeType) {
        el.type = savedType;

        if (isElementActive)
            FocusBlur.focus(el, null, true);
    }

    return selection;
}

export function wrapSetterSelection (element, selectionSetter, needFocus, isContentEditable) {
    var curDocument   = DOM.findDocument(element);
    var activeElement = null;
    var result        = null;
    var focusRaised   = false;
    var focusHandler  = function (e) {
        if (e.target === element || element.style.display === 'none')
            focusRaised = true;
    };

    if (needFocus)
        Listeners.addInternalEventListener(document, ['focus'], focusHandler);

    //focus and blur events
    Listeners.beforeDispatchEvent();
    Listeners.beforeDispatchEvent();

    result = selectionSetter();

    //focus and blur events
    Listeners.afterDispatchEvent();
    Listeners.afterDispatchEvent();

    if (needFocus) {
        activeElement = DOM.getActiveElement(curDocument);

        if (Browser.isWebKit && activeElement !== element) {
            if (focusRaised)
                element[FocusBlur.getInternalEventFlag('focus')] = true;

            element.focus();
        }

        //in MSEdge focus/blur is sync
        if (Browser.isIE && Browser.version < 12)
            Timeout.internalSetTimeout.call(window, function () {
                Timeout.internalSetTimeout.call(window, function () {
                    Listeners.removeInternalEventListener(document, ['focus'], focusHandler);

                    if (!focusRaised)
                        EventSimulator.focus(element);
                }, 0);
            }, 0);
        else {
            Listeners.removeInternalEventListener(document, ['focus'], focusHandler);

            if (!focusRaised) {
                //NOTE: in Mozilla calling dispatchEvent 'focus' does active element.
                // We should call native focus method.
                if (isContentEditable && Browser.isMozilla)
                    FocusBlur.focus(element, null, true, false, true);
                else
                    EventSimulator.focus(element);
            }
        }
    }
    return result;
}

export function selectWrapper () {
    var element = this.parentElement();

    if (!element || DOM.getActiveElement(DOM.findDocument(element)) === element)
        return NativeMethods.select.call(this);

    var result       = null;
    var focusRaised  = false;
    var focusHandler = function (e) {
        if (e.target === element || element.style.display === 'none')
            focusRaised = true;
    };

    Listeners.addInternalEventListener(document, ['focus'], focusHandler);

    result = NativeMethods.select.call(this);

    Timeout.internalSetTimeout.call(window, function () {
        Timeout.internalSetTimeout.call(window, function () {
            Listeners.removeInternalEventListener(document, ['focus'], focusHandler);

            if (!focusRaised)
                EventSimulator.focus(element);
        }, 0);
    }, 0);

    return result;
}
