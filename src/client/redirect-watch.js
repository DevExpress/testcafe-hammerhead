import EventEmiter from './utils/event-emitter';
import { parseProxyUrl } from '../utils/url';
import { isShadowUIElement } from './utils/dom';
import ElementSandbox from './sandbox/node/element';
import * as windowsStorage from './sandbox/windows-storage';
import domProcessor from './dom-processor/index';

const HASH_RE = /#.*$/;

export default class RedirectWatch extends EventEmiter {
    constructor (codeInstrumentation, eventSandbox) {
        super();

        this.DETECTED_EVENT = 'hammerhead|event|redirect-detected';

        this.codeInstrumentation = codeInstrumentation;
        this.eventSandbox        = eventSandbox;
    }

    init () {
        this._locationWatch(this.codeInstrumentation);
        this._linkClickWatch(this.eventSandbox);
    }

    redirect (url) {
        this.emit(this.DETECTED_EVENT, parseProxyUrl(url).destUrl);
    }

    _linkClickWatch (eventSandbox) {
        eventSandbox.listeners.addInternalEventListener(window, ['click'], e => {
            var link = e.target;

            if (link.tagName && link.tagName.toLowerCase() === 'a' && !isShadowUIElement(link)) {
                var target       = link.getAttribute(domProcessor.getStoredAttrName('target')) ||
                                   link.getAttribute('target');
                var targetWindow = window;

                if (target) {
                    if (!ElementSandbox._isKeywordTarget(target))
                        targetWindow = windowsStorage.findByName(target) || window;
                    else if (target === '_top')
                        targetWindow = window.top;
                    else if (target === '_parent')
                        targetWindow = window.parent;
                }
                try {
                    targetWindow['%hammerhead%'].redirectWatch.redirect(link.href);
                }
                    /*eslint-disable no-empty */
                catch (ex) {
                }
                /*eslint-enable no-empty */
            }
        });
    }

    _locationWatch (codeInstrumentation) {
        var locationAccessorsInstrumentation = codeInstrumentation.locationAccessorsInstrumentation;
        var propertyAccessorsInstrumentation = codeInstrumentation.propertyAccessorsInstrumentation;
        var lastLocationValue                = window.location.toString();
        var locationChangedHandler           = newLocation => {
            var currentLocation = lastLocationValue;

            lastLocationValue = window.location.toString();

            if (newLocation !== currentLocation &&
                newLocation.replace(HASH_RE, '') === currentLocation.replace(HASH_RE, ''))
                return;

            this.redirect(newLocation);
        };

        locationAccessorsInstrumentation.on(locationAccessorsInstrumentation.LOCATION_CHANGED_EVENT, locationChangedHandler);
        propertyAccessorsInstrumentation.on(propertyAccessorsInstrumentation.LOCATION_CHANGED_EVENT, locationChangedHandler);
    }
}
