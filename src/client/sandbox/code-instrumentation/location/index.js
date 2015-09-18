import LocationWrapper from './wrapper';
import SandboxBase from '../../base';
import { isLocation } from '../../../utils/types';
import { GET_LOCATION_METH_NAME, SET_LOCATION_METH_NAME } from '../../../../processing/js';

const LOCATION_WRAPPER = 'location_1b082a6cec';

export default class LocationAccessorsInstrumentation extends SandboxBase {
    constructor (sandbox) {
        super(sandbox);
    }

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
