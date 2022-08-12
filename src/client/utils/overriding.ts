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

    if (!descriptor)
        return void 0;

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
    if (!obj)
        return;

    const descriptor = createOverriddenDescriptor(obj, prop, propertyAccessors);

    if (descriptor)
        nativeMethods.objectDefineProperty(obj, prop, descriptor);
    else
        overrideDescriptor(nativeMethods.objectGetPrototypeOf(obj), prop, propertyAccessors);
}

function overrideFunctionName (fn: Function, name: string): void {
    const nameDescriptor = nativeMethods.objectGetOwnPropertyDescriptor(fn, 'name');

    if (!nameDescriptor)
        return;

    nameDescriptor.value = name; // eslint-disable-line no-restricted-properties

    nativeMethods.objectDefineProperty(fn, 'name', nameDescriptor);
}

function overrideToString (nativeFnWrapper: Function, nativeFn: Function): void {
    nativeMethods.objectDefineProperty(nativeFnWrapper, INTERNAL_PROPS.nativeStrRepresentation, {
        value:        nativeMethods.Function.prototype.toString.call(nativeFn),
        configurable: true,
    });
}

// TODO: this function should not be used outside this file
// for now it's used to flag cases in which we assign our wrapper to a native function when it is missing
export function overrideStringRepresentation (nativeFnWrapper: Function, nativeFn: Function): void {
    overrideFunctionName(nativeFnWrapper, nativeFn.name);
    overrideToString(nativeFnWrapper, nativeFn);
}

export function isNativeFunction (fn: Function): boolean {
    return !nativeMethods.objectHasOwnProperty.call(fn, INTERNAL_PROPS.nativeStrRepresentation);
}

export function overrideFunction<O extends object, K extends keyof O> (obj: O, fnName: K, wrapper: Function): void {
    const fn = obj[fnName] as unknown as Function;

    if (isNativeFunction(fn)) {
        overrideStringRepresentation(wrapper, fn);

        (obj[fnName] as unknown as Function) = wrapper;
    }
}

export function overrideConstructor<O extends object, K extends keyof O> (obj: O, fnName: K, wrapper: Function, overrideProtoConstructor = false): void {
    const nativePrototype = obj[fnName]['prototype'];

    overrideFunction(obj, fnName, wrapper);

    // NOTE: restore native prototype (to make `instanceof` work as expected)
    wrapper.prototype = nativePrototype;

    // NOTE: we need to override the `constructor` property of a prototype
    // because sometimes native constructor can be retrieved from it
    if (overrideProtoConstructor)
        nativePrototype.constructor = wrapper;
}
