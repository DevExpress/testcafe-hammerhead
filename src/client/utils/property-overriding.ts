import nativeMethods from '../sandbox/native-methods';


interface PropertySettings<T extends object, K extends keyof T> {
    getter?: (() => T[K]) | null | undefined;
    setter?: ((val: T[K]) => void) | null | undefined;
    value?: any;
}

function replaceNativeAccessor (descriptor, accessorName: string, newAccessor) {
    if (newAccessor && descriptor[accessorName]) {
        const stringifiedNativeAccessor = descriptor[accessorName].toString();

        newAccessor.toString = () => stringifiedNativeAccessor;
    }

    descriptor[accessorName] = newAccessor;
}

export function createOverriddenDescriptor<O extends object, K extends keyof O> (obj: O, prop: K, { getter, setter, value }: PropertySettings<O, K>) {
    const descriptor = nativeMethods.objectGetOwnPropertyDescriptor(obj, prop);

    if ((getter || setter) && value)
        throw new Error('Cannot both specify accessors and a value or writable attribute.');

    if (value) {
        if (!nativeMethods.objectHasOwnProperty.call(descriptor, 'writable')) {
            descriptor.writable = !!descriptor.set;

            delete descriptor.get;
            delete descriptor.set;
        }

        descriptor.value = value; // eslint-disable-line no-restricted-properties
    }
    else {
        if (nativeMethods.objectHasOwnProperty.call(descriptor, 'writable')) {
            delete descriptor.value; // eslint-disable-line no-restricted-properties
            delete descriptor.writable;
        }

        if (getter !== null)
            replaceNativeAccessor(descriptor, 'get', getter);

        if (setter !== null)
            replaceNativeAccessor(descriptor, 'set', setter);
    }

    return descriptor;
}

export function overrideDescriptor<O extends object, K extends keyof O> (obj: O, prop: K, propertyAccessors: PropertySettings<O, K>) {
    const descriptor = createOverriddenDescriptor(obj, prop, propertyAccessors);

    nativeMethods.objectDefineProperty(obj, prop, descriptor);
}
