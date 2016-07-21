import EventEmiter from './utils/event-emitter';
import { parseProxyUrl } from '../utils/url';
import { isShadowUIElement, isAnchorElement } from './utils/dom';
import ElementSandbox from './sandbox/node/element';
import * as windowsStorage from './sandbox/windows-storage';
import domProcessor from './dom-processor/index';
import nativeMethods from './sandbox/native-methods';

const HASH_RE = /#.*$/;

export default class RedirectWatch extends EventEmiter {
    constructor (listeners, codeInstrumentation, elementSandbox) {
        super();

        this.REDIRECT_DETECTED_EVENT = 'hammerhead|event|redirect-detected';

        this.lastLocationValue = window.location.toString();

        this._locationWatch(codeInstrumentation);
        this._linkWatch(listeners);
        this._formWatch(elementSandbox);
    }

    _formWatch (elementSandbox) {
        elementSandbox.on(elementSandbox.BEFORE_FORM_SUBMIT, e => {
            var targetWindow = this._getTargetWindow(e.form);

            this._redirectWindow(targetWindow, e.form.action);
        });
    }

    _redirectWindow (window, url) {
        try {
            window['%hammerhead%'].redirectWatch.redirect(url);
        }
            /*eslint-disable no-empty */
        catch (e) {
        }
        /*eslint-enable no-empty */
    }

    _getTargetWindow (el) {
        var targetWindow = window;
        var target       = nativeMethods.getAttribute.call(el, domProcessor.getStoredAttrName('target')) ||
                           nativeMethods.getAttribute.call(el, 'target');

        if (target) {
            if (!ElementSandbox._isKeywordTarget(target))
                targetWindow = windowsStorage.findByName(target) || window;
            else if (target === '_top')
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
                var targetWindow = this._getTargetWindow(link);

                this._redirectWindow(targetWindow, link.href);
            }
        });
    }

    _locationWatch (codeInstrumentation) {
        var locationAccessorsInstrumentation = codeInstrumentation.locationAccessorsInstrumentation;
        var propertyAccessorsInstrumentation = codeInstrumentation.propertyAccessorsInstrumentation;

        var locationChangedHandler = newLocation => this.redirect(newLocation);

        locationAccessorsInstrumentation.on(locationAccessorsInstrumentation.LOCATION_CHANGED_EVENT, locationChangedHandler);
        propertyAccessorsInstrumentation.on(propertyAccessorsInstrumentation.LOCATION_CHANGED_EVENT, locationChangedHandler);
    }

    redirect (url) {
        var currentLocation = this.lastLocationValue;

        this.lastLocationValue = window.location.toString();

        if (url !== currentLocation && url.replace(HASH_RE, '') === currentLocation.replace(HASH_RE, ''))
            return;

        this.emit(this.REDIRECT_DETECTED_EVENT, parseProxyUrl(url).destUrl);
    }
}
