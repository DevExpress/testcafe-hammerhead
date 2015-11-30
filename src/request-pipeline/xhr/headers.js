// -------------------------------------------------------------
// WARNING: this file is used by both the client and the server.
// Do not use any browser or node-specific API!
// -------------------------------------------------------------

export default {
    requestMarker:   'x-hammerhead|xhr|request-marker-header',
    corsSupported:   'x-hammerhead|xhr|cors-supported-header',
    withCredentials: 'x-hammerhead|xhr|with-credentials-header',
    origin:          'x-hammerhead|xhr|origin'
};
