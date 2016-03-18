import SandboxBase from '../base';
import PropertyAccessorsInstrumentation from './properties';
import LocationAccessorsInstrumentation from './location';
import MethodCallInstrumentation from './methods';
import StoragesAccessorsInstrumentation from './storages';
import { getAttributeProperty } from './properties/attributes';
import { processScript } from '../../../processing/script';
import INSTRUCTION from '../../../processing/script/instruction';
import { isString } from '../../../utils/types';

export default class CodeInstrumentation extends SandboxBase {
    constructor (nodeMutation, eventSandbox, cookieSandbox, uploadSandbox, shadowUI, storageSandbox) {
        super();

        this.methodCallInstrumentation        = new MethodCallInstrumentation(eventSandbox.message);
        this.locationAccessorsInstrumentation = new LocationAccessorsInstrumentation();
        this.propertyAccessorsInstrumentation = new PropertyAccessorsInstrumentation(nodeMutation, eventSandbox,
            cookieSandbox, uploadSandbox, shadowUI, storageSandbox);
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

        // NOTE: GH-260
        window[INSTRUCTION.getEval] = evalFn => {
            if (evalFn !== window.eval)
                return evalFn;

            return script => {
                if (isString(script))
                    script = processScript(script);

                return evalFn(script);
            };
        };

        window[INSTRUCTION.processScript] = (script, isApply) => {
            if (isApply) {
                if (script && script.length && isString(script[0])) {
                    var args = [processScript(script[0], false, false)];

                    // NOTE: shallow-copy the remaining args. Don't use arr.slice(),
                    // since it may leak the arguments object.
                    // See: https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Functions/arguments
                    for (var i = 1; i < script.length; i++)
                        args.push(script[i]);

                    return args;
                }
            }
            else if (isString(script))
                return processScript(script, false, false);

            return script;
        };
    }
}

