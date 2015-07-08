import * as Browser from '../../util/browser';
import * as DOM from '../../util/dom';
import * as ElementEditingWatcher from './element-editing-watcher';
import * as EventSimulator from './simulator';
import * as Listeners from './listeners';
import NativeMethods from '../native-methods';
import * as Timeout from './timeout';
import * as ShadowUI from '../shadow-ui';
import Const from '../../../const';
import * as Style from '../../util/style';

const INTERNAL_FOCUS_FLAG = Const.PROPERTY_PREFIX + 'iff';
const INTERNAL_BLUR_FLAG  = Const.PROPERTY_PREFIX + 'ibf';

var shouldDisableOuterFocusHandlers = false;
var currentWindow             = null;
var topWindow                 = null;
var hoverElementFixed         = false;
var lastHoveredElement        = null;

function callFocusCallback (callback, el) {
    //NOTE:in MSEdge event 'selectionchange' doesn't occur immediately (with some delay)
    //so we should raise it right after 'focus' event
    if (Browser.isIE && Browser.version > 11 && el && DOM.isTextEditableElement(el))
        EventSimulator.selectionchange(el);

    if (typeof callback === 'function')
        callback();
}

function raiseEvent (element, type, callback, withoutHandlers, isAsync, forMouseEvent, preventScrolling) {
    //NOTE: focus and blur events should be raised after the activeElement changed (B237489)
    //in MSEdge focus/blur is sync
    var simulateEvent = function () {
        /*eslint-disable indent */
        if (Browser.isIE && Browser.version < 12) {
            currentWindow.setTimeout(function () {
                currentWindow.setTimeout(function () {
                    if (element[getInternalEventFlag(type)])
                        delete element[getInternalEventFlag(type)];
                }, 0);
            }, 0);
        }
        else if (element[getInternalEventFlag(type)])
            delete element[getInternalEventFlag(type)];
        /*eslint-enable indent */

        if (!withoutHandlers) {
            /*eslint-disable indent */
            if (isAsync) {
                Timeout.deferFunction(function () {
                    EventSimulator[type](element);
                });
            }
            else
                EventSimulator[type](element);
            /*eslint-enable indent */
        }

        callback();
    };

    //T239149 - TD15.1? - Error occurs during assertion creation on http://knockoutjs.com/examples/helloWorld.html in IE9
    if (Browser.isIE9 && ShadowUI.getRoot() === element && (type === 'focus' || type === 'blur'))
        callback();

    /*eslint-disable indent */
    if (element[type]) {
        //NOTE: we should guarantee that activeElement will be changed, therefore we should call native focus/blur
        // event. To guarantee all focus/blur events raising we should raise it manually too.

        var windowScroll = null;

        if (preventScrolling)
            windowScroll = Style.getElementScroll(currentWindow);

        var tempElement = null;

        if (type === 'focus' && element.tagName && element.tagName.toLowerCase() === 'label' &&
            element.htmlFor) {
            tempElement = DOM.findDocument(element).getElementById(element.htmlFor);
            if (tempElement)
                element = tempElement;
            else {
                callback();
                return;
            }
        }

        element[getInternalEventFlag(type)] = true;

        NativeMethods[type].call(element);

        if (preventScrolling) {
            var newWindowScroll = Style.getElementScroll(currentWindow);

            if (newWindowScroll.left !== windowScroll.left)
                Style.setScrollLeft(currentWindow, windowScroll.left);

            if (newWindowScroll.top !== windowScroll.top)
                Style.setScrollTop(windowScroll.top);
        }

        var curDocument   = DOM.findDocument(element);
        var activeElement = DOM.getActiveElement(curDocument);

        //if element was not focused and it has parent with tabindex, we focus this parent
        var parent = element.parentNode;

        if (type === 'focus' && activeElement !== element && parent !== document &&
            DOM.closest(parent, '[tabindex]') && forMouseEvent) {
            //NOTE: in WebKit calling of native focus for parent element raised page scrolling, we can't prevent it,
            // therefore we need to restore page scrolling value
            raiseEvent(DOM.closest(parent, '[tabindex]'), 'focus', simulateEvent, false, false, forMouseEvent, forMouseEvent &&
                                                                                                               Browser.isWebKit);
        }
        // NOTE: some browsers doesn't change document.activeElement after element.blur() if browser window is on background.
        // That's why we call body.focus() without handlers. It should be called synchronously because client scripts may
        // expect that document.activeElement will be changed immediately after element.blur() calling.
        else if (type === 'blur' && activeElement === element && element !== curDocument.body)
            raiseEvent(curDocument.body, 'focus', simulateEvent, true);
        else
            simulateEvent();
    }
    else
        simulateEvent();
    /*eslint-enable indent */
}

