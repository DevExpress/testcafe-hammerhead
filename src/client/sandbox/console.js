import SandboxBase from './base';
import { isCrossDomainWindows } from '../utils/dom';

export default class ConsoleSandbox extends SandboxBase {
    constructor (messageSandbox) {
        super();

        this.CONSOLE_METH_CALLED_EVENT = 'hammerhead|event|console-meth-called';

        this.messageSandbox = messageSandbox;
    }

    _proxyConsoleMeth (meth) {
        this.window.console[meth] = (...args) => {
            if (!isCrossDomainWindows(window, window.top)) {
                const sendToTopWindow = window !== window.top;

                if (sendToTopWindow) {
                    this.emit(this.CONSOLE_METH_CALLED_EVENT, { meth, args, inIframe: true });
                    this.messageSandbox.sendServiceMsg({ meth, args, cmd: this.CONSOLE_METH_CALLED_EVENT }, window.top);
                }
                else
                    this.emit(this.CONSOLE_METH_CALLED_EVENT, { meth, args });
            }

            this.nativeMethods.consoleMeths[meth].apply(this.nativeMethods.console, args);
        };
    }

    attach (window) {
        super.attach(window);

        if (this.window.console && typeof this.window.console.log.apply === 'function') {
            // NOTE: ie9 has no the `window.console` object when developer tools are closed.
            // If they are opened there is no `console.log.apply`, so we skip this case.
            this._proxyConsoleMeth('log');
            this._proxyConsoleMeth('info');
            this._proxyConsoleMeth('error');
            this._proxyConsoleMeth('warn');
        }

        const messageSandbox = this.messageSandbox;

        messageSandbox.on(messageSandbox.SERVICE_MSG_RECEIVED_EVENT, e => {
            const message = e.message;

            if (message.cmd === this.CONSOLE_METH_CALLED_EVENT)
                this.emit(this.CONSOLE_METH_CALLED_EVENT, { meth: message.meth, args: message.args });
        });
    }
}
