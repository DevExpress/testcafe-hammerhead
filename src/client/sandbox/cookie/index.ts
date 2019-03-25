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
    messageSandbox: any;
    windowSync: any;
    pendingWindowSync: Array<any>;
    unloadSandbox: any;

    constructor (messageSandbox, unloadSandbox) {
        super();

        this.messageSandbox = messageSandbox;
        this.unloadSandbox  = unloadSandbox;
        this.windowSync     = null;

        this.pendingWindowSync = [];
    }

    _canSetCookie (cookie, setByClient: boolean): boolean {
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

    static _updateClientCookieStr (cookieKey, newCookieStr: string): void {
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

    getCookie (): string {
        this.syncCookie();

        // eslint-disable-next-line no-restricted-properties
        return settings.get().cookie || '';
    }

    setCookie (_document, cookie): void {
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

    syncCookie (): void {
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

        if (serverSyncCookies.length)
            this._syncServerCookie(serverSyncCookies);
    }

    _syncServerCookie (parsedCookies): void {
        for (const parsedCookie of parsedCookies) {
            this.setCookie(this.document, parsedCookie);

            nativeMethods.documentCookieSetter.call(this.document, generateDeleteSyncCookieStr(parsedCookie));
            changeSyncType(parsedCookie, { server: false, window: true });
            nativeMethods.documentCookieSetter.call(this.document, formatSyncCookie(parsedCookie));
        }

        this.windowSync.syncBetweenWindows(parsedCookies);
    }

    _syncClientCookie (parsedCookie): void {
        parsedCookie.isClientSync = true;
        parsedCookie.isWindowSync = true;
        parsedCookie.sid          = settings.get().sessionId;
        parsedCookie.lastAccessed = new nativeMethods.date(); // eslint-disable-line new-cap

        prepareSyncCookieProperties(parsedCookie);

        nativeMethods.documentCookieSetter.call(this.document, formatSyncCookie(parsedCookie));

        this.windowSync.syncBetweenWindows([parsedCookie]);
    }

    static isSyncCookieExists (parsedCookie, clientCookieStr: string): boolean {
        const startIndex = clientCookieStr.indexOf(parsedCookie.cookieStr);
        const endIndex   = startIndex + parsedCookie.cookieStr.length;

        return startIndex > -1 && (clientCookieStr.length === endIndex || clientCookieStr.charAt(endIndex) === ';');
    }

    syncWindowCookie (parsedCookies): void {
        const clientCookie = nativeMethods.documentCookieGetter.call(this.document);

        for (const parsedCookie of parsedCookies) {
            if (CookieSandbox.isSyncCookieExists(parsedCookie, clientCookie))
                this.setCookie(this.document, parsedCookie);
        }
    }

    attach (window: Window): void {
        super.attach(window);

        this.windowSync = new WindowSync(window, this, this.messageSandbox, this.unloadSandbox);
    }
}