function onMouseOverHandler (e) {
    if (hoverElementFixed || DOM.isShadowUIElement(e.target))
        return;

    // NOTE: In this method, we are looking for a joint parent for the previous and the new hovered element.
    // Processes need only to that parent. This we are trying to reduce the number of dom calls.

    var clearHoverMarkerUntilJointParent = function (lastHoveredElement, newHoveredElement) {
        var jointParent = null;

        if (lastHoveredElement) {
            var el = lastHoveredElement;

            while (el && el.tagName) {
                // Check that the current element is a joint parent for the hovered elements.
                /*eslint-disable indent */
                if (el.contains && !el.contains(newHoveredElement)) {
                    NativeMethods.removeAttribute.call(el, Const.HOVER_PSEUDO_CLASS_ATTR);
                    el = el.parentNode;
                }
                else
                    break;
                /*eslint-enable indent */
            }

            jointParent = el;

            if (jointParent)
                NativeMethods.removeAttribute.call(jointParent, Const.HOVER_PSEUDO_CLASS_ATTR);
        }

        return jointParent;
    };

    var setHoverMarker = function (newHoveredElement, jointParent) {
        if (jointParent)
            NativeMethods.setAttribute.call(jointParent, Const.HOVER_PSEUDO_CLASS_ATTR, '');

        while (newHoveredElement && newHoveredElement.tagName) {
            /*eslint-disable indent */
            // Assign pseudo-class marker up to joint parent.
            if (newHoveredElement !== jointParent) {
                NativeMethods.setAttribute.call(newHoveredElement, Const.HOVER_PSEUDO_CLASS_ATTR, '');
                newHoveredElement = newHoveredElement.parentNode;
            }
            else
                break;
            /*eslint-enable indent */
        }
    };

    var jointParent = clearHoverMarkerUntilJointParent(lastHoveredElement, e.target);

    setHoverMarker(e.target, jointParent);
}

function onMouseOut (e) {
    if (!DOM.isShadowUIElement(e.target))
        lastHoveredElement = e.target;
}

export function init (window) {
    currentWindow = window;
    topWindow     = DOM.isCrossDomainWindows(currentWindow, currentWindow.top) ? currentWindow : currentWindow.top;

    Listeners.addInternalEventListener(window, ['mouseover'], onMouseOverHandler);
    Listeners.addInternalEventListener(window, ['mouseout'], onMouseOut);
}

