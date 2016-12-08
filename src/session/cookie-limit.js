// -------------------------------------------------------------
// WARNING: this file is used by both the client and the server.
// Do not use any browser or node-specific API!
// -------------------------------------------------------------
/* eslint hammerhead/proto-methods: 2 */


// NOTE: At least 4096 bytes per cookie (as measured by the sum of the length of the cookie's name,
// value, and attributes). Specification https://tools.ietf.org/html/rfc6265#page-27 (GH-767)
const BYTES_PER_COOKIE_LIMIT = 4096;

export default BYTES_PER_COOKIE_LIMIT;
