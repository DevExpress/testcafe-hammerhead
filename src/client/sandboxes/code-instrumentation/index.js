import propertyAccessorsInstrumentation from './properties';
import locationAccessorsInstrumentation from './location';
import methodCallInstrumentation from './methods';
import EventEmitter from '../../utils/event-emitter';
import { getAttributeProperty } from './properties/attributes';
import { PROCESS_SCRIPT_METH_NAME, process as processScript } from '../../../processing/js';

class CodeInstrumentation {
    constructor () {
        this.BODY_CONTENT_CHANGED = 'bodyContentChanged';
        this.eventEmitter         = new EventEmitter();

        propertyAccessorsInstrumentation.on(propertyAccessorsInstrumentation.BODY_CONTENT_CHANGED,
                el => this.eventEmitter.emit(this.BODY_CONTENT_CHANGED, el));
    }

    on (event, handler) {
        return this.eventEmitter.on(event, handler);
    }

    getAttributesProperty (el) {
        return getAttributeProperty(el);
    }

    getOriginalErrorHandler (window) {
        return propertyAccessorsInstrumentation.getOriginalErrorHandler(window);
    }

    init (window, document) {
        methodCallInstrumentation.initWindow(window);
        locationAccessorsInstrumentation.initWindow(window, document);

        var propertyAccessors = propertyAccessorsInstrumentation.initWindow(window, document);

        this.elementPropertyAccessors = propertyAccessors;

        window[PROCESS_SCRIPT_METH_NAME] = script => typeof script !== 'string' ? script : processScript(script);
    }
}

export default new CodeInstrumentation();
