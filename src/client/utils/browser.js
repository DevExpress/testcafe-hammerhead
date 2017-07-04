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
export var isMobile      = !!info.mobile;
export var isTablet      = !!info.tablet;

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


