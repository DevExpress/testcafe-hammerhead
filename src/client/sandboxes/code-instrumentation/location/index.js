import LocationWrapper from './wrapper';
import { GET_LOCATION_METH_NAME, SET_LOCATION_METH_NAME } from '../../../../processing/js';
import { isLocation } from '../../../utils/types';

class LocationAccessorsInstrumentation {
    constructor () {
        this.LOCATION_WRAPPER = 'location_1b082a6cec';
    }

    isLocationWrapper (obj) {
        return obj instanceof LocationWrapper;
    }

    getLocationWrapper (owner) {
        return owner[this.LOCATION_WRAPPER];
    }

    initWindow (window, document) {
        var locationWrapper = new LocationWrapper(window);

        window[this.LOCATION_WRAPPER]   = locationWrapper;
        document[this.LOCATION_WRAPPER] = locationWrapper;

        window[GET_LOCATION_METH_NAME] = location => isLocation(location) ? locationWrapper : location;
        window[SET_LOCATION_METH_NAME] = (location, value) => {
            if (isLocation(location)) {
                location = value;

                return location;
            }

            return null;
        };
    }
}

export default new LocationAccessorsInstrumentation();
