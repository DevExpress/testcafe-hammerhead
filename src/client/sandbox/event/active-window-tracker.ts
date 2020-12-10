import SandboxBase from '../base';
import MessageSandbox from './message';

const WINDOW_ACTIVATED_EVENT   = 'hammerhead|event|window-activated';
const WINDOW_DEACTIVATED_EVENT = 'hammerhead|event|window-deactivated';

export default class ActiveWindowTracker extends SandboxBase {
    private _isIframeWindow = false;
    private _activeWindow: Window | null = null;
    private _isActive = false;

    constructor (private readonly _messageSandbox: MessageSandbox) { //eslint-disable-line no-unused-vars
        super();
    }

    _notifyPrevActiveWindow (): void {
        try {
            if (this._activeWindow && this._activeWindow.top && this._activeWindow !== this._activeWindow.top) {
                this._messageSandbox.sendServiceMsg({
                    cmd: WINDOW_DEACTIVATED_EVENT
                }, this._activeWindow);
            }
        }
        catch (err) {
            // NOTE: The error appears in IE when the corresponding iframe is removed.
        }
    }

    attach (window: Window & typeof globalThis): void {
        super.attach(window);

        this._isIframeWindow = window !== window.top;
        this._activeWindow   = !this._isIframeWindow ? window.top : null;
        this._isActive       = !this._isIframeWindow;

        this._messageSandbox.on(this._messageSandbox.SERVICE_MSG_RECEIVED_EVENT, e => {
            if (e.message.cmd === WINDOW_ACTIVATED_EVENT) {
                this._notifyPrevActiveWindow();

                this._isActive     = false;
                this._activeWindow = e.source;
            }
            else if (e.message.cmd === WINDOW_DEACTIVATED_EVENT)
                this._isActive = false;
        });
    }

    isCurrentWindowActive (): boolean {
        return this._isActive;
    }

    makeCurrentWindowActive (): void {
        this._isActive = true;

        if (!this._isIframeWindow) {
            this._notifyPrevActiveWindow();

            this._activeWindow = this.window;
        }
        else if (this.window) {
            this._messageSandbox.sendServiceMsg({
                cmd: WINDOW_ACTIVATED_EVENT
            }, this.window.top);
        }
    }
}
