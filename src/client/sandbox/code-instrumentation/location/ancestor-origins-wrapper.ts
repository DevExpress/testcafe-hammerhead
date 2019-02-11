import nativeMethods from '../../native-methods';
import LocationAccessorsInstrumentation from './index';
import { createOverriddenDescriptor } from '../../../utils/property-overriding';

const lengthWeakMap = new WeakMap();

export default function DOMStringListWrapper (window: Window, getCrossDomainOrigin) {
    const nativeOrigins = window.location.ancestorOrigins;
    const length        = nativeOrigins.length;
    let parentWindow    = window.parent;

    lengthWeakMap.set(this, length);

    for (let i = 0; i < length; i++) {
        const parentLocationWrapper = LocationAccessorsInstrumentation.getLocationWrapper(parentWindow);
        const isCrossDomainParent   = parentLocationWrapper === parentWindow.location;

        // eslint-disable-next-line no-restricted-properties
        updateOrigin(nativeOrigins, this, i, isCrossDomainParent ? '' : parentLocationWrapper.origin);

        if (isCrossDomainParent)
            getCrossDomainOrigin(parentWindow, origin => updateOrigin(nativeOrigins, this, i, origin));

        parentWindow = parentWindow.parent;
    }
}

DOMStringListWrapper.prototype = nativeMethods.objectCreate(DOMStringList.prototype);

DOMStringListWrapper.prototype.item = function (index) {
    return this[index];
};

DOMStringListWrapper.prototype.contains = function (origin) {
    if (typeof origin !== 'string')
        origin = String(origin);

    const length = lengthWeakMap.get(this);

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

function updateOrigin (ancestorOrigins, wrapper, index, origin) {
    const descriptor = createOverriddenDescriptor(ancestorOrigins, index, { value: origin });

    nativeMethods.objectDefineProperty(wrapper, index, descriptor);
}
