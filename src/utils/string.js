// -------------------------------------------------------------
// WARNING: this file is used by both the client and the server.
// Do not use any browser or node-specific API!
// -------------------------------------------------------------
/* eslint hammerhead/proto-methods: 2 */

// NOTE: Some websites override the String.prototype.trim method. When we use this function
// in our scripts, we expect it to have the default behavior. Therefore, in order to protect
// ourselves from spoofing, we must use our own implementation.

export function trim (str) {
    return str.replace(/^\s+|\s+$/g, '');
}

export function endsWith (str, suffix) {
    return str.indexOf(suffix, str.length - suffix.length) !== -1;
}
