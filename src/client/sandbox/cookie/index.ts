import MessageSandbox from '../event/message';
import UnloadSandbox from '../event/unload';
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
import { CookieRecord } from '../../../typings/cookie';
import ChildWindowSandbox from '../child-window';
import getTopOpenerWindow from '../../utils/get-top-opener-window';

const MIN_DATE_VALUE = new nativeMethods.date(0).toUTCString();

export default class CookieSandbox extends SandboxBase {
    private readonly _windowSync: WindowSync;

    constructor (messageSandbox: MessageSandbox,
        private readonly _unloadSandbox: UnloadSandbox,
        childWindowSandbox: ChildWindowSandbox) {
        super();

        this._windowSync = new WindowSync(this, messageSandbox, childWindowSandbox);
    }

    private static _removeAllSyncCookie (): void {
        const cookies       = nativeMethods.documentCookieGetter.call(document);
        const parsedCookies = parseClientSyncCookieStr(cookies);
        const sessionId     = settings.get().sessionId;

        for (const outdatedCookie of parsedCookies.outdated)
            nativeMethods.documentCookieSetter.call(document, generateDeleteSyncCookieStr(outdatedCookie));

        for (const parsedCookie of parsedCookies.actual) {
            if (parsedCookie.sid === sessionId && (parsedCookie.isWindowSync || parsedCookie.isServerSync)) {
                nativeMethods.documentCookieSetter.call(document, generateDeleteSyncCookieStr(parsedCookie));

                if (parsedCookie.isClientSync) {
                    changeSyncType(parsedCookie, { window: false });
                    nativeMethods.documentCookieSetter.call(document, formatSyncCookie(parsedCookie));
                }
            }
        }
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

    setCookie (cookie: CookieRecord | string): void {
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
                this.setCookie(parsedCookie);
        }

        if (serverSyncCookies.length)
            this._syncServerCookie(serverSyncCookies);
    }

    _syncServerCookie (parsedCookies: CookieRecord[]): void {
        for (const parsedCookie of parsedCookies) {
            this.setCookie(parsedCookie);

            nativeMethods.documentCookieSetter.call(this.document, generateDeleteSyncCookieStr(parsedCookie));
            changeSyncType(parsedCookie, { server: false, window: true });
            nativeMethods.documentCookieSetter.call(this.document, formatSyncCookie(parsedCookie));
        }

        this._windowSync.syncBetweenWindows(parsedCookies);
    }

    _syncClientCookie (parsedCookie: CookieRecord): void {
        parsedCookie.isClientSync = true;
        parsedCookie.isWindowSync = true;
        parsedCookie.sid          = settings.get().sessionId;
        parsedCookie.lastAccessed = new nativeMethods.date();

        prepareSyncCookieProperties(parsedCookie);

        nativeMethods.documentCookieSetter.call(this.document, formatSyncCookie(parsedCookie));

        this._windowSync.syncBetweenWindows([parsedCookie]);
    }

    static isSyncCookieExists (parsedCookie: CookieRecord, clientCookieStr: string): boolean {
        const startIndex = clientCookieStr.indexOf(parsedCookie.cookieStr);
        const endIndex   = startIndex + parsedCookie.cookieStr.length;

        return startIndex > -1 && (clientCookieStr.length === endIndex || clientCookieStr.charAt(endIndex) === ';');
    }

    syncWindowCookie (parsedCookies: CookieRecord[]): void {
        const clientCookie = nativeMethods.documentCookieGetter.call(this.document);

        for (const parsedCookie of parsedCookies) {
            if (CookieSandbox.isSyncCookieExists(parsedCookie, clientCookie))
                this.setCookie(parsedCookie);
        }
    }

    getWindowSync (): WindowSync {
        return this._windowSync;
    }

    attach (window: Window & typeof globalThis): void {
        super.attach(window);

        this._windowSync.attach(window);

        if (window === getTopOpenerWindow())
            this._unloadSandbox.on(this._unloadSandbox.UNLOAD_EVENT, CookieSandbox._removeAllSyncCookie);
    }
}
