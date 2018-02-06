import { CookieJar } from 'tough-cookie';
import BYTES_PER_COOKIE_LIMIT from './cookie-limit';
import castArray from 'cast-array';

export default class Cookies {
    constructor () {
        this.cookieJar = new CookieJar();
    }

    _set (url, cookies, isClient) {
        cookies = castArray(cookies);

        cookies.forEach(cookieStr => {
            if (cookieStr.length > BYTES_PER_COOKIE_LIMIT)
                return;

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
        this.cookieJar = serializedJar ?
                         CookieJar.deserializeSync(JSON.parse(serializedJar)) :
                         new CookieJar();
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
