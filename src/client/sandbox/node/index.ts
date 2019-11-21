import INTERNAL_PROPS from '../../../processing/dom/internal-properties';
import SandboxBase from '../base';
import WindowSandbox from './window';
import DocumentSandbox from './document';
import ElementSandbox from './element';
import DomProcessor from '../../../processing/dom';
import domProcessor from '../../dom-processor';
import * as domUtils from '../../utils/dom';
import { getNativeQuerySelectorAll } from '../../utils/query-selector';
import nativeMethods from '../native-methods';
import { URL_ATTRS } from '../../../processing/dom/attributes';
import INTERNAL_ATTRS from '../../../processing/dom/internal-attributes';
import NodeMutation from './mutation';
import IframeSandbox from '../iframe';
import EventSandbox from '../event';
import UploadSandbox from '../upload';
import ShadowUI from '../shadow-ui';
import CookieSandbox from '../cookie';
import * as browserUtils from '../../utils/browser';

const ATTRIBUTE_SELECTOR_REG_EX          = /\[([\w-]+)(\^?=.+?)]/g;
const ATTRIBUTE_OPERATOR_WITH_HASH_VALUE = /^\W+\s*#/;
const PSEUDO_CLASS_FOCUS_REG_EX          = /\s*:focus\b/gi;
const PSEUDO_CLASS_HOVER_REG_EX          = /:hover\b/gi;

export default class NodeSandbox extends SandboxBase {
    raiseBodyCreatedEvent: Function;
    doc: DocumentSandbox;
    win: WindowSandbox;
    element: ElementSandbox;

    constructor (readonly mutation: NodeMutation,
        readonly iframeSandbox: IframeSandbox,
        private readonly _eventSandbox: EventSandbox,
        private readonly _uploadSandbox: UploadSandbox,
        readonly shadowUI: ShadowUI,
        private readonly _cookieSandbox: CookieSandbox) {

        super();

        this.raiseBodyCreatedEvent = this._onBodyCreated;

        // NOTE: We need to define the property with the 'writable' descriptor for testing purposes
        nativeMethods.objectDefineProperty(document, INTERNAL_PROPS.documentCharset, {
            value:    domUtils.parseDocumentCharset(),
            writable: true
        });

        this.doc     = new DocumentSandbox(this, this.shadowUI, this._cookieSandbox);
        this.win     = new WindowSandbox(this, this._eventSandbox, this._uploadSandbox, this.mutation);
        this.element = new ElementSandbox(this, this._uploadSandbox, this.iframeSandbox, this.shadowUI, this._eventSandbox);
    }

    private _onBodyCreated (): void {
        this._eventSandbox.listeners.initDocumentBodyListening(this.document);
        this.mutation.onBodyCreated(this.document.body as HTMLBodyElement);
    }

    private _processElement (el) {
        const processedContext = el[INTERNAL_PROPS.processedContext];

        if (domUtils.isShadowUIElement(el) || processedContext === this.window)
            return;

        let urlAttrName = null;

        if (processedContext) {
            urlAttrName = domProcessor.getUrlAttr(el);
            urlAttrName = urlAttrName && el.hasAttribute(urlAttrName) ? urlAttrName : null;
        }

        const canAddNewProp         = nativeMethods.objectIsExtensible(el);
        const canUpdateExistingProp = processedContext && !nativeMethods.objectIsFrozen(el);

        if (canAddNewProp || canUpdateExistingProp) {
            nativeMethods.objectDefineProperty(el, INTERNAL_PROPS.processedContext, {
                value:    this.window,
                writable: true
            });
        }

        // NOTE: We need to reprocess url attribute of element, if it's moved to different window (GH-564)
        if (urlAttrName)
            el.setAttribute(urlAttrName, el.getAttribute(urlAttrName));

        this.element.processElement(el);
    }

    processNodes (el, doc?: Document) {
        if (!el) {
            doc = doc || this.document;

            if (doc.documentElement)
                this.processNodes(doc.documentElement);
        }
        else if (el.querySelectorAll) {
            this._processElement(el);

            const children = getNativeQuerySelectorAll(el).call(el, '*');
            const length   = nativeMethods.nodeListLengthGetter.call(children);

            for (let i = 0; i < length; i++)
                this._processElement(children[i]);
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
            const contentWindow   = nativeMethods.contentWindowGetter.call(iframe);
            const contentDocument = nativeMethods.contentDocumentGetter.call(iframe);

            // NOTE: Before overriding the iframe, we must restore native document methods.
            // Therefore, we save them before they are overridden.
            const iframeNativeMethods = new this.nativeMethods.constructor(contentDocument, contentWindow);

            contentWindow[INTERNAL_PROPS.iframeNativeMethods] = iframeNativeMethods;

            // NOTE: Override only the document (in fact, we only need the 'write' and 'writeln' methods).
            this.doc.attach(contentWindow, contentDocument);
        });

        // NOTE: In Google Chrome, iframes whose src contains html code raise the 'load' event twice.
        // So, we need to define code instrumentation functions as 'configurable' so that they can be redefined.
        nativeMethods.objectDefineProperty(window, INTERNAL_PROPS.processDomMethodName, {
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

    private static _processAttributeSelector (selector) {
        if (!ATTRIBUTE_SELECTOR_REG_EX.test(selector))
            return selector;

        return selector + ',' + selector.replace(ATTRIBUTE_SELECTOR_REG_EX, (str, name, operatorWithValue) => {
            if (URL_ATTRS.indexOf(name) !== -1 &&
                !ATTRIBUTE_OPERATOR_WITH_HASH_VALUE.test(operatorWithValue)) {
                name = DomProcessor.getStoredAttrName(name);

                return '[' + name + operatorWithValue + ']';
            }

            return str;
        });
    }

    static _processPseudoClassSelectors (selector: string) {
        // NOTE: When a selector that contains the ':focus' pseudo-class is used in the querySelector and
        // querySelectorAll functions, these functions return an empty result if the browser is not focused.
        // This replaces ':focus' with a custom CSS class to return the current active element in that case.
        // IE returns a valid element, so there is no need to replace the selector for it.

        if (!browserUtils.isIE)
            selector = selector.replace(PSEUDO_CLASS_FOCUS_REG_EX, '[' + INTERNAL_ATTRS.focusPseudoClass + ']');

        selector = selector.replace(PSEUDO_CLASS_HOVER_REG_EX, '[' + INTERNAL_ATTRS.hoverPseudoClass + ']');

        return selector;
    }

    static processSelector (selector) {
        if (selector) {
            selector = NodeSandbox._processPseudoClassSelectors(selector);
            selector = NodeSandbox._processAttributeSelector(selector);
        }

        return selector;
    }
}
