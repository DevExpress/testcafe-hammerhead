import nativeMethods from '../../native-methods';
import LocationAccessorsInstrumentation from './index';
import { createOverriddenDescriptor } from '../../../utils/overriding';

const lengthWeakMap = new WeakMap<DOMStringListWrapper, number>();

function updateOrigin (ancestorOrigins: DOMStringList, wrapper: DOMStringListWrapper, index: string, origin: string) {
    const descriptor = createOverriddenDescriptor(ancestorOrigins, index as keyof DOMStringList, { value: origin });

    nativeMethods.objectDefineProperty(wrapper, index, descriptor);
}

class DOMStringListInheritor {}

DOMStringListInheritor.prototype = DOMStringList.prototype;

export default class DOMStringListWrapper extends DOMStringListInheritor {
    constructor (window: Window, getCrossDomainOrigin?: Function) {
        super();

        const nativeOrigins = window.location.ancestorOrigins;
        const length        = nativeOrigins.length;
        let parentWindow    = window.parent;

        lengthWeakMap.set(this, length);

        for (let i = 0; i < length; i++) {
            const parentLocationWrapper = LocationAccessorsInstrumentation.getLocationWrapper(parentWindow);
            const isCrossDomainParent   = parentLocationWrapper === parentWindow.location;

            // eslint-disable-next-line no-restricted-properties
            updateOrigin(nativeOrigins, this, i.toString(), isCrossDomainParent ? '' : parentLocationWrapper.origin);

            if (isCrossDomainParent && getCrossDomainOrigin)
            //@ts-ignore
                getCrossDomainOrigin(parentWindow, (origin: string) => updateOrigin(nativeOrigins, this, i, origin));

            parentWindow = parentWindow.parent;
        }
    }

    item (index: number) {
        return this[index];
    }

    contains (origin: string) {
        if (typeof origin !== 'string')
            origin = String(origin);

        const length = lengthWeakMap.get(this) || 0;

        for (let i = 0; i < length; i++) {
            if (this[i] === origin)
                return true;
        }

        return false;
    }

    get length () {
        return lengthWeakMap.get(this);
    }
}
