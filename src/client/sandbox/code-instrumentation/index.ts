import SandboxBase from '../base';
import PropertyAccessorsInstrumentation from './properties';
import LocationAccessorsInstrumentation from './location';
import MethodCallInstrumentation from './methods';
import { processScript } from '../../../processing/script';
import INSTRUCTION from '../../../processing/script/instruction';
import nativeMethods from '../../sandbox/native-methods';
import { processHtml } from '../../utils/html';
import { getProxyUrl, stringifyResourceType } from '../../utils/url';
import urlResolver from '../../utils/url-resolver';
import EventSandbox from '../event';
import MessageSandbox from '../event/message';
import { isFunction } from 'lodash';

export default class CodeInstrumentation extends SandboxBase {
    static readonly WRAPPED_EVAL_FN = 'hammerhead|code-instrumentation|wrapped-eval-fn';

    _methodCallInstrumentation: MethodCallInstrumentation;
    _locationAccessorsInstrumentation: LocationAccessorsInstrumentation;
    _propertyAccessorsInstrumentation: PropertyAccessorsInstrumentation;

    constructor (eventSandbox: EventSandbox, messageSandbox: MessageSandbox) {
        super();

        this._methodCallInstrumentation        = new MethodCallInstrumentation(eventSandbox.message);
        this._locationAccessorsInstrumentation = new LocationAccessorsInstrumentation(messageSandbox);
        this._propertyAccessorsInstrumentation = new PropertyAccessorsInstrumentation();
    }

    attach (window: Window & typeof globalThis) {
        super.attach(window);

        this._methodCallInstrumentation.attach(window);
        this._locationAccessorsInstrumentation.attach(window);
        this._propertyAccessorsInstrumentation.attach(window);

        // NOTE: In Google Chrome, iframes whose src contains html code raise the 'load' event twice.
        // So, we need to define code instrumentation functions as 'configurable' so that they can be redefined.
        // NOTE: GH-260
        nativeMethods.objectDefineProperty(window, INSTRUCTION.getEval, {
            value: (evalFn: Function) => {
                if (evalFn !== window.eval)
                    return evalFn;

                const evalWrapper = (script: any) => {
                    if (typeof script === 'string')
                        script = processScript(script);

                    return evalFn(script);
                };

                nativeMethods.objectDefineProperty(evalWrapper, CodeInstrumentation.WRAPPED_EVAL_FN, { value: evalFn });

                return evalWrapper;
            },

            configurable: true,
        });

        nativeMethods.objectDefineProperty(window, INSTRUCTION.processScript, {
            value: (script: any, isApply: true) => {
                if (isApply) {
                    if (script && script.length && typeof script[0] === 'string') {
                        const args = [processScript(script[0], false)];

                        // NOTE: shallow-copy the remaining args. Don't use arr.slice(),
                        // since it may leak the arguments object.
                        // See: https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Functions/arguments
                        for (let i = 1; i < script.length; i++)
                            args.push(script[i]);

                        return args;
                    }
                }
                else if (typeof script === 'string')
                    return processScript(script, false);

                return script;
            },

            configurable: true,
        });

        nativeMethods.objectDefineProperty(window, INSTRUCTION.processHtml, {
            value: (win: Window, html: any) => {
                if (typeof html === 'string')
                    html = processHtml(`<html><body>${html}</body></html>`, { processedContext: win });

                return html;
            },

            configurable: true,
        });

        nativeMethods.objectDefineProperty(window, INSTRUCTION.getProxyUrl, {
            value: (url: any, baseUrl?: string) => {
                const storedBaseUrl    = urlResolver.getBaseUrl(this.document);
                const shouldChangeBase = baseUrl && baseUrl !== storedBaseUrl;

                if (shouldChangeBase)
                    urlResolver.updateBase(baseUrl as string, this.document);

                const proxyUrl = getProxyUrl(url, { resourceType: stringifyResourceType({ isScript: true }) });

                if (shouldChangeBase)
                    urlResolver.updateBase(storedBaseUrl, this.document);

                return proxyUrl;
            },

            configurable: true,
        });

        nativeMethods.objectDefineProperty(window, INSTRUCTION.restArray, {
            value:        (array: any[], startIndex: number) => nativeMethods.arraySlice.call(array, startIndex),
            configurable: true,
        });

        nativeMethods.objectDefineProperty(window, INSTRUCTION.arrayFrom, {
            value: (target: any) => {
                if (!target)
                    return target;

                const shouldConvertToArray = !nativeMethods.isArray.call(nativeMethods.Array, target) &&
                    isFunction(target[Symbol.iterator]);

                return shouldConvertToArray ? nativeMethods.arrayFrom.call(nativeMethods.Array, target) : target;
            },
            configurable: true,
        });

        nativeMethods.objectDefineProperty(window, INSTRUCTION.restObject, {
            value: (obj: object, excludeProps: string[]) => {
                const rest = {};
                const keys = nativeMethods.objectKeys(obj);

                for (const key of keys) {
                    if (excludeProps.indexOf(key) < 0)
                        rest[key] = obj[key];
                }

                return rest;
            },

            configurable: true,
        });
    }
}

