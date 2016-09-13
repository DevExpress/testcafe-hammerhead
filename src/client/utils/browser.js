function calculateBrowserAndVersion (userAgent) {
    var msEdgeRegEx   = /(edge)\/([\w.]+)/;
    var chromeRegEx   = /(chrome)[\/]([\w.]+)/;
    var safariRegEx   = /(webkit)[ \/]([\w.]+).*(version)[ \/]([\w.]+).*(safari)[ \/]([\w.]+)/;
    var webkitRegEx   = /(webkit)[\/]([\w.]+)/;
    var ie9And10RegEx = /(msie) ([\w.]+)/;
    var ie11RegEx     = /(rv)(?::| )([\w.]+)/;
    var firefoxRegEx  = /(mozilla)(?:.*? rv:([\w.]+)|)/;
    var match         = msEdgeRegEx.exec(userAgent) ||
                        chromeRegEx.exec(userAgent) ||
                        safariRegEx.exec(userAgent) ||
                        webkitRegEx.exec(userAgent) ||
                        ie9And10RegEx.exec(userAgent) ||
                        userAgent.indexOf('trident') >= 0 && ie11RegEx.exec(userAgent) ||
                        userAgent.indexOf('compatible') < 0 && firefoxRegEx.exec(userAgent) ||
                        [];

    return {
        name:    match[5] || match[3] || match[1] || '',
        version: parseInt(match[4] || match[2] || '0', 10)
    };
}

var userAgent = navigator.userAgent.toLowerCase();
var browser   = calculateBrowserAndVersion(userAgent);

//Platforms
export var isMacPlatform = /^Mac/.test(navigator.platform);
export var isAndroid     = /(android)/.test(userAgent);
export var isIOS         = /(iphone|ipod|ipad)/.test(userAgent);

//Browsers
export var version           = browser.version;
export var isIE11            = browser.name === 'rv';
export var isIE              = browser.name === 'msie' || browser.name === 'edge' || isIE11;
export var isIE10            = isIE && version === 10;
export var isIE9             = isIE && version === 9;
export var isFirefox         = browser.name === 'mozilla';
export var isMSEdge          = browser.name === 'edge';
export var isChrome          = browser.name === 'chrome';
export var isSafari          = isIOS || browser.name === 'safari';
export var isWebKit          = isChrome || isSafari || browser.name === 'webkit';

//Feature detection
export var hasTouchEvents = !!('ontouchstart' in window);
// NOTE: We need to check touch points only for IE, because it has PointerEvent and MSPointerEvent (IE10, IE11)
// instead of TouchEvent (T109295).
export var isTouchDevice = hasTouchEvents || isIE && (navigator.maxTouchPoints > 0 || navigator.msMaxTouchPoints > 0);


