import SandboxBase from '../base';
import INSTRUCTION from '../../../processing/script/instruction';
import { shouldInstrumentMethod } from '../../../processing/script/instrumented';
import { isWindow, isLocation } from '../../utils/dom';
import fastApply from '../../utils/fast-apply';
import * as typeUtils from '../../utils/types';
import { getProxyUrl } from '../../utils/url';

export default class MethodCallInstrumentation extends SandboxBase {
    constructor (messageSandbox) {
        super();

        this.methodWrappers = {
            postMessage: {
                condition: isWindow,
                method:    (contentWindow, args) => messageSandbox.postMessage(contentWindow, args)
            },

            // NOTE: We cannot get the location wrapper for a cross-domain window. Therefore, we need to
            // intercept calls to the native 'replace' method.
            replace: {
                condition: isLocation,
                method:    (location, args) => location.replace(getProxyUrl(args[0]))
            },

            // NOTE: We cannot get the location wrapper for a cross-domain window. Therefore, we need to
            // intercept calls to the native 'assign' method.
            assign: {
                condition: isLocation,
                method:    (location, args) => location.replace(getProxyUrl(args[0]))
            }
        };
    }

    // NOTE: Isolate throw statement into a separate function because JS engine doesn't optimize such functions.
    static _error (msg) {
        throw new Error(msg);
    }

    attach (window) {
        super.attach(window);

        // NOTE: In Google Chrome, iframes whose src contains html code raise the 'load' event twice.
        // So, we need to define code instrumentation functions as 'configurable' so that they can be redefined.
        Object.defineProperty(window, INSTRUCTION.callMethod, {
            value: (owner, methName, args) => {
                if (typeUtils.isNullOrUndefined(owner))
                    MethodCallInstrumentation._error(`Cannot call method '${methName}' of ${typeUtils.inaccessibleTypeToStr(owner)}`);

                if (typeof owner[methName] !== 'function')
                    MethodCallInstrumentation._error(`'${methName}' is not a function`);

                // OPTIMIZATION: previously we've performed the
                // `this.methodWrappers.hasOwnProperty(methName)`
                // check which is quite slow. Now we use the
                // fast RegExp check instead.
                if (typeof methName === 'string' && shouldInstrumentMethod(methName) &&
                    this.methodWrappers[methName].condition(owner))
                    return this.methodWrappers[methName].method(owner, args);

                return fastApply(owner, methName, args);
            },
            configurable: true
        });

    }
}
