import nativeMethods from '../sandbox/native-methods';

export function createOverriddenDescriptor (obj, prop, { getter, setter }) {
    const descriptor = nativeMethods.objectGetOwnPropertyDescriptor.call(window.Object, obj, prop);

    if (getter !== null)
        descriptor.get = getter;

    if (setter !== null)
        descriptor.set = setter;

    return descriptor;
}

export function overrideDescriptor (obj, prop, propertyAccessors) {
    const descriptor = createOverriddenDescriptor(obj, prop, propertyAccessors);

    nativeMethods.objectDefineProperty.call(window.Object, obj, prop, descriptor);
}
