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
import ChildWindowSandbox from '../child-window';
import DocumentTitleStorage from './document/title-storage';
import DocumentTitleStorageInitializer from './document/title-storage-initializer';
import urlResolver from '../../utils/url-resolver';


const ATTRIBUTE_SELECTOR_REG_EX          = /\[([\w-]+)(\^?=.+?)]/g;
const ATTRIBUTE_OPERATOR_WITH_HASH_VALUE = /^\W+\s*#/;
const PSEUDO_CLASS_FOCUS_REG_EX          = /\s*:focus\b/gi;
const PSEUDO_CLASS_HOVER_REG_EX          = /:hover\b/gi;

export default class NodeSandbox extends SandboxBase {
    raiseBodyCreatedEvent: Function;
    doc: DocumentSandbox;
    win: WindowSandbox;
    element: ElementSandbox;
    private readonly _documentTitleStorageInitializer: DocumentTitleStorageInitializer | null;

    constructor (readonly mutation: NodeMutation,
        readonly iframeSandbox: IframeSandbox,
        private readonly _eventSandbox: EventSandbox,
        private readonly _uploadSandbox: UploadSandbox,
        readonly shadowUI: ShadowUI,
        private readonly _cookieSandbox: CookieSandbox,
        private readonly _childWindowSandbox: ChildWindowSandbox) {

        super();

        this.raiseBodyCreatedEvent = this._onBodyCreated;

        // NOTE: We need to define the property with the 'writable' descriptor for testing purposes
        nativeMethods.objectDefineProperty(document, INTERNAL_PROPS.documentCharset, {
            value:    domUtils.parseDocumentCharset(),
            writable: true,
        });

        this._documentTitleStorageInitializer = NodeSandbox._createDocumentTitleStorageInitializer();

        this.doc     = new DocumentSandbox(this, this.shadowUI, this._cookieSandbox, this.iframeSandbox, this._documentTitleStorageInitializer);
        this.win     = new WindowSandbox(this, this._eventSandbox, this._uploadSandbox, this.mutation, this._childWindowSandbox, this._documentTitleStorageInitializer);
        this.element = new ElementSandbox(this, this._uploadSandbox, this.iframeSandbox, this.shadowUI, this._eventSandbox, this._childWindowSandbox);
    }

    private static _createDocumentTitleStorageInitializer (): DocumentTitleStorageInitializer | null {
        if (domUtils.isIframeWindow(window))
            return null;

        const documentTitleStorage = new DocumentTitleStorage(document);

        return new DocumentTitleStorageInitializer(documentTitleStorage);
    }

    private _onBodyCreated (): void {
        this._eventSandbox.listeners.initDocumentBodyListening(this.document);
        this.mutation.onBodyCreated(this.document.body as HTMLBodyElement);
    }

    private _processElement (el: Element): void {
        const processedContext = el[INTERNAL_PROPS.processedContext];
        const isBaseUrlChanged = !!el[INTERNAL_PROPS.currentBaseUrl] &&
                                 el[INTERNAL_PROPS.currentBaseUrl] !== urlResolver.getBaseUrl(this.document);

        if (!isBaseUrlChanged && (domUtils.isShadowUIElement(el) || processedContext === this.window))
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
                writable: true,
            });
        }

        // NOTE: We need to reprocess url attribute of element, if it's moved to different window (GH-564)
        // or a base element is added dynamically (GH-1965)
        if (urlAttrName)
            el.setAttribute(urlAttrName, el.getAttribute(urlAttrName));

        if (isBaseUrlChanged)
            delete el[INTERNAL_PROPS.currentBaseUrl];

        this.element.processElement(el);
    }

    onOriginFirstTitleElementInHeadLoaded (): void {
        if (this._documentTitleStorageInitializer)
            this._documentTitleStorageInitializer.onPageTitleLoaded();
    }

    processNodes (el?: Element | DocumentFragment, doc?: Document): void {
        if (!el) {
            doc = doc || this.document;

            if (doc.documentElement)
                this.processNodes(doc.documentElement);
        }
        else if (el.querySelectorAll) {
            if (el.nodeType !== Node.DOCUMENT_FRAGMENT_NODE)
                this._processElement(el as Element);

            const children = getNativeQuerySelectorAll(el).call(el, '*');
            const length   = nativeMethods.nodeListLengthGetter.call(children);

            for (let i = 0; i < length; i++)
                this._processElement(children[i]);
        }
    }

    // NOTE: DOM sandbox hides evidence of the content proxying from a page native script. Proxy replaces URLs for
    // resources. Our goal is to make the native script think that all resources are fetched from the destination
    // resource, not from proxy, and also provide proxying for dynamically created elements.
    attach (window: Window & typeof globalThis): void {
        const document                  = window.document;
        let domContentLoadedEventRaised = false;

        super.attach(window, document);

        if (this._documentTitleStorageInitializer)
            this._documentTitleStorageInitializer.onAttach();

        this.iframeSandbox.on(this.iframeSandbox.IFRAME_DOCUMENT_CREATED_EVENT, ({ iframe }) => {
            const contentWindow   = nativeMethods.contentWindowGetter.call(iframe);
            const contentDocument = nativeMethods.contentDocumentGetter.call(iframe);

            // NOTE: Before overriding the iframe, we must restore native document methods.
            // Therefore, we save them before they are overridden.
            // @ts-ignore
            const iframeNativeMethods = new this.nativeMethods.constructor(contentDocument, contentWindow);

            contentWindow[INTERNAL_PROPS.iframeNativeMethods] = iframeNativeMethods;

            // NOTE: Override only the document (in fact, we only need the 'write' and 'writeln' methods).
            this.doc.attach(contentWindow, contentDocument, true);
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

            configurable: true,
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

    private static _processAttributeSelector (selector: string): string {
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

    static _processPseudoClassSelectors (selector: string): string {
        return selector
            .replace(PSEUDO_CLASS_FOCUS_REG_EX, '[' + INTERNAL_ATTRS.focusPseudoClass + ']')
            .replace(PSEUDO_CLASS_HOVER_REG_EX, '[' + INTERNAL_ATTRS.hoverPseudoClass + ']');
    }

    static processSelector (selector: string): string {
        if (selector) {
            selector = NodeSandbox._processPseudoClassSelectors(selector);
            selector = NodeSandbox._processAttributeSelector(selector);
        }

        return selector;
    }
}
