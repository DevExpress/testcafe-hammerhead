import EventEmiter from './utils/event-emitter';
import { parseProxyUrl } from '../utils/url';
import { isChangedOnlyHash } from './utils/url';
import { isShadowUIElement, isAnchorElement, isFormElement } from './utils/dom';
import ElementSandbox from './sandbox/node/element';
import * as windowsStorage from './sandbox/windows-storage';
import domProcessor from './dom-processor/index';
import nativeMethods from './sandbox/native-methods';


export default class PageNavigationWatch extends EventEmiter {
    constructor (listeners, codeInstrumentation, elementSandbox) {
        super();

        this.PAGE_NAVIGATION_TRIGGERED_EVENT = 'hammerhead|event|page-navigation-triggered';

        this.lastLocationValue = window.location.toString();

        this._locationWatch(codeInstrumentation);
        this._linkWatch(listeners);
        this._formWatch(elementSandbox, listeners);
    }

    _formWatch (elementSandbox, listeners) {
        var onFormSubmit = form => {
            var targetWindow = PageNavigationWatch._getTargetWindow(form);

            PageNavigationWatch._onNavigationTriggeredInWindow(targetWindow, form.action);
        };

        // NOTE: this raises when form.submit() was called
        elementSandbox.on(elementSandbox.BEFORE_FORM_SUBMIT, e => onFormSubmit(e.form));

        // NOTE: this raises when form submitting was triggered by a submit button click
        listeners.initElementListening(window, ['submit']);
        listeners.addInternalEventListener(window, ['submit'], e => isFormElement(e.target) && onFormSubmit(e.target));
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

    _linkWatch (listeners) {
        listeners.initElementListening(window, ['click']);
        listeners.addInternalEventListener(window, ['click'], e => {
            var link = e.target;

            if (isAnchorElement(link) && !isShadowUIElement(link)) {
                var targetWindow = PageNavigationWatch._getTargetWindow(link);

                PageNavigationWatch._onNavigationTriggeredInWindow(targetWindow, link.href);
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
