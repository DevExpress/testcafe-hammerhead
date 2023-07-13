import { CookieJar, Cookie } from 'tough-cookie';
import BYTES_PER_COOKIE_LIMIT from './cookie-limit';
import { castArray, flattenDeep } from 'lodash';
import { parseUrl } from '../utils/url';
import { parse as parseJSON, stringify as stringifyJSON } from '../utils/json';
import { URL } from 'url';
import { DestInfo } from '../request-pipeline/context';
import { parseClientSyncCookieStr } from '../utils/cookie';

const LOCALHOST_DOMAIN = 'localhost';
const LOCALHOST_IP     = '127.0.0.1';

interface ExternalCookies {
    name?: string;
    value?: string;
    domain?: string;
    path?: string;
    expires?: Date;
    maxAge?: number | 'Infinity' | '-Infinity';
    secure?: boolean;
    httpOnly?: boolean;
    sameSite?: string;
}

interface Url {
    domain: string;
    path: string;
}

export default class Cookies {
    private _cookieJar: any;
    private readonly _findCookieSync: any;
    private readonly _findCookiesSync: any;
    private readonly _getAllCookiesSync: any;
    private readonly _putCookieSync: any;
    private readonly _removeCookieSync: any;
    private readonly _removeAllCookiesSync: any;
    private _pendingSyncCookies: Cookie[];

    constructor () {
        this._cookieJar            = new CookieJar();
        this._findCookieSync       = this._syncWrap('findCookie');
        this._findCookiesSync      = this._syncWrap('findCookies');
        this._getAllCookiesSync    = this._syncWrap('getAllCookies');
        this._putCookieSync        = this._syncWrap('putCookie');
        this._removeCookieSync     = this._syncWrap('removeCookie');
        this._removeAllCookiesSync = this._syncWrap('removeAllCookies');
        this._pendingSyncCookies   = [];
    }

    _syncWrap (method: string) {
        return (...args) => {
            let syncErr;
            let syncResult;

            this._cookieJar.store[method](...args, (err, result) => {
                syncErr    = err;
                syncResult = result;
            });

            if (syncErr)
                throw syncErr;

            return syncResult;
        };
    }

    static _isLocalHostDomain = (domain): boolean => domain === LOCALHOST_DOMAIN || domain === LOCALHOST_IP;

    static _hasLocalhostDomain (cookie): boolean {
        if (cookie)
            return this._isLocalHostDomain(cookie.domain);

        return false;
    }

    _set (url, cookies, isClient: boolean) {
        cookies = castArray(cookies);

        return cookies.reduce((resultCookies, cookieStr) => {
            let cookie;

            if (!isClient) {
                if (cookieStr.length > BYTES_PER_COOKIE_LIMIT)
                    return resultCookies;

                cookie = Cookie.parse(cookieStr, { loose: true });

                if (!cookie)
                    return resultCookies;
            }
            else
                cookie = cookieStr;

            // NOTE: If cookie.domain and url hostname are equal to localhost/127.0.0.1,
            // we should remove 'Domain=...' form cookieStr (GH-1491)
            if (Cookies._hasLocalhostDomain(cookie) && (isClient || parseUrl(url).hostname === cookie.domain))
                cookie.domain = '';

            const parsedCookie = this._cookieJar.setCookieSync(cookie, url, {
                http:        !isClient,
                ignoreError: true,
                loose:       true,
            });

            if (parsedCookie)
                resultCookies.push(parsedCookie);

            return resultCookies;
        }, []);
    }

    serializeJar (): string {
        return stringifyJSON(this._cookieJar.serializeSync());
    }

    setJar (serializedJar): void {
        this._cookieJar = serializedJar
            ? CookieJar.deserializeSync(parseJSON(serializedJar))
            : new CookieJar();
    }

    private _convertToExternalCookies (internalCookies: Cookie[]): ExternalCookies[] {
        return internalCookies.map(cookie => {
            const {
                key, value, domain,
                path, expires, maxAge,
                secure, httpOnly, sameSite,
            } = cookie;

            return {
                name:     key,
                domain:   domain || void 0,
                path:     path || void 0,
                expires:  expires === 'Infinity' ? void 0 : expires,
                maxAge:   maxAge || void 0,
                sameSite: sameSite || 'none',
                value, secure, httpOnly,
            };
        });
    }

    private _convertToCookieProperties (externalCookie: ExternalCookies[]): Cookie.Properties[] {
        return externalCookie.map(cookie => {
            const { name, ...rest } = cookie;

            return name ? { key: name, ...rest } : rest;
        });
    }

    private _findCookiesByApi (urls: Url[], key?: string): (Cookie | Cookie[])[] {
        return urls.map(({ domain, path }) => {
            const cookies = key
                ? this._findCookieSync(domain, path, key)
                : this._findCookiesSync(domain, path);

            return cookies || [];
        });
    }

    private _filterCookies (cookies: Cookie[], filters: Cookie.Properties): Cookie[] {
        const filterKeys = Object.keys(filters) as (keyof Cookie.Properties)[];

        return cookies.filter(cookie => filterKeys.every(key => cookie[key] === filters[key]));
    }

