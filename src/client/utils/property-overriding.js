import nativeMethods from '../sandbox/native-methods';

function replaceNativeAccessor (descriptor, accessorName, newAccessor) {
    if (newAccessor && descriptor[accessorName]) {
        const stringifiedNativeAccessor = descriptor[accessorName].toString();

        newAccessor.toString = () => stringifiedNativeAccessor;
    }

    descriptor[accessorName] = newAccessor;
}

export function createOverriddenDescriptor (obj, prop, { getter, setter }) {
    const descriptor = nativeMethods.objectGetOwnPropertyDescriptor.call(window.Object, obj, prop);

    if (getter !== null)
        replaceNativeAccessor(descriptor, 'get', getter);

    if (setter !== null)
        replaceNativeAccessor(descriptor, 'set', setter);

    return descriptor;
}

export function overrideDescriptor (obj, prop, propertyAccessors) {
    const descriptor = createOverriddenDescriptor(obj, prop, propertyAccessors);

    nativeMethods.objectDefineProperty.call(window.Object, obj, prop, descriptor);
}
