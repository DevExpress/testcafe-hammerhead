/* eslint-disable */
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
    prepareSyncCookieProperties,
} from '../../../utils/cookie';
import { CookieRecord } from '../../../typings/cookie';
import ChildWindowSandbox from '../child-window';
import getTopOpenerWindow from '../../utils/get-top-opener-window';
import { isNull, isNumber } from '../../utils/types';

const MIN_DATE_VALUE = new nativeMethods.date(0).toUTCString(); // eslint-disable-line new-cap

interface CookieSandboxStrategy {
    getCookie: () => string;

    setCookie: (cookie: CookieRecord | string) => void;

    syncCookie: () => void;

    syncWindowCookie: (parsedCookies: CookieRecord[]) => void;

    removeAllSyncCookie: () => void;
}

class CookieSandboxStrategyFactory {
    static create (nativeAutomation: boolean, document: Document | null, windowSync: WindowSync) {
        return nativeAutomation ? new CookieSandboxNativeAutomationStrategy() : new CookieSandboxProxyStrategy(document, windowSync);
    }
}

class CookieSandboxNativeAutomationStrategy implements CookieSandboxStrategy {
    getCookie (): string {
        return '';
    }
    setCookie (): void {
        return void 0;
    }
    syncCookie (): void {
        return void 0;
    }
    syncWindowCookie (): void {
        return void 0;
    }
    removeAllSyncCookie (): void {
        return void 0;
    }
}

class CookieSandboxProxyStrategy implements CookieSandboxStrategy {
    document: Document | null = null;
    private readonly _windowSync: WindowSync;

    constructor (document: Document | null, _windowSync: WindowSync) {
        this.document    = document;
        this._windowSync = _windowSync;
    }

    getCookie (): string {
        this.syncCookie(true);

        // eslint-disable-next-line no-restricted-properties
        return settings.get().cookie || '';
    }

    setCookie (cookie: CookieRecord | string): void {
        const setByClient = typeof cookie === 'string';

        // NOTE: Cookie cannot be set on a page with 'file:' protocol
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

            if ((!parsedCookie.expires || parsedCookie.expires === 'Infinity' || parsedCookie.expires > currentDate) &&
                (isNull(parsedCookie.maxAge) || isNaN(parsedCookie.maxAge) || parsedCookie.maxAge > 0))
                clientCookieStr = cookieUtils.formatClientString(parsedCookie);

            CookieSandbox._updateClientCookieStr(parsedCookie.key, clientCookieStr);
        }

        if (setByClient) {
            cookieUtils.setDefaultValues(parsedCookie, parsedDestLocation);

            this._syncClientCookie(parsedCookie);
            this.syncCookie();
        }
    }

    /* eslint-disable */
    syncCookie (gettingCookies = false): void {
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
            else if (gettingCookies && parsedCookie.isClientSync) {
                const currentDate = cookieUtils.getUTCDate();
                const maxAge      = !isNull(parsedCookie.maxAge) && Number(parsedCookie.maxAge);
                const expires     = Number(parsedCookie.expires);

                if (!isNaN(maxAge) && isNumber(maxAge) && maxAge * 1000 <= currentDate.getTime() - parsedCookie.lastAccessed.getTime() ||
                    !isNaN(expires) && isNumber(expires) && expires < currentDate.getTime()) {
                    nativeMethods.documentCookieSetter.call(this.document, generateDeleteSyncCookieStr(parsedCookie));
                    CookieSandbox._updateClientCookieStr(parsedCookie.key, null);
                }
            }
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

    syncWindowCookie (parsedCookies: CookieRecord[]): void {
        const clientCookie = nativeMethods.documentCookieGetter.call(this.document);

        for (const parsedCookie of parsedCookies) {
            if (CookieSandbox.isSyncCookieExists(parsedCookie, clientCookie))
                this.setCookie(parsedCookie);
        }
    }

    removeAllSyncCookie (): void {
        const cookies       = nativeMethods.documentCookieGetter.call(this.document);
        const parsedCookies = parseClientSyncCookieStr(cookies);
        const sessionId     = settings.get().sessionId;

        for (const outdatedCookie of parsedCookies.outdated)
            nativeMethods.documentCookieSetter.call(this.document, generateDeleteSyncCookieStr(outdatedCookie));

        for (const parsedCookie of parsedCookies.actual) {
            if (parsedCookie.sid === sessionId && (parsedCookie.isWindowSync || parsedCookie.isServerSync)) {
                nativeMethods.documentCookieSetter.call(this.document, generateDeleteSyncCookieStr(parsedCookie));

                if (parsedCookie.isClientSync) {
                    changeSyncType(parsedCookie, { window: false });
                    nativeMethods.documentCookieSetter.call(this.document, formatSyncCookie(parsedCookie));
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

    _syncClientCookie (parsedCookie: CookieRecord): void {
        parsedCookie.isClientSync = true;
        parsedCookie.isWindowSync = true;
        parsedCookie.sid          = settings.get().sessionId;
        parsedCookie.lastAccessed = cookieUtils.getUTCDate();

        prepareSyncCookieProperties(parsedCookie);

        nativeMethods.documentCookieSetter.call(this.document, formatSyncCookie(parsedCookie));

        this._windowSync.syncBetweenWindows([parsedCookie]);
    }
}

export default class CookieSandbox extends SandboxBase {
    private readonly _windowSync: WindowSync;
    private _cookieStrategy: CookieSandboxStrategy;

    constructor (messageSandbox: MessageSandbox,
        private readonly _unloadSandbox: UnloadSandbox,
        childWindowSandbox: ChildWindowSandbox) {
        super();

        this._windowSync = new WindowSync(this, messageSandbox, childWindowSandbox);
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

    static isSyncCookieExists (parsedCookie: CookieRecord, clientCookieStr: string): boolean {
        const startIndex = clientCookieStr.indexOf(parsedCookie.cookieStr);
        const endIndex   = startIndex + parsedCookie.cookieStr.length;

        return startIndex > -1 && (clientCookieStr.length === endIndex || clientCookieStr.charAt(endIndex) === ';');
    }

    attach (window: Window & typeof globalThis): void {
        super.attach(window);

        this._windowSync.attach(window);

        this._cookieStrategy = CookieSandboxStrategyFactory.create(
            settings.nativeAutomation,
            this.document,
            this._windowSync);

        if (window === getTopOpenerWindow())
            this._unloadSandbox.on(this._unloadSandbox.UNLOAD_EVENT, this._cookieStrategy.removeAllSyncCookie);
    }

    getWindowSync (): WindowSync {
        return this._windowSync;
    }

    // Strategy methods
    getCookie (): string {
        return this._cookieStrategy.getCookie();
    }
    setCookie (cookie: CookieRecord | string): void {
        this._cookieStrategy.setCookie(cookie);
    }
    syncCookie (): void {
        this._cookieStrategy.syncCookie();
    }
    syncWindowCookie (parsedCookies: CookieRecord[]): void {
        this._cookieStrategy.syncWindowCookie(parsedCookies);
    }
}