export function focus (element, callback, silent, forMouseEvent, isNativeFocus) {
    if (shouldDisableOuterFocusHandlers && !DOM.isShadowUIElement(element))
        return null;

    var isCurrentElementInIFrame = DOM.isElementInIframe(element);
    var iFrameElement            = isCurrentElementInIFrame ? DOM.getIFrameByElement(element) : null;
    var curDocument              = DOM.findDocument(element);
    var withoutHandlers          = element === curDocument.body && !Browser.isIE;

    // NOTE: in IE if you call focus() or blur() methods from script, active element is changed immediately
    // but events are raised asynchronously after some timeout
    var isAsync = false;

    var raiseFocusEvent = function () {
        raiseEvent(element, 'focus', function () {
            if (!silent)
                ElementEditingWatcher.watchElementEditing(element);

            // NOTE: If we call focus for unfocusable element (like 'div' or 'image') in iframe we should make
            // document.active this iframe manually, so we call focus without handlers
            /*eslint-disable indent */
            if (isCurrentElementInIFrame && iFrameElement &&
                topWindow.document.activeElement !== iFrameElement) {
                raiseEvent(iFrameElement, 'focus', function () {
                    callFocusCallback(callback, element);
                }, true, isAsync);
            }
            else
                callFocusCallback(callback, element);
            /*eslint-enable indent */

        }, withoutHandlers || silent, isAsync, forMouseEvent);
    };

    if (isNativeFocus && Browser.isIE) {
        //in IE focus() method does not have any effect if it is called from focus event handler on second event phase
        if ((EventSimulator.isSavedWindowsEventsExists() || Browser.isIE && Browser.version > 10) &&
            currentWindow.event &&
            currentWindow.event.type === 'focus' && currentWindow.event.srcElement === element) {
            callFocusCallback(callback);

            return null;
        }

        if (Browser.version < 12) //in MSEdge focus/blur is sync
            isAsync = true;
    }

    var activeElement         = DOM.getActiveElement();
    var activeElementDocument = DOM.findDocument(activeElement);
    var needBlur              = false;
    var needBlurIFrame        = false;

    if (activeElement && activeElement.tagName) {
        /*eslint-disable indent */
        if (activeElement === element)
            withoutHandlers = true;
        else if (curDocument !== activeElementDocument && activeElement === activeElementDocument.body)  //B253685
            needBlur = false;
        else if (activeElement === curDocument.body) {
            //Blur event raised for body only in IE. In addition, we must not call blur function for body because
            //this leads to browser window moving to background
            if (!silent && Browser.isIE) {
                var simulateBodyBlur = EventSimulator.blur.bind(EventSimulator, activeElement);

                if (isAsync)
                    Timeout.internalSetTimeout.call(currentWindow, simulateBodyBlur, 0);
                else
                    simulateBodyBlur();
            }
        }
        else
            needBlur = true;
        /*eslint-enable indent */

        //B254260
        needBlurIFrame = curDocument !== activeElementDocument &&
                         DOM.isElementInIframe(activeElement, activeElementDocument);
    }

    //NOTE: we always call blur for iframe manually without handlers (B254260)
    /*eslint-disable indent */
    if (needBlurIFrame && !needBlur) {
        if (Browser.isIE) {
            //NOTE: We should call blur for iframe with handlers in IE
            //but we can't call method 'blur' because activeElement !== element and handlers will not be called
            EventSimulator.blur(DOM.getIFrameByElement(activeElement));
            raiseFocusEvent();
        }
        else
            blur(DOM.getIFrameByElement(activeElement), raiseFocusEvent, true, isNativeFocus);
    }
    else if (needBlur) {
        blur(activeElement, function () {
            if (needBlurIFrame)
                blur(DOM.getIFrameByElement(activeElement), raiseFocusEvent, true, isNativeFocus);
            else
                raiseFocusEvent();
        }, silent, isNativeFocus);
    }
    else
        raiseFocusEvent();
    /*eslint-enable indent */
}

export function blur (element, callback, withoutHandlers, isNativeBlur) {
    var activeElement = DOM.getActiveElement(DOM.findDocument(element));
    //in IE if you call focus() or blur() methods from script, active element is changed immediately
    // but events are raised asynchronously after some timeout (in MSEdge focus/blur is sync)
    var isAsync = isNativeBlur && Browser.isIE && Browser.version < 12;

    if (activeElement !== element)
        withoutHandlers = true;

    if (!withoutHandlers) {
        ElementEditingWatcher.processElementChanging(element);
        ElementEditingWatcher.stopWatching(element);
    }

    raiseEvent(element, 'blur', function () {
        if (typeof callback === 'function')
            callback();
    }, withoutHandlers, isAsync);
}

export function disableOuterFocusHandlers () {
    shouldDisableOuterFocusHandlers = true;
}

export function enableOuterFocusHandlers () {
    shouldDisableOuterFocusHandlers = false;
}

export function getInternalEventFlag (type) {
    return type === 'focus' ? INTERNAL_FOCUS_FLAG : INTERNAL_BLUR_FLAG;
}

export function fixHoveredElement () {
    hoverElementFixed = true;
}

export function freeHoveredElement () {
    hoverElementFixed = false;
}
