import SandboxBase from './base';

export default class ConsoleSandbox extends SandboxBase {
    constructor () {
        super();

        this.CONSOLE_METH_CALLED = 'hammerhead|console|console-meth-called-event';
    }

    attach (window) {
        super.attach(window);

        const sandbox = this;

        const proxyConsoleMeth = meth => {
            sandbox.window.console[meth] = function () {
                sandbox.emit(sandbox.CONSOLE_METH_CALLED, { meth, args: arguments });
                sandbox.nativeMethods.consoleMeths[meth].apply(sandbox.nativeMethods.console, arguments);
            };
        };

        proxyConsoleMeth('log');
        proxyConsoleMeth('info');
        proxyConsoleMeth('error');
        proxyConsoleMeth('warn');
    }
}
