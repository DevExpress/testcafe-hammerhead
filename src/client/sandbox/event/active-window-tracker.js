import SandboxBase from '../base';

const WINDOW_ACTIVATED_EVENT   = 'hammerhead|event|window-activated';
const WINDOW_DEACTIVATED_EVENT = 'hammerhead|event|window-deactivated';

export default class ActiveWindowTracker extends SandboxBase {
    constructor (sandbox) {
        super(sandbox);

        this.isIFrameWindow = null;
        this.activeWindow   = null;
        this.isActive       = null;
    }

    _notifyPrevActiveWindow () {
        if (this.activeWindow.top) {
            try {
                this.sandbox.message.sendServiceMsg({
                    cmd: WINDOW_DEACTIVATED_EVENT
                }, this.activeWindow);
            }
            catch (err) {
                //NOTE: the error appears in IE when the corresponding iframe is removed
                return void 0;
            }
        }
    }

    attach (window) {
        super.attach(window);

        this.isIFrameWindow = window !== window.top;
        this.activeWindow   = !this.isIFrameWindow ? window.top : null;
        this.isActive       = !this.isIFrameWindow;

        this.sandbox.message.on(this.sandbox.message.SERVICE_MSG_RECEIVED_EVENT, e => {
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

    isCurrentWindowActive () {
        return this.isActive;
    }

    makeCurrentWindowActive () {
        this.isActive = true;

        if (!this.isIFrameWindow) {
            this._notifyPrevActiveWindow();

            this.activeWindow = this.window;
        }
        else {
            this.sandbox.message.sendServiceMsg({
                cmd: WINDOW_ACTIVATED_EVENT
            }, this.window.top);
        }
    }
}
