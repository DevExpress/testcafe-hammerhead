// -------------------------------------------------------------
// WARNING: this file is used by both the client and the server.
// Do not use any browser or node-specific API!
// -------------------------------------------------------------

import trim from './string-trim';

const TIME_RADIX             = 36;
const CLEAR_COOKIE_VALUE_STR = '=;path=/;expires=Thu, 01 Jan 1970 00:00:01 GMT';
const SYNCHRONIZATION_TYPE   = {
    server: 's',
    client: 'c'
};

export function parseClientSyncCookieStr (cookieStr) {
    const cookies       = cookieStr ? cookieStr.split(';') : '';
    const parsedCookies = [];

    for (const cookie of cookies) {
        const parsedCookie = parseSyncCookie(trim(cookie));

        if (parsedCookie)
            parsedCookies.push(parsedCookie);
    }

    return parsedCookies;
}

export function formatSyncCookie (cookie) {
    const syncType     = cookie.isServerSync ? SYNCHRONIZATION_TYPE.server : SYNCHRONIZATION_TYPE.client;
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
        isServerSync: parsedKey[0] === SYNCHRONIZATION_TYPE.server,
        sid:          parsedKey[1],
        key:          decodeURIComponent(parsedKey[2]),
        domain:       decodeURIComponent(parsedKey[3]),
        path:         decodeURIComponent(parsedKey[4]),
        expires:      parsedKey[5] ? new Date(parseInt(parsedKey[5], TIME_RADIX)) : 'Infinity',
        lastAccessed: new Date(parseInt(parsedKey[6], TIME_RADIX)),
        value:        parsedCookie.join('='),
        syncKey:      key
    };
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
