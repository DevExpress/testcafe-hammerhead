import SandboxBase from './base';
import COMMAND from '../../session/command';
import settings from '../settings';
import * as destLocation from '../utils/destination-location';
import * as cookieUtils from '../utils/cookie';
import { isCrossDomainWindows } from '../utils/dom';
import transport from '../transport';
import trim from '../../utils/string-trim';

export default class CookieSandbox extends SandboxBase {
    _getSettings () {
        var windowSettings = this.window !== this.window.top && !isCrossDomainWindows(this.window, this.window.top) ?
                             this.window.top['%hammerhead%'].get('./settings') : settings;

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

        if (processedByBrowserCookieStr)
            return processedByBrowserCookieStr.substr(uniquePrefix.length);

        return null;
    }

    // NOTE: Perform validations that can't be processed by a browser due to proxying.
    static _isValidCookie (parsedCookie, document) {
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

        // NOTE: Add a protocol portion to the domain, so that we can use urlUtils for the same origin check.
        var domain = parsedCookie.domain && 'http://' + parsedCookie.domain;

        // NOTE: All Hammerhad sessions have the same domain, so we need to validate the Domain attribute manually
        // according to a test url.
        return !domain || destLocation.sameOriginCheck(document.location.toString(), domain);
    }

    _updateClientCookieStr (cookieKey, newCookieStr) {
        var cookies  = this._getSettings().cookie ? this._getSettings().cookie.split(';') : [];
        var replaced = false;

        // NOTE: Replace a cookie if it already exists.
        for (var i = 0; i < cookies.length; i++) {
            cookies[i] = trim(cookies[i]);

            if (cookies[i].indexOf(cookieKey + '=') === 0 || cookies[i] === cookieKey) {
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

    setCookie (document, value) {
        // NOTE: First, update our client cookies cache with a client-validated cookie string,
        // so that sync code can immediately access cookies.
        var parsedCookie = cookieUtils.parse(value);

        if (CookieSandbox._isValidCookie(parsedCookie, document)) {
            // NOTE: These attributes don't have to be processed by a browser.
            delete parsedCookie.secure;
            delete parsedCookie.domain;

            var clientCookieStr = CookieSandbox._getBrowserProcessedCookie(parsedCookie, document);

            if (!clientCookieStr) {
                // NOTE: We have two options here:
                // 1)cookie was invalid, so it was ignored;
                // 2)cookie was deleted by setting the Expired attribute;
                // We need to check the second option and delete cookie in our cookie string manually.
                delete parsedCookie.expires;

                // NOTE: We should delete a cookie.
                if (CookieSandbox._getBrowserProcessedCookie(parsedCookie, document))
                    this._updateClientCookieStr(parsedCookie.key, null);

            }
            else
                this._updateClientCookieStr(parsedCookie.key, clientCookieStr);
        }

        var setCookieMsg = {
            cmd:    COMMAND.setCookie,
            cookie: value,
            url:    document.location.href
        };

        // NOTE: Meanwhile, synchronize cookies with the server cookie jar.
        transport.queuedAsyncServiceMsg(setCookieMsg);

        return value;
    }
}
