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

export function isLooseNull (obj) {
    //Some times IE cannot compare null correctly
    // eslint-disable-next-line eqeqeq
    return obj == null;
}
