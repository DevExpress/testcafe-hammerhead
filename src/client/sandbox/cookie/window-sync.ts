import CookieSandbox from './index';
import Promise from 'pinkie';
import INTERNAL_PROPS from '../../../processing/dom/internal-properties';
import IntegerIdGenerator from '../../utils/integer-id-generator';
import nativeMethods from '../native-methods';
import { changeSyncType, formatSyncCookie, generateDeleteSyncCookieStr } from '../../../utils/cookie';

const SYNC_COOKIE_START_CMD      = 'hammerhead|command|sync-cookie-start';
const SYNC_COOKIE_DONE_CMD       = 'hammerhead|command|sync-cookie-done';
const SYNC_MESSAGE_TIMEOUT       = 500;
const SYNC_MESSAGE_ATTEMPT_COUNT = 10;

export default class WindowSync {
    private readonly _win: Window;
    private readonly _resolversMap: Map<number, () => void>;
    private readonly _cookieSandbox: CookieSandbox;
    private readonly _messageSandbox: any;
    private readonly _messageIdGenerator: IntegerIdGenerator;

    constructor (win: Window, cookieSandbox: CookieSandbox, messageSandbox) {
        this._win                = win;
        this._cookieSandbox      = cookieSandbox;
        this._messageSandbox     = messageSandbox;
        this._messageIdGenerator = win === win.top ? new IntegerIdGenerator() : null;
        this._resolversMap       = win === win.top ? new Map() : null;

        messageSandbox.on(messageSandbox.SERVICE_MSG_RECEIVED_EVENT, e => this._onMsgReceived(e));
    }

    private static _getCookieSandbox (win) {
        try {
            // eslint-disable-next-line no-restricted-properties
            const cookieSandbox = win[INTERNAL_PROPS.hammerhead].sandbox.cookie;

            return cookieSandbox.document && cookieSandbox;
        }
        catch (e) {
            return null;
        }
    }

    private _onMsgReceived ({ message, source }) {
        if (message.cmd === SYNC_COOKIE_START_CMD) {
            this._cookieSandbox.syncWindowCookie(message.cookies);

            if (this._win !== this._win.top)
                this._messageSandbox.sendServiceMsg({ id: message.id, cmd: SYNC_COOKIE_DONE_CMD }, source);
            else
                this.syncBetweenWindows(message.cookies, source);
        }
        else if (message.cmd === SYNC_COOKIE_DONE_CMD) {
            if (this._resolversMap.has(message.id)) {
                this._resolversMap.get(message.id)();
                this._resolversMap.delete(message.id);
            }
        }
    }

    private _getWindowsForSync (initiator: Window, currentWindow: Window = this._win.top, windows: Array<Window> = []) {
        if (currentWindow !== initiator && currentWindow !== this._win.top)
            windows.push(currentWindow);

        for (let i = 0; i < currentWindow.frames.length; i++)
            this._getWindowsForSync(initiator, currentWindow.frames[i], windows);

        return windows;
    }

    private _sendSyncMessage (win: Window, cmd: string, cookies) {
        const id     = this._messageIdGenerator.increment();
        let attempts = SYNC_MESSAGE_ATTEMPT_COUNT;

        return new Promise(resolve => {
            let timeoutId = null;
            const sendMsg = () => {
                if (attempts--) {
                    // NOTE: The window was removed if the parent property is null.
                    if (!win.parent) {
                        this._resolversMap.delete(id);
                        resolve();
                    }
                    else {
                        this._messageSandbox.sendServiceMsg({ id, cmd, cookies }, win);
                        timeoutId = nativeMethods.setTimeout.call(this._win, sendMsg, SYNC_MESSAGE_TIMEOUT);
                    }
                }
                else {
                    this._resolversMap.delete(id);
                    resolve();
                }
            };

            this._resolversMap.set(id, () => {
                nativeMethods.clearTimeout.call(this._win, timeoutId);
                resolve();
            });

            sendMsg();
        });
    }

    private _delegateSyncBetweenWindowsToTop (cookies): void {
        const cookieSandboxTop = WindowSync._getCookieSandbox(this._win.top);

        if (cookieSandboxTop) {
            cookieSandboxTop.syncWindowCookie(cookies);
            cookieSandboxTop.windowSync.syncBetweenWindows(cookies, this._win);
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
}
