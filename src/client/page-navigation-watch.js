import EventEmiter from './utils/event-emitter';
import { parseProxyUrl } from '../utils/url';
import { isShadowUIElement } from './utils/dom';
import ElementSandbox from './sandbox/node/element';
import * as windowsStorage from './sandbox/windows-storage';
import domProcessor from './dom-processor/index';

const HASH_RE = /#.*$/;

export default class PageNavigationWatch extends EventEmiter {
    constructor (codeInstrumentation, eventSandbox) {
        super();

        this.PAGE_NAVIGATION_TRIGGERED_EVENT = 'hammerhead|event|page-navigation-triggered';

        this.codeInstrumentation = codeInstrumentation;
        this.eventSandbox        = eventSandbox;
    }

    init () {
        this._locationWatch();
        this._linkClickWatch();
    }

    onNavigationTriggered (url) {
        this.emit(this.PAGE_NAVIGATION_TRIGGERED_EVENT, parseProxyUrl(url).destUrl);
    }

    _linkClickWatch () {
        this.eventSandbox.listeners.addInternalEventListener(window, ['click'], e => {
            var link = e.target;

            if (link.tagName && link.tagName.toLowerCase() === 'a' && !isShadowUIElement(link)) {
                var target = link.getAttribute(domProcessor.getStoredAttrName('target')) ||
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
                    targetWindow['%hammerhead%'].pageNavigationWatch.onNavigationTriggered(link.href);
                }
                    /*eslint-disable no-empty */
                catch (ex) {
                }
                /*eslint-enable no-empty */
            }
        });
    }

    _locationWatch () {
        var locationAccessorsInstrumentation = this.codeInstrumentation.locationAccessorsInstrumentation;
        var propertyAccessorsInstrumentation = this.codeInstrumentation.propertyAccessorsInstrumentation;
        var lastLocationValue                = window.location.toString();
        var locationChangedHandler           = newLocation => {
            var currentLocation = lastLocationValue;

            lastLocationValue = window.location.toString();

            if (newLocation !== currentLocation &&
                newLocation.replace(HASH_RE, '') === currentLocation.replace(HASH_RE, ''))
                return;

            this.onNavigationTriggered(newLocation);
        };

        locationAccessorsInstrumentation.on(locationAccessorsInstrumentation.LOCATION_CHANGED_EVENT, locationChangedHandler);
        propertyAccessorsInstrumentation.on(propertyAccessorsInstrumentation.LOCATION_CHANGED_EVENT, locationChangedHandler);
    }
}
