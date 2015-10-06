import FocusBlurSandbox from './focus-blur';
import Listeners from './listeners';
import nativeMethods from '../native-methods';
import * as browserUtils from '../../utils/browser';
import { getActiveElement, findDocument, isInputWithoutSelectionPropertiesInFirefox } from '../../utils/dom';

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

            var isTextArea      = this.tagName && this.tagName.toLowerCase() === 'textarea';
            var fn              = isTextArea ? nativeMethods.textAreaSetSelectionRange : nativeMethods.setSelectionRange;
            var activeElement   = getActiveElement(findDocument(el));
            var isElementActive = false;

            var selectionSetter = () => {
                var changeType = Selection._needChangeInputType(el);
                var savedType  = el.type;
                var res;

                if (changeType)
                    el.type = 'text';

                //NOTE: in MSEdge error raised when setSelectionRange method calls for input with 'display = none' and selectionStart !== selectionEnd
                //in other IEs error don't raise but selectionStart === selectionEnd === 0 in result
                try {
                    res = fn.call(el, selectionStart, selectionEnd, selectionDirection);
                }
                catch (e) {
                    res = fn.call(el, 0, 0, selectionDirection);
                }

                if (changeType) {
                    el.type = savedType;
                    //HACK: (the problem after Chrome update to v.33.0.1750.117, and in Mozilla 29.0 for input with type 'number' T101195)
                    // To set right selection we should change input type to text if it's 'number' or 'email' and restore it after (B254340).
                    // But type changing is async in this case, so we should call blur to raise it (and focus to restore activeElement).
                    if (isElementActive) {
                        selection.focusBlurSandbox.blur(el, null, true);
                        selection.focusBlurSandbox.focus(el, null, true);
                    }
                }

                //NOTE:in MSEdge event 'selectionchange' doesn't occur immediately (with some delay)
                //so we should raise it right after 'setSelectionRange' method
                if (browserUtils.isIE && browserUtils.version > 11)
                    eventSimulator.selectionchange(el);

                return res;
            };

            if (activeElement === el) {
                isElementActive = true;
                return selectionSetter();
            }

            //setSelectionRange leads to element focusing only in IE
            return selection.wrapSetterSelection(el, selectionSetter, browserUtils.isIE && browserUtils.version < 12);
        };

        this.selectWrapper = function () {
            var element = this.parentElement();

            if (!element || getActiveElement(findDocument(element)) === element)
                return nativeMethods.select.call(this);

            var result       = null;
            var focusRaised  = false;
            var focusHandler = e => {
                if (e.target === element || element.style.display === 'none')
                    focusRaised = true;
            };

            listeners.addInternalEventListener(document, ['focus'], focusHandler);

            result = nativeMethods.select.call(this);

            timersSandbox.internalSetTimeout.call(window, () => {
                timersSandbox.internalSetTimeout.call(window, () => {
                    listeners.removeInternalEventListener(document, ['focus'], focusHandler);

                    if (!focusRaised)
                        eventSimulator.focus(element);
                }, 0);
            }, 0);

            return result;
        };
    }

    static _needChangeInputType (el) {
        var tagName = el.tagName ? el.tagName.toLowerCase() : '';

        return tagName === 'input' && (browserUtils.isWebKit && /^(number|email)$/.test(el.type));
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
        var activeElement   = getActiveElement(findDocument(el));
        var isElementActive = activeElement === el;
        var savedType       = el.type;
        var selection       = null;

        //HACK: (the problem after Chrome update to v.33.0.1750.117, and in Mozilla 29.0 for input with type 'number' T101195)
        // To get selection we should change input type to text if it's 'number' or 'email' (B254340).
        // But type changing is async in this case, so we should call blur to raise it (and focus to restore activeElement).
        if (changeType) {
            if (isElementActive)
                this.focusBlurSandbox.blur(el, null, true);

            el.type = 'text';
        }

        if (isInputWithoutSelectionPropertiesInFirefox(el)) {
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
                this.focusBlurSandbox.focus(el, null, true);
        }

        return selection;
    }

    wrapSetterSelection (el, selectionSetter, needFocus, isContentEditable) {
        var curDocument   = findDocument(el);
        var activeElement = null;
        var result        = null;
        var focusRaised   = false;

        var focusHandler = e => {
            if (e.target === el || el.style.display === 'none')
                focusRaised = true;
        };

        if (needFocus)
            this.listeners.addInternalEventListener(document, ['focus'], focusHandler);

        //focus and blur events
        Listeners.beforeDispatchEvent();
        Listeners.beforeDispatchEvent();

        result = selectionSetter();

        //focus and blur events
        Listeners.afterDispatchEvent();
        Listeners.afterDispatchEvent();

        if (needFocus) {
            activeElement = getActiveElement(curDocument);

            if (browserUtils.isWebKit && activeElement !== el) {
                if (focusRaised)
                    el[FocusBlurSandbox.getInternalEventFlag('focus')] = true;

                el.focus();
            }

            //in MSEdge focus/blur is sync
            if (browserUtils.isIE && browserUtils.version < 12) {
                this.timersSandbox.internalSetTimeout.call(window, () => {
                    this.timersSandbox.internalSetTimeout.call(window, () => {
                        this.listeners.removeInternalEventListener(document, ['focus'], focusHandler);

                        if (!focusRaised)
                            this.eventSimulator.focus(el);
                    }, 0);
                }, 0);
            }
            else {
                this.listeners.removeInternalEventListener(document, ['focus'], focusHandler);

                if (!focusRaised) {
                    //NOTE: in Firefox calling dispatchEvent 'focus' does active element.
                    // We should call native focus method.
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
