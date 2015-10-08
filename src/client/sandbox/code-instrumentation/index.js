import SandboxBase from '../base';
import PropertyAccessorsInstrumentation from './properties';
import LocationAccessorsInstrumentation from './location';
import MethodCallInstrumentation from './methods';
import { getAttributeProperty } from './properties/attributes';
import { PROCESS_SCRIPT_METH_NAME, process as processScript } from '../../../processing/js';

export default class CodeInstrumentation extends SandboxBase {
    constructor (nodeMutation, eventSandbox, cookieSandbox, uploadSandbox, shadowUI) {
        super();

        this.methodCallInstrumentation        = new MethodCallInstrumentation(eventSandbox.message);
        this.locationAccessorsInstrumentation = new LocationAccessorsInstrumentation();
        this.propertyAccessorsInstrumentation = new PropertyAccessorsInstrumentation(nodeMutation, eventSandbox,
            cookieSandbox, uploadSandbox, shadowUI);
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
        this.elementPropertyAccessors = this.propertyAccessorsInstrumentation.attach(window);

        window[PROCESS_SCRIPT_METH_NAME] = script => typeof script !== 'string' ? script : processScript(script);
    }
}
