import { CookieJar, Cookie } from 'tough-cookie';
import BYTES_PER_COOKIE_LIMIT from './cookie-limit';
import { castArray } from 'lodash';
import { parseUrl } from '../utils/url';

const LOCALHOST_DOMAIN = 'localhost';
const LOCALHOST_IP     = '127.0.0.1';

export default class Cookies {
    constructor () {
        this.cookieJar = new CookieJar();
    }

    static _hasLocalhostDomain (cookie) {
        if (cookie)
            return cookie.domain === LOCALHOST_DOMAIN || cookie.domain === LOCALHOST_IP;

        return false;
    }

    _set (url, cookies, isClient) {
        cookies = castArray(cookies);

        cookies.forEach(cookieStr => {
            if (cookieStr.length > BYTES_PER_COOKIE_LIMIT)
                return;

            const cookie = Cookie.parse(cookieStr);

            // NOTE: If cookie.domain and url hostname are equal to localhost/127.0.0.1,
            // we should remove 'Domain=...' form cookieStr (GH-1491)
            if (Cookies._hasLocalhostDomain(cookie) && parseUrl(url).hostname === cookie.domain) {
                cookie.domain = '';
                cookieStr     = cookie.toString();
            }

            this.cookieJar.setCookieSync(cookieStr, url, {
                http:        !isClient,
                ignoreError: true,
                loose:       true
            });
        });
    }

    serializeJar () {
        return JSON.stringify(this.cookieJar.serializeSync());
    }

    setJar (serializedJar) {
        this.cookieJar = serializedJar
            ? CookieJar.deserializeSync(JSON.parse(serializedJar))
            : new CookieJar();
    }

    setByServer (url, cookies) {
        this._set(url, cookies, false);
    }

    setByClient (url, cookies) {
        this._set(url, cookies, true);
    }

    getClientString (url) {
        return this.cookieJar.getCookieStringSync(url, { http: false });
    }

    getHeader (url) {
        return this.cookieJar.getCookieStringSync(url, { http: true }) || null;
    }
}
