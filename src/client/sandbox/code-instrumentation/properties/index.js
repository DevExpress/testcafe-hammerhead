import INTERNAL_PROPS from '../../../../processing/dom/internal-properties';
import LocationAccessorsInstrumentation from '../location';
import LocationWrapper from '../location/wrapper';
import SandboxBase from '../../base';
import * as destLocation from '../../../utils/destination-location';
import * as domUtils from '../../../utils/dom';
import * as typeUtils from '../../../utils/types';
import * as urlUtils from '../../../utils/url';
import { prepareUrl } from '../../../../utils/url';
import INSTRUCTION from '../../../../processing/script/instruction';
import { shouldInstrumentProperty } from '../../../../processing/script/instrumented';
import nativeMethods from '../../native-methods';
import { isJsProtocol, processJsAttrValue } from '../../../../processing/dom';

export default class PropertyAccessorsInstrumentation extends SandboxBase {
    constructor (elementSandbox) {
        super();

        this.elementSandbox = elementSandbox;
    }

    // NOTE: Isolate throw statements into a separate function because the
    // JS engine doesn't optimize such functions.
    static _error (msg) {
        throw new Error(msg);
    }

    _createPropertyAccessors (window, document) {
        return {
            href: {
                condition: LocationAccessorsInstrumentation.isLocationWrapper,

                // eslint-disable-next-line no-restricted-properties
                get: locationWrapper => locationWrapper.href,

                set: (locationWrapper, value) => {
                    // eslint-disable-next-line no-restricted-properties
                    locationWrapper.href = destLocation.resolveUrl(value, document);

                    return value;
                }
            },

            location: {
                condition: owner => domUtils.isDocument(owner) || domUtils.isWindow(owner),

                get: owner => {
                    const locationWrapper = LocationAccessorsInstrumentation.getLocationWrapper(owner);

                    if (locationWrapper)
                        return locationWrapper;

                    const wnd = domUtils.isWindow(owner) ? owner : owner.defaultView;

                    return new LocationWrapper(wnd);
                },

                set: (owner, location) => {
                    const ownerWindow     = domUtils.isWindow(owner) ? owner : owner.defaultView;
                    const locationWrapper = LocationAccessorsInstrumentation.getLocationWrapper(ownerWindow);

                    if (!locationWrapper) {
                        if (typeof location !== 'string')
                            location = String(location);

                        if (!isJsProtocol(location)) {
                            const url          = prepareUrl(location);
                            const resourceType = urlUtils.stringifyResourceType({ isIframe: true });

                            owner.location = destLocation.sameOriginCheck(location.toString(), url)
                                ? urlUtils.getProxyUrl(url, { resourceType })
                                : urlUtils.getCrossDomainIframeProxyUrl(url);
                        }
                        else
                            owner.location = processJsAttrValue(location, { isJsProtocol: true, isEventAttr: false });
                    }
                    else
                        // eslint-disable-next-line no-restricted-properties
                        locationWrapper.href = location;

                    return location;
                }
            }
        };
    }

    static _getSetPropertyInstructionByOwner (owner, window) {
        try {
            return owner && owner[INTERNAL_PROPS.processedContext] &&
                   owner[INTERNAL_PROPS.processedContext] !== window &&
                   owner[INTERNAL_PROPS.processedContext][INSTRUCTION.setProperty];
        }
        catch (e) {
            return null;
        }
    }

    attach (window) {
        super.attach(window);

        const accessors = this._createPropertyAccessors(window, window.document);

        // NOTE: In Google Chrome, iframes whose src contains html code raise the 'load' event twice.
        // So, we need to define code instrumentation functions as 'configurable' so that they can be redefined.
        nativeMethods.objectDefineProperty.call(window.Object, window, INSTRUCTION.getProperty, {
            value: (owner, propName) => {
                if (typeUtils.isNullOrUndefined(owner))
                    PropertyAccessorsInstrumentation._error(`Cannot read property '${propName}' of ${typeUtils.inaccessibleTypeToStr(owner)}`);

                if (typeof propName === 'string' && shouldInstrumentProperty(propName) &&
                    accessors[propName].condition(owner))
                    return accessors[propName].get(owner);

                const propertyValue = owner[propName];

                if (propertyValue && domUtils.isShadowUIElement(propertyValue))
                    return void 0;

                return propertyValue;
            },

            configurable: true
        });

        nativeMethods.objectDefineProperty.call(window.Object, window, INSTRUCTION.setProperty, {
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
