import FocusBlurSandbox from './focus-blur';
import Listeners from './listeners';
import nativeMethods from '../native-methods';
import * as browserUtils from '../../utils/browser';
import * as domUtils from '../../utils/dom';

export default class Selection {
    constructor (eventSandbox) {
        this.focusBlurSandbox = eventSandbox.focusBlur;
        this.timersSandbox    = eventSandbox.timers;
        this.listeners        = eventSandbox.listeners;
        this.eventSimulator   = eventSandbox.eventSimulator;

        var selection      = this;
        var eventSimulator = this.eventSimulator;
        var listeners      = this.listeners;
        var timersSandbox  = this.timersSandbox;

        this.setSelectionRangeWrapper = function () {
            var selectionStart     = arguments[0];
            var selectionEnd       = arguments[1];
            var selectionDirection = arguments[2] || 'none';
            var el                 = this;
            var fn                 = domUtils.isTextAreaElement(el) ? nativeMethods.textAreaSetSelectionRange : nativeMethods.setSelectionRange;
            var activeElement      = domUtils.getActiveElement(domUtils.findDocument(el));
            var isElementActive    = false;

            var selectionSetter = () => {
                var changeType = Selection._needChangeInputType(el);
                var savedType  = el.type;
                var res;

                if (changeType)
                    el.type = 'text';

                // NOTE: In MSEdge, an error occurs  when the setSelectionRange method is called for an input with
                // 'display = none' and selectionStart !== selectionEnd in other IEs, the error doesn't occur, but
                // as a result selectionStart === selectionEnd === 0.
                try {
                    res = fn.call(el, selectionStart, selectionEnd, selectionDirection);
                }
                catch (e) {
                    res = fn.call(el, 0, 0, selectionDirection);
                }

                if (changeType) {
                    el.type = savedType;
                    // HACK: (A problem with input type = 'number' after Chrome is updated to v.33.0.1750.117 and
                    // in Firefox 29.0.  T101195) To set right selection: if the input type is 'number' or 'email',
                    // we need to change the type to text, and then restore it after setting selection.(B254340).
                    // However, the type is changed asynchronously in this case. To force type changing,we need to
                    // call blur, Then raise the focus event to make the element active.
                    if (isElementActive) {
                        selection.focusBlurSandbox.blur(el, null, true);
                        selection.focusBlurSandbox.focus(el, null, true);
                    }
                }

                // NOTE: In MSEdge, the 'selectionchange' event doesn't occur immediately (it occurs with a delay)
                // So, we should raise it right after the 'setSelectionRange' method.
                if (browserUtils.isIE && browserUtils.version > 11)
                    eventSimulator.selectionchange(el);

                return res;
            };

            if (activeElement === el) {
                isElementActive = true;
                return selectionSetter();
            }

            // NOTE: setSelectionRange leads to focusing an element only in IE.
            return selection.wrapSetterSelection(el, selectionSetter, browserUtils.isIE && browserUtils.version < 12);
        };

        this.selectWrapper = function () {
            var element = this.parentElement();

            if (!element || domUtils.getActiveElement(domUtils.findDocument(element)) === element)
                return nativeMethods.select.call(this);

            var result       = null;
            var focusRaised  = false;
            var focusHandler = e => {
                if (e.target === element || element.style.display === 'none')
                    focusRaised = true;
            };

            listeners.addInternalEventListener(document, ['focus'], focusHandler);

            result = nativeMethods.select.call(this);

            timersSandbox.setTimeout.call(window, () => {
                timersSandbox.setTimeout.call(window, () => {
                    listeners.removeInternalEventListener(document, ['focus'], focusHandler);

                    if (!focusRaised)
                        eventSimulator.focus(element);
                }, 0);
            }, 0);

            return result;
        };
    }

    static _needChangeInputType (el) {
        return domUtils.isInputElement(el) && browserUtils.isWebKit && /^(number|email)$/.test(el.type);
    }

    setSelection (el, start, end, direction) {
        if (el.setSelectionRange)
            el.setSelectionRange(start, end, direction);
        else {
            el.selectionStart = start;
            el.selectionEnd   = end;
        }
    }

    getSelection (el) {
        var changeType      = Selection._needChangeInputType(el);
        var activeElement   = domUtils.getActiveElement(domUtils.findDocument(el));
        var isElementActive = activeElement === el;
        var savedType       = el.type;
        var selection       = null;

        // HACK: (A problem with input type = ‘number’ after Chrome is updated to v.33.0.1750.117 and in
        // Firefox 29.0. T101195) To get selection, if the input type is  'number' or 'email', we need to change
        // the type to text (B254340). However, the type is changed asynchronously in this case. To force type changing,
        // we need to call blur.Then call focus to make the element active.
        if (changeType) {
            if (isElementActive)
                this.focusBlurSandbox.blur(el, null, true);

            el.type = 'text';
        }

        selection = {
            start:     el.selectionStart,
            end:       el.selectionEnd,
            direction: el.selectionDirection
        };

        if (changeType) {
            el.type = savedType;

            if (isElementActive)
                this.focusBlurSandbox.focus(el, null, true);
        }

        return selection;
    }

    wrapSetterSelection (el, selectionSetter, needFocus, isContentEditable) {
        var curDocument   = domUtils.findDocument(el);
        var activeElement = null;
        var result        = null;
        var focusRaised   = false;

        var focusHandler = e => {
            if (e.target === el || el.style.display === 'none')
                focusRaised = true;
        };

        if (needFocus)
            this.listeners.addInternalEventListener(document, ['focus'], focusHandler);

        // The focus and blur events
        Listeners.beforeDispatchEvent();
        Listeners.beforeDispatchEvent();

        result = selectionSetter();

        // The focus and blur events
        Listeners.afterDispatchEvent();
        Listeners.afterDispatchEvent();

        if (needFocus) {
            activeElement = domUtils.getActiveElement(curDocument);

            if (browserUtils.isWebKit && activeElement !== el) {
                if (focusRaised)
                    el[FocusBlurSandbox.getInternalEventFlag('focus')] = true;

                el.focus();
            }

            // NOTE: In MSEdge, focus and blur are sync.
            if (browserUtils.isIE && browserUtils.version < 12) {
                this.timersSandbox.setTimeout.call(window, () => {
                    this.timersSandbox.setTimeout.call(window, () => {
                        this.listeners.removeInternalEventListener(document, ['focus'], focusHandler);

                        if (!focusRaised)
                            this.eventSimulator.focus(el);
                    }, 0);
                }, 0);
            }
            else {
                this.listeners.removeInternalEventListener(document, ['focus'], focusHandler);

                if (!focusRaised) {
                    // NOTE: In Firefox, raising the dispatchEvent 'focus' doesn’t activate an element.
                    // We should call the native focus method.
                    if (isContentEditable && browserUtils.isFirefox)
                        this.focusBlurSandbox.focus(el, null, true, false, true);
                    else
                        this.eventSimulator.focus(el);
                }
            }
        }
        return result;
    }
}
