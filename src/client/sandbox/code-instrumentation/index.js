import SandboxBase from '../base';
import PropertyAccessorsInstrumentation from './properties';
import LocationAccessorsInstrumentation from './location';
import MethodCallInstrumentation from './methods';
import { getAttributeProperty } from './properties/attributes';
import { PROCESS_SCRIPT_METH_NAME, process as processScript } from '../../../processing/js';

export default class CodeInstrumentation extends SandboxBase {
    constructor (sandbox) {
        super(sandbox);

        this.BODY_CONTENT_CHANGED_EVENT = 'bodyContentChanged';

        this.methodCallInstrumentation        = new MethodCallInstrumentation(sandbox);
        this.locationAccessorsInstrumentation = new LocationAccessorsInstrumentation(sandbox);
        this.propertyAccessorsInstrumentation = new PropertyAccessorsInstrumentation(sandbox);

        this.propertyAccessorsInstrumentation.on(this.propertyAccessorsInstrumentation.BODY_CONTENT_CHANGED_EVENT,
                el => this._emit(this.BODY_CONTENT_CHANGED_EVENT, el));
    }

    getAttributesProperty (el) {
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
