import EventEmiter from './utils/event-emitter';
import { parseProxyUrl } from '../utils/url';

const HASH_RE = /#.*$/;

export default class RedirectWatch extends EventEmiter {
    constructor (codeInstrumentation) {
        super();

        this.DETECTED_EVENT = 'hammerhead|event|redirect-detected';

        var locationAccessorsInstrumentation = codeInstrumentation.locationAccessorsInstrumentation;
        var propertyAccessorsInstrumentation = codeInstrumentation.propertyAccessorsInstrumentation;
        var lastLocationValue                = window.location.toString();
        var locationChangedHandler           = newLocation => {
            var currentLocation = lastLocationValue;

            lastLocationValue = window.location.toString();

            if (newLocation !== currentLocation &&
                newLocation.replace(HASH_RE, '') === currentLocation.replace(HASH_RE, ''))
                return;

            this.emit(this.DETECTED_EVENT, parseProxyUrl(newLocation).destUrl);
        };

        locationAccessorsInstrumentation.on(locationAccessorsInstrumentation.LOCATION_CHANGED_EVENT, locationChangedHandler);
        propertyAccessorsInstrumentation.on(propertyAccessorsInstrumentation.LOCATION_CHANGED_EVENT, locationChangedHandler);
    }
}
