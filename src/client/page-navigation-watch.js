import Promise from 'pinkie';
import EventEmiter from './utils/event-emitter';
import { parseProxyUrl } from '../utils/url';
import { isChangedOnlyHash } from './utils/url';
import { isShadowUIElement, isAnchorElement, isFormElement, closest } from './utils/dom';
import ElementSandbox from './sandbox/node/element';
import * as windowsStorage from './sandbox/windows-storage';
import domProcessor from './dom-processor/index';
import nativeMethods from './sandbox/native-methods';


var nextTick = () => new Promise(resolve => nativeMethods.setTimeout.call(window, resolve, 0));

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

        // NOTE: this raises when form.submit() was called
        elementSandbox.on(elementSandbox.BEFORE_FORM_SUBMIT, e => onFormSubmit(e.form));

        // NOTE: this raises when form submitting was triggered by a submit button click
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

                    // NOTE: the event keep the defaultPrevented flag between event handlers in all
                    // browsers except IE. In IE it is reset to false before the next handler execution.
                    if (!e.defaultPrevented && !prevented)
                        onFormSubmit(e.target);
                });
        });
    }

    static _getTargetWindow (el) {
        var targetWindow = window;
        var target       = nativeMethods.getAttribute.call(el, domProcessor.getStoredAttrName('target')) ||
                           nativeMethods.getAttribute.call(el, 'target');

        if (target) {
            if (!ElementSandbox._isKeywordTarget(target))
                targetWindow = windowsStorage.findByName(target) || window;
            else if (target === '_top' || target === '_blank')
                targetWindow = window.top;
            else if (target === '_parent')
                targetWindow = window.parent;
        }

        return targetWindow;
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

                        // NOTE: the event keep the defaultPrevented flag between event handlers in all
                        // browsers except IE. In IE it is reset to false before the next handler execution.
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
        try {
            win['%hammerhead%'].pageNavigationWatch.onNavigationTriggered(url);
        }
            /*eslint-disable no-empty */
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
