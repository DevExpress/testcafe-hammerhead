// -------------------------------------------------------------
// WARNING: this file is used by both the client and the server.
// Do not use any browser or node-specific API!
// -------------------------------------------------------------
/* eslint hammerhead/proto-methods: 2 */
export default {
    valuePrefix: 'hammerhead|prefix|by-client',
    headers: [
        'authorization',
        'authentication-info',
        'proxy-authenticate',
        'proxy-authorization'
    ]
};
