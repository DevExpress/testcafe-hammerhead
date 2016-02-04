import { CookieJar } from 'tough-cookie';
import COOKIE_HIDDEN_INPUT_NAME from './hidden-input-name';
import urlUtils from 'url';

export default class Cookies {
    constructor () {
        this.cookieJar = new CookieJar();
    }

    _set (url, cookies, isClient) {
        cookies = Array.isArray(cookies) ? cookies : [cookies];

        cookies.forEach(cookieStr => {
            this.cookieJar.setCookieSync(cookieStr, url, {
                http:        !isClient,
                ignoreError: true
            });
        });
    }

    extractFromRequest (url, method, reqBody) {
        var cookieInfo = null;

        if (method === 'GET') {
            var query = urlUtils.parse(url, true).query;

            cookieInfo = query[COOKIE_HIDDEN_INPUT_NAME];
        }
        else if (method === 'POST') {
            var regEx   = new RegExp(COOKIE_HIDDEN_INPUT_NAME + '=([^;]*(;|$))');
            var matches = reqBody.match(regEx);

            if (matches)
                cookieInfo = decodeURIComponent(matches[1]);
        }

        if (cookieInfo) {
            cookieInfo = JSON.parse(cookieInfo);

            this.setByClient(cookieInfo.url, cookieInfo.cookie.split(';'));
        }
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
