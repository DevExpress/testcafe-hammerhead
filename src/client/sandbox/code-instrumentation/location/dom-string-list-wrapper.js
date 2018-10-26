import nativeMethods from '../../native-methods';

export default function DOMStringListWrapper (nativeList, actualValuesList) {
    nativeMethods.objectDefineProperties.call(Object, this, {
        _length: { value: nativeList.length }
    });

    for (let i = 0; i < nativeList.length; i++) {
        const nativeItem = Object.getOwnPropertyDescriptor(nativeList, i);

        // eslint-disable-next-line no-restricted-properties
        nativeItem.value = actualValuesList[i];

        Object.defineProperty(this, i, nativeItem);
    }
}

DOMStringListWrapper.prototype = nativeMethods.objectCreate.call(Object, DOMStringList.prototype);

DOMStringListWrapper.prototype.item = function (index) {
    return this[index];
};

DOMStringListWrapper.prototype.contains = function (string) {
    if (typeof string !== 'string')
        string = String(string);

    for (let i = 0; i < this._length; i++) {
        if (this[i] === string)
            return true;
    }

    return false;
};

nativeMethods.objectDefineProperty.call(Object, DOMStringListWrapper.prototype, 'length', {
    configurable: true,
    enumerable:   true,
    get:          function () {
        return this._length;
    }
});
