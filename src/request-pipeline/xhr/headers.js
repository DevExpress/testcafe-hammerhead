// -------------------------------------------------------------
// WARNING: this file is used by both the client and the server.
// Do not use any browser or node-specific API!
// -------------------------------------------------------------
/* eslint hammerhead/proto-methods: 2 */

export default {
    requestMarker:           'x-hammerhead|xhr|request-marker',
    withCredentials:         'x-hammerhead|xhr|with-credentials',
    origin:                  'x-hammerhead|xhr|origin',
    setCookie:               'x-hammerhead|xhr|set-cookie',
    fetchRequestCredentials: 'x-hammerhead|fetch|request-credentials'
};
