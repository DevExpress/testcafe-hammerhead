var Util = {};

// NOTE: Some web-sites override String.prototype.trim method
Util.trim = function (str) {
    return str.replace(/^\s+|\s+$/g, '');
};

export default Util;
