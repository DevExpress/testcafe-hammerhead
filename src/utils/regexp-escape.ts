// -------------------------------------------------------------
// WARNING: this file is used by both the client and the server.
// Do not use any browser or node-specific API!
// -------------------------------------------------------------
/* eslint hammerhead/proto-methods: 2 */

// NOTE: taken from https://github.com/benjamingr/RegExp.escape
export default function (str: string): string {
    return str.replace(/[\\^$*+?.()|[\]{}]/g, '\\$&');
}
