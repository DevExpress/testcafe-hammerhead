import Promise from 'pinkie';
import SandboxBase from '../base';
import settings from '../../settings';
import CookieSync from './cookie-sync';
import WindowSync from './window-sync';
import * as destLocation from '../../utils/destination-location';
import * as cookieUtils from '../../utils/cookie';
import trim from '../../../utils/string-trim';
import BYTES_PER_COOKIE_LIMIT from '../../../session/cookie-limit';
import nativeMethods from '../../sandbox/native-methods';
import {
    changeSyncType,
    formatSyncCookie,
    generateDeleteSyncCookieStr,
    parseClientSyncCookieStr
} from '../../../utils/cookie';

const MIN_DATE_VALUE = new nativeMethods.date(0).toUTCString(); // eslint-disable-line new-cap

export default class CookieSandbox extends SandboxBase {
    constructor (messageSandbox) {
        super();

        this.messageSandbox = messageSandbox;
        this.cookieSync     = new CookieSync();
        this.windowSync     = null;

        this.pendingWindowSync = [];
    }

    // NOTE: Perform validations that can't be processed by a browser due to proxying.
    static _isValidCookie (parsedCookie) {
        if (!parsedCookie)
            return false;

        // NOTE: HttpOnly cookies can't be accessed from the client code.
        if (parsedCookie.httpOnly)
            return false;

        const parsedDestLocation = destLocation.getParsed();
        const destProtocol       = parsedDestLocation.protocol; // eslint-disable-line no-restricted-properties

        // NOTE: Hammerhead tunnels HTTPS requests via HTTP, so we need to validate the Secure attribute manually.
        if (parsedCookie.secure && destProtocol !== 'https:')
            return false;

        // eslint-disable-next-line no-restricted-properties
        if (parsedCookie.path && !cookieUtils.pathMatch(parsedDestLocation.pathname, parsedCookie.path))
            return false;

        // NOTE: All Hammerhad sessions have the same domain, so we need to validate the Domain attribute manually
        // according to a test url.
        // eslint-disable-next-line no-restricted-properties
        return !parsedCookie.domain || cookieUtils.domainMatch(parsedDestLocation.hostname, parsedCookie.domain);
    }

    _canSetCookie (cookie, setByClient) {
        // eslint-disable-next-line no-restricted-properties
        if (setByClient && (cookie.length > BYTES_PER_COOKIE_LIMIT || destLocation.getParsed().protocol === 'file:'))
            return false;

        const clientCookie = `key${nativeMethods.mathRandom.call(nativeMethods.math)}=value`;

        nativeMethods.documentCookieSetter.call(this.document, clientCookie);

        const documentCookieIsEmpty = !nativeMethods.documentCookieGetter.call(this.document);

        if (!documentCookieIsEmpty)
            nativeMethods.documentCookieSetter.call(this.document, `${clientCookie};expires=${MIN_DATE_VALUE}`);

        return !documentCookieIsEmpty;
    }

