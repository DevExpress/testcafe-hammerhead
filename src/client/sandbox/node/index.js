import INTERNAL_PROPS from '../../../processing/dom/internal-properties';
import SandboxBase from '../base';
import WindowSandbox from './window';
import DocumentSandbox from './document';
import ElementSandbox from './element';
import FocusBlurSandbox from '../event/focus-blur';
import { getStoredAttrName } from '../../../processing/dom';
import domProcessor from '../../dom-processor';
import * as domUtils from '../../utils/dom';
import { getNativeQuerySelectorAll } from '../../utils/query-selector';
import nativeMethods from '../native-methods';
import { URL_ATTRS } from '../../../processing/dom/attributes';

const ATTRIBUTE_SELECTOR_REG_EX          = /\[([\w-]+)(\^?=.+?)]/g;
const ATTRIBUTE_OPERATOR_WITH_HASH_VALUE = /^\W+\s*#/;

export default class NodeSandbox extends SandboxBase {
    constructor (nodeMutation, iframeSandbox, eventSandbox, uploadSandbox, shadowUI, cookieSandbox) {
        super();

        this.raiseBodyCreatedEvent = this._onBodyCreated;

        // NOTE: We need to define the property with the 'writable' descriptor for testing purposes
        nativeMethods.objectDefineProperty.call(window.Object, document, INTERNAL_PROPS.documentCharset, {
            value:    domUtils.parseDocumentCharset(),
            writable: true
        });

        this.eventSandbox  = eventSandbox;
        this.iframeSandbox = iframeSandbox;
        this.shadowUI      = shadowUI;
        this.mutation      = nodeMutation;

        this.doc     = new DocumentSandbox(this, shadowUI, cookieSandbox);
        this.win     = new WindowSandbox(this, eventSandbox, uploadSandbox, nodeMutation);
        this.element = new ElementSandbox(this, uploadSandbox, iframeSandbox, shadowUI, eventSandbox);
    }

    _onBodyCreated () {
        this.eventSandbox.listeners.initDocumentBodyListening(this.document);
        this.mutation.onBodyCreated({
            body: this.document.body
        });
    }

    _processElement (el) {
        const processedContext = el[INTERNAL_PROPS.processedContext];

        if (domUtils.isShadowUIElement(el) || processedContext === this.window)
            return;

        let urlAttrName = null;

        if (processedContext) {
            urlAttrName = domProcessor.getUrlAttr(el);
            urlAttrName = el.hasAttribute(urlAttrName) ? urlAttrName : null;
        }

        const canAddNewProp         = nativeMethods.objectIsExtensible.call(window.Object, el);
        const canUpdateExistingProp = processedContext && !nativeMethods.objectIsFrozen.call(window.Object, el);

        if (canAddNewProp || canUpdateExistingProp) {
            nativeMethods.objectDefineProperty.call(this.window, el, INTERNAL_PROPS.processedContext, {
                value:    this.window,
                writable: true
            });
        }

        // NOTE: We need to reprocess url attribute of element, if it's moved to different window (GH-564)
        if (urlAttrName)
            el.setAttribute(urlAttrName, el.getAttribute(urlAttrName));

        this.element.processElement(el);
    }

    processNodes (el, doc) {
        if (!el) {
            doc = doc || this.document;

            if (doc.documentElement)
                this.processNodes(doc.documentElement);
        }
        else if (el.querySelectorAll) {
            this._processElement(el);

            const children = getNativeQuerySelectorAll(el).call(el, '*');

            for (const child of children)
                this._processElement(child);
        }
    }

    // NOTE: DOM sandbox hides evidence of the content proxying from a page native script. Proxy replaces URLs for
    // resources. Our goal is to make the native script think that all resources are fetched from the destination
    // resource, not from proxy, and also provide proxying for dynamically created elements.
    attach (window) {
        const document                  = window.document;
        let domContentLoadedEventRaised = false;

        super.attach(window, document);

        this.iframeSandbox.on(this.iframeSandbox.IFRAME_DOCUMENT_CREATED_EVENT, ({ iframe }) => {
            // NOTE: Before overriding the iframe, we must restore native document methods.
            // Therefore, we save them before they are overridden.
            const iframeNativeMethods = new this.nativeMethods.constructor(iframe.contentDocument, iframe.contentWindow);

            iframe.contentWindow[INTERNAL_PROPS.iframeNativeMethods] = iframeNativeMethods;

            // NOTE: Override only the document (in fact, we only need the 'write' and 'writeln' methods).
            this.doc.attach(iframe.contentWindow, iframe.contentDocument);
        });

        // NOTE: In Google Chrome, iframes whose src contains html code raise the 'load' event twice.
        // So, we need to define code instrumentation functions as 'configurable' so that they can be redefined.
        nativeMethods.objectDefineProperty.call(window.Object, window, INTERNAL_PROPS.processDomMethodName, {
            value: (el, doc) => {
                // NOTE: TestCafe creates a shadow-ui root before the DOMContentLoaded event (once document.body is
                // available). Sometimes for a very heavy DOM or a very slow loading the body doesn't contain all
                // elements at that moment and as a result after a full page loading our root element becomes not
                // the last child of the body. So we need to make the root last body child manually on every script
                // loading until the DOMContentLoaded event is raised.
                if (!domContentLoadedEventRaised)
                    this.shadowUI.onBodyElementMutation();

                this.processNodes(el, doc);
            },

            configurable: true
        });

        // NOTE: In some browsers (for example Firefox), the 'window.document' object is different when iframe is
        // created and when the document’s ready event is raised. Therefore, we need to update the 'document' object
        // to override its methods (Q527555).
        document.addEventListener('DOMContentLoaded', () => {
            domContentLoadedEventRaised = true;

            this.processNodes(null, document);
        }, false);

        this.doc.attach(window, document);
        this.win.attach(window);
        this.element.attach(window);
    }

    static _processAttributeSelector (selector) {
        if (!ATTRIBUTE_SELECTOR_REG_EX.test(selector))
            return selector;

        return selector.replace(ATTRIBUTE_SELECTOR_REG_EX, (str, name, operatorWithValue) => {
            if (URL_ATTRS.indexOf(name) !== -1 &&
                !ATTRIBUTE_OPERATOR_WITH_HASH_VALUE.test(operatorWithValue)) {
                name = getStoredAttrName(name);

                return '[' + name + operatorWithValue + ']';
            }

            return str;
        });
    }

    static processSelector (selector) {
        if (selector) {
            selector = FocusBlurSandbox._processFocusPseudoClassSelector(selector);
            selector = NodeSandbox._processAttributeSelector(selector);
        }

        return selector;
    }
}
