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
/*eslint-disable no-unused-vars*/
import EventSandbox from '../event';
import WindowSandbox from '../node/window';
import MessageSandbox from '../event/message';
/*eslint-enable no-unused-vars*/

export default class CodeInstrumentation extends SandboxBase {
    _methodCallInstrumentation: MethodCallInstrumentation;
    _locationAccessorsInstrumentation: LocationAccessorsInstrumentation;
    _propertyAccessorsInstrumentation: PropertyAccessorsInstrumentation;
    elementPropertyAccessors: any;

    constructor (eventSandbox: EventSandbox, windowSandbox: WindowSandbox, messageSandbox: MessageSandbox) {
        super();

        this._methodCallInstrumentation        = new MethodCallInstrumentation(eventSandbox.message);
        this._locationAccessorsInstrumentation = new LocationAccessorsInstrumentation(messageSandbox);
        this._propertyAccessorsInstrumentation = new PropertyAccessorsInstrumentation(windowSandbox);
    }

    attach (window: Window) {
        super.attach(window);

        this._methodCallInstrumentation.attach(window);
        this._locationAccessorsInstrumentation.attach(window);
        this.elementPropertyAccessors = this._propertyAccessorsInstrumentation.attach(window);

        // NOTE: In Google Chrome, iframes whose src contains html code raise the 'load' event twice.
        // So, we need to define code instrumentation functions as 'configurable' so that they can be redefined.
        // NOTE: GH-260
        nativeMethods.objectDefineProperty(window, INSTRUCTION.getEval, {
            value: (evalFn: Function) => {
                // @ts-ignore
                if (evalFn !== window.eval)
                    return evalFn;

                return (script: any) => {
                    if (typeof script === 'string')
                        script = processScript(script);

                    return evalFn(script);
                };
            },

            configurable: true
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

            configurable: true
        });

        nativeMethods.objectDefineProperty(window, INSTRUCTION.processHtml, {
            value: (win: Window, html: any) => {
                if (typeof html === 'string')
                    html = processHtml(`<html><body>${html}</body></html>`, { processedContext: win });

                return html;
            },

            configurable: true
        });

        nativeMethods.objectDefineProperty(window, INSTRUCTION.getProxyUrl, {
            value: (url: any, baseUrl?: string) => {
                const storedBaseUrl    = urlResolver.getBaseUrl(document);
                const shouldChangeBase = baseUrl && baseUrl !== storedBaseUrl;

                if (shouldChangeBase)
                    urlResolver.updateBase(baseUrl, document);

                const proxyUrl = getProxyUrl(String(url), { resourceType: stringifyResourceType({ isScript: true }) });

                if (shouldChangeBase)
                    urlResolver.updateBase(storedBaseUrl, document);

                return proxyUrl;
            },

            configurable: true
        });
    }
}

