import MessageSandbox from '../event/message';
import CookieSandbox from './index';
import Promise from 'pinkie';
import INTERNAL_PROPS from '../../../processing/dom/internal-properties';
import IntegerIdGenerator from '../../utils/integer-id-generator';
import nativeMethods from '../native-methods';

import {
    changeSyncType,
    formatSyncCookie,
    generateDeleteSyncCookieStr,
} from '../../../utils/cookie';

import ChildWindowSandbox from '../child-window';
import getTopOpenerWindow from '../../utils/get-top-opener-window';

const SYNC_COOKIE_START_CMD      = 'hammerhead|command|sync-cookie-start';
const SYNC_COOKIE_DONE_CMD       = 'hammerhead|command|sync-cookie-done';
const SYNC_MESSAGE_TIMEOUT       = 500;
const SYNC_MESSAGE_ATTEMPT_COUNT = 5;

interface SyncCookieMsg {
    id?: number;
    cmd: string;
    cookies: any[];
}

export default class WindowSync {
    private _win: Window | null = null;
    private _messageIdGenerator: IntegerIdGenerator | null = null;
    private _resolversMap: Map<number, () => void> = new Map<number, () => void>(); // eslint-disable-line no-spaced-func

    constructor (private readonly _cookieSandbox: CookieSandbox,
        private readonly _messageSandbox: MessageSandbox,
        private readonly _childWindowSandbox: ChildWindowSandbox) {
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

    private _onMsgReceived ({ message, source }: { message: SyncCookieMsg; source: Window }) {
        if (message.cmd === SYNC_COOKIE_START_CMD) {
            this._cookieSandbox.syncWindowCookie(message.cookies);

            if (this._win !== this._win.top)
                this._messageSandbox.sendServiceMsg({ id: message.id, cmd: SYNC_COOKIE_DONE_CMD }, source);
            else if (this._win !== getTopOpenerWindow()) {
                this.syncBetweenWindows(message.cookies, source)
                    .then(() => this._messageSandbox.sendServiceMsg({
                        id:  message.id,
                        cmd: SYNC_COOKIE_DONE_CMD,
                    }, source));
            }
            else
                this.syncBetweenWindows(message.cookies, source);
        }
        else if (message.cmd === SYNC_COOKIE_DONE_CMD) {
            const resolver = this._resolversMap.get(message.id);

            if (resolver)
                resolver();
        }
    }

    private _getWindowsForSync (initiator: Window, currentWindow: Window, windows: Window[] = []): Window[] {
        if (currentWindow !== initiator && currentWindow !== this._win.top)
            windows.push(currentWindow);

        // @ts-ignore
        for (const frameWindow of currentWindow.frames)
            this._getWindowsForSync(initiator, frameWindow, windows);

        return windows;
    }

    private _sendSyncMessage (win: Window, cmd: string, cookies): Promise<void> {
        const id     = this._messageIdGenerator.increment();
        let attempts = 0;

        return new Promise((resolve: Function) => {
            let timeoutId: number | null = null;

            const resolveWrapper = () => {
                nativeMethods.clearTimeout.call(this._win, timeoutId as number);
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

    private _delegateSyncBetweenWindowsToMainTopWindow (cookies): void {
        const topOpenerWindow  = getTopOpenerWindow();
        const cookieSandboxTop = WindowSync._getCookieSandbox(topOpenerWindow);

        if (cookieSandboxTop) {
            cookieSandboxTop.syncWindowCookie(cookies);
            cookieSandboxTop.getWindowSync().syncBetweenWindows(cookies, this._win);
        }
        else
            this._messageSandbox.sendServiceMsg({ cmd: SYNC_COOKIE_START_CMD, cookies }, topOpenerWindow);
    }

    private _removeSyncCookie (cookies): void {
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

    syncBetweenWindows (cookies, initiator?: Window): Promise<void> {
        const topOpenerWindow = getTopOpenerWindow();

        if (this._win !== this._win.top || this._win !== topOpenerWindow && !initiator) {
            this._delegateSyncBetweenWindowsToMainTopWindow(cookies);

            return Promise.resolve();
        }

        const windowsForSync                = this._getWindowsForSync(initiator, this._win);
        const syncMessages: Promise<void>[] = [];

        if (this._win === topOpenerWindow) {
            for (const win of this._childWindowSandbox.getChildWindows()) {
                const cookieSandbox = WindowSync._getCookieSandbox(win);

                if (cookieSandbox)
                    syncMessages.push(cookieSandbox.getWindowSync().syncBetweenWindows(cookies, this._win));
                else
                    syncMessages.push(this._sendSyncMessage(win, SYNC_COOKIE_START_CMD, cookies));
            }
        }

        for (const win of windowsForSync) {
            const cookieSandbox = WindowSync._getCookieSandbox(win);

            if (cookieSandbox)
                cookieSandbox.syncWindowCookie(cookies);
            else
                syncMessages.push(this._sendSyncMessage(win, SYNC_COOKIE_START_CMD, cookies));
        }

        if (syncMessages.length) {
            const syncMessagesPromise = Promise.all(syncMessages);

            if (this._win === topOpenerWindow)
                return syncMessagesPromise.then(() => this._removeSyncCookie(cookies));

            return syncMessagesPromise.then();
        }

        this._removeSyncCookie(cookies);

        return Promise.resolve();
    }

    attach (win: Window): void {
        this._win = win;

        this._messageSandbox.on(this._messageSandbox.SERVICE_MSG_RECEIVED_EVENT, e => this._onMsgReceived(e));

        if (win === win.top) {
            this._messageIdGenerator = this._messageIdGenerator || new IntegerIdGenerator();
            this._resolversMap       = this._resolversMap || new Map();
        }
    }
}
