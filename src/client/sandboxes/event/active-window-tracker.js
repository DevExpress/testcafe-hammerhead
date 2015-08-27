import * as MessageSandbox from '../message';


const WINDOW_ACTIVATED_EVENT   = 'windowActivated';
const WINDOW_DEACTIVATED_EVENT = 'windowDeactivated';

class ActiveWindowTracker {
    constructor () {
        this.currentWindow  = window;
        this.isIFrameWindow = this.currentWindow !== this.currentWindow.top;
        this.activeWindow   = !this.isIFrameWindow ? this.currentWindow.top : null;
        this.isActive       = !this.isIFrameWindow;

        MessageSandbox.on(MessageSandbox.SERVICE_MSG_RECEIVED, (e) => {
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
                MessageSandbox.sendServiceMsg({
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
            MessageSandbox.sendServiceMsg({
                cmd: WINDOW_ACTIVATED_EVENT
            }, this.currentWindow.top);
        }
    }
}

export default new ActiveWindowTracker();
