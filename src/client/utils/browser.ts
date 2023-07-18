import bowser from 'bowser';

const userAgent = navigator.userAgent.toLowerCase();
//@ts-ignore
const info               = bowser._detect(userAgent);
const webkitVersionMatch = userAgent.match(/applewebkit\/(\d+(:?\.\d+)*)/);

//Helper
//@ts-ignore
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
export const isFirefox     = !!info.firefox;
export const isChrome      = !!info.chrome;
export const isSafari      = !!info.safari;
export const isWebKit      = !!(info.webkit || info.blink);
export const isElectron    = /electron/g.test(userAgent);


