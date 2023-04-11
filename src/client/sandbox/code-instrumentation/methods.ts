import SandboxBase from '../base';
import INSTRUCTION from '../../../processing/script/instruction';
import { shouldInstrumentMethod } from '../../../processing/script/instrumented';
import { isWindow, isLocation } from '../../utils/dom';
import fastApply from '../../utils/fast-apply';
import {
    isNullOrUndefined,
    inaccessibleTypeToStr,
    isFunction,
} from '../../utils/types';
import { getProxyUrl, stringifyResourceType } from '../../utils/url';
import nativeMethods from '../native-methods';
import MessageSandbox from '../event/message';
import settings from '../../settings';

export default class MethodCallInstrumentation extends SandboxBase {
    methodWrappers: any;

    constructor (private readonly _messageSandbox: MessageSandbox) {
        super();

        this._buildMethodWrappers();
    }

    _buildMethodWrappers (): void {
        this.methodWrappers = {
            postMessage: {
                condition: isWindow,
                method:    (contentWindow: Window, args: any[]) => this._messageSandbox.postMessage(contentWindow, args),
            },
        };

        if (settings.nativeAutomation)
            return;

        // NOTE: We cannot get the location wrapper for a cross-domain window. Therefore, we need to
        // intercept calls to the native 'replace' and 'assign' methods.
        this.methodWrappers.replace = {
            condition: isLocation,
            method:    (location: Location, args: any[]) => location.replace(getProxyUrl(args[0], {
                resourceType: MethodCallInstrumentation._getLocationResourceType(location),
            })),
        };

        this.methodWrappers.assign = {
            condition: isLocation,
            method:    (location: Location, args: any[]) => location.assign(getProxyUrl(args[0], {
                resourceType: MethodCallInstrumentation._getLocationResourceType(location),
            })),
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

        return fn && isFunction(fn.toString) && fn.toString() === win.postMessage.toString();
    }

    attach (window: Window & typeof globalThis) {
        super.attach(window);

        // NOTE: In Google Chrome, iframes whose src contains html code raise the 'load' event twice.
        // So, we need to define code instrumentation functions as 'configurable' so that they can be redefined.
        nativeMethods.objectDefineProperty(window, INSTRUCTION.callMethod, {
            value: (owner: any, methName: any, args: any[], optional = false) => {
                if (isNullOrUndefined(owner) && !optional)
                    MethodCallInstrumentation._error(`Cannot call method '${methName}' of ${inaccessibleTypeToStr(owner)}`);

                if (!isFunction(owner[methName]) && !optional)
                    MethodCallInstrumentation._error(`'${methName}' is not a function`);

                // OPTIMIZATION: previously we've performed the
                // `this.methodWrappers.hasOwnProperty(methName)`
                // check which is quite slow. Now we use the
                // fast RegExp check instead.
                if (typeof methName === 'string' && shouldInstrumentMethod(methName)) {
                    if (optional && !isFunction(owner[methName]))
                        return void 0;
                    else if (this.methodWrappers[methName].condition(owner))
                        return this.methodWrappers[methName].method(owner, args);
                }

                if (optional && !isFunction(owner[methName]))
                    return void 0;

                return fastApply(owner, methName, args);
            },
            configurable: true,
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
            configurable: true,
        });
    }
}
