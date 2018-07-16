// -------------------------------------------------------------
// WARNING: this file is used by both the client and the server.
// Do not use any browser or node-specific API!
// -------------------------------------------------------------

import trim from './string-trim';

const TIME_RADIX             = 36;
const CLEAR_COOKIE_VALUE_STR = '=;path=/;expires=Thu, 01 Jan 1970 00:00:01 GMT';

export const SYNCHRONIZATION_TYPE = {
    server: 's',
    client: 'c',
    frames: 'f'
};

const SYNCHRONIZATION_TYPE_RE = new RegExp(`^[${SYNCHRONIZATION_TYPE.server}${SYNCHRONIZATION_TYPE.client}${SYNCHRONIZATION_TYPE.frames}]+`);

function isSameCookies (cookie1, cookie2) {
    return cookie1.sid === cookie2.sid &&
           cookie1.key === cookie2.key &&
           cookie1.domain === cookie2.domain &&
           cookie1.path === cookie2.path;
}

function sortByOutdatedAndActual (parsedCookies) {
    const outdated = [];
    const actual   = [];

    for (let current = 0; current < parsedCookies.length; current++) {
        let other = current + 1;

        for (; other < parsedCookies.length; other++) {
            if (isSameCookies(parsedCookies[current], parsedCookies[other])) {
                if (parsedCookies[current].lastAccessed > parsedCookies[other].lastAccessed) {
                    const temp = parsedCookies[current];

                    parsedCookies[current] = parsedCookies[other];
                    parsedCookies[other]   = temp;
                }

                outdated.push(parsedCookies[current]);
                break;
            }
        }

        if (other === parsedCookies.length)
            actual.push(parsedCookies[current]);
    }

    return { outdated, actual };
}

function stringifySyncType (cookie) {
    return (cookie.isServerSync ? SYNCHRONIZATION_TYPE.server : '') +
           (cookie.isClientSync ? SYNCHRONIZATION_TYPE.client : '') +
           (cookie.isFramesSync ? SYNCHRONIZATION_TYPE.frames : '');
}

export function parseClientSyncCookieStr (cookieStr) {
    const cookies       = cookieStr ? cookieStr.split(';') : '';
    const parsedCookies = [];

    for (const cookie of cookies) {
        const parsedCookie = parseSyncCookie(trim(cookie));

        if (parsedCookie)
            parsedCookies.push(parsedCookie);
    }

    return sortByOutdatedAndActual(parsedCookies);
}

export function formatSyncCookie (cookie) {
    const syncType     = stringifySyncType(cookie);
    const key          = encodeURIComponent(cookie.key);
    const domain       = encodeURIComponent(cookie.domain);
    const path         = encodeURIComponent(cookie.path);
    const expires      = cookie.expires !== 'Infinity' ? cookie.expires.getTime().toString(TIME_RADIX) : '';
    const lastAccessed = cookie.lastAccessed.getTime().toString(TIME_RADIX);

    return `${syncType}|${cookie.sid}|${key}|${domain}|${path}|${expires}|${lastAccessed}=${cookie.value};path=/`;
}

export function parseSyncCookie (cookieStr) {
    const parsedCookie = cookieStr.split('=');
    const key          = parsedCookie.length < 2 ? '' : parsedCookie.shift();
    const parsedKey    = key.split('|');

    if (parsedKey.length !== 7)
        return null;

    return {
        isServerSync: parsedKey[0].indexOf(SYNCHRONIZATION_TYPE.server) > -1,
        isClientSync: parsedKey[0].indexOf(SYNCHRONIZATION_TYPE.client) > -1,
        isFramesSync: parsedKey[0].indexOf(SYNCHRONIZATION_TYPE.frames) > -1,
        sid:          parsedKey[1],
        key:          decodeURIComponent(parsedKey[2]),
        domain:       decodeURIComponent(parsedKey[3]),
        path:         decodeURIComponent(parsedKey[4]),
        expires:      parsedKey[5] ? new Date(parseInt(parsedKey[5], TIME_RADIX)) : 'Infinity',
        lastAccessed: new Date(parseInt(parsedKey[6], TIME_RADIX)),
        value:        parsedCookie.join('='),
        syncKey:      key,

        cookieStr
    };
}

export function applySyncType (cookie) {
    const newSyncTypeStr = stringifySyncType(cookie);

    cookie.syncKey   = cookie.syncKey.replace(SYNCHRONIZATION_TYPE_RE, newSyncTypeStr);
    cookie.cookieStr = cookie.cookieStr.replace(SYNCHRONIZATION_TYPE_RE, newSyncTypeStr);
}

export function isOutdatedSyncCookie (currentCookie, newCookie) {
    return newCookie.isServerSync === currentCookie.isServerSync &&
           newCookie.sid === currentCookie.sid &&
           newCookie.key === currentCookie.key &&
           newCookie.domain === currentCookie.domain &&
           newCookie.path === currentCookie.path &&
           newCookie.lastAccessed > currentCookie.lastAccessed;
}

export function generateDeleteSyncCookieStr (cookie) {
    return cookie.syncKey + CLEAR_COOKIE_VALUE_STR;
}
