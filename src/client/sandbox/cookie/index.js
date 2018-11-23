import Promise from 'pinkie';
import SandboxBase from '../base';
import settings from '../../settings';
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
    parseClientSyncCookieStr,
    prepareSyncCookieProperties
} from '../../../utils/cookie';

const MIN_DATE_VALUE = new nativeMethods.date(0).toUTCString(); // eslint-disable-line new-cap

export default class CookieSandbox extends SandboxBase {
    constructor (messageSandbox) {
        super();

        this.messageSandbox = messageSandbox;
        this.windowSync     = null;

        this.pendingWindowSync = [];
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

    static _updateClientCookieStr (cookieKey, newCookieStr) {
        const cookieStr      = settings.get().cookie; // eslint-disable-line no-restricted-properties
        const cookies        = cookieStr ? cookieStr.split(';') : [];
        const changedCookies = [];
        let replaced         = false;
        const searchStr      = cookieKey === '' ? null : cookieKey + '=';

        // NOTE: Replace a cookie if it already exists.
        for (let cookie of cookies) {
            cookie = trim(cookie);

            const isCookieExists = searchStr ? cookie.indexOf(searchStr) === 0 : cookie.indexOf('=') === -1;

            if (!isCookieExists)
                changedCookies.push(cookie);
            else if (newCookieStr !== null) {
                changedCookies.push(newCookieStr);

                replaced = true;
            }
        }

        if (!replaced && newCookieStr !== null)
            changedCookies.push(newCookieStr);

        settings.get().cookie = changedCookies.join('; '); // eslint-disable-line no-restricted-properties
    }

    getCookie () {
        this.syncCookie();

        // eslint-disable-next-line no-restricted-properties
        return settings.get().cookie || '';
    }

    setCookie (document, cookie) {
        const setByClient = typeof cookie === 'string';

        // NOTE: Cookie cannot be set in iframe without src in IE
        // Also cookie cannot be set on a page with 'file:' protocol
        // or if the length of cookie higher than limit
        if (!this._canSetCookie(cookie, setByClient))
            return;

        const parsedCookie = setByClient ? cookieUtils.parse(cookie) : cookie;

        if (!parsedCookie || parsedCookie.httpOnly)
            return;

        const parsedDestLocation = destLocation.getParsed();

        // NOTE: All Hammerhad sessions have the same domain, so we need to validate the Domain attribute manually
        // according to a test url.
        // eslint-disable-next-line no-restricted-properties
        if (!cookieUtils.domainMatch(parsedDestLocation.hostname, parsedCookie.domain))
            return;

        // eslint-disable-next-line no-restricted-properties
        if ((!parsedCookie.secure || parsedDestLocation.protocol === 'https:') &&
            // eslint-disable-next-line no-restricted-properties
            cookieUtils.pathMatch(parsedDestLocation.pathname, parsedCookie.path)) {
            const currentDate   = cookieUtils.getUTCDate();
            let clientCookieStr = null;

            if (!parsedCookie.expires || parsedCookie.expires === 'Infinity' || parsedCookie.expires > currentDate)
                clientCookieStr = cookieUtils.formatClientString(parsedCookie);

            CookieSandbox._updateClientCookieStr(parsedCookie.key, clientCookieStr);
        }

        if (setByClient) {
            cookieUtils.setDefaultValues(parsedCookie, parsedDestLocation);

            this._syncClientCookie(parsedCookie);
            this.syncCookie();
        }
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
                this.setCookie(this.document, parsedCookie);
        }

        this._syncServerCookie(serverSyncCookies);
    }

    _syncServerCookie (parsedCookies) {
        for (const parsedCookie of parsedCookies) {
            this.setCookie(this.document, parsedCookie);

            nativeMethods.documentCookieSetter.call(this.document, generateDeleteSyncCookieStr(parsedCookie));
            changeSyncType(parsedCookie, { server: false, window: true });
            nativeMethods.documentCookieSetter.call(this.document, formatSyncCookie(parsedCookie));
        }

        this.windowSync.syncBetweenWindows(parsedCookies, null, () => {
            for (const parsedCookie of parsedCookies)
                nativeMethods.documentCookieSetter.call(this.document, generateDeleteSyncCookieStr(parsedCookie));
        });
    }

    _syncClientCookie (parsedCookie) {
        parsedCookie.isClientSync = true;
        parsedCookie.isWindowSync = true;
        parsedCookie.sid          = settings.get().sessionId;
        parsedCookie.lastAccessed = new nativeMethods.date(); // eslint-disable-line new-cap

        prepareSyncCookieProperties(parsedCookie);

        nativeMethods.documentCookieSetter.call(this.document, formatSyncCookie(parsedCookie));

        this.windowSync.syncBetweenWindows([parsedCookie], null, () => {
            nativeMethods.documentCookieSetter.call(this.document, generateDeleteSyncCookieStr(parsedCookie));
            changeSyncType(parsedCookie, { window: false });
            nativeMethods.documentCookieSetter.call(this.document, formatSyncCookie(parsedCookie));
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
                this.setCookie(this.document, parsedCookie);
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
