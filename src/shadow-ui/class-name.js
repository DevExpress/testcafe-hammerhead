// -------------------------------------------------------------
// WARNING: this file is used by both the client and the server.
// Do not use any browser or node-specific API!
// -------------------------------------------------------------
/* eslint hammerhead/proto-methods: 2 */

const POSTFIX = '-hammerhead-shadow-ui';

export default {
    postfix:      POSTFIX,
    charset:      'charset' + POSTFIX,
    script:       'script' + POSTFIX,
    uiStylesheet: 'ui-stylesheet' + POSTFIX
};
