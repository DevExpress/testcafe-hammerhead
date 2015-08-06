// -----------------------------------------------------
// WARNING: this file is used both by client and server.
// Do not use any browser or node specific API!
// -----------------------------------------------------

// NOTE: Some web-sites override String.prototype.trim method:
//
//      String.prototype.trim = function() {
//          return this.replace(/^\s/, '');
//      };
//
// In our scripts we are using 'trim' function and look forward to its default behavior.
// In order to protect us from spoofing we must use the our own function implementation.


export default function trim (str) {
    return str.replace(/^\s+|\s+$/g, '');
}
