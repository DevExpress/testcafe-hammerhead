import SandboxBase from './base';

export default class ConsoleSandbox extends SandboxBase {
    constructor () {
        super();

        this.CONSOLE_METH_CALLED_EVENT = 'hammerhead|event|console-meth-called';
    }

    _proxyConsoleMeth (meth) {
        this.window.console[meth] = (...args) => {
            this.emit(this.CONSOLE_METH_CALLED_EVENT, { meth, args: args });
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
    }
}
