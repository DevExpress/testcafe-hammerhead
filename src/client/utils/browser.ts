import bowser from 'bowser';

const userAgent: string = navigator.userAgent.toLowerCase();
//@ts-ignore
const info               = bowser._detect(userAgent);
const webkitVersionMatch = userAgent.match(/applewebkit\/(\d+(:?\.\d+)*)/);

//Helper
//@ts-ignore
export const compareVersions = bowser.compareVersions;

//Platforms
export const isMacPlatform: boolean = !!info.mac;
export const isAndroid: boolean     = !!info.android;
export const isIOS: boolean         = !!info.ios;
export const isMobile: boolean      = !!info.mobile;
export const isTablet: boolean      = !!info.tablet;

//Browsers
export const version: number       = parseInt(info.version, 10);
export const fullVersion   = info.version;
export const webkitVersion = webkitVersionMatch && webkitVersionMatch[1] || '';
export const isIE: boolean          = !!(info.msie || info.msedge);
export const isIE11: boolean        = isIE && version === 11;
export const isIE10: boolean        = isIE && version === 10;
export const isIE9: boolean         = isIE && version === 9;
export const isFirefox: boolean     = !!info.firefox;
export const isMSEdge: boolean      = !!info.msedge;
export const isChrome: boolean      = !!info.chrome;
export const isSafari: boolean      = !!info.safari;
export const isWebKit: boolean      = !!(info.webkit || info.blink);
export const isElectron: boolean    = /electron/g.test(userAgent);


