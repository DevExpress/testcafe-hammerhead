import { getSandboxFromStorage } from '../storage';

const WINDOW_ACTIVATED_EVENT   = 'windowActivated';
const WINDOW_DEACTIVATED_EVENT = 'windowDeactivated';

export default class ActiveWindowTracker {
    constructor (window) {
        this.currentWindow  = window;
        this.isIFrameWindow = this.currentWindow !== this.currentWindow.top;
        this.activeWindow   = !this.isIFrameWindow ? this.currentWindow.top : null;
        this.isActive       = !this.isIFrameWindow;

        var sandboxStorage = getSandboxFromStorage(window);

        sandboxStorage.activeWindowTracker = this;

        this.message = sandboxStorage.message;

        this.message.on(this.message.SERVICE_MSG_RECEIVED, (e) => {
            if (e.message.cmd === WINDOW_ACTIVATED_EVENT) {
                if (this.activeWindow !== this.activeWindow.top)
                    this._notifyPrevActiveWindow();

                this.isActive     = false;
                this.activeWindow = e.source;
            }
            else if (e.message.cmd === WINDOW_DEACTIVATED_EVENT)
                this.isActive = false;
        });
    }

    _notifyPrevActiveWindow () {
        if (this.activeWindow.top) {
            try {
                this.message.sendServiceMsg({
                    cmd: WINDOW_DEACTIVATED_EVENT
                }, this.activeWindow);
            }
            catch (err) {
                //NOTE: the error appears in IE when the corresponding iframe is removed
                return void 0;
            }
        }
    }

    isCurrentWindowActive () {
        return this.isActive;
    }

    makeCurrentWindowActive () {
        this.isActive = true;

        if (!this.isIFrameWindow) {
            this._notifyPrevActiveWindow();

            this.activeWindow = this.currentWindow;
        }
        else {
            this.message.sendServiceMsg({
                cmd: WINDOW_ACTIVATED_EVENT
            }, this.currentWindow.top);
        }
    }
}
