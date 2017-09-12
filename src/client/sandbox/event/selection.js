import FocusBlurSandbox from './focus-blur';
import Listeners from './listeners';
import nativeMethods from '../native-methods';
import * as browserUtils from '../../utils/browser';
import * as domUtils from '../../utils/dom';
import INTERNAL_PROPS from '../../../processing/dom/internal-properties';

const browserResetInputSelection = browserUtils.isFirefox && browserUtils.version > 50;

export default class Selection {
    constructor (eventSandbox) {
        this.focusBlurSandbox = eventSandbox.focusBlur;
        this.timersSandbox    = eventSandbox.timers;
        this.listeners        = eventSandbox.listeners;
        this.eventSimulator   = eventSandbox.eventSimulator;

        const selection      = this;
        const eventSimulator = this.eventSimulator;
        const listeners      = this.listeners;
        const timersSandbox  = this.timersSandbox;

        this.setSelectionRangeWrapper = function () {
            const selectionStart     = arguments[0];
            const selectionEnd       = arguments[1];
            const selectionDirection = arguments[2] || 'none';
            const el                 = this;
            const fn                 = domUtils.isTextAreaElement(el) ? nativeMethods.textAreaSetSelectionRange : nativeMethods.setSelectionRange;
            const activeElement      = domUtils.getActiveElement(domUtils.findDocument(el));
            let isElementActive      = false;

            const selectionSetter = () => {
                const changeType           = Selection._needChangeInputType(el);
                const useInternalSelection = Selection._needForInternalSelection(el);
                const savedType            = el.type;
                let res;

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

                if (useInternalSelection) {
                    el[INTERNAL_PROPS.selection] = {
                        selectionStart:     el.selectionStart,
                        selectionEnd:       el.selectionEnd,
                        selectionDirection: el.selectionDirection
                    };
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

                        // HACK: we should call focus for previous active element again because
                        // in Firefox 55.0.3 after first focus active element isn't changed
                        if (domUtils.getActiveElement(domUtils.findDocument(el)) !== el)
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
            const element = this.parentElement();

            if (!element || domUtils.getActiveElement(domUtils.findDocument(element)) === element)
                return nativeMethods.select.call(this);

            let result         = null;
            let focusRaised    = false;
            const focusHandler = e => {
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

    static _isNumberOrEmailInput (el) {
        return domUtils.isInputElement(el) && /^(number|email)$/.test(el.type);
    }

    static _needChangeInputType (el) {
        return (browserUtils.isWebKit || browserResetInputSelection) && Selection._isNumberOrEmailInput(el);
    }

    // NOTE: We need to store the state of element's selection
    // because it is cleared when element's type is changed
    static _needForInternalSelection (el) {
        return Selection._isNumberOrEmailInput(el) && browserResetInputSelection;
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
        const changeType      = Selection._needChangeInputType(el);
        const activeElement   = domUtils.getActiveElement(domUtils.findDocument(el));
        const isElementActive = activeElement === el;
        const savedType       = el.type;
        let selection         = null;

        // HACK: (A problem with input type = ‘number’ after Chrome is updated to v.33.0.1750.117 and in
        // Firefox 29.0. T101195) To get selection, if the input type is  'number' or 'email', we need to change
        // the type to text (B254340). However, the type is changed asynchronously in this case. To force type changing,
        // we need to call blur.Then call focus to make the element active.
        if (changeType) {
            // NOTE: We shouldn't call blur while changing element's type in Firefox, cause
            // sometimes it can't be focused after. The reason of this behavior is hard to
            // be determinated, this was found during execution testcafe client tests.
            if (!browserResetInputSelection && isElementActive)
                this.focusBlurSandbox.blur(el, null, true);

            el.type = 'text';
        }

        const internalSelection = el[INTERNAL_PROPS.selection];

        selection = {
            start:     internalSelection ? internalSelection.selectionStart : el.selectionStart,
            end:       internalSelection ? internalSelection.selectionEnd : el.selectionEnd,
            direction: internalSelection ? internalSelection.selectionDirection : el.selectionDirection
        };

        if (changeType) {
            el.type = savedType;

            if (isElementActive)
                this.focusBlurSandbox.focus(el, null, true);
        }

        return selection;
    }

    wrapSetterSelection (el, selectionSetter, needFocus, isContentEditable) {
        const curDocument = domUtils.findDocument(el);
        let activeElement = null;
        let result        = null;
        let focusRaised   = false;

        const focusHandler = e => {
            if (e.target === el || el.style.display === 'none')
                focusRaised = true;
        };

        if (needFocus)
            this.listeners.addInternalEventListener(document, ['focus'], focusHandler);

        // The focus and blur events
        Listeners.beforeDispatchEvent(el);
        Listeners.beforeDispatchEvent(el);

        result = selectionSetter();

        // The focus and blur events
        Listeners.afterDispatchEvent(el);
        Listeners.afterDispatchEvent(el);

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
