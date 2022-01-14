'use strict';

exports.__esModule = true;
exports.default = isSafari15;

function isSafari15(browserInfo) {
    return browserInfo && browserInfo.browserName === 'safari' && browserInfo.version === '15';
}

module.exports = exports.default;