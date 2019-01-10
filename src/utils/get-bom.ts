// -------------------------------------------------------------
// WARNING: this file is used by both the client and the server.
// Do not use any browser or node-specific API!
// -------------------------------------------------------------
/* eslint hammerhead/proto-methods: 2 */

const BOM_RE: RegExp = /^(\xEF\xBB\xBF|\xFE\xFF|\xFF\xFE|\x00\x00\xFE\xFF|\xFF\xFE\x00\x00|\x2B\x2F\x76\x38|\x2B\x2F\x76\x39|\x2B\x2F\x76\x2B|\x2B\x2F\x76\x2F|\xF7\x64\x4C|\xDD\x73\x66\x73|\x0E\xFE\xFF|\xFB\xEE\x28|\x84\x31\x95\x33)/;

export default function (str: string) {
    const match = str.match(BOM_RE);

    return match ? match[0] : null;
}
