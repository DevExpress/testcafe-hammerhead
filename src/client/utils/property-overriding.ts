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

// NOTE: saves the original string representation of a native function in its wrapper as an additional property
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
    const fn = obj[fnName] as unknown as Function;

    if (isNativeFunction(fn)) {
        // NOTE: we need to override the 'name' property of our wrapper 
        // to be the same as the `name` property of a native function
        nativeMethods.objectDefineProperty(wrapper, 'name', {
            value: obj[fnName]['name']
        });

        overrideStringRepresentation(wrapper, fn);
        
        nativeMethods.objectDefineProperty(obj, fnName, {
            value: wrapper
        });
    }
}

export function overrideConstructor<O extends object, K extends keyof O> (obj: O, fnName: K, wrapper: Function, overrideProtoConstructor: boolean = false): void {
    const nativePrototype = obj[fnName]['prototype'];
    
    overrideFunction(obj, fnName, wrapper);

    if (nativePrototype) {
        // NOTE: restore native prototype (to make `instanceof` work as expected)
        nativeMethods.objectDefineProperty(obj[fnName], 'prototype', {
            value: nativePrototype
        });
        
        // NOTE: we need to override the `constructor` property of a prototype 
        // because sometimes native constructor can be retrieved from it
        if (overrideProtoConstructor) {
            nativeMethods.objectDefineProperty(nativePrototype, 'constructor', {
                value: wrapper
            });
        }
    }
}
