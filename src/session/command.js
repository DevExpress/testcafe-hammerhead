// -------------------------------------------------------------
// WARNING: this file is used by both the client and the server.
// Do not use any browser or node-specific API!
// -------------------------------------------------------------
/* eslint hammerhead/proto-methods: 2 */

var ServiceCommands = {
    getUploadedFiles:    'hammerhead|command|get-uploaded-files',
    setCookie:           'hammerhead|command|set-cookie',
    uploadFiles:         'hammerhead|command|upload-files',
    getIframeTaskScript: 'hammerhead|command|get-iframe-task-script'
};

export default ServiceCommands;
