import LocationAccessorsInstrumentation from '../location';
import LocationWrapper from '../location/wrapper';
import SandboxBase from '../../base';
import * as domUtils from '../../../utils/dom';
import { isNullOrUndefined, inaccessibleTypeToStr } from '../../../utils/types';
import * as urlUtils from '../../../utils/url';
import { prepareUrl } from '../../../../utils/url';
import INSTRUCTION from '../../../../processing/script/instruction';
import { shouldInstrumentProperty } from '../../../../processing/script/instrumented';
import nativeMethods from '../../native-methods';
import DomProcessor from '../../../../processing/dom';
import settings from '../../../settings';
import WindowSandbox from '../../node/window';
import noop from '../../../utils/noop';

export default class PropertyAccessorsInstrumentation extends SandboxBase {
    // NOTE: Isolate throw statements into a separate function because the
    // JS engine doesn't optimize such functions.
    private static _error (msg: string) {
        throw new Error(msg);
    }

    private static _setCrossDomainLocation (location: Location, value: any) {
        let proxyUrl = '';

        if (typeof value !== 'string')
            value = String(value);

        if (!DomProcessor.isJsProtocol(value)) {
            const resourceType = urlUtils.stringifyResourceType({ isIframe: true });

            value = prepareUrl(value);

            proxyUrl = location !== window.top.location
                ? urlUtils.getProxyUrl(value, { resourceType })
                : urlUtils.getProxyUrl(value, { proxyPort: settings.get().crossDomainProxyPort });
        }
        else
            proxyUrl = DomProcessor.processJsAttrValue(value, { isJsProtocol: true, isEventAttr: false });

        location.href = proxyUrl; // eslint-disable-line no-restricted-properties

        return value;
    }

    private static _getLocation (owner: Window | Document) {
        const locationWrapper = LocationAccessorsInstrumentation.getLocationWrapper(owner);

        if (locationWrapper)
            return locationWrapper;
        else if (!owner.location)
            return owner.location;

        const wnd = domUtils.isWindow(owner) ? owner : owner.defaultView;

        return new LocationWrapper(wnd, null, noop);
    }

    private static _setLocation (owner: Window | Document, location: Location) {
        //@ts-ignore
        const ownerWindow     = domUtils.isWindow(owner) ? owner : owner.defaultView;
        const locationWrapper = LocationAccessorsInstrumentation.getLocationWrapper(ownerWindow);

        if (!locationWrapper || locationWrapper === owner.location)
            PropertyAccessorsInstrumentation._setCrossDomainLocation(owner.location, location);
        else if (locationWrapper)
            locationWrapper.href = location; // eslint-disable-line no-restricted-properties

        return location;
    }

    private static _ACCESSORS = {
        href: {
            condition: domUtils.isLocation,

            // eslint-disable-next-line no-restricted-properties
            get: (crossDomainLocation: Location) => crossDomainLocation.href,
            set: PropertyAccessorsInstrumentation._setCrossDomainLocation,
        },

        location: {
            condition: (owner: any) => domUtils.isDocument(owner) || domUtils.isWindow(owner),
            get:       PropertyAccessorsInstrumentation._getLocation,
            set:       PropertyAccessorsInstrumentation._setLocation,
        },
    };

    private static _propertyGetter (owner: any, propName: any, optional = false) {
        if (isNullOrUndefined(owner) && !optional)
            PropertyAccessorsInstrumentation._error(`Cannot read property '${propName}' of ${inaccessibleTypeToStr(owner)}`);

        if (typeof propName === 'string' && shouldInstrumentProperty(propName)) {
            if (optional && isNullOrUndefined(owner))
                return void 0;

            else if (!WindowSandbox.isProxyObject(owner) && PropertyAccessorsInstrumentation._ACCESSORS[propName].condition(owner) && !settings.nativeAutomation)
                return PropertyAccessorsInstrumentation._ACCESSORS[propName].get(owner);
        }

        if (optional && isNullOrUndefined(owner))
            return void 0;

        return owner[propName];
    }

    private static _propertySetter (owner: any, propName: any, value: any) {
        if (isNullOrUndefined(owner))
            PropertyAccessorsInstrumentation._error(`Cannot set property '${propName}' of ${inaccessibleTypeToStr(owner)}`);

        if (typeof propName === 'string' && shouldInstrumentProperty(propName) && !settings.nativeAutomation &&
                !WindowSandbox.isProxyObject(owner) && PropertyAccessorsInstrumentation._ACCESSORS[propName].condition(owner))
            return PropertyAccessorsInstrumentation._ACCESSORS[propName].set(owner, value);

        return owner[propName] = value; // eslint-disable-line no-return-assign
    }

    attach (window: Window & typeof globalThis) {
        super.attach(window);

        // NOTE: In Google Chrome, iframes whose src contains html code raise the 'load' event twice.
        // So, we need to define code instrumentation functions as 'configurable' so that they can be redefined.
        nativeMethods.objectDefineProperties(window, {
            [INSTRUCTION.getProperty]: {
                value:        PropertyAccessorsInstrumentation._propertyGetter,
                configurable: true,
            },
            [INSTRUCTION.setProperty]: {
                value:        PropertyAccessorsInstrumentation._propertySetter,
                configurable: true,
            },
        });
    }
}
