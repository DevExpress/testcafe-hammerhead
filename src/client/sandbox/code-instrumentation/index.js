import SandboxBase from '../base';
import PropertyAccessorsInstrumentation from './properties';
import LocationAccessorsInstrumentation from './location';
import MethodCallInstrumentation from './methods';
import StoragesAccessorsInstrumentation from './storages';
import { getAttributeProperty } from './properties/attributes';
import { processScript } from '../../../processing/script';
import INSTRUCTION from '../../../processing/script/instruction';
import nativeMethods from '../../sandbox/native-methods';
import { processHtml } from '../../utils/html';

export default class CodeInstrumentation extends SandboxBase {
    constructor (nodeMutation, eventSandbox, cookieSandbox, shadowUI, storageSandbox, elementSandbox) {
        super();

        this.methodCallInstrumentation        = new MethodCallInstrumentation(eventSandbox.message);
        this.locationAccessorsInstrumentation = new LocationAccessorsInstrumentation();
        this.propertyAccessorsInstrumentation = new PropertyAccessorsInstrumentation(nodeMutation, eventSandbox,
            cookieSandbox, shadowUI, storageSandbox, elementSandbox);
        this.storagesAccessorsInstrumentation = new StoragesAccessorsInstrumentation(storageSandbox);
    }

    static getAttributesProperty (el) {
        return getAttributeProperty(el);
    }

    static getOriginalErrorHandler (window) {
        return PropertyAccessorsInstrumentation.getOriginalErrorHandler(window);
    }

    attach (window) {
        super.attach(window);

        this.methodCallInstrumentation.attach(window);
        this.locationAccessorsInstrumentation.attach(window);
        this.storagesAccessorsInstrumentation.attach(window);
        this.elementPropertyAccessors = this.propertyAccessorsInstrumentation.attach(window);

        // NOTE: In Google Chrome, iframes whose src contains html code raise the 'load' event twice.
        // So, we need to define code instrumentation functions as 'configurable' so that they can be redefined.
        // NOTE: GH-260
        nativeMethods.objectDefineProperty.call(window.Object, window, INSTRUCTION.getEval, {
            value: evalFn => {
                if (evalFn !== window.eval)
                    return evalFn;

                return script => {
                    if (typeof script === 'string')
                        script = processScript(script);

                    return evalFn(script);
                };
            },
            configurable: true
        });

        nativeMethods.objectDefineProperty.call(window.Object, window, INSTRUCTION.processScript, {
            value: (script, isApply) => {
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

        nativeMethods.objectDefineProperty.call(window.Object, window, INSTRUCTION.processHtml, {
            value: (win, html) => {
                if (typeof html === 'string')
                    html = processHtml(`<html><body>${html}</body></html>`, { processedContext: win });

                return html;
            },
            configurable: true
        });
    }
}

