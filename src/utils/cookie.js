// -------------------------------------------------------------
// WARNING: this file is used by both the client and the server.
// Do not use any browser or node-specific API!
// -------------------------------------------------------------

import trim from './string-trim';

const SERVER_SYNCHRONIZATION_FLAG = 's';
const CLIENT_SYNCHRONIZATION_FLAG = 'c';

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
    const flag         = cookie.isServerSync ? SERVER_SYNCHRONIZATION_FLAG : CLIENT_SYNCHRONIZATION_FLAG;
    const key          = encodeURIComponent(cookie.key);
    const domain       = encodeURIComponent(cookie.domain);
    const path         = encodeURIComponent(cookie.path);
    const expires      = cookie.expires !== 'Infinity' ? cookie.expires.getTime() : '';
    const lastAccessed = cookie.lastAccessed.getTime();

    return `${flag}|${cookie.sid}|${key}|${domain}|${path}|${expires}|${lastAccessed}=${cookie.value};path=/`;
}

export function parseSyncCookie (cookieStr) {
    const parsedCookie = cookieStr.split('=');
    const key          = parsedCookie.length < 2 ? '' : parsedCookie.shift();
    const parsedKey    = key.split('|');

    if (parsedKey.length !== 7)
        return null;

    return {
        isServerSync: parsedKey[0] === SERVER_SYNCHRONIZATION_FLAG,
        sid:          parsedKey[1],
        key:          decodeURIComponent(parsedKey[2]),
        domain:       decodeURIComponent(parsedKey[3]),
        path:         decodeURIComponent(parsedKey[4]),
        expires:      parsedKey[5] ? new Date(parseInt(parsedKey[5], 10)) : 'Infinity',
        lastAccessed: new Date(parseInt(parsedKey[6], 10)),
        value:        parsedCookie.join('='),
        syncKey:      key
    };
}

export function isObsoleteSyncCookie (currentCookie, newCookie) {
    return newCookie.isServerSync === currentCookie.isServerSync &&
           newCookie.sid === currentCookie.sid &&
           newCookie.key === currentCookie.key &&
           newCookie.domain === currentCookie.domain &&
           newCookie.path === currentCookie.path &&
           newCookie.lastAccessed > currentCookie.lastAccessed;
}

export function deleteSyncCookie (cookie) {
    return cookie.syncKey + '=;path=/;expires=Thu, 01 Jan 1970 00:00:01 GMT';
}

export function processServerCookie (ctx, parsedCookies) {
    parsedCookies = parsedCookies.filter(cookie => !cookie.httpOnly);

    const syncWithClientCookies = parsedCookies
        .map(cookie => {
            cookie.isServerSync = true;
            cookie.sid          = ctx.session.id;

            return formatSyncCookie(cookie);
        });

    const obsoleteSyncCookies = ctx.req.headers.cookie
        ? parseClientSyncCookieStr(ctx.req.headers.cookie)
            .filter(clientCookie => {
                for (const serverCookie of parsedCookies) {
                    if (isObsoleteSyncCookie(clientCookie, serverCookie))
                        return true;
                }

                return false;
            })
            .map(deleteSyncCookie)
        : [];

    return obsoleteSyncCookies.concat(syncWithClientCookies);
}
