import EventEmitter from '../utils/event-emitter';
import nativeMethods from './native-methods';
import { findDocument, isElementInDocument, getFrameElement } from '../utils/dom';
import INTERNAL_PROPS from '../../processing/dom/internal-properties';

export default class SandboxBase extends EventEmitter {
    window: Window | null  = null;
    nativeMethods = nativeMethods;
    document: Document | null = null;

    // NOTE: The sandbox is deactivated when its window is removed from the DOM.
    isDeactivated (): boolean {
        try {
            // NOTE: In IE11, a situation when the document is not active may occur.
            // eslint-disable-next-line no-unused-expressions
            this.document.body;

            if (this.window[INTERNAL_PROPS.hammerhead]) {
                const frameElement = getFrameElement(this.window);

                return !!frameElement && !isElementInDocument(frameElement, findDocument(frameElement));
            }
        }
        catch (e) { // eslint-disable-line no-empty
        }

        return true;
    }

    attach (window: Window, document?: Document): void {
        this.window   = window;
        this.document = document || window.document;
    }
}
