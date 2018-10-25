import nativeMethods from '../../native-methods';

export default function DOMStringListWrapper (nativeList, actualValuesList) {
    const nativeListLength = nativeList.length;

    nativeMethods.objectDefineProperties.call(Object, this, {
        _nativeListLength: { value: nativeListLength }
    });

    for (let i = 0; i < nativeListLength; i++) {
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

nativeMethods.objectDefineProperty.call(Object, DOMStringListWrapper.prototype, 'length', {
    configurable: true,
    enumerable:   true,
    get:          function () {
        return this._nativeListLength;
    }
});
