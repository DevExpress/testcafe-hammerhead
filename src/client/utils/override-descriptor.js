import nativeMethods from '../sandbox/native-methods';

export default function overrideDescriptor (obj, prop, getter, setter) {
    const descriptor = nativeMethods.objectGetOwnPropertyDescriptor.call(window.Object, obj, prop);

    if (getter !== null)
        descriptor.get = getter;

    if (setter !== null)
        descriptor.set = setter;

    nativeMethods.objectDefineProperty.call(window.Object, obj, prop, descriptor);
}
