import Promise from 'pinkie';
import INTERNAL_PROPS from '../../../processing/dom/internal-properties';
import createIntegerIdGenerator from '../../utils/integer-id-generator';
const SYNC_COOKIE_START_CMD = 'hammerhead|command|sync-cookie-start';
const SYNC_COOKIE_DONE_CMD = 'hammerhead|command|sync-cookie-done';
export default class WindowSync {
    constructor(win, cookieSandbox, messageSandbox) {
        this.win = win;
        this.cookieSandbox = cookieSandbox;
        this.messageSandbox = messageSandbox;
        this.messageIdGenerator = createIntegerIdGenerator();
        this.resolversMap = {};
        messageSandbox.on(messageSandbox.SERVICE_MSG_RECEIVED_EVENT, ({ message, source }) => {
            if (message.cmd === SYNC_COOKIE_START_CMD) {
                const syncResultPromise = this.cookieSandbox.syncWindowCookie(message.cookies, source);
                const callback = () => this.messageSandbox.sendServiceMsg({
                    id: message.id,
                    cmd: SYNC_COOKIE_DONE_CMD
                }, source);
                if (syncResultPromise)
                    syncResultPromise.then(callback);
                else
                    callback();
            }
            // NOTE: We need to remove the second part of the condition after a fix of GH-1715
            else if (message.cmd === SYNC_COOKIE_DONE_CMD && this.resolversMap[message.id]) {
                this.resolversMap[message.id]();
                delete this.resolversMap[message.id];
            }
        });
    }
    static _getCookieSandbox(win) {
        try {
            // eslint-disable-next-line no-restricted-properties
            return win[INTERNAL_PROPS.hammerhead].sandbox.cookie;
        }
        catch (e) {
            return null;
        }
    }
    _getWindowsForSync(initiator) {
        const windows = [];
        if (this.win !== this.win.parent && this.win.parent !== initiator)
            windows.push(this.win.parent);
        for (const frameWin of this.win.window) {
            if (frameWin !== initiator)
                windows.push(frameWin);
        }
        return windows;
    }
    syncBetweenWindows(cookies, initiator, callback) {
        if (!cookies.length) {
            if (callback)
                callback();
            return null;
        }
        const windowsForSync = this._getWindowsForSync(initiator);
        const syncMessages = [];
        for (const win of windowsForSync) {
            const cookieSandbox = WindowSync._getCookieSandbox(win);
            if (cookieSandbox) {
                const syncResultPromise = cookieSandbox.syncWindowCookie(cookies, this.win);
                if (syncResultPromise)
                    syncMessages.push(syncResultPromise);
            }
            else
                syncMessages.push(this.sendSyncMessage(win, SYNC_COOKIE_START_CMD, cookies));
        }
        if (syncMessages.length) {
            const promiseAllMessages = Promise.all(syncMessages);
            return callback ? promiseAllMessages.then(callback) : promiseAllMessages;
        }
        if (callback)
            callback();
        return null;
    }
    sendSyncMessage(win, cmd, cookies) {
        const id = this.messageIdGenerator.increment();
        return new Promise(resolve => {
            this.resolversMap[id] = resolve;
            this.messageSandbox.sendServiceMsg({ id, cmd, cookies }, win);
        });
    }
}
