import INTERNAL_ATTRS from '../../../processing/dom/internal-attributes';
import INTERNAL_PROPS from '../../../processing/dom/internal-properties';
import SandboxBase from '../base';
import ActiveWindowTracker from '../event/active-window-tracker';
import nativeMethods from '../native-methods';
import * as browserUtils from '../../utils/browser';
import * as domUtils from '../../utils/dom';
import * as styleUtils from '../../utils/style';

const INTERNAL_FOCUS_BLUR_FLAG_PREFIX = 'hammerhead|event|internal-';

const eventsMap = {
    bubbles: {
        'focus': 'focusin',
        'blur':  'focusout'
    },
    nonBubbles: {
        'focusin':  'focus',
        'focusout': 'blur'
    }
};

export default class FocusBlurSandbox extends SandboxBase {
    constructor (listeners, eventSimulator, messageSandbox, shadowUI, timersSandbox, elementEditingWatcher) {
        super();

        this.topWindow          = null;
        this.lastFocusedElement = null;
        this.scrollState        = {};

        this.eventSimulator        = eventSimulator;
        this.activeWindowTracker   = new ActiveWindowTracker(messageSandbox);
        this.shadowUI              = shadowUI;
        this.listeners             = listeners;
        this.elementEditingWatcher = elementEditingWatcher;
        this.timersSandbox         = timersSandbox;
    }

    static _getNativeMeth (el, event) {
        if (domUtils.isSVGElement(el)) {
            if (event === 'focus')
                return nativeMethods.svgFocus;
            else if (event === 'blur')
                return nativeMethods.svgBlur;
        }

        return nativeMethods[event];
    }

    static _restoreElementScroll (el, scroll) {
        const newScroll = styleUtils.getElementScroll(el);

        if (newScroll.left !== scroll.left)
            styleUtils.setScrollLeft(el, scroll.left);

        if (newScroll.top !== scroll.top)
            styleUtils.setScrollTop(el, scroll.top);
    }

    _onChangeActiveElement (activeElement) {
        if (this.lastFocusedElement === activeElement)
            return;

        if (this.lastFocusedElement &&
            nativeMethods.getAttribute.call(this.lastFocusedElement, INTERNAL_ATTRS.focusPseudoClass))
            nativeMethods.removeAttribute.call(this.lastFocusedElement, INTERNAL_ATTRS.focusPseudoClass);

        if (domUtils.isElementFocusable(activeElement) && !(domUtils.isBodyElement(activeElement) &&
            domUtils.getTabIndex(activeElement, 'tabIndex') === null)) {
            this.lastFocusedElement = activeElement;
            nativeMethods.setAttribute.call(activeElement, INTERNAL_ATTRS.focusPseudoClass, true);
        }
        else
            this.lastFocusedElement = null;
    }

    _shouldUseLabelHtmlForElement (el, type) {
        return type === 'focus' && domUtils.isLabelElement(el) && el.htmlFor;
    }

    _getElementNonScrollableParentsScrollState (el) {
        const scrollState    = [];
        const elementParents = domUtils.getParents(el);

        for (const elementParent of elementParents) {
            if (styleUtils.get(elementParent, 'overflow') === 'hidden') {
                scrollState.push({
                    element: elementParent,
                    state:   styleUtils.getElementScroll(elementParent)
                });
            }
        }

        return scrollState;
    }

    _restoreElementNonScrollableParentsScrollState (scrollState) {
        for (const scrollStateEntry of scrollState)
            FocusBlurSandbox._restoreElementScroll(scrollStateEntry.element, scrollStateEntry.state);
    }

    _saveScrollStateIfNecessary (el, preventScrolling) {
        if (preventScrolling)
            this.scrollState.windowScroll = styleUtils.getElementScroll(this.window);

        if (browserUtils.isIE)
            this.scrollState.elementNonScrollableParentsScrollState = this._getElementNonScrollableParentsScrollState(el);
    }

