import SandboxBase from './base';
import { isCrossDomainWindows } from '../utils/dom';
import { isConvertibleToString } from '../utils/types';
import { stringify as stringifyJSON } from '../json';

// NOTE: We should avoid using native object prototype methods,
// since they can be overridden by the client code. (GH-245)
const arrayMap = Array.prototype.map;

export default class ConsoleSandbox extends SandboxBase {
    constructor (messageSandbox) {
        super();

        this.CONSOLE_METH_CALLED_EVENT = 'hammerhead|event|console-meth-called';

        this.messageSandbox = messageSandbox;
    }

    _convertToStringOrStringify (obj) {
        if (isConvertibleToString(obj))
            return String(obj);

        return stringifyJSON(obj);
    }

    _proxyConsoleMeth (meth) {
        this.window.console[meth] = (...args) => {
            if (!isCrossDomainWindows(window, window.top)) {
                const sendToTopWindow = window !== window.top;
                const line            = arrayMap.call(args, this._convertToStringOrStringify).join(' ');

                if (sendToTopWindow) {
                    this.emit(this.CONSOLE_METH_CALLED_EVENT, { meth, line, inIframe: true });
                    this.messageSandbox.sendServiceMsg({ meth, line, cmd: this.CONSOLE_METH_CALLED_EVENT }, window.top);
                }
                else
                    this.emit(this.CONSOLE_METH_CALLED_EVENT, { meth, line });
            }

            this.nativeMethods.consoleMeths[meth].apply(this.nativeMethods.console, args);
        };
    }

    attach (window) {
        super.attach(window);

        this._proxyConsoleMeth('log');
        this._proxyConsoleMeth('info');
        this._proxyConsoleMeth('error');
        this._proxyConsoleMeth('warn');

        const messageSandbox = this.messageSandbox;

        messageSandbox.on(messageSandbox.SERVICE_MSG_RECEIVED_EVENT, ({ message }) => {
            if (message.cmd === this.CONSOLE_METH_CALLED_EVENT)
                this.emit(this.CONSOLE_METH_CALLED_EVENT, { meth: message.meth, line: message.line });
        });
    }
}
