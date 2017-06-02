import SandboxBase from './base';
import nativeMethods from './native-methods';
import { processScript } from '../../processing/script';
import { isIE, version as browserVersion } from '../utils/browser';

// NOTE: When you call the focus and blur function for some elements in IE, the event handlers  must be raised
// asynchronously, but before executing functions that are called by using the window.setTimeout function. So,
// we need to raise the handlers with a timeout, but do it before calling other asynchronous functions.
export default class TimersSandbox extends SandboxBase {
    constructor () {
        super();

        this.timeouts          = [];
        this.deferredFunctions = [];
        this.setTimeout        = nativeMethods.setTimeout;
    }

    _wrapTimeoutFunctionsArguments (args) {
        var isScriptFirstArg = typeof args[0] === 'string';
        var func             = !isScriptFirstArg ? args[0] : null;
        var script           = isScriptFirstArg ? processScript(args[0], false) : null;

        if (isIE && browserVersion < 12) {
            var timersSandbox = this;
            var fnToRun       = isScriptFirstArg ? () => {
                // NOTE: We are switching eval to the global context with this assignment.
                // Unlike eval, the setTimeout/setInterval functions always work in the global context.
                var ev = this.window.eval;

                return ev(script);
            } : func;

            args[0] = function () {
                return timersSandbox._callDeferredFunction(fnToRun, arguments);
            };
        }
        else if (isScriptFirstArg)
            args[0] = script;

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
                nativeMethods.clearInterval.call(this.window, curTimeouts[j]);
                curHandlers[j]();
            }

            // NOTE: Handlers can create new deferred functions.
            return this._callDeferredFunction(fn, args);
        }

        return fn.apply(this.window, args);
    }

    attach (window) {
        super.attach(window);

        var timersSandbox = this;

        window.setTimeout = function (...args) {
            return nativeMethods.setTimeout.apply(window, timersSandbox._wrapTimeoutFunctionsArguments(args));
        };

        window.setInterval = function (...args) {
            return nativeMethods.setInterval.apply(window, timersSandbox._wrapTimeoutFunctionsArguments(args));
        };

        // NOTE: We are saving the setTimeout wrapper for internal use in case the page-script replaces
        // it with an invalid value.
        this.setTimeout = window.setTimeout;
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
        this.timeouts.push(nativeMethods.setTimeout.call(window, deferredFunction, 0));
    }
}

