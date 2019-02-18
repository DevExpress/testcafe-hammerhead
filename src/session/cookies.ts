import { CookieJar, Cookie } from 'tough-cookie';
import BYTES_PER_COOKIE_LIMIT from './cookie-limit';
import { castArray } from 'lodash';
import { parseUrl } from '../utils/url';

const LOCALHOST_DOMAIN: string = 'localhost';
const LOCALHOST_IP: string     = '127.0.0.1';

export default class Cookies {
    private _cookieJar: any;

    constructor () {
        this._cookieJar = new CookieJar();
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
        return JSON.stringify(this._cookieJar.serializeSync());
    }

    setJar (serializedJar): void {
        this._cookieJar = serializedJar
            ? CookieJar.deserializeSync(JSON.parse(serializedJar))
            : new CookieJar();
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
