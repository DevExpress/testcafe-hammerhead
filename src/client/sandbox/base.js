import EventEmitter from '../utils/event-emitter';
import nativeMethods from './native-methods';
import { findDocument, isElementInDocument, getFrameElement } from '../utils/dom';
import INTERNAL_PROPS from '../../processing/dom/internal-properties';

export default class SandboxBase extends EventEmitter {
    constructor () {
        super();

        this.window        = null;
        this.nativeMethods = nativeMethods;
    }

    // NOTE: The sandbox is deactivated when its window is removed from the DOM.
    isDeactivated () {
        try {
            if (this.window[INTERNAL_PROPS.hammerheadPropertyName]) {
                var frameElement = getFrameElement(this.window);

                return frameElement && !isElementInDocument(frameElement, findDocument(frameElement));
            }
        }
            /*eslint-disable no-empty */
        catch (e) {
        }
        /*eslint-enable no-empty */

        return true;
    }

    attach (window, document) {
        this.window   = window;
        this.document = document || window.document;
    }
}
