// NOTE: Some web-sites override String.prototype.trim method
export default function trim (str) {
    return str.replace(/^\s+|\s+$/g, '');
}
