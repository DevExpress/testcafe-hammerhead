import SandboxBase from '../base';
import { isIE, version as browserVersion } from '../../utils/browser';
import { setTimeout as nativeSetTimeout, setInterval as nativeSetInterval } from '../native-methods';

// NOTE: when you call focus/blur function of some element in IE, handlers of the event are executed it async manner,
// but before any function that is called with the window.setTimeout function. So, we should raise handlers with
// timeout but we should do it before other async functions calling
export default class TimersSandbox extends SandboxBase {
    constructor (sandbox) {
        super(sandbox);

        this.timeouts           = [];
        this.deferredFunctions  = [];
        this.internalSetTimeout = nativeSetTimeout;
    }

    _wrapTimeoutFunctionsArguments (args) {
        var fn             = args[0];
        var fnToRun        = typeof fn === 'function' ? fn : () => window.eval(fn);
        var timeoutSandbox = this;

        args[0] = function () {
            return timeoutSandbox._callDeferredFunction(fnToRun, arguments);
        };

        return args;
    }

    _callDeferredFunction (fn, args) {
        if (this.timeouts.length) {
            var curTimeouts = [];
            var curHandlers = [];

            for (var i = 0; i < this.timeouts.length; i++) {
                curTimeouts.push(this.timeouts[i]);
                curHandlers.push(this.deferredFunctions[i]);
            }

            this.timeouts          = [];
            this.deferredFunctions = [];

            for (var j = 0; j < curTimeouts.length; j++) {
                this.window.clearInterval(curTimeouts[j]);
                curHandlers[j]();
            }

            //NOTE: handlers can create new deferred functions
            return this._callDeferredFunction(fn, args);
        }

        return fn.apply(this.window, args);
    }

    attach (window) {
        super.attach(window);

        var timeoutSandbox = this;

        if (isIE && browserVersion < 12) {
            window.setTimeout = function () {
                return nativeSetTimeout.apply(window, timeoutSandbox._wrapTimeoutFunctionsArguments(arguments));
            };

            window.setInterval = function () {
                return nativeSetInterval.apply(window, timeoutSandbox._wrapTimeoutFunctionsArguments(arguments));
            };

            this.internalSetTimeout = window.setTimeout;
        }
    }

    deferFunction (fn) {
        var deferredFunction = () => {
            fn();

            for (var i = 0; i < this.deferredFunctions.length; i++) {
                if (this.deferredFunctions[i] === deferredFunction) {
                    this.deferredFunctions.splice(i, 1);
                    this.timeouts.splice(i, 1);

                    break;
                }
            }
        };

        this.deferredFunctions.push(deferredFunction);
        this.timeouts.push(nativeSetTimeout.call(window, deferredFunction, 0));
    }
}

