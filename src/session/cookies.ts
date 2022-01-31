import { CookieJar, Cookie } from 'tough-cookie';
import BYTES_PER_COOKIE_LIMIT from './cookie-limit';
import { castArray, flattenDeep } from 'lodash';
import { parseUrl } from '../utils/url';
import { parse as parseJSON, stringify as stringifyJSON } from '../utils/json';
import { promisify } from 'util';
import { URL } from 'url';

const LOCALHOST_DOMAIN = 'localhost';
const LOCALHOST_IP     = '127.0.0.1';

interface ExternalCookies {
    name: string;
    value: string;
    domain: string;
    path: string;
    expires: Date;
    maxAge: number | 'Infinity' | '-Infinity';
    secure: boolean;
    httpOnly: boolean;
    sameSite: string;
}

export default class Cookies {
    private _cookieJar: any;
    private _findCookiePromisified: any;
    private _findCookiesPromisified: any;
    private _getAllCookiesPromisified: any;
    private _putCookiePromisified: any;
    private _removeCookiePromisified: any;
    private _removeCookiesPromisified: any;
    private _removeAllCookiesPromisified: any;

    constructor () {
        this._cookieJar                   = new CookieJar();
        this._findCookiePromisified       = promisify(this._cookieJar.store.findCookie);
        this._findCookiesPromisified      = promisify(this._cookieJar.store.findCookies);
        this._getAllCookiesPromisified    = promisify(this._cookieJar.store.getAllCookies);
        this._putCookiePromisified        = promisify(this._cookieJar.store.putCookie);
        this._removeCookiePromisified     = promisify(this._cookieJar.store.removeCookie);
        this._removeCookiesPromisified    = promisify(this._cookieJar.store.removeCookies);
        this._removeAllCookiesPromisified = promisify(this._cookieJar.store.removeAllCookies);
    }

    static _hasLocalhostDomain (cookie): boolean {
        if (cookie)
            return cookie.domain === LOCALHOST_DOMAIN || cookie.domain === LOCALHOST_IP;

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
                loose:       true
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

    private _convertToExternalCookies (internalCookies: Cookie.Properties[]): Partial<ExternalCookies>[] {
        return internalCookies.map(cookie => {
            const {
                      key, value, domain,
                      path, expires, maxAge,
                      secure, httpOnly, sameSite,
                  } = cookie;

            return {
                name: key, value, domain,
                path, expires, maxAge,
                secure, httpOnly, sameSite,
            };
        });
    }

    private _convertToInternalCookies (externalCookie: ExternalCookies[]): Cookie.Properties[] {
        return externalCookie.map(cookie => {
            const { name, ...rest } = cookie;

            return { key: name, ...rest };
        });
    }

    private async _findCookiesByApi (urls: { domain: string; path: string }[], key?: string): Promise<(Cookie.Properties | Cookie.Properties[])[]> {
        return Promise.all(urls.map(async ({ domain, path }) => {
            const cookies = key
                            ? await this._findCookiePromisified.call(this._cookieJar.store, domain, path, key)
                            : await this._findCookiesPromisified.call(this._cookieJar.store, domain, path);

            return cookies || [];
        }));
    }

    private _filterCookies (cookies: Cookie.Properties[], filters: Cookie.Properties): Cookie.Properties[] {
        const filterKeys = Object.keys(filters) as (keyof Cookie.Properties)[];

        return cookies.filter(cookie => filterKeys.every(key => cookie[key] === filters[key]));
    }

    private async _getCookiesByApi (cookie: Cookie.Properties, urls?: { domain: string; path: string }[]): Promise<Cookie.Properties[]> {
        const { key, domain, path, ...filters } = cookie;

        const currentUrls = domain && path ? castArray({ domain, path }) : urls;
        let receivedCookies: Cookie.Properties[];

        if (currentUrls && currentUrls.length)
            receivedCookies = flattenDeep(await this._findCookiesByApi(currentUrls, key));
        else {
            receivedCookies = flattenDeep(await this._getAllCookiesPromisified.call(this._cookieJar.store));

            Object.assign(filters, cookie);
        }

        return Object.keys(filters).length ? this._filterCookies(receivedCookies, filters) : receivedCookies;
    }

    private async _deleteCookiesByApi (urls: { domain: string; path: string }[], key?: string): Promise<void[]> {
        return Promise.all(urls.map(async ({ domain, path }) => {
            return key
                   ? this._removeCookiePromisified.call(this._cookieJar.store, domain, path, key)
                   : this._removeCookiesPromisified.call(this._cookieJar.store, domain, path);
        }));
    }

    async getCookies (externalCookies?: ExternalCookies[], urls: string[] = []): Promise<Partial<ExternalCookies>[]> {
        let resultCookies: Cookie.Properties[] = [];

        if (!externalCookies || !externalCookies.length)
            resultCookies = await this._getAllCookiesPromisified.call(this._cookieJar.store);
        else {
            const parsedUrls = urls.map(url => {
                const { hostname, pathname } = new URL(url);

                return { domain: hostname, path: pathname };
            });

            const cookies = this._convertToInternalCookies(externalCookies);

            for (const cookie of cookies) {
                const receivedCookies = await this._getCookiesByApi(cookie, parsedUrls);

                resultCookies.push(...receivedCookies);
            }
        }

        return this._convertToExternalCookies(resultCookies);
    }

    async setCookies (externalCookies: ExternalCookies[], url?: string): Promise<void> {
        const cookies = this._convertToInternalCookies(externalCookies);

        const { hostname = '', pathname = '/' } = url ? new URL(url) : {};

        for (const cookie of cookies) {
            if (!cookie.domain && !cookie.path)
                Object.assign(cookie, { domain: hostname, path: pathname });

            const cookieToSet = new Cookie(cookie);
            const cookieStr   = cookieToSet.toString();

            if (cookieStr.length > BYTES_PER_COOKIE_LIMIT)
                break;

            await this._putCookiePromisified.call(this._cookieJar.store, cookieToSet);
        }
    }

    async deleteCookies (externalCookies?: ExternalCookies[], urls: string[] = []): Promise<void> {
        if (!externalCookies || !externalCookies.length)
            return this._removeAllCookiesPromisified.call(this._cookieJar.store);

        const parsedUrls = urls.map(url => {
            const { hostname, pathname } = new URL(url);

            return { domain: hostname, path: pathname };
        });

        const cookies = this._convertToInternalCookies(externalCookies);

        for (const cookie of cookies) {
            const { key, domain, path, ...filters } = cookie;

            const currentUrls  = domain && path ? castArray({ domain, path }) : parsedUrls;

            if (currentUrls.length && !Object.keys(filters).length)
                await this._deleteCookiesByApi(currentUrls, key);
            else {
                const deletedCookies = await this._getCookiesByApi(cookie, parsedUrls);

                for (const deletedCookie of deletedCookies) {
                    if (deletedCookie.domain && deletedCookie.path && deletedCookie.key)
                        await this._removeCookiePromisified.call(this._cookieJar.store, deletedCookie.domain, deletedCookie.path, deletedCookie.key);
                }
            }
        }
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

    getClientString (url: string) {
        return this._cookieJar.getCookieStringSync(url, { http: false });
    }

    getHeader (url: string): string | null {
        return this._cookieJar.getCookieStringSync(url, { http: true }) || null;
    }
}
