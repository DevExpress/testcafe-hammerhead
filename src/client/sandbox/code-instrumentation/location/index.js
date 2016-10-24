import LocationWrapper from './wrapper';
import SandboxBase from '../../base';
import { isLocation } from '../../../utils/dom';
import INSTRUCTION from '../../../../processing/script/instruction';


const LOCATION_WRAPPER = 'hammerhead|location-wrapper';

export default class LocationAccessorsInstrumentation extends SandboxBase {
    constructor () {
        super();

        this.LOCATION_CHANGED_EVENT = 'hammerhead|event|location-changed';
    }

    static isLocationWrapper (obj) {
        return obj instanceof LocationWrapper;
    }

    static getLocationWrapper (owner) {
        // NOTE: When the owner is cross-domain, we cannot get its location wrapper, so we return the original
        // location, which cannot be accessed but behaves like a real one. Cross-domain location retains the 'replace'
        // and 'assign' methods, so we intercept calls to them through MethodCallInstrumentation.
        try {
            return owner[LOCATION_WRAPPER];
        }
        catch (e) {
            return owner.location;
        }
    }

    attach (window) {
        super.attach(window);

        var locationWrapper = new LocationWrapper(window);

        locationWrapper.on(locationWrapper.CHANGED_EVENT, e => this.emit(this.LOCATION_CHANGED_EVENT, e));

        // NOTE: In Google Chrome, iframes whose src contains html code raise the 'load' event twice.
        // So, we need to define code instrumentation functions as 'configurable' so that they can be redefined.
        Object.defineProperty(window, LOCATION_WRAPPER, {
            value:        locationWrapper,
            configurable: true
        });
        Object.defineProperty(window.document, LOCATION_WRAPPER, {
            value:        locationWrapper,
            configurable: true
        });
        Object.defineProperty(window, INSTRUCTION.getLocation, {
            value:        location => isLocation(location) ? locationWrapper : location,
            configurable: true
        });
        Object.defineProperty(window, INSTRUCTION.setLocation, {
            value: (location, value) => {
                if (isLocation(location) && typeof value === 'string') {
                    locationWrapper.href = value;

                    return value;
                }

                return null;
            },

            configurable: true
        });
    }
}
