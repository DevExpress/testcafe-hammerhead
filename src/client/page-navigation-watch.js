import EventEmiter from './utils/event-emitter';
import { parseProxyUrl } from '../utils/url';
import { isChangedOnlyHash } from './utils/url';
import { isShadowUIElement, isAnchorElement, isFormElement, closest } from './utils/dom';
import * as windowsStorage from './sandbox/windows-storage';
import DomProcessor from '../processing/dom';
import nextTick from './utils/next-tick';
import nativeMethods from './sandbox/native-methods';
import INTERNAL_PROPS from '../processing/dom/internal-properties';
export default class PageNavigationWatch extends EventEmiter {
    constructor(eventSandbox, codeInstrumentation, elementSandbox) {
        super();
        this.PAGE_NAVIGATION_TRIGGERED_EVENT = 'hammerhead|event|page-navigation-triggered';
        this.PAGE_NAVIGATION_TRIGGERED_EVENT = 'hammerhead|event|page-navigation-triggered';
        this.lastLocationValue = window.location.toString();
        this.codeInstrumentation = codeInstrumentation;
        this.eventSandbox = eventSandbox;
        this.elementSandbox = elementSandbox;
    }
    _formWatch(elementSandbox, eventSandbox) {
        const onFormSubmit = form => {
            const targetWindow = PageNavigationWatch._getTargetWindow(form);
            PageNavigationWatch._onNavigationTriggeredInWindow(targetWindow, nativeMethods.formActionGetter.call(form));
        };
        // NOTE: fires when form.submit() is called
        elementSandbox.on(elementSandbox.BEFORE_FORM_SUBMIT_EVENT, e => onFormSubmit(e.form));
        // NOTE: fires when the form is submitted by clicking the submit button
        eventSandbox.listeners.initElementListening(window, ['submit']);
        eventSandbox.listeners.addInternalEventListener(window, ['submit'], e => {
            let prevented = false;
            if (!isFormElement(e.target))
                return;
            const onPreventDefault = preventedEvent => {
                prevented = prevented || preventedEvent === e;
            };
            eventSandbox.on(eventSandbox.EVENT_PREVENTED_EVENT, onPreventDefault);
            nextTick()
                .then(() => {
                eventSandbox.off(eventSandbox.EVENT_PREVENTED_EVENT, onPreventDefault);
                // NOTE: the defaultPrevented flag is saved between event raises in all browsers
                // except IE. In IE, it is reset to false before the next handler is executed.
                if (!e.defaultPrevented && !prevented)
                    onFormSubmit(e.target);
            });
        });
    }
    static _getTargetWindow(el) {
        const target = nativeMethods.getAttribute.call(el, DomProcessor.getStoredAttrName('target')) ||
            nativeMethods.getAttribute.call(el, 'target') ||
            '_self';
        switch (target) {
            case '_top':
                return window.top;
            case '_parent':
                return window.parent;
            case '_self':
                return window;
            default:
                return windowsStorage.findByName(target);
        }
    }
    _linkWatch(eventSandbox) {
        eventSandbox.listeners.initElementListening(window, ['click']);
        eventSandbox.listeners.addInternalEventListener(window, ['click'], e => {
            const link = isAnchorElement(e.target) ? e.target : closest(e.target, 'a');
            if (link && !isShadowUIElement(link)) {
                let prevented = false;
                const targetWindow = PageNavigationWatch._getTargetWindow(link);
                const href = nativeMethods.anchorHrefGetter.call(link);
                const onPreventDefault = preventedEvent => {
                    prevented = prevented || preventedEvent === e;
                };
                eventSandbox.on(eventSandbox.EVENT_PREVENTED_EVENT, onPreventDefault);
                nextTick()
                    .then(() => {
                    eventSandbox.off(eventSandbox.EVENT_PREVENTED_EVENT, onPreventDefault);
                    // NOTE: the defaultPrevented flag is saved between event raises in all browsers
                    // except IE. In IE, it is reset to false before the next handler is executed.
                    if (!e.defaultPrevented && !prevented)
                        PageNavigationWatch._onNavigationTriggeredInWindow(targetWindow, href);
                });
            }
        });
    }
    _locationWatch(codeInstrumentation) {
        const locationAccessorsInstrumentation = codeInstrumentation.locationAccessorsInstrumentation;
        const locationChangedHandler = newLocation => this.onNavigationTriggered(newLocation);
        locationAccessorsInstrumentation.on(locationAccessorsInstrumentation.LOCATION_CHANGED_EVENT, locationChangedHandler);
    }
    static _onNavigationTriggeredInWindow(win, url) {
        try {
            win[INTERNAL_PROPS.hammerhead].pageNavigationWatch.onNavigationTriggered(url);
        }
        // eslint-disable-next-line no-empty
        catch (e) {
        }
    }
    onNavigationTriggered(url) {
        const currentLocation = this.lastLocationValue;
        this.lastLocationValue = window.location.toString();
        if (url !== currentLocation && (url.charAt(0) === '#' || isChangedOnlyHash(currentLocation, url)) ||
            DomProcessor.isJsProtocol(url))
            return;
        this.emit(this.PAGE_NAVIGATION_TRIGGERED_EVENT, parseProxyUrl(url).destUrl);
    }
    start() {
        this._locationWatch(this.codeInstrumentation);
        this._linkWatch(this.eventSandbox);
        this._formWatch(this.elementSandbox, this.eventSandbox);
    }
}
