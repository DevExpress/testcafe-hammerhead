// -------------------------------------------------------------
// WARNING: this file is used by both the client and the server.
// Do not use any browser or node-specific API!
// -------------------------------------------------------------

// NOTE: We should store the methods of the `JSON` object
// since they can be overridden by the client code.
export const parse     = JSON.parse;
export const stringify = JSON.stringify;

function isDOMNode (obj) {
    if (typeof Node === 'object')
        return obj instanceof Node;

    return typeof obj.nodeType === 'number' && typeof obj.nodeName === 'string';
}

function isJQueryObj (obj) {
    return !!(obj && obj.jquery);
}

export function isSerializable (value) {
    if (value) {
        // NOTE: jquery object, DOM nodes and functions are disallowed obj types because we can't serialize them correctly
        if (typeof value === 'function' || isJQueryObj(value) || isDOMNode(value))
            return false;

        if (typeof value === 'object') {
            for (const prop in value) {
                if (value.hasOwnProperty(prop) && !isSerializable(value[prop])) // eslint-disable-line no-prototype-builtins
                    return false;
            }
        }
    }

    return true;
}
