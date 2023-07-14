import TimersSandbox from '../timers';
import EventSimulator from './simulator';
import EventSandbox from './index';
import FocusBlurSandbox from './focus-blur';
import Listeners from './listeners';
import nativeMethods from '../native-methods';
import * as browserUtils from '../../utils/browser';
import * as domUtils from '../../utils/dom';
import INTERNAL_PROPS from '../../../processing/dom/internal-properties';

export default class Selection {
    focusBlurSandbox: FocusBlurSandbox;
    timersSandbox: TimersSandbox;
    listeners: Listeners;
    eventSimulator: EventSimulator;
    setSelectionRangeWrapper: any;
    selectWrapper: any;

    constructor (eventSandbox: EventSandbox) {
        this.focusBlurSandbox = eventSandbox.focusBlur;
        this.timersSandbox    = eventSandbox.timers;
        this.listeners        = eventSandbox.listeners;
        this.eventSimulator   = eventSandbox.eventSimulator;

        const selection      = this;
        const eventSimulator = this.eventSimulator;
        const listeners      = this.listeners;
        const timersSandbox  = this.timersSandbox;

        this.setSelectionRangeWrapper = function (this: HTMLInputElement | HTMLTextAreaElement) {
            const selectionStart     = arguments[0];
            const selectionEnd       = arguments[1];
            const selectionDirection = arguments[2] || 'none';
            const el                 = this;
            const fn                 = domUtils.isTextAreaElement(el) ? nativeMethods.textAreaSetSelectionRange : nativeMethods.setSelectionRange;
            const activeElement      = domUtils.getActiveElement(domUtils.findDocument(el));
            let isElementActive      = false;

            const selectionSetter = () => {
                // NOTE: These browsers cannot restore the `selectionStart` and `selectionEnd` properties when we change the `type` attribute.
                // So we need to use our own mechanism to store the `selectionStart` and `selectionEnd` properties.
                const useInternalSelection = domUtils.isInputWithoutSelectionProperties(el);
                const savedType            = el.type;

                if (useInternalSelection)
                    el.setAttribute('type', 'text');

                const res = fn.call(el, selectionStart, selectionEnd, selectionDirection);

                if (useInternalSelection ) {
                    el[INTERNAL_PROPS.selection] = {
                        selectionStart:     el.selectionStart,
                        selectionEnd:       el.selectionEnd,
                        selectionDirection: el.selectionDirection,
                    };

                    el.setAttribute('type', savedType);
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

                return res;
            };

            if (activeElement === el) {
                isElementActive = true;
                return selectionSetter();
            }

            return selection.wrapSetterSelection(el, selectionSetter);
        };

        this.selectWrapper = function (this: HTMLElement) {
            const element = this.parentElement;

            if (!element || domUtils.getActiveElement(domUtils.findDocument(element)) === element)
                return nativeMethods.select.call(this);

            let result         = null;
            let focusRaised    = false;
            const focusHandler = (e: FocusEvent) => {
                if (nativeMethods.eventTargetGetter.call(e) === element || element.style.display === 'none')
                    focusRaised = true;
            };

            listeners.addInternalEventBeforeListener(document, ['focus'], focusHandler);

            result = nativeMethods.select.call(this);

            timersSandbox.setTimeout.call(window, () => {
                timersSandbox.setTimeout.call(window, () => {
                    listeners.removeInternalEventBeforeListener(document, ['focus'], focusHandler);

                    if (!focusRaised)
                        eventSimulator.focus(element);
                }, 0);
            }, 0);

            return result;
        };
    }

    setSelection (el, start: number, end: number, direction) {
        if (el.setSelectionRange)
            el.setSelectionRange(start, end, direction);
        else {
            el.selectionStart = start;
            el.selectionEnd   = end;
        }
    }

    getSelection (el) {
        const internalSelection = el[INTERNAL_PROPS.selection];

        return {
            start:     internalSelection ? internalSelection.selectionStart : el.selectionStart,
            end:       internalSelection ? internalSelection.selectionEnd : el.selectionEnd,
            direction: internalSelection ? internalSelection.selectionDirection : el.selectionDirection,
        };
    }

    wrapSetterSelection (el, selectionSetter, needFocus?: boolean, isContentEditable?: boolean) {
        const curDocument = domUtils.findDocument(el);
        let activeElement = domUtils.getActiveElement(curDocument);
        let result        = null;
        let focusRaised   = false;

        // NOTE: we should not call focus during selection setting
        // if element has been focused already (TestCafe GH-2301)
        needFocus = needFocus && activeElement !== el;

        const focusHandler = (e: FocusEvent) => {
            if (nativeMethods.eventTargetGetter.call(e) === el || el.style.display === 'none')
                focusRaised = true;
        };

        if (needFocus)
            this.listeners.addInternalEventBeforeListener(document, ['focus'], focusHandler);

        // The focus and blur events
        Listeners.beforeDispatchEvent(el);
        Listeners.beforeDispatchEvent(el);

        result = selectionSetter();

        // The focus and blur events
        Listeners.afterDispatchEvent(el);
        Listeners.afterDispatchEvent(el);

        if (needFocus) {
            activeElement = domUtils.getActiveElement(curDocument);

            if (activeElement !== el && browserUtils.isWebKit) {
                if (focusRaised)
                    el[FocusBlurSandbox.getInternalEventFlag('focus')] = true;

                el.focus();
            }

            this.listeners.removeInternalEventBeforeListener(document, ['focus'], focusHandler);

            if (!focusRaised) {
                // NOTE: In Firefox, raising the dispatchEvent 'focus' doesn’t activate an element.
                // We should call the native focus method.
                if (isContentEditable && browserUtils.isFirefox)
                    this.focusBlurSandbox.focus(el, null, true, false, true);
                else
                    this.eventSimulator.focus(el);
            }
        }

        return result;
    }
}
