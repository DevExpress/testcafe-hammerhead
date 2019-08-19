import INTERNAL_PROPS from '../../../../processing/dom/internal-properties';
import LocationAccessorsInstrumentation from '../location';
import LocationWrapper from '../location/wrapper';
import SandboxBase from '../../base';
import * as domUtils from '../../../utils/dom';
import * as typeUtils from '../../../utils/types';
import * as urlUtils from '../../../utils/url';
import { prepareUrl } from '../../../../utils/url';
import INSTRUCTION from '../../../../processing/script/instruction';
import { shouldInstrumentProperty } from '../../../../processing/script/instrumented';
import nativeMethods from '../../native-methods';
import DomProcessor from '../../../../processing/dom';
import settings from '../../../settings';
import { isIE } from '../../../utils/browser';
/*eslint-disable no-unused-vars*/
import WindowSandbox from '../../node/window';
/*eslint-enable no-unused-vars*/

export default class PropertyAccessorsInstrumentation extends SandboxBase {
    constructor (private readonly _windowSandbox: WindowSandbox) { // eslint-disable-line no-unused-vars
        super();
    }

    // NOTE: Isolate throw statements into a separate function because the
    // JS engine doesn't optimize such functions.
    static _error (msg: string) {
        throw new Error(msg);
    }

    static _safeIsShadowUIElement (el: any) {
        try {
            return domUtils.isShadowUIElement(el);
        }
        catch (e) {
            return false;
        }
    }

    static _setCrossDomainLocation (location: Location, value: any) {
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

    _createPropertyAccessors () {
        return {
            href: {
                condition: domUtils.isLocation,

                // eslint-disable-next-line no-restricted-properties
                get: (crossDomainLocation: Location) => crossDomainLocation.href,

                set: PropertyAccessorsInstrumentation._setCrossDomainLocation
            },

            location: {
                condition: (owner: any) => domUtils.isDocument(owner) || domUtils.isWindow(owner),

                get: (owner: Window | Document) => {
                    const locationWrapper = LocationAccessorsInstrumentation.getLocationWrapper(owner);

                    if (locationWrapper)
                        return locationWrapper;

                    //@ts-ignore
                    const wnd = domUtils.isWindow(owner) ? owner : owner.defaultView;

                    return new LocationWrapper(wnd);
                },

                set: (owner: Window | Document, location: Location) => {
                    //@ts-ignore
                    const ownerWindow     = domUtils.isWindow(owner) ? owner : owner.defaultView;
                    const locationWrapper = LocationAccessorsInstrumentation.getLocationWrapper(ownerWindow);

                    if (!locationWrapper || locationWrapper === owner.location ||
                        isIE && domUtils.isCrossDomainWindows(window, ownerWindow))
                        PropertyAccessorsInstrumentation._setCrossDomainLocation(owner.location, location);
                    else if (locationWrapper)
                        locationWrapper.href = location; // eslint-disable-line no-restricted-properties

                    return location;
                }
            }
        };
    }

    static _getSetPropertyInstructionByOwner (owner, window: Window) {
        try {
            return owner && owner[INTERNAL_PROPS.processedContext] &&
                   owner[INTERNAL_PROPS.processedContext] !== window &&
                   owner[INTERNAL_PROPS.processedContext][INSTRUCTION.setProperty];
        }
        catch (e) {
            return null;
        }
    }

    attach (window: Window) {
        super.attach(window);

        const accessors     = this._createPropertyAccessors();
        const windowSandbox = this._windowSandbox;

        // NOTE: The browser's 'document' and 'window' can be overridden (for instance, after a 'document.write' call).
        // So, we need to define all internal properties stored in the 'window' or 'document' with the 'configurable' option to be able to redefine them.
        nativeMethods.objectDefineProperty(window, INSTRUCTION.getProperty, {
            value: (owner, propName) => {
                if (typeUtils.isNullOrUndefined(owner))
                    PropertyAccessorsInstrumentation._error(`Cannot read property '${propName}' of ${typeUtils.inaccessibleTypeToStr(owner)}`);

                if (typeof propName === 'string' && shouldInstrumentProperty(propName) &&
                    accessors[propName].condition(owner))
                    return accessors[propName].get(owner);

                const propertyValue = owner[propName];

                windowSandbox.isInternalGetter = true;

                if (propertyValue && PropertyAccessorsInstrumentation._safeIsShadowUIElement(propertyValue))
                    return void 0;

                windowSandbox.isInternalGetter = false;

                return propertyValue;
            },

            configurable: true
        });

        nativeMethods.objectDefineProperty(window, INSTRUCTION.setProperty, {
            value: (owner, propName, value) => {
                if (typeUtils.isNullOrUndefined(owner))
                    PropertyAccessorsInstrumentation._error(`Cannot set property '${propName}' of ${typeUtils.inaccessibleTypeToStr(owner)}`);

                const ownerSetPropertyInstruction = PropertyAccessorsInstrumentation._getSetPropertyInstructionByOwner(owner, window);

                if (ownerSetPropertyInstruction)
                    return ownerSetPropertyInstruction(owner, propName, value);

                if (typeof propName === 'string' && shouldInstrumentProperty(propName) &&
                    accessors[propName].condition(owner))
                    return accessors[propName].set(owner, value);

                // eslint-disable-next-line no-return-assign
                return owner[propName] = value;
            },

            configurable: true
        });

        return accessors;
    }
}
