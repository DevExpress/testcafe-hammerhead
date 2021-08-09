import nativeMethods from '../sandbox/native-methods';

export default function ensureArrayInDeclarationDestructuring(target: any) {
    if (!target)
        return target;

    const shouldConvertToArray = !nativeMethods.isArray.call(nativeMethods.Array, target) &&
        typeof target[Symbol.iterator] === 'function';

    return shouldConvertToArray ? nativeMethods.arrayFrom.call(nativeMethods.Array, target) : target;
}
