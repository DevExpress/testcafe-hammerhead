import SandboxBase from '../base';
import settings from '../../settings';
import CookieSync from './cookie-sync';
import * as destLocation from '../../utils/destination-location';
import * as cookieUtils from '../../utils/cookie';
import { isCrossDomainWindows } from '../../utils/dom';
import trim from '../../../utils/string-trim';
import INTERNAL_PROPS from '../../../processing/dom/internal-properties';
import BYTES_PER_COOKIE_LIMIT from '../../../session/cookie-limit';

export default class CookieSandbox extends SandboxBase {
    constructor () {
        super();

        this.cookieSync = new CookieSync();
    }

    _getSettings () {
        var windowSettings = this.window !== this.window.top && !isCrossDomainWindows(this.window, this.window.top) ?
                             this.window.top[INTERNAL_PROPS.hammerhead].get('./settings') : settings;

        return windowSettings.get();
    }

    // NOTE: Let a browser validate other stuff (e.g. the Path attribute). For this purpose, we add a unique prefix
    // to the cookie key, pass cookies to the browser, then clean up the cookies and return a result.
    static _getBrowserProcessedCookie (parsedCookie, document) {
        var parsedCookieCopy = {};

        for (var prop in parsedCookie) {
            if (parsedCookie.hasOwnProperty(prop))
                parsedCookieCopy[prop] = parsedCookie[prop];
        }

        var uniquePrefix = Math.floor(Math.random() * 1e10) + '|';

        parsedCookieCopy.key = uniquePrefix + parsedCookieCopy.key;

        // NOTE: We must add a cookie path prefix to the path because the proxied location path differs from the
        // destination location path.
        if (parsedCookieCopy.path && parsedCookieCopy.path !== '/')
            parsedCookieCopy.path = destLocation.getCookiePathPrefix() + parsedCookieCopy.path;

        document.cookie = cookieUtils.format(parsedCookieCopy);

        var processedByBrowserCookieStr = cookieUtils.get(document, parsedCookieCopy.key);

        cookieUtils.del(document, parsedCookieCopy);

        if (processedByBrowserCookieStr) {
            // NOTE: We need to remove the '=' char if the key is empty
            var startCookiePos = parsedCookie.key === '' ? uniquePrefix.length + 1 : uniquePrefix.length;

            return processedByBrowserCookieStr.substr(startCookiePos);
        }

        return null;
    }

    // NOTE: Perform validations that can't be processed by a browser due to proxying.
    static _isValidCookie (parsedCookie) {
        if (!parsedCookie)
            return false;

        // NOTE: HttpOnly cookies can't be accessed from the client code.
        if (parsedCookie.httponly)
            return false;

        var parsedDestLocation = destLocation.getParsed();
        var destProtocol       = parsedDestLocation.protocol;

        // NOTE: Hammerhead tunnels HTTPS requests via HTTP, so we need to validate the Secure attribute manually.
        if (parsedCookie.secure && destProtocol !== 'https:')
            return false;

        // NOTE: Add a relative protocol portion to the domain, so that we can use urlUtils for the same origin check.
        var domain = parsedCookie.domain && '//' + parsedCookie.domain;


        // NOTE: All Hammerhad sessions have the same domain, so we need to validate the Domain attribute manually
        // according to a test url.
        return !domain || destLocation.sameOriginCheck(destLocation.get(), domain);
    }

    _updateClientCookieStr (cookieKey, newCookieStr) {
        var cookies   = this._getSettings().cookie ? this._getSettings().cookie.split(';') : [];
        var replaced  = false;
        var searchStr = cookieKey === '' ? null : cookieKey + '=';

        // NOTE: Replace a cookie if it already exists.
        for (var i = 0; i < cookies.length; i++) {
            cookies[i] = trim(cookies[i]);

            var isCookieExists = searchStr ? cookies[i].indexOf(searchStr) === 0 : cookies[i].indexOf('=') === -1;

            if (isCookieExists) {
                // NOTE: Delete or update a cookie string.
                if (newCookieStr === null)
                    cookies.splice(i, 1);
                else
                    cookies[i] = newCookieStr;

                replaced = true;
            }
        }

        if (!replaced && newCookieStr !== null)
            cookies.push(newCookieStr);

        this._getSettings().cookie = cookies.join('; ');
    }

    getCookie () {
        return this._getSettings().cookie;
    }

    setCookie (document, value, syncWithServer) {
        if (value.length > BYTES_PER_COOKIE_LIMIT || destLocation.getParsed().protocol === 'file:')
            return value;

        // NOTE: First, update our client cookies cache with a client-validated cookie string,
        // so that sync code can immediately access cookies.
        var parsedCookie = cookieUtils.parse(value);

        if (CookieSandbox._isValidCookie(parsedCookie)) {
            // NOTE: These attributes don't have to be processed by a browser.
            delete parsedCookie.secure;
            delete parsedCookie.domain;

            var clientCookieStr = CookieSandbox._getBrowserProcessedCookie(parsedCookie, document);

            if (clientCookieStr === null) {
                // NOTE: We have two options here:
                // 1)cookie was invalid, so it was ignored;
                // 2)cookie was deleted by setting the Expired attribute;
                // We need to check the second option and delete cookie in our cookie string manually.
                delete parsedCookie.expires;

                // NOTE: We should delete a cookie.
                if (CookieSandbox._getBrowserProcessedCookie(parsedCookie, document) !== null)
                    this._updateClientCookieStr(parsedCookie.key, null);
            }
            else
                this._updateClientCookieStr(parsedCookie.key, clientCookieStr);
        }

        if (syncWithServer) {
            // NOTE: Meanwhile, synchronize cookies with the server cookie jar.
            this.cookieSync.perform({
                cookie: value,
                url:    document.location.href
            });
        }

        return value;
    }
}
