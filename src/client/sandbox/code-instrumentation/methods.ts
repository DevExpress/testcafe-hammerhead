import SandboxBase from '../base';
import INSTRUCTION from '../../../processing/script/instruction';
import { shouldInstrumentMethod } from '../../../processing/script/instrumented';
import { isWindow, isLocation } from '../../utils/dom';
import fastApply from '../../utils/fast-apply';
import * as typeUtils from '../../utils/types';
import { getProxyUrl, stringifyResourceType } from '../../utils/url';
import nativeMethods from '../native-methods-adapter';
import MessageSandbox from '../event/message';

export default class MethodCallInstrumentation extends SandboxBase {
    methodWrappers: any;

    constructor (private readonly _messageSandbox: MessageSandbox) {
        super();

        this.methodWrappers = {
            postMessage: {
                condition: isWindow,
                method:    (contentWindow: Window, args: any[]) => _messageSandbox.postMessage(contentWindow, args)
            },

            // NOTE: We cannot get the location wrapper for a cross-domain window. Therefore, we need to
            // intercept calls to the native 'replace' method.
            replace: {
                condition: isLocation,
                method:    (location: Location, args: any[]) => location.replace(getProxyUrl(args[0], {
                    resourceType: MethodCallInstrumentation._getLocationResourceType(location)
                }))
            },

            // NOTE: We cannot get the location wrapper for a cross-domain window. Therefore, we need to
            // intercept calls to the native 'assign' method.
            assign: {
                condition: isLocation,
                method:    (location: Location, args: any[]) => location.assign(getProxyUrl(args[0], {
                    resourceType: MethodCallInstrumentation._getLocationResourceType(location)
                }))
            }
        };
    }

    // NOTE: Isolate throw statement into a separate function because JS engine doesn't optimize such functions.
    static _error (msg: string) {
        throw new Error(msg);
    }

    static _getLocationResourceType (location: Location) {
        return window.top.location === location ? null : stringifyResourceType({ isIframe: true });
    }

    static _isPostMessageFn (win: Window, fn: Function) {
        // NOTE: in iOS Safari 9.3 win.postMessage === win.postMessage equals false
        if (win.postMessage === win.postMessage)
            return win.postMessage === fn;

        return fn && typeof fn.toString === 'function' && fn.toString() === win.postMessage.toString();
    }

    attach (window: Window) {
        super.attach(window);

        // NOTE: In Google Chrome, iframes whose src contains html code raise the 'load' event twice.
        // So, we need to define code instrumentation functions as 'configurable' so that they can be redefined.
        nativeMethods.objectDefineProperty(window, INSTRUCTION.callMethod, {
            value: (owner: any, methName: any, args: any[]) => {
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

        const methodCallInstrumentation = this;

        nativeMethods.objectDefineProperty(window, INSTRUCTION.getPostMessage, {
            value: function (win: Window, postMessageFn: Function) {
                if (arguments.length === 1 && !isWindow(win)) {
                    // @ts-ignore
                    return win.postMessage;
                }

                if (arguments.length === 2 && !MethodCallInstrumentation._isPostMessageFn(this, postMessageFn))
                    return postMessageFn;

                return function (...args: any[]) {
                    //@ts-ignore
                    return methodCallInstrumentation._messageSandbox.postMessage(this, args);
                };
            },
            configurable: true
        });
    }
}
