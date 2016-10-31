import EventEmiter from './utils/event-emitter';
import { parseProxyUrl } from '../utils/url';
import { isChangedOnlyHash } from './utils/url';
import { isShadowUIElement, isAnchorElement, isFormElement, closest } from './utils/dom';
import * as windowsStorage from './sandbox/windows-storage';
import domProcessor from './dom-processor/index';
import nextTick from './utils/next-tick';
import nativeMethods from './sandbox/native-methods';

export default class PageNavigationWatch extends EventEmiter {
    constructor (eventSandbox, codeInstrumentation, elementSandbox) {
        super();

        this.PAGE_NAVIGATION_TRIGGERED_EVENT = 'hammerhead|event|page-navigation-triggered';

        this.lastLocationValue = window.location.toString();

        this._locationWatch(codeInstrumentation);
        this._linkWatch(eventSandbox);
        this._formWatch(elementSandbox, eventSandbox);
    }

    _formWatch (elementSandbox, eventSandbox) {
        var onFormSubmit = form => {
            var targetWindow = PageNavigationWatch._getTargetWindow(form);

            PageNavigationWatch._onNavigationTriggeredInWindow(targetWindow, form.action);
        };

        // NOTE: fires when form.submit() is called
        elementSandbox.on(elementSandbox.BEFORE_FORM_SUBMIT, e => onFormSubmit(e.form));

        // NOTE: fires when the form is submitted by clicking the submit button
        eventSandbox.listeners.initElementListening(window, ['submit']);
        eventSandbox.listeners.addInternalEventListener(window, ['submit'], e => {
            var prevented = false;

            if (!isFormElement(e.target))
                return;

            var onPreventDefault = preventedEvent => {
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

    static _getTargetWindow (el) {
        var target = nativeMethods.getAttribute.call(el, domProcessor.getStoredAttrName('target')) ||
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

    _linkWatch (eventSandbox) {
        eventSandbox.listeners.initElementListening(window, ['click']);
        eventSandbox.listeners.addInternalEventListener(window, ['click'], e => {
            var link = isAnchorElement(e.target) ? e.target : closest(e.target, 'a');

            if (link && !isShadowUIElement(link)) {
                var prevented    = false;
                var targetWindow = PageNavigationWatch._getTargetWindow(link);
                var href         = link.href;

                var onPreventDefault = preventedEvent => {
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

    _locationWatch (codeInstrumentation) {
        var locationAccessorsInstrumentation = codeInstrumentation.locationAccessorsInstrumentation;
        var propertyAccessorsInstrumentation = codeInstrumentation.propertyAccessorsInstrumentation;

        var locationChangedHandler = newLocation => this.onNavigationTriggered(newLocation);

        locationAccessorsInstrumentation.on(locationAccessorsInstrumentation.LOCATION_CHANGED_EVENT, locationChangedHandler);
        propertyAccessorsInstrumentation.on(propertyAccessorsInstrumentation.LOCATION_CHANGED_EVENT, locationChangedHandler);
    }

    static _onNavigationTriggeredInWindow (win, url) {
        /*eslint-disable no-empty */
        try {
            win['%hammerhead%'].pageNavigationWatch.onNavigationTriggered(url);
        }
        catch (e) {
        }
        /*eslint-enable no-empty */
    }

    onNavigationTriggered (url) {
        var currentLocation = this.lastLocationValue;

        this.lastLocationValue = window.location.toString();

        if (url !== currentLocation && isChangedOnlyHash(currentLocation, url))
            return;

        this.emit(this.PAGE_NAVIGATION_TRIGGERED_EVENT, parseProxyUrl(url).destUrl);
    }
}
