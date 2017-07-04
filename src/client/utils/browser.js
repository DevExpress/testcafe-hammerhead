import bowser from 'bowser';

const userAgent          = navigator.userAgent.toLowerCase();
const info               = bowser._detect(userAgent);
const webkitVersionMatch = userAgent.match(/applewebkit\/(\d+(:?\.\d+)*)/);

//Helper
export const compareVersions = bowser.compareVersions;

//Platforms
export const isMacPlatform = !!info.mac;
export const isAndroid     = !!info.android;
export const isIOS         = !!info.ios;
export const isMobile      = !!info.mobile;
export const isTablet      = !!info.tablet;

//Browsers
export const version       = parseInt(info.version, 10);
export const fullVersion   = info.version;
export const webkitVersion = webkitVersionMatch && webkitVersionMatch[1] || '';
export const isIE          = !!(info.msie || info.msedge);
export const isIE11        = isIE && version === 11;
export const isIE10        = isIE && version === 10;
export const isIE9         = isIE && version === 9;
export const isFirefox     = !!info.firefox;
export const isMSEdge      = !!info.msedge;
export const isChrome      = !!info.chrome;
export const isSafari      = !!info.safari;
export const isWebKit      = !!(info.webkit || info.blink);
export const isElectron    = /electron/g.test(userAgent);


