function getMSEdgeVersion (userAgent) {
    var edgeStrIndex = userAgent.indexOf('edge/');

    return parseInt(userAgent.substring(edgeStrIndex + 5, userAgent.indexOf('.', edgeStrIndex)), 10);
}

function calculateBrowserAndVersion (userAgent) {
    var webkitRegEx  = /(webkit)[ \/]([\w.]+)/;
    var operaRegEx   = /(opera)(?:.*version)?[ \/]([\w.]+)/;
    var msieRegEx    = /(msie) ([\w.]+)/;
    var firefoxRegEx = /(firefox)/;

    var match = webkitRegEx.exec(userAgent) ||
                operaRegEx.exec(userAgent) ||
                msieRegEx.exec(userAgent) ||
                userAgent.indexOf('compatible') < 0 && firefoxRegEx.exec(userAgent) ||
                [];

    return {
        name:    match[1] || '',
        version: match[2] || '0'
    };
}

export function init (win) {
    win = win || window;

    var userAgent           = win.navigator.userAgent.toLowerCase();
    var browser             = calculateBrowserAndVersion(userAgent);
    var majorBrowserVersion = parseInt(browser.version, 10);
    var isIE11              = /trident\/7.0/.test(userAgent) && !(browser.name === 'msie' &&
                              (majorBrowserVersion === 9 || majorBrowserVersion === 10));

    if (isIE11)
        majorBrowserVersion = 11;

    var exports = module.exports;

    exports.isAndroid         = /android/.test(userAgent);
    exports.isMSEdge          = !!/edge\//.test(userAgent);
    exports.version           = exports.isMSEdge ? getMSEdgeVersion(userAgent) : majorBrowserVersion;
    exports.isIOS             = /(iphone|ipod|ipad)/.test(userAgent);
    exports.isIE11            = isIE11;
    exports.isIE              = browser.name === 'msie' || isIE11 || exports.isMSEdge;
    exports.isIE10            = exports.isIE && exports.version === 10;
    exports.isIE9             = exports.isIE && exports.version === 9;
    exports.isMozilla         = browser.name === 'firefox' && !isIE11;
    exports.isOpera           = browser.name === 'opera';
    exports.isOperaWithWebKit = /opr/.test(userAgent);
    exports.isSafari          = exports.isIOS || /safari/.test(userAgent) && !/chrome/.test(userAgent);
    exports.isWebKit          = browser.name === 'webkit' && !exports.isMSEdge && !exports.isSafari;
    exports.hasTouchEvents    = !!('ontouchstart' in win);

    //NOTE: we need check of touch points only for IE, because it has PointerEvent and MSPointerEvent (IE10, IE11) instead TouchEvent (T109295)
    exports.isTouchDevice = exports.hasTouchEvents ||
                            exports.isIE && (win.navigator.maxTouchPoints > 0 || win.navigator.msMaxTouchPoints > 0);

    exports.isMacPlatform = /^Mac/.test(win.navigator.platform);
}

init();
