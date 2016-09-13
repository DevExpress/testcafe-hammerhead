function getMSEdgeVersion (userAgent) {
    var edgeStrIndex = userAgent.indexOf('edge/');

    return parseInt(userAgent.substring(edgeStrIndex + 5, userAgent.indexOf('.', edgeStrIndex)), 10);
}

function calculateBrowserAndVersion (userAgent) {
    var webkitRegEx  = /(webkit)[ \/]([\w.]+)/;
    var msieRegEx    = /(msie) ([\w.]+)/;
    var firefoxRegEx = /(firefox)/;

    var match = webkitRegEx.exec(userAgent) ||
                msieRegEx.exec(userAgent) ||
                userAgent.indexOf('compatible') < 0 && firefoxRegEx.exec(userAgent) ||
                [];

    return {
        name:    match[1] || '',
        version: match[2] || '0'
    };
}

var userAgent           = navigator.userAgent.toLowerCase();
var browser             = calculateBrowserAndVersion(userAgent);
var majorBrowserVersion = parseInt(browser.version, 10);

export var isIE11 = /trident\/7.0/.test(userAgent) && !(browser.name === 'msie' &&
                    (majorBrowserVersion === 9 || majorBrowserVersion === 10));

if (isIE11)
    majorBrowserVersion = 11;

export var isAndroid         = /android/.test(userAgent);
export var isMSEdge          = !!/edge\//.test(userAgent);
export var version           = isMSEdge ? getMSEdgeVersion(userAgent) : majorBrowserVersion;
export var isIOS             = /(iphone|ipod|ipad)/.test(userAgent);
export var isIE              = browser.name === 'msie' || isIE11 || isMSEdge;
export var isIE10            = isIE && version === 10;
export var isIE9             = isIE && version === 9;
export var isFirefox         = browser.name === 'firefox' && !isIE11;
export var isSafari          = isIOS || /safari/.test(userAgent) && !/chrome/.test(userAgent);
export var isWebKit          = browser.name === 'webkit' && !isMSEdge;
export var hasTouchEvents    = !!('ontouchstart' in window);
export var isMacPlatform     = /^Mac/.test(navigator.platform);

// NOTE: We need to check touch points only for IE, because it has PointerEvent and MSPointerEvent (IE10, IE11)
// instead of TouchEvent (T109295).
export var isTouchDevice = hasTouchEvents || isIE && (navigator.maxTouchPoints > 0 || navigator.msMaxTouchPoints > 0);
