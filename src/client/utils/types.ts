export function inaccessibleTypeToStr (obj) {
    return obj === null ? 'null' : 'undefined';
}

export function isNullOrUndefined (obj) {
    return obj === void 0 || isNull(obj);
}

export function isPrimitiveType (obj) {
    const objType = typeof obj;

    return objType !== 'object' && objType !== 'function';
}

export function isNull (obj) {
    return obj === null;
}

export function isNumber (val) {
    return typeof val === 'number';
}

export function isFunction (val) {
    return typeof val === 'function';
}
