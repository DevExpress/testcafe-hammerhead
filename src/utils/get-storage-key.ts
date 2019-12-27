// -------------------------------------------------------------
// WARNING: this file is used by both the client and the server.
// Do not use any browser or node-specific API!
// -------------------------------------------------------------
/* eslint hammerhead/proto-methods: 2 */
const STORAGE_WRAPPER_PREFIX = 'hammerhead|storage-wrapper|';

export default function getStorageKey (sessionId: string, host: string): string {
    return STORAGE_WRAPPER_PREFIX + sessionId + '|' + host;
}
