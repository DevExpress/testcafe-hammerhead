import bowser from 'bowser';

var userAgent          = navigator.userAgent.toLowerCase();
var info               = bowser._detect(userAgent);
var webkitVersionMatch = userAgent.match(/applewebkit\/(\d+(:?\.\d+)*)/);

//Helper
export var compareVersions = bowser.compareVersions;

//Platforms
export var isMacPlatform = !!info.mac;
export var isAndroid     = !!info.android;
export var isIOS         = !!info.ios;

//Browsers
export var version       = parseInt(info.version, 10);
export var fullVersion   = info.version;
export var webkitVersion = webkitVersionMatch && webkitVersionMatch[1] || '';
export var isIE          = !!(info.msie || info.msedge);
export var isIE11        = isIE && version === 11;
export var isIE10        = isIE && version === 10;
export var isIE9         = isIE && version === 9;
export var isFirefox     = !!info.firefox;
export var isMSEdge      = !!info.msedge;
export var isChrome      = !!info.chrome;
export var isSafari      = !!info.safari;
export var isWebKit      = !!(info.webkit || info.blink);
export var isElectron    = /electron/g.test(userAgent);

//Feature detection
export var hasTouchEvents = !!('ontouchstart' in window);
// NOTE: We need to check touch points only for IE, because it has PointerEvent and MSPointerEvent (IE10, IE11)
// instead of TouchEvent (T109295).
export var hasTouchPoints = isIE && (navigator.maxTouchPoints > 0 || navigator.msMaxTouchPoints > 0);
export var isTouchDevice  = !!(info.mobile || info.tablet) && hasTouchEvents;

export var hasDataTransfer = !!window.DataTransfer;

