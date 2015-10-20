import LocationWrapper from './wrapper';
import SandboxBase from '../../base';
import { isLocation } from '../../../utils/dom';
import INSTRUCTION from '../../../../processing/js/instruction';

const LOCATION_WRAPPER = 'hammerhead|location-wrapper';

export default class LocationAccessorsInstrumentation extends SandboxBase {
    static isLocationWrapper (obj) {
        return obj instanceof LocationWrapper;
    }

    static getLocationWrapper (owner) {
        return owner[LOCATION_WRAPPER];
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
