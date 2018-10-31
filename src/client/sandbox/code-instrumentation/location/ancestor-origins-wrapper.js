import nativeMethods from '../../native-methods';
import LocationAccessorsInstrumentation from './index';

export default function DOMStringListWrapper (window, getCrossDomainOrigin) {
    const nativeOrigins = window.location.ancestorOrigins;
    let parentWindow    = window;

    this._nativeLength = nativeOrigins.length;

    for (let i = 0; i < this._nativeLength; i++) {
        parentWindow                = parentWindow.parent;
        const parentLocationWrapper = LocationAccessorsInstrumentation.getLocationWrapper(parentWindow);
        const isCrossDomainParent   = parentLocationWrapper === parentWindow.location;

        // eslint-disable-next-line no-restricted-properties
        updateOrigin(this, i, isCrossDomainParent ? '' : parentLocationWrapper.origin);

        if (isCrossDomainParent) {
            getCrossDomainOrigin(parentWindow, origin => {
                updateOrigin(this, i, origin);
            });
        }
    }
}

DOMStringListWrapper.prototype = nativeMethods.objectCreate.call(Object, DOMStringList.prototype);

DOMStringListWrapper.prototype.item = function (index) {
    return this[index];
};

DOMStringListWrapper.prototype.contains = function (string) {
    if (typeof string !== 'string')
        string = String(string);

    for (let i = 0; i < this._nativeLength; i++) {
        if (this.item(i) === string)
            return true;
    }

    return false;
};

nativeMethods.objectDefineProperty.call(Object, DOMStringListWrapper.prototype, 'length', {
    configurable: true,
    enumerable:   true,
    get:          function () {
        return this._nativeLength;
    }
});

function updateOrigin (wrapper, idx, newOrigin) {
    wrapper[idx] = newOrigin;

    nativeMethods.objectDefineProperty.call(Object, wrapper, idx, {
        value:        newOrigin,
        configurable: true,
        enumerable:   true,
        writable:     false
    });
}
