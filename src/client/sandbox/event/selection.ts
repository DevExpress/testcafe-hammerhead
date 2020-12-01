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
            const curDocument        = domUtils.findDocument(el);
            let isElementActive      = false;

            const selectionSetter = () => {
                // NOTE: These browsers cannot restore the `selectionStart` and `selectionEnd` properties when we change the `type` attribute.
                // So we need to use our own mechanism to store the `selectionStart` and `selectionEnd` properties.
                const useInternalSelection = domUtils.isInputWithoutSelectionProperties(el);
                const savedType            = el.type;
                let res;

                if (useInternalSelection)
                    el.setAttribute('type', 'text');

                // NOTE: In MSEdge, an error occurs when the setSelectionRange method is called for an input with
                // 'display = none' and selectionStart !== selectionEnd in other IEs, the error doesn't occur, but
                // as a result selectionStart === selectionEnd === 0.
                try {
                    res = fn.call(el, selectionStart, selectionEnd, selectionDirection);
                }
                catch (e) {
                    res = fn.call(el, 0, 0, selectionDirection);
                }

                if (useInternalSelection ) {
                    el[INTERNAL_PROPS.selection] = {
                        selectionStart:     el.selectionStart,
                        selectionEnd:       el.selectionEnd,
                        selectionDirection: el.selectionDirection
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

                // NOTE: In MSEdge, the 'selectionchange' event doesn't occur immediately (it occurs with a delay)
                // So, we should raise it right after the 'setSelectionRange' method.
                if (browserUtils.isMSEdge)
                    eventSimulator.selectionchange(el);

                return res;
            };

            if (activeElement === el) {
                isElementActive = true;
                return selectionSetter();
            }

            const needFocus = browserUtils.isIE11 || browserUtils.isMSEdge &&
                              (browserUtils.version === 17 && !curDocument.hasFocus() || browserUtils.version > 17);

            return selection.wrapSetterSelection(el, selectionSetter, needFocus);
        };

        this.selectWrapper = function (this: HTMLElement) {
            const element = this.parentElement;

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
            direction: internalSelection ? internalSelection.selectionDirection : el.selectionDirection
        };
    }

    wrapSetterSelection (el, selectionSetter, needFocus, isContentEditable?: boolean) {
        const curDocument = domUtils.findDocument(el);
        let activeElement = domUtils.getActiveElement(curDocument);
        let result        = null;
        let focusRaised   = false;

        // NOTE: we should not call focus during selection setting
        // if element has been focused already (TestCafe GH-2301)
        needFocus = needFocus && activeElement !== el;

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

            if (activeElement !== el && (browserUtils.isWebKit || browserUtils.isMSEdge && browserUtils.version > 17)) {
                if (focusRaised)
                    el[FocusBlurSandbox.getInternalEventFlag('focus')] = true;

                el.focus();
            }

            // NOTE: In MSEdge, focus and blur are sync.
            if (browserUtils.isIE11) {
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
