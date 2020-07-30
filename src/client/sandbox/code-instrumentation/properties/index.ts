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
import nativeMethods from '../../native-methods-adapter';
import DomProcessor from '../../../../processing/dom';
import domProcessor from '../../../dom-processor';
import settings from '../../../settings';
import { isIE } from '../../../utils/browser';
import WindowSandbox from '../../node/window';
import ShadowUISandbox from '../../shadow-ui';

export default class PropertyAccessorsInstrumentation extends SandboxBase {
    // NOTE: Isolate throw statements into a separate function because the
    // JS engine doesn't optimize such functions.
    private static _error (msg: string) {
        throw new Error(msg);
    }

    private static _safeIsShadowUIElement<T extends any> (owner: T, propName: keyof T): boolean {
        const el = owner[propName];

        if (!el || !ShadowUISandbox.isShadowContainerCollection(owner))
            return false;

        try {
            return !WindowSandbox.isProxyObject(el) && domUtils.isShadowUIElement(el);
        }
        catch (e) {
            return false;
        }
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
            proxyUrl = domProcessor.processJsAttrValue(value, { isJsProtocol: true, isEventAttr: false });

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
                    else if (!owner.location)
                        return owner.location;

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

        const accessors = this._createPropertyAccessors();

        // NOTE: In Google Chrome, iframes whose src contains html code raise the 'load' event twice.
        // So, we need to define code instrumentation functions as 'configurable' so that they can be redefined.
        nativeMethods.objectDefineProperty(window, INSTRUCTION.getProperty, {
            value: (owner, propName) => {
                if (typeUtils.isNullOrUndefined(owner))
                    PropertyAccessorsInstrumentation._error(`Cannot read property '${propName}' of ${typeUtils.inaccessibleTypeToStr(owner)}`);

                if (WindowSandbox.isProxyObject(owner))
                    return owner[propName];

                if (typeof propName === 'string' && shouldInstrumentProperty(propName) &&
                    accessors[propName].condition(owner))
                    return accessors[propName].get(owner);

                if (PropertyAccessorsInstrumentation._safeIsShadowUIElement(owner, propName))
                    return void 0;

                return owner[propName];
            },

            configurable: true
        });

        nativeMethods.objectDefineProperty(window, INSTRUCTION.setProperty, {
            value: (owner, propName, value) => {
                if (typeUtils.isNullOrUndefined(owner))
                    PropertyAccessorsInstrumentation._error(`Cannot set property '${propName}' of ${typeUtils.inaccessibleTypeToStr(owner)}`);

                if (WindowSandbox.isProxyObject(owner))
                    return owner[propName] = value; // eslint-disable-line no-return-assign

                const ownerSetPropertyInstruction = PropertyAccessorsInstrumentation._getSetPropertyInstructionByOwner(owner, window);

                if (ownerSetPropertyInstruction)
                    return ownerSetPropertyInstruction(owner, propName, value);

                if (typeof propName === 'string' && shouldInstrumentProperty(propName) &&
                    accessors[propName].condition(owner))
                    return accessors[propName].set(owner, value);

                return owner[propName] = value; // eslint-disable-line no-return-assign
            },

            configurable: true
        });

        return accessors;
    }
}
