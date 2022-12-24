// -------------------------------------------------------------
// WARNING: this file is used by both the client and the server.
// Do not use any browser or node-specific API!
// -------------------------------------------------------------

import trim from './string-trim';
import { CookieRecord, ParsedClientSyncCookie } from '../typings/cookie';
import { isNil } from 'lodash';

const TIME_RADIX                            = 36;
const CLEAR_COOKIE_VALUE_STR                = '=;path=/;expires=Thu, 01 Jan 1970 00:00:01 GMT';
const CLIENT_COOKIE_SYNC_KEY_FRAGMENT_COUNT = 8;
const KEY_VALUE_REGEX                       = /(?:^([^=]+)=([\s\S]*))?/;

export const SYNCHRONIZATION_TYPE = {
    server: 's',
    client: 'c',
    window: 'w',
};

const SYNCHRONIZATION_TYPE_RE = new RegExp(`^[${SYNCHRONIZATION_TYPE.server}${SYNCHRONIZATION_TYPE.client}${SYNCHRONIZATION_TYPE.window}]+`);

function isSameCookies (cookie1: CookieRecord, cookie2: CookieRecord): boolean {
    return cookie1.sid === cookie2.sid &&
           cookie1.key === cookie2.key &&
           cookie1.domain === cookie2.domain &&
           cookie1.path === cookie2.path;
}

function sortByOutdatedAndActual (parsedCookies: CookieRecord[]): ParsedClientSyncCookie {
    const outdated = [] as CookieRecord[];
    const actual   = [] as CookieRecord[];

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

function stringifySyncType (cookie: CookieRecord): string {
    return (cookie.isServerSync ? SYNCHRONIZATION_TYPE.server : '') +
           (cookie.isClientSync ? SYNCHRONIZATION_TYPE.client : '') +
           (cookie.isWindowSync ? SYNCHRONIZATION_TYPE.window : '');
}

function formatSyncCookieKey (cookie: CookieRecord): string {
    const syncType     = stringifySyncType(cookie);
    const key          = encodeURIComponent(cookie.key);
    const domain       = encodeURIComponent(cookie.domain);
    const path         = encodeURIComponent(cookie.path);
    const expires      = cookie.expires !== 'Infinity' ? cookie.expires.getTime().toString(TIME_RADIX) : '';
    const lastAccessed = cookie.lastAccessed.getTime().toString(TIME_RADIX);
    const maxAge       = !isNil(cookie.maxAge) && !isNaN(Number(cookie.maxAge)) && String(cookie.maxAge) !== 'Infinity' ? cookie.maxAge.toString(TIME_RADIX) : '';

    return `${syncType}|${cookie.sid}|${key}|${domain}|${path}|${expires}|${lastAccessed}|${maxAge}`;
}

export function parseClientSyncCookieStr (cookieStr: string): ParsedClientSyncCookie {
    const cookies       = cookieStr ? cookieStr.split(';') : '';
    const parsedCookies = [] as CookieRecord[];

    for (const cookie of cookies) {
        const parsedCookie = parseSyncCookie(trim(cookie));

        if (parsedCookie)
            parsedCookies.push(parsedCookie);
    }

    return sortByOutdatedAndActual(parsedCookies);
}

export function prepareSyncCookieProperties (cookie: CookieRecord): void {
    cookie.syncKey   = cookie.syncKey || formatSyncCookieKey(cookie);
    cookie.cookieStr = cookie.cookieStr || `${cookie.syncKey}=${cookie.value}`;
}

export function formatSyncCookie (cookie: CookieRecord): string {
    if (cookie.cookieStr)
        return `${cookie.cookieStr};path=/`;

    return `${formatSyncCookieKey(cookie)}=${cookie.value};path=/`;
}

export function parseSyncCookie (cookieStr: string): CookieRecord | null {
    const [, key, value] = KEY_VALUE_REGEX.exec(cookieStr) || [];
    const parsedKey      = key !== void 0 && value !== void 0 && key.split('|') as any;

    if (parsedKey && parsedKey.length !== CLIENT_COOKIE_SYNC_KEY_FRAGMENT_COUNT)
        return null;

    return {
        isServerSync: parsedKey[0].indexOf(SYNCHRONIZATION_TYPE.server) > -1,
        isClientSync: parsedKey[0].indexOf(SYNCHRONIZATION_TYPE.client) > -1,
        isWindowSync: parsedKey[0].indexOf(SYNCHRONIZATION_TYPE.window) > -1,
        sid:          parsedKey[1],
        key:          decodeURIComponent(parsedKey[2]),
        domain:       decodeURIComponent(parsedKey[3]),
        path:         decodeURIComponent(parsedKey[4]),
        expires:      parsedKey[5] ? new Date(parseInt(parsedKey[5], TIME_RADIX)) : 'Infinity',
        lastAccessed: new Date(parseInt(parsedKey[6], TIME_RADIX)),
        maxAge:       parsedKey[7] ? parseInt(parsedKey[7], TIME_RADIX) : null,
        syncKey:      key,

        value,
        cookieStr,
    };
}

export function changeSyncType (parsedCookie: CookieRecord, flags): void {
    if ('server' in flags)
        parsedCookie.isServerSync = flags.server;

    if ('client' in flags)
        parsedCookie.isClientSync = flags.client;

    if ('window' in flags)
        parsedCookie.isWindowSync = flags.window;

    const newSyncTypeStr = stringifySyncType(parsedCookie);

    parsedCookie.syncKey   = parsedCookie.syncKey?.replace(SYNCHRONIZATION_TYPE_RE, newSyncTypeStr);
    parsedCookie.cookieStr = parsedCookie.cookieStr?.replace(SYNCHRONIZATION_TYPE_RE, newSyncTypeStr);
}

export function isOutdatedSyncCookie (currentCookie: CookieRecord, newCookie: CookieRecord): boolean {
    return newCookie.isServerSync === currentCookie.isServerSync &&
           newCookie.sid === currentCookie.sid &&
           newCookie.key === currentCookie.key &&
           newCookie.domain === currentCookie.domain &&
           newCookie.path === currentCookie.path &&
           newCookie.lastAccessed > currentCookie.lastAccessed;
}

export function generateDeleteSyncCookieStr (cookie: CookieRecord): string {
    return cookie.syncKey + CLEAR_COOKIE_VALUE_STR;
}
