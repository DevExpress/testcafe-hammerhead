import SandboxBase from './base';
import COMMAND from '../../session/command';
import trim from '../../utils/string-trim';
import urlUtils from '../utils/url';
import settings from '../settings';
import * as cookieUtils from '../utils/cookie';
import { isCrossDomainWindows } from '../utils/dom';
import { queuedAsyncServiceMsg } from '../transport';

export default class CookieSandbox extends SandboxBase {
    _getSettings () {
        var windowSettings = this.window !== this.window.top && !isCrossDomainWindows(this.window, this.window.top) ?
                             this.window.top.Hammerhead.get('./settings') : settings;

        return windowSettings.get();
    }

    //NOTE: let browser validate other stuff (e.g. Path attribute), so we add unique prefix
    //to the cookie key, pass cookie to the browser then clean up and return result.
    static _getBrowserProcessedCookie (parsedCookie, document) {
        var parsedCookieCopy = {};

        for (var prop in parsedCookie) {
            if (parsedCookie.hasOwnProperty(prop))
                parsedCookieCopy[prop] = parsedCookie[prop];
        }

        var uniquePrefix = Math.floor(Math.random() * 1e10) + '|';

        parsedCookieCopy.key = uniquePrefix + parsedCookieCopy.key;

        // NOTE: We must add cookie path prefix to the path because the proxied location path defferent from the
        // destination location path
        if (parsedCookieCopy.path && parsedCookieCopy.path !== '/')
            parsedCookieCopy.path = urlUtils.OriginLocation.getCookiePathPrefix() + parsedCookieCopy.path;

        document.cookie = cookieUtils.format(parsedCookieCopy);

        var processedByBrowserCookieStr = cookieUtils.get(document, parsedCookieCopy.key);

        cookieUtils.del(document, parsedCookieCopy);

        if (processedByBrowserCookieStr)
            return processedByBrowserCookieStr.substr(uniquePrefix.length);

        return null;
    }

    //NOTE: perform validations which can't be processed by browser due to proxying
    static _isValidCookie (parsedCookie, document) {
        if (!parsedCookie)
            return false;

        //NOTE: HttpOnly cookies can't be accessed from client code
        if (parsedCookie.httponly)
            return false;

        var parsedOrigin   = urlUtils.OriginLocation.getParsed();
        var originProtocol = parsedOrigin.protocol;

        //NOTE: TestCafe tunnels HTTPS requests via HTTP so we should validate Secure attribute manually
        if (parsedCookie.secure && originProtocol !== 'https:')
            return false;

        //NOTE: add protocol portion to the domain, so we can use urlUtil for same origin check
        var domain = parsedCookie.domain && 'http://' + parsedCookie.domain;

        //NOTE: all TestCafe sessions has same domain, so we should validate Domain attribute manually
        //according to test url
        return !domain || urlUtils.sameOriginCheck(document.location.toString(), domain);
    }

    _updateClientCookieStr (cookieKey, newCookieStr) {
        var cookies  = this._getSettings().cookie ? this._getSettings().cookie.split(';') : [];
        var replaced = false;

        //NOTE: replace cookie if it's already exists
        for (var i = 0; i < cookies.length; i++) {
            cookies[i] = trim(cookies[i]);

            if (cookies[i].indexOf(cookieKey + '=') === 0 || cookies[i] === cookieKey) {
                //NOTE: delete or update cookie string
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
        //NOTE: at first try to update our client cookie cache with client-validated cookie string,
        //so sync code can immediately access cookie
        var parsedCookie = cookieUtils.parse(value);

        if (CookieSandbox._isValidCookie(parsedCookie, document)) {
            //NOTE: this attributes shouldn't be processed by browser
            delete parsedCookie.secure;
            delete parsedCookie.domain;

            var clientCookieStr = CookieSandbox._getBrowserProcessedCookie(parsedCookie, document);

            if (!clientCookieStr) {
                //NOTE: we have two options here:
                //1)cookie was invalid, so it was ignored
                //2)cookie was deleted by setting Expired attribute
                //We need to check the second option and delete cookie in our cookie string manually
                delete parsedCookie.expires;

                //NOTE: we should delete cookie
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

        //NOTE: meanwhile sync cookies with server cookie jar
        queuedAsyncServiceMsg(setCookieMsg);

        return value;
    }
}


