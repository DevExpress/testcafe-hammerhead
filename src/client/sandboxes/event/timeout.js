import * as Browser from '../../util/browser';
import NativeMethods from '../native-methods';

// NOTE: when you call focus/blur function of some element in IE, handlers of the event are executed it async manner,
// but before any function that is called with the window.setTimeout function. So, we should raise handlers with
// timeout but we should do it before other async functions calling
var timeouts          = [];
var deferredFunctions = [];
var nativeSetTimeout  = NativeMethods.setTimeout;
var nativeSetInterval = NativeMethods.setInterval;


function wrapTimeoutFunctionsArguments (args) {
    var fn      = args[0];
    var fnToRun = typeof fn === 'function' ? fn : function () {
        window.eval(fn);
    };

    args[0] = function () {
        return callDeferredFunction(fnToRun, arguments);
    };

    return args;
}

function callDeferredFunction (fn, args) {
    if (timeouts.length) {
        var curTimeouts = [];
        var curHandlers = [];

        var i = 0;

        for (; i < timeouts.length; i++) {
            curTimeouts.push(timeouts[i]);
            curHandlers.push(deferredFunctions[i]);
        }

        timeouts          = [];
        deferredFunctions = [];

        for (i = 0; i < curTimeouts.length; i++) {
            window.clearInterval(curTimeouts[i]);
            curHandlers[i]();
        }

        //NOTE: handlers can create new deferred functions
        return callDeferredFunction(fn, args);
    }

    return fn.apply(window, args);
}


export function init (window) {
    if (Browser.isIE && Browser.version < 12) {
        window.setTimeout = function () {
            return nativeSetTimeout.apply(window, wrapTimeoutFunctionsArguments(arguments));
        };

        window.setInterval = function () {
            return nativeSetInterval.apply(window, wrapTimeoutFunctionsArguments(arguments));
        };

        internalSetTimeout = window.setTimeout;
    }
}

export var internalSetTimeout = nativeSetTimeout;

export function deferFunction (fn) {
    var deferredFunction = function () {
        fn();

        for (var i = 0; i < deferredFunctions.length; i++) {
            if (deferredFunctions[i] === deferredFunction) {
                deferredFunctions.splice(i, 1);
                timeouts.splice(i, 1);

                break;
            }
        }
    };

    deferredFunctions.push(deferredFunction);
    timeouts.push(nativeSetTimeout.call(window, deferredFunction, 0));
}