    _updateClientCookieStr (cookieKey, newCookieStr) {
        // eslint-disable-next-line no-restricted-properties
        const cookieStr = settings.get().cookie;
        const cookies   = cookieStr ? cookieStr.split(';') : [];
        let replaced    = false;
        const searchStr = cookieKey === '' ? null : cookieKey + '=';

        // NOTE: Replace a cookie if it already exists.
        for (let i = 0; i < cookies.length; i++) {
            cookies[i] = trim(cookies[i]);

            const isCookieExists = searchStr ? cookies[i].indexOf(searchStr) === 0 : cookies[i].indexOf('=') === -1;

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

        // eslint-disable-next-line no-restricted-properties
        settings.get().cookie = cookies.join('; ');
    }

    getCookie () {
        this.syncCookie();

        // eslint-disable-next-line no-restricted-properties
        return settings.get().cookie || '';
    }

    setCookie (document, cookie, syncWithServer) {
        const setByClient = typeof cookie === 'string';

        // NOTE: Cookie cannot be set in iframe without src in IE
        // Also cookie cannot be set on a page with 'file:' protocol
        // or if the length of cookie higher than limit
        if (!this._canSetCookie(cookie, setByClient))
            return;

        let parsedCookie;

        // NOTE: First, update our client cookies cache with a client-validated cookie string,
        // so that sync code can immediately access cookies.
        if (setByClient) {
            this.syncCookie();

            parsedCookie = cookieUtils.parse(cookie);
        }
        else
            parsedCookie = cookie;

        if (CookieSandbox._isValidCookie(parsedCookie)) {
            const currentDate   = cookieUtils.getUTCDate();
            let clientCookieStr = null;

            if (!parsedCookie.expires || parsedCookie.expires === 'Infinity' || parsedCookie.expires > currentDate)
                clientCookieStr = cookieUtils.formatClientString(parsedCookie);

            this._updateClientCookieStr(parsedCookie.key, clientCookieStr);
        }

        // NOTE: Meanwhile, synchronize cookies with the server cookie jar.
        if (syncWithServer)
            // eslint-disable-next-line no-restricted-properties
            this.cookieSync.perform({ url: document.location.href, cookie });
    }

    syncCookie () {
        const cookies           = nativeMethods.documentCookieGetter.call(this.document);
        const parsedCookies     = parseClientSyncCookieStr(cookies);
        const sessionId         = settings.get().sessionId;
        const serverSyncCookies = [];

        for (const outdatedCookie of parsedCookies.outdated)
            nativeMethods.documentCookieSetter.call(this.document, generateDeleteSyncCookieStr(outdatedCookie));

        for (const parsedCookie of parsedCookies.actual) {
            if (parsedCookie.sid !== sessionId)
                continue;

            if (parsedCookie.isServerSync)
                serverSyncCookies.push(parsedCookie);
            else if (parsedCookie.isWindowSync)
                this.setCookie(this.document, parsedCookie, false);
        }

        this._syncServerCookie(serverSyncCookies);
    }

    _syncServerCookie (parsedCookies) {
        for (const parsedCookie of parsedCookies) {
            this.setCookie(this.document, parsedCookie, false);

            nativeMethods.documentCookieSetter.call(this.document, generateDeleteSyncCookieStr(parsedCookie));
            changeSyncType(parsedCookie, { server: false, window: true });
            nativeMethods.documentCookieSetter.call(this.document, formatSyncCookie(parsedCookie));
        }

        this.windowSync.syncBetweenWindows(parsedCookies, null, () => {
            for (const parsedCookie of parsedCookies)
                nativeMethods.documentCookieSetter.call(this.document, generateDeleteSyncCookieStr(parsedCookie));
        });
    }

    _processPendingWindowSync () {
        for (const { parsedCookies, win, resolve } of this.pendingWindowSync) {
            const syncResultPromise = this.syncWindowCookie(parsedCookies, win);

            if (syncResultPromise)
                syncResultPromise.then(resolve);
            else
                resolve();
        }

        this.pendingWindowSync = [];
    }

    syncWindowCookie (parsedCookies, win) {
        // NOTE: This function can be called before the 'attach' call.
        if (!this.document)
            return new Promise(resolve => this.pendingWindowSync.push({ parsedCookies, win, resolve }));

        const clientCookie  = nativeMethods.documentCookieGetter.call(this.document);
        const actualCookies = [];

        for (const parsedCookie of parsedCookies) {
            const startIndex = clientCookie.indexOf(parsedCookie.cookieStr);
            const endIndex   = startIndex + parsedCookie.cookieStr.length;

            if (startIndex > -1 && (clientCookie.length === endIndex || clientCookie.charAt(endIndex) === ';')) {
                this.setCookie(this.document, parsedCookie, false);
                actualCookies.push(parsedCookie);
            }
        }

        return this.windowSync.syncBetweenWindows(actualCookies, win);
    }

    attach (window) {
        super.attach(window);

        this.windowSync = new WindowSync(window, this, this.messageSandbox);

        this._processPendingWindowSync();
    }
}
