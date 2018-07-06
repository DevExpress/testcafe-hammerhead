import Promise from 'pinkie';
import INTERNAL_PROPS from '../../../processing/dom/internal-properties';

const MAX_SAFE_INTEGER       = Math.pow(2, 53) - 1;
const SYNC_COOKIE_KEYS_EVENT = 'hammerhead|event|sync-cookie-keys';
const SYNC_COOKIE_DONE_EVENT = 'hammerhead|event|sync-cookie-done';

export default class FrameSync {
    constructor (win, cookieSandbox, messageSandbox) {
        this.win            = win;
        this.cookieSandbox  = cookieSandbox;
        this.messageSandbox = messageSandbox;

        this.syncMessageCounter = 0;

        this.resolvers = {};

        messageSandbox.on(messageSandbox.SERVICE_MSG_RECEIVED_EVENT, ({ message, source }) => {
            if (message.cmd === SYNC_COOKIE_KEYS_EVENT) {
                const syncResultPromise = this.cookieSandbox.syncFrameCookie(message.cookies, source);
                const callback = () => this.messageSandbox.sendServiceMsg({
                    id:  message.id,
                    cmd: SYNC_COOKIE_DONE_EVENT
                }, source);

                if (syncResultPromise)
                    syncResultPromise.then(callback);
                else
                    callback();
            }
            else if (message.cmd === SYNC_COOKIE_DONE_EVENT) {
                this.resolvers[message.id]();

                delete this.resolvers[message.id];
            }
        });
    }

    static _getCookieSandbox (win) {
        try {
            // eslint-disable-next-line no-restricted-properties
            return win[INTERNAL_PROPS.hammerhead].sandbox.cookie;
        }
        catch (e) {
            return null;
        }
    }

    _getWindowsForSync (initiator) {
        const windows = [];

        if (this.win !== this.win.parent && this.win.parent !== initiator)
            windows.push(this.win.parent);

        for (const frameWin of this.win.frames) {
            if (frameWin !== initiator)
                windows.push(frameWin);
        }

        return windows;
    }

    syncBetweenFrames (cookies, initiator, callback) {
        if (!cookies.length) {
            if (callback)
                callback();

            return null;
        }

        const windowsForSync = this._getWindowsForSync(initiator);
        const syncMessages   = [];

        for (const win of windowsForSync) {
            const cookieSandbox = FrameSync._getCookieSandbox(win);

            if (cookieSandbox) {
                const syncResultPromise = cookieSandbox.syncFrameCookie(cookies, this.win);

                if (syncResultPromise)
                    syncMessages.push(syncResultPromise);
            }
            else
                syncMessages.push(this.sendSyncMessage(win, SYNC_COOKIE_KEYS_EVENT, cookies));
        }

        if (syncMessages.length) {
            const promiseAllMessages = Promise.all(syncMessages);

            return callback ? promiseAllMessages.then(callback) : promiseAllMessages;
        }

        if (callback)
            callback();

        return null;
    }

    sendSyncMessage (win, cmd, cookies) {
        const id = this.syncMessageCounter;

        this.syncMessageCounter = this.syncMessageCounter + 1;

        if (this.syncMessageCounter > MAX_SAFE_INTEGER)
            this.syncMessageCounter = 0;

        return new Promise(resolve => {
            this.resolvers[id] = resolve;
            this.messageSandbox.sendServiceMsg({ id, cmd, cookies }, win);
        });
    }
}
