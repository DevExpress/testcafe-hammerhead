import { CookieJar, Cookie } from 'tough-cookie';
import BYTES_PER_COOKIE_LIMIT from './cookie-limit';
import { castArray } from 'lodash';
import { parseUrl } from '../utils/url';
import { parse as parseJSON, stringify as stringifyJSON } from '../utils/json';
import { promisify } from 'util';

const LOCALHOST_DOMAIN = 'localhost';
const LOCALHOST_IP     = '127.0.0.1';

export default class Cookies {
    private _cookieJar: any;
    private _getCookiesPromisified: any;
    private _getAllCookiesPromisified: any;
    private _removeCookiePromisified: any;
    private _removeCookiesPromisified: any;

    constructor () {
        this._cookieJar = new CookieJar();

        this._getCookiesPromisified    = promisify(this._cookieJar.getCookies);
        this._getAllCookiesPromisified = promisify(this._cookieJar.store.getAllCookies);
        this._removeCookiePromisified  = promisify(this._cookieJar.store.removeCookie);
        this._removeCookiesPromisified = promisify(this._cookieJar.store.removeCookies);
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

    setByServer (url: string, cookies) {
        return this._set(url, cookies, false);
    }

    getCookiesByApi (urls: string) {
        return this._getCookiesPromisified.call(this._cookieJar, urls);
    }

    async getAllCookiesByApi () {
        return await this._getAllCookiesPromisified.call(this._cookieJar.store);
    }

    setCookiesByApi (url: string, apiCookies) {
        apiCookies = castArray(apiCookies);

        const cookiesToSet: string[] = apiCookies.map(apiCookie => {
            apiCookie.key = apiCookie.name;

            delete apiCookie.name;

            return new Cookie(apiCookie).toString();
        })

        this._set(url, cookiesToSet, false);
    }

    async deleteCookieByApi () {
        await this._removeCookiePromisified.apply(this._cookieJar.store, arguments);
    }

    // TODO: unused in the second API variant, remove it
    async deleteCookiesByApi () {
        await this._removeCookiesPromisified.apply(this._cookieJar.store, arguments);
    }

    deleteAllCookiesByApi () {
        this._cookieJar.removeAllCookiesSync();
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