    _restoreScrollStateIfNecessary (preventScrolling) {
        if (preventScrolling)
            FocusBlurSandbox._restoreElementScroll(this.window, this.scrollState.windowScroll);

        if (browserUtils.isIE)
            this._restoreElementNonScrollableParentsScrollState(this.scrollState.elementNonScrollableParentsScrollState);
    }

    _raiseEvent (el, type, callback, withoutHandlers, isAsync, forMouseEvent, preventScrolling, relatedTarget) {
        // NOTE: We cannot use Promise because 'resolve' will be called async, but we need to resolve
        // immediately in IE9 and IE10.

        const simulateEvent = () => {
            // NOTE: The focus and blur events should be raised after activeElement is changed (B237489)
            // in MSEdge, the focus/blur events are executed  synchronously.
            if (browserUtils.isIE && browserUtils.version < 12) {
                this.window.setTimeout(() => {
                    this.window.setTimeout(() => {
                        delete el[FocusBlurSandbox.getInternalEventFlag(type)];
                    }, 0);
                }, 0);
            }
            else
                delete el[FocusBlurSandbox.getInternalEventFlag(type)];

            if (!withoutHandlers) {

                const bubblesEventType               = eventsMap.bubbles[type];
                const isMSEdgeBlur                   = browserUtils.isMSEdge && browserUtils.version < 17 && type === 'blur';
                const bubblesEventShouldRaiseFirstly = browserUtils.isIE11 || isMSEdgeBlur;

                if (isAsync) {
                    // NOTE: focusin, focusout events are synchronously
                    this.eventSimulator[bubblesEventType](el, relatedTarget);
                    this.timersSandbox.deferFunction(() => this.eventSimulator[type](el, relatedTarget));
                }
                else if (bubblesEventShouldRaiseFirstly) {
                    this.eventSimulator[bubblesEventType](el, relatedTarget);
                    this.eventSimulator[type](el, relatedTarget);
                }
                else {
                    this.eventSimulator[type](el, relatedTarget);
                    this.eventSimulator[bubblesEventType](el, relatedTarget);
                }
            }

            callback();
        };

        if (el[type]) {
            // NOTE: To guarantee that all focus/blur events are raised, we need to raise them manually.
            this._saveScrollStateIfNecessary(el, preventScrolling);

            if (this._shouldUseLabelHtmlForElement(el, type)) {
                const htmlForElement = nativeMethods.getElementById.call(domUtils.findDocument(el), el.htmlFor);

                if (htmlForElement)
                    el = htmlForElement;
                else {
                    callback();
                    return;
                }
            }

            el[FocusBlurSandbox.getInternalEventFlag(type)] = true;
            // NOTE: We should guarantee that activeElement will be changed, therefore we need to call the native
            // focus/blur event.
            FocusBlurSandbox._getNativeMeth(el, type).call(el);
            this._restoreScrollStateIfNecessary(preventScrolling);

            const curDocument   = domUtils.findDocument(el);
            const activeElement = domUtils.getActiveElement(curDocument);

            // NOTE: If the element was not focused and has a parent with tabindex, we focus this parent.
            const parent             = el.parentNode;
            const parentWithTabIndex = parent === document ? null : domUtils.closest(parent, '[tabindex]');

            if (type === 'focus' && activeElement !== el && parentWithTabIndex && forMouseEvent) {
                // NOTE: In WebKit, Safari and MSEdge, calling the native focus event for a parent element
                // raises page scrolling. We can't prevent it. Therefore, we need to restore a page scrolling value.
                const needPreventScrolling = browserUtils.isWebKit || browserUtils.isSafari || browserUtils.isIE;

                this._raiseEvent(parentWithTabIndex, 'focus', simulateEvent, false, false, forMouseEvent, needPreventScrolling);
            }
            // NOTE: Some browsers don't change document.activeElement after calling element.blur() if a browser
            // window is in the background. That's why we call body.focus() without handlers. It should be called
            // synchronously because client scripts may expect that document.activeElement will be changed immediately
            // after element.blur() is called.
            else if (type === 'blur' && activeElement === el && el !== curDocument.body)
                this._raiseEvent(curDocument.body, 'focus', simulateEvent, true);
            else if (!el.disabled)
                simulateEvent();
            else
                callback();
        }
        else
            simulateEvent();
    }

