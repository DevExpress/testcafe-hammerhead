import LocationWrapper from './wrapper';
import SandboxBase from '../../base';
import { isLocation } from '../../../utils/dom';
import INSTRUCTION from '../../../../processing/script/instruction';
import nativeMethods from '../../native-methods';
import MessageSandbox from '../../event/message';

const LOCATION_WRAPPER = 'hammerhead|location-wrapper';

export default class LocationAccessorsInstrumentation extends SandboxBase {
    LOCATION_CHANGED_EVENT = 'hammerhead|event|location-changed';

    _locationChangedEventCallback: any;

    constructor (private readonly _messageSandbox: MessageSandbox) {
        super();

        this._locationChangedEventCallback = (e: string) => this.emit(this.LOCATION_CHANGED_EVENT, e);
    }

    static isLocationWrapper (obj: any) {
        return obj instanceof LocationWrapper;
    }

    static getLocationWrapper (owner: any) {
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

    attach (window: Window & typeof globalThis) {
        super.attach(window);

        const document        = window.document;
        const locationWrapper = new LocationWrapper(window, this._messageSandbox, this._locationChangedEventCallback);

        // NOTE: In Google Chrome, iframes whose src contains html code raise the 'load' event twice.
        // So, we need to define code instrumentation functions as 'configurable' so that they can be redefined.
        nativeMethods.objectDefineProperty(window, LOCATION_WRAPPER, { value: locationWrapper, configurable: true });
        nativeMethods.objectDefineProperty(document, LOCATION_WRAPPER, { value: locationWrapper, configurable: true });
        nativeMethods.objectDefineProperty(window, INSTRUCTION.getLocation, {
            value:        (location: any) => isLocation(location) ? locationWrapper : location,
            configurable: true,
        });
        nativeMethods.objectDefineProperty(window, INSTRUCTION.setLocation, {
            value: (location: any, value: any) => {
                if (isLocation(location) && typeof value === 'string') {
                    // @ts-ignore
                    locationWrapper.href = value;// eslint-disable-line no-restricted-properties

                    return value;
                }

                return null;
            },

            configurable: true,
        });
    }
}
