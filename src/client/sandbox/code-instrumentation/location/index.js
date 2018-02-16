import LocationWrapper from './wrapper';
import SandboxBase from '../../base';
import { isLocation } from '../../../utils/dom';
import INSTRUCTION from '../../../../processing/script/instruction';
import nativeMethods from '../../native-methods';

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

        const locationWrapper = new LocationWrapper(window);

        locationWrapper.on(locationWrapper.CHANGED_EVENT, e => this.emit(this.LOCATION_CHANGED_EVENT, e));

        // NOTE: In Google Chrome, iframes whose src contains html code raise the 'load' event twice.
        // So, we need to define code instrumentation functions as 'configurable' so that they can be redefined.
        nativeMethods.objectDefineProperty.call(window.Object, window, LOCATION_WRAPPER, {
            value:        locationWrapper,
            configurable: true
        });
        nativeMethods.objectDefineProperty.call(window.Object, window.document, LOCATION_WRAPPER, {
            value:        locationWrapper,
            configurable: true
        });
        nativeMethods.objectDefineProperty.call(window.Object, window, INSTRUCTION.getLocation, {
            value:        location => isLocation(location) ? locationWrapper : location,
            configurable: true
        });
        nativeMethods.objectDefineProperty.call(window.Object, window, INSTRUCTION.setLocation, {
            value: (location, value) => {
                if (isLocation(location) && typeof value === 'string') {
                    /*eslint-disable no-restricted-properties*/
                    locationWrapper.href = value;
                    /*eslint-enable no-restricted-properties*/

                    return value;
                }

                return null;
            },

            configurable: true
        });
    }
}