    static getInternalEventFlag (type) {
        return INTERNAL_FOCUS_BLUR_FLAG_PREFIX + type;
    }

    static getNonBubblesEventType (bubblesEventType) {
        return eventsMap.nonBubbles[bubblesEventType];
    }

    attach (window) {
        super.attach(window);

        this.activeWindowTracker.attach(window);
        this.topWindow = domUtils.isCrossDomainWindows(window, window.top) ? window : window.top;

        this.listeners.addInternalEventListener(window, ['focus', 'blur'], () => {
            const activeElement = domUtils.getActiveElement(this.document);

            this._onChangeActiveElement(activeElement);
        });
    }

    _raiseSelectionChange (callback, el) {
        // NOTE: In MSEdge, the 'selectionchange' event doesn't occur immediately (it occurs with a some delay)
        // so we should raise it right after the 'focus' event is raised.
        if (browserUtils.isMSEdge && el && domUtils.isTextEditableElement(el))
            this.eventSimulator.selectionchange(el);

        if (typeof callback === 'function')
            callback();
    }

    focus (el, callback, silent, forMouseEvent, isNativeFocus, preventScrolling) {
        // NOTE: el.focus() does not raise the event if the element is invisible. If the element is located
        // within an invisible iframe, all browsers except Chrome do not raise the event (GH-442)
        const raiseEventInIframe = !isNativeFocus || browserUtils.isWebKit ||
                                   !styleUtils.isElementInInvisibleIframe(el);
        const elDocument         = (el[INTERNAL_PROPS.processedContext] || this.window).document;

        if (!raiseEventInIframe || isNativeFocus && !styleUtils.isElementVisible(el, elDocument))
            return null;

        const isElementInIframe     = domUtils.isElementInIframe(el);
        const iframeElement         = isElementInIframe ? domUtils.getIframeByElement(el) : null;
        const curDocument           = domUtils.findDocument(el);
        const isBodyElement         = domUtils.isBodyElement(el);
        const activeElement         = domUtils.getActiveElement();
        const activeElementDocument = domUtils.findDocument(activeElement);

        let withoutHandlers = false;
        let needBlur        = false;
        let needBlurIframe  = false;

        const isContentEditable     = domUtils.isContentEditableElement(el);
        const isCurrentWindowActive = this.activeWindowTracker.isCurrentWindowActive();

        if (activeElement === el)
            withoutHandlers = !(isBodyElement && isContentEditable && !isCurrentWindowActive);
        else
            withoutHandlers = isBodyElement && !(isContentEditable || browserUtils.isIE);

        // NOTE: In IE, if you call focus() or blur() methods from script, an active element is changed immediately,
        // but events are raised asynchronously after some timeout.
        let isAsync           = false;
        const raiseFocusEvent = () => {
            if (!isCurrentWindowActive && !domUtils.isShadowUIElement(el))
                this.activeWindowTracker.makeCurrentWindowActive();

            this._raiseEvent(el, 'focus', () => {
                if (!silent)
                    this.elementEditingWatcher.watchElementEditing(el);

                // NOTE: If we call focus for an unfocusable element (like 'div' or 'image') in iframe, we should
                // specify document.active for this iframe manually, so we call focus without handlers.
                if (isElementInIframe && iframeElement &&
                    domUtils.getActiveElement(this.topWindow.document) !== iframeElement)
                    this._raiseEvent(iframeElement, 'focus', () => this._raiseSelectionChange(callback, el), true, isAsync);
                else
                    this._raiseSelectionChange(callback, el);

            }, withoutHandlers || silent, isAsync, forMouseEvent, preventScrolling, activeElement);
        };

        if (isNativeFocus && browserUtils.isIE) {
            // NOTE: In IE, the focus() method does not have any effect if it is called in the focus event handler
            // during the  second event phase.
            if ((this.eventSimulator.isSavedWindowsEventsExists() || browserUtils.version > 10) &&
                this.window.event &&
                this.window.event.type === 'focus' && this.window.event.srcElement === el) {
                this._raiseSelectionChange(callback, el);

                return null;
            }

            // NOTE: In MSEdge, the focus/blur events are executed synchronously.
            if (browserUtils.version < 12)
                isAsync = true;
        }

        if (activeElement && activeElement.tagName) {
            if (activeElement !== el) {
                // NOTE: B253685
                if (curDocument !== activeElementDocument && activeElement === activeElementDocument.body)
                    needBlur = false;
                else if (activeElement === curDocument.body) {
                    // NOTE: The Blur event is raised for the body only in IE. In addition, we must not call the
                    // blur function for the body because this moves the browser window into the background.
                    if (!silent && browserUtils.isIE) {
                        if (isAsync)
                            this.timersSandbox.setTimeout.call(this.window, () => this.eventSimulator.blur(activeElement), 0);
                        else
                            this.eventSimulator.blur(activeElement);
                    }
                }
                else if (!el.disabled)
                    needBlur = true;
            }

            // NOTE: B254260
            needBlurIframe = curDocument !== activeElementDocument &&
                             domUtils.isElementInIframe(activeElement, activeElementDocument);
        }
        // NOTE: We always call blur for iframe manually without handlers (B254260).
        if (needBlurIframe && !needBlur) {
            if (browserUtils.isIE) {
                // NOTE: We should call blur for iframe with handlers in IE but we can't call the method 'blur'
                // because activeElement !== element and handlers will not be called.
                this.eventSimulator.blur(domUtils.getIframeByElement(activeElement));
                raiseFocusEvent();
            }
            else
                this.blur(domUtils.getIframeByElement(activeElement), raiseFocusEvent, true, isNativeFocus);
        }
        else if (needBlur) {
            this.blur(activeElement, () => {
                if (needBlurIframe)
                    this.blur(domUtils.getIframeByElement(activeElement), raiseFocusEvent, true, isNativeFocus);
                else
                    raiseFocusEvent();
            }, silent, isNativeFocus, el);
        }
        else
            raiseFocusEvent();

        return null;
    }