    private _getCookiesByApi (cookie: Cookie.Properties, urls?: Url[], strict = false): Cookie[] {
        const { key, domain, path, ...filters } = cookie;

        const currentUrls = domain && path ? [{ domain, path }] : urls;
        let receivedCookies: Cookie[];

        if (currentUrls?.[0] && (!strict || key))
            receivedCookies = flattenDeep(this._findCookiesByApi(currentUrls, key));
        else {
            receivedCookies = flattenDeep(this._getAllCookiesSync());

            Object.assign(filters, cookie);
        }

        return Object.keys(filters).length ? this._filterCookies(receivedCookies, filters) : receivedCookies;
    }

    getCookies (externalCookies?: ExternalCookies[], urls: string[] = []): Partial<ExternalCookies>[] {
        let resultCookies: Cookie[] = [];

        if (!externalCookies || !externalCookies.length)
            resultCookies = this._getAllCookiesSync();
        else {
            const parsedUrls = urls.map(url => {
                const { hostname, pathname } = new URL(url);

                return { domain: hostname, path: pathname };
            });

            const cookies = this._convertToCookieProperties(externalCookies);

            for (const cookie of cookies) {
                const receivedCookies = this._getCookiesByApi(cookie, parsedUrls);

                resultCookies.push(...receivedCookies);
            }
        }

        return this._convertToExternalCookies(resultCookies);
    }

    setCookies (externalCookies: ExternalCookies[], url?: string): void {
        const cookies = this._convertToCookieProperties(externalCookies);

        const { hostname = '', pathname = '/' } = url ? new URL(url) : {};

        for (const cookie of cookies) {
            if (!cookie.domain && !cookie.path)
                Object.assign(cookie, { domain: hostname, path: pathname });

            const cookieToSet = new Cookie(cookie);
            const cookieStr   = cookieToSet.toString();

            if (cookieStr.length > BYTES_PER_COOKIE_LIMIT)
                break;

            this._putCookieSync(cookieToSet);

            this._pendingSyncCookies.push(cookieToSet);
        }
    }

    deleteCookies (externalCookies?: ExternalCookies[], urls: string[] = []): void { // eslint-disable-line consistent-return
        if (!externalCookies || !externalCookies.length) {
            const deletedCookies = this._getAllCookiesSync();

            this._pendingSyncCookies.push(...deletedCookies);
            return this._removeAllCookiesSync();
        }

        const parsedUrls = urls.map(url => {
            const { hostname, pathname } = new URL(url);

            return { domain: hostname, path: pathname };
        });

        const cookies = this._convertToCookieProperties(externalCookies);

        for (const cookie of cookies) {
            const deletedCookies = this._getCookiesByApi(cookie, parsedUrls, true);

            for (const deletedCookie of deletedCookies) {
                if (deletedCookie.domain && deletedCookie.path && deletedCookie.key) {
                    this._removeCookieSync(deletedCookie.domain, deletedCookie.path, deletedCookie.key);

                    deletedCookie.expires = new Date(0);
                    this._pendingSyncCookies.push(deletedCookie);
                }
            }
        }
    }

    takePendingSyncCookies () {
        const cookies = this._pendingSyncCookies;

        this._pendingSyncCookies = [];

        return cookies;
    }

    setByServer (url: string, cookies) {
        return this._set(url, cookies, false);
    }

    setByClient (syncCookies) {
        for (const syncCookie of syncCookies) {
            const cookie = new Cookie(syncCookie);
            const url    = { hostname: syncCookie.domain, pathname: syncCookie.path };

            this._set(url, cookie, true);
        }
    }

    copySyncCookies (syncCookie: string, toUrl: string) {
        let hostname;
        let pathname;

        try {
            ({ hostname, pathname } = new URL(toUrl));
        }
        catch (e) {
            return;
        }

        const { actual: cookies } = parseClientSyncCookieStr(syncCookie);

        for (const cookie of cookies) {
            const { domain, path, key } = cookie;

            const originCookie = this._findCookieSync(domain, path, key);
            const newCookie    = new Cookie(Object.assign({}, originCookie, { domain: hostname, path: pathname }));

            this._putCookieSync(newCookie);
            this._pendingSyncCookies.push(newCookie);
        }
    }

    getClientString (url: string) {
        return this._cookieJar.getCookieStringSync(url, { http: false });
    }

    getHeader ({ url, hostname }: DestInfo): string | null {
        // NOTE: https://github.com/DevExpress/testcafe-hammerhead/issues/2715
        // Cookies with the secure attribute should be passed to the localhost server(without ssl) or any other server(with ssl).
        // CookieJar only checks the protocol, but not a hostname. That is why we should to add secure attribute in case of localhost.
        const cookieJarOpts = Cookies._isLocalHostDomain(hostname) ?
            { http: true, secure: true } :
            { http: true };

        return this._cookieJar.getCookieStringSync(url, cookieJarOpts) || null;
    }
}
