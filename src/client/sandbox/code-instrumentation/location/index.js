import LocationWrapper from './wrapper';
import SandboxBase from '../../base';
import { isLocation } from '../../../utils/dom';
import INSTRUCTION from '../../../../processing/script/instruction';

const LOCATION_WRAPPER = 'hammerhead|location-wrapper';

export default class LocationAccessorsInstrumentation extends SandboxBase {
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

        window[LOCATION_WRAPPER]          = locationWrapper;
        window.document[LOCATION_WRAPPER] = locationWrapper;

        window[INSTRUCTION.getLocation] = location => isLocation(location) ? locationWrapper : location;

        window[INSTRUCTION.setLocation] = (location, value) => {
            if (isLocation(location)) {
                location = value;

                return location;
            }

            return null;
        };
    }
}
