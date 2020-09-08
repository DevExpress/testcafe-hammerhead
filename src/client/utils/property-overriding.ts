import nativeMethods from '../sandbox/native-methods';
import INTERNAL_PROPS from '../../processing/dom/internal-properties';


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

export function overrideStringRepresentation (nativeFnWrapper: Function, nativeFn: Function): void {
    const nativeStringRepresentation = nativeMethods.Function.prototype.toString.call(nativeFn);

    nativeMethods.objectDefineProperty(nativeFnWrapper, INTERNAL_PROPS.nativeStringRepresentation, {
        value: nativeStringRepresentation,
        configurable: true
    });
}

export function isNativeFunction (fn: Function): boolean {
    return !nativeMethods.objectHasOwnProperty.call(fn, INTERNAL_PROPS.nativeStringRepresentation);
}

export function overrideFunction<O extends object, K extends keyof O> (obj: O, fnName: K, wrapper: Function): void {
    const descriptor = nativeMethods.objectGetOwnPropertyDescriptor(obj, fnName);
    const value      = descriptor.value; // eslint-disable-line no-restricted-properties

    if (value && isNativeFunction(value)) {
        nativeMethods.objectDefineProperty(wrapper, 'name', {
            value: fnName
        });

        overrideStringRepresentation(wrapper, value);
        
        nativeMethods.objectDefineProperty(obj, fnName, {
            value: wrapper
        });
    }
}

export function overrideConstructor<O extends object, K extends keyof O> (obj: O, fnName: K, wrapper: Function, overrideProtoConstructor?: false): void {
    const prototypeDescriptor = nativeMethods.objectGetOwnPropertyDescriptor(obj[fnName], 'prototype');
    const nativePrototype     = prototypeDescriptor.value; // eslint-disable-line no-restricted-properties

    overrideFunction(obj, fnName, wrapper);

    // NOTE: restore original prototype (to make `instanceof` work as expected)
    nativeMethods.objectDefineProperty(obj[fnName], 'prototype', {
        value: nativePrototype
    });
    
    if (overrideProtoConstructor) {
        nativeMethods.objectDefineProperty(obj[fnName], 'constructor', {
            value: wrapper
        });
    }
}