    blur (el, callback, withoutHandlers, isNativeBlur, relatedTarget) {
        const activeElement = domUtils.getActiveElement(domUtils.findDocument(el));
        // NOTE: In IE, if you call the focus() or blur() method from script, an active element is changed
        // immediately but events are raised asynchronously after some timeout (in MSEdgethe focus/blur methods
        // are executed synchronously).
        const isAsync = isNativeBlur && browserUtils.isIE && browserUtils.version < 12;

        if (activeElement !== el)
            withoutHandlers = true;

        if (!withoutHandlers) {
            this.elementEditingWatcher.processElementChanging(el);
            this.elementEditingWatcher.stopWatching(el);
        }

        this._raiseEvent(el, 'blur', () => {
            if (typeof callback === 'function')
                callback();
        }, withoutHandlers, isAsync, false, false, relatedTarget);
    }

    static _processFocusPseudoClassSelector (selector) {
        // NOTE: When a selector that contains the ':focus' pseudo-class is used in the querySelector and
        // querySelectorAll functions, these functions return an empty result if the browser is not focused.
        // This replaces ':focus' with a custom CSS class to return the current active element in that case.
        // IE returns a valid element, so there is no need to replace the selector for it.

        if (!browserUtils.isIE)
            return selector.replace(/\s*:focus\b/gi, '[' + INTERNAL_ATTRS.focusPseudoClass + ']');

        return selector;
    }
}
