import nativeMethods from '../../native-methods';
import LocationAccessorsInstrumentation from './index';
import { createOverriddenDescriptor } from '../../../utils/property-overriding';

const lengthWeakMap = new WeakMap<DOMStringListWrapper, number>();

export default function DOMStringListWrapper (window: Window, getCrossDomainOrigin?: Function) {
    const nativeOrigins = window.location.ancestorOrigins;
    const length        = nativeOrigins.length;
    let parentWindow    = window.parent;

    //@ts-ignore
    lengthWeakMap.set(this, length);

    for (let i = 0; i < length; i++) {
        const parentLocationWrapper = LocationAccessorsInstrumentation.getLocationWrapper(parentWindow);
        const isCrossDomainParent   = parentLocationWrapper === parentWindow.location;

        // @ts-ignore
        updateOrigin(nativeOrigins, this, i.toString(), isCrossDomainParent ? '' : parentLocationWrapper.origin); // eslint-disable-line no-restricted-properties

        if (isCrossDomainParent && getCrossDomainOrigin)
            //@ts-ignore
            getCrossDomainOrigin(parentWindow, (origin: string) => updateOrigin(nativeOrigins, this, i, origin));

        parentWindow = parentWindow.parent;
    }
}

DOMStringListWrapper.prototype = nativeMethods.objectCreate(DOMStringList.prototype);

DOMStringListWrapper.prototype.item = function (index: number) {
    return this[index];
};

DOMStringListWrapper.prototype.contains = function (origin: string) {
    if (typeof origin !== 'string')
        origin = String(origin);

    const length = lengthWeakMap.get(this) || 0;

    for (let i = 0; i < length; i++) {
        if (this[i] === origin)
            return true;
    }

    return false;
};

const lengthDescriptor = createOverriddenDescriptor(DOMStringList.prototype, 'length', {
    getter: function () {
        return lengthWeakMap.get(this);
    }
});

nativeMethods.objectDefineProperty(DOMStringListWrapper.prototype, 'length', lengthDescriptor);

function updateOrigin (ancestorOrigins: DOMStringList, wrapper: DOMStringListWrapper, index: string, origin: string) {
    const descriptor = createOverriddenDescriptor(ancestorOrigins, index as keyof DOMStringList, { value: origin });

    nativeMethods.objectDefineProperty(wrapper, index, descriptor);
}
