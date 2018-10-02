// -------------------------------------------------------------
// WARNING: this file is used by both the client and the server.
// Do not use any browser or node-specific API!
// -------------------------------------------------------------

export function inaccessibleTypeToStr (obj) {
    return obj === null ? 'null' : 'undefined';
}

export function isNullOrUndefined (obj) {
    return obj === null || obj === void 0;
}

export function isPrimitiveType (obj) {
    const objType = typeof obj;

    return objType !== 'object' && objType !== 'function';
}

export function isConvertibleToString (obj) {
    try {
        String(obj);

        return true;
    }
    catch (e) {
        return false;
    }
}
