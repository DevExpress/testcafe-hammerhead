import SandboxBase from './base';
import nativeMethods from './native-methods';
import { processScript } from '../../processing/script';
import { overrideFunction } from '../utils/overriding';

export default class TimersSandbox extends SandboxBase {
    timeouts: any[];
    setTimeout: any;

    constructor () {
        super();

        this.timeouts          = [];
        this.setTimeout        = nativeMethods.setTimeout;
    }

    _wrapTimeoutFunctionsArguments (args) {
        const isScriptFirstArg = typeof args[0] === 'string';
        const script           = isScriptFirstArg ? processScript(args[0], false) : null;

        if (isScriptFirstArg)
            args[0] = script;

        return args;
    }

    attach (window) {
        super.attach(window);

        const timersSandbox = this;

        overrideFunction(window, 'setTimeout', function (...args) {
            return nativeMethods.setTimeout.apply(window, timersSandbox._wrapTimeoutFunctionsArguments(args));
        });

        overrideFunction(window, 'setInterval', function (...args) {
            return nativeMethods.setInterval.apply(window, timersSandbox._wrapTimeoutFunctionsArguments(args));
        });

        // NOTE: We are saving the setTimeout wrapper for internal use in case the page-script replaces
        // it with an invalid value.
        this.setTimeout = window.setTimeout;
    }
}

