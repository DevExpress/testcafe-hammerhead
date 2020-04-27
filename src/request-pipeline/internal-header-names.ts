// -------------------------------------------------------------
// WARNING: this file is used by both the client and the server.
// Do not use any browser or node-specific API!
// -------------------------------------------------------------
/* eslint hammerhead/proto-methods: 2 */
import BUILTIN_HEADERS from './builtin-header-names';

const hammerheadPrefix = 'x-hammerhead-';

export default {
    credentials:        hammerheadPrefix + 'credentials',
    origin:             hammerheadPrefix + BUILTIN_HEADERS.origin,
    wwwAuthenticate:    hammerheadPrefix + BUILTIN_HEADERS.wwwAuthenticate,
    proxyAuthenticate:  hammerheadPrefix + BUILTIN_HEADERS.proxyAuthenticate,
    authorization:      hammerheadPrefix + BUILTIN_HEADERS.authorization,
    proxyAuthorization: hammerheadPrefix + BUILTIN_HEADERS.proxyAuthorization
};
