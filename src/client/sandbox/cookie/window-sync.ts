/*eslint-disable no-unused-vars*/
import MessageSandbox from '../event/message';
import UnloadSandbox from '../event/unload';
/*eslint-enable no-unused-vars*/
import CookieSandbox from './index';
import Promise from 'pinkie';
import INTERNAL_PROPS from '../../../processing/dom/internal-properties';
import IntegerIdGenerator from '../../utils/integer-id-generator';
import nativeMethods from '../native-methods';
import {
    changeSyncType,
    formatSyncCookie,
    generateDeleteSyncCookieStr,
    parseClientSyncCookieStr
} from '../../../utils/cookie';
import settings from '../../settings';

const SYNC_COOKIE_START_CMD      = 'hammerhead|command|sync-cookie-start';
const SYNC_COOKIE_DONE_CMD       = 'hammerhead|command|sync-cookie-done';
const SYNC_MESSAGE_TIMEOUT       = 500;
const SYNC_MESSAGE_ATTEMPT_COUNT = 5;

interface SyncCookieMsg {
    id?: number;
    cmd: string;
    cookies: Array<any>;
}

export default class WindowSync {
    private _win: Window;
    private _messageIdGenerator: IntegerIdGenerator;
    private _resolversMap: Map<number, () => void>;

    constructor (private readonly _cookieSandbox: CookieSandbox,   // eslint-disable-line
                 private readonly _messageSandbox: MessageSandbox, // eslint-disable-line
                 private readonly _unloadSandbox: UnloadSandbox) { // eslint-disable-line
    }

    private static _getCookieSandbox (win: Window): CookieSandbox {
        try {
            // eslint-disable-next-line no-restricted-properties
            const cookieSandbox = win[INTERNAL_PROPS.hammerhead].sandbox.cookie;

            return cookieSandbox.document && cookieSandbox;
        }
        catch (e) {
            return null;
        }
    }

    private static _removeAllWindowSyncCookie () {
        const cookies       = nativeMethods.documentCookieGetter.call(document);
        const parsedCookies = parseClientSyncCookieStr(cookies);
        const sessionId     = settings.get().sessionId;

        for (const outdatedCookie of parsedCookies.outdated)
            nativeMethods.documentCookieSetter.call(document, generateDeleteSyncCookieStr(outdatedCookie));

        for (const parsedCookie of parsedCookies.actual) {
            if (parsedCookie.sid === sessionId && parsedCookie.isWindowSync) {
                nativeMethods.documentCookieSetter.call(document, generateDeleteSyncCookieStr(parsedCookie));

                if (parsedCookie.isClientSync) {
                    changeSyncType(parsedCookie, { window: false });
                    nativeMethods.documentCookieSetter.call(document, formatSyncCookie(parsedCookie));
                }
            }
        }
    }

    private _onMsgReceived ({ message, source }: { message: SyncCookieMsg, source: Window }) {
        if (message.cmd === SYNC_COOKIE_START_CMD) {
            this._cookieSandbox.syncWindowCookie(message.cookies);

            if (this._win !== this._win.top)
                this._messageSandbox.sendServiceMsg({ id: message.id, cmd: SYNC_COOKIE_DONE_CMD }, source);
            else
                this.syncBetweenWindows(message.cookies, source);
        }
        else if (message.cmd === SYNC_COOKIE_DONE_CMD) {
            const resolver = this._resolversMap.get(message.id);

            if (resolver)
                resolver();
        }
    }

    private _getWindowsForSync (initiator: Window, currentWindow: Window = this._win.top, windows: Array<Window> = []): Array<Window> {
        if (currentWindow !== initiator && currentWindow !== this._win.top)
            windows.push(currentWindow);

        // @ts-ignore
        for (const frameWindow of currentWindow.frames)
            this._getWindowsForSync(initiator, frameWindow, windows);

        return windows;
    }

    private _sendSyncMessage (win: Window, cmd: string, cookies) {
        const id     = this._messageIdGenerator.increment();
        let attempts = 0;

        return new Promise(resolve => {
            let timeoutId = null;

            const resolveWrapper = () => {
                nativeMethods.clearTimeout.call(this._win, timeoutId);
                this._resolversMap.delete(id);
                resolve();
            };

            const sendMsg = () => {
                // NOTE: The window was removed if the parent property is null.
                if (attempts++ < SYNC_MESSAGE_ATTEMPT_COUNT || !win.parent) {
                    this._messageSandbox.sendServiceMsg({ id, cmd, cookies }, win);
                    timeoutId = nativeMethods.setTimeout.call(this._win, sendMsg, SYNC_MESSAGE_TIMEOUT * attempts);
                }
                else
                    resolveWrapper();
            };

            this._resolversMap.set(id, resolveWrapper);
            sendMsg();
        });
    }

    private _delegateSyncBetweenWindowsToTop (cookies) {
        const cookieSandboxTop = WindowSync._getCookieSandbox(this._win.top);

        if (cookieSandboxTop) {
            cookieSandboxTop.syncWindowCookie(cookies);
            cookieSandboxTop.getWindowSync().syncBetweenWindows(cookies, this._win);
        }
        else
            this._messageSandbox.sendServiceMsg({ cmd: SYNC_COOKIE_START_CMD, cookies }, this._win.top);
    }

    private _removeSyncCookie (cookies) {
        const doc             = this._win.document;
        const clientCookieStr = cookies[0].isClientSync && nativeMethods.documentCookieGetter.call(doc);

        for (const parsedCookie of cookies)
            nativeMethods.documentCookieSetter.call(doc, generateDeleteSyncCookieStr(parsedCookie));

        // NOTE: client cookie is passed one at a time
        const parsedCookie = cookies[0];

        if (clientCookieStr && CookieSandbox.isSyncCookieExists(parsedCookie, clientCookieStr)) {
            changeSyncType(parsedCookie, { window: false });
            nativeMethods.documentCookieSetter.call(doc, formatSyncCookie(parsedCookie));
        }
    }

    // eslint-disable-next-line consistent-return
    syncBetweenWindows (cookies, initiator?: Window): void {
        if (this._win !== this._win.top)
            return this._delegateSyncBetweenWindowsToTop(cookies);

        const windowsForSync = this._getWindowsForSync(initiator);
        const syncMessages   = [];

        for (const win of windowsForSync) {
            const cookieSandbox = WindowSync._getCookieSandbox(win);

            if (cookieSandbox)
                cookieSandbox.syncWindowCookie(cookies);
            else
                syncMessages.push(this._sendSyncMessage(win, SYNC_COOKIE_START_CMD, cookies));
        }

        if (syncMessages.length)
            Promise.all(syncMessages).then(() => this._removeSyncCookie(cookies));
        else
            this._removeSyncCookie(cookies);
    }

    attach (win: Window) {
        this._win = win;

        this._messageSandbox.on(this._messageSandbox.SERVICE_MSG_RECEIVED_EVENT, e => this._onMsgReceived(e));

        if (win === win.top) {
            this._messageIdGenerator = this._messageIdGenerator || new IntegerIdGenerator();
            this._resolversMap       = this._resolversMap || new Map();

            this._unloadSandbox.on(this._unloadSandbox.UNLOAD_EVENT, WindowSync._removeAllWindowSyncCookie);
        }
    }
}
