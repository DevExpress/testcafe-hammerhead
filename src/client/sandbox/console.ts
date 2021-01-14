import SandboxBase from './base';
import { isCrossDomainWindows, isIframeWindow } from '../utils/dom';
import nativeMethods from '../sandbox/native-methods';
import MessageSandbox from './event/message';
import { overrideFunction } from '../utils/overriding';

export default class ConsoleSandbox extends SandboxBase {
    CONSOLE_METH_CALLED_EVENT = 'hammerhead|event|console-meth-called';

    private _serviceMsgReceivedEventCallback: Function;

    constructor (private readonly _messageSandbox: MessageSandbox) {
        super();

        this._serviceMsgReceivedEventCallback = ({ message }) => {
            if (message.cmd === this.CONSOLE_METH_CALLED_EVENT)
                this.emit(this.CONSOLE_METH_CALLED_EVENT, { meth: message.meth, line: message.line });
        };
    }

    private _toString (obj: any): string {
        try {
            return String(obj);
        }
        catch (e) {
            return 'object';
        }
    }

    private _proxyConsoleMeth (meth: keyof Console): void {
        overrideFunction(this.window.console, meth, (...args: any[]) => {
            if (!isCrossDomainWindows(window, window.top)) {
                const sendToTopWindow = isIframeWindow(window);
                const line            = nativeMethods.arrayMap.call(args, this._toString).join(' ');

                if (sendToTopWindow) {
                    this.emit(this.CONSOLE_METH_CALLED_EVENT, { meth, line, inIframe: true });
                    this._messageSandbox.sendServiceMsg({ meth, line, cmd: this.CONSOLE_METH_CALLED_EVENT }, window.top);
                }
                else
                    this.emit(this.CONSOLE_METH_CALLED_EVENT, { meth, line });
            }

            this.nativeMethods.consoleMeths[meth].apply(this.nativeMethods.console, args);
        });
    }

    attach (window: Window & typeof globalThis) {
        super.attach(window);

        this._proxyConsoleMeth('log');
        this._proxyConsoleMeth('info');
        this._proxyConsoleMeth('error');
        this._proxyConsoleMeth('warn');

        this._messageSandbox.on(this._messageSandbox.SERVICE_MSG_RECEIVED_EVENT, this._serviceMsgReceivedEventCallback);
    }
}
