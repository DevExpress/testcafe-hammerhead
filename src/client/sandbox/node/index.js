import INTERNAL_PROPS from '../../../processing/dom/internal-properties';
import SandboxBase from '../base';
import WindowSandbox from './window';
import DocumentSandbox from './document';
import ElementSandbox from './element';
import { parseDocumentCharset } from '../../utils/dom';

export default class NodeSandbox extends SandboxBase {
    constructor (nodeMutation, iframeSandbox, eventSandbox, uploadSandbox, shadowUI) {
        super();

        this.raiseBodyCreatedEvent               = this._onBodyCreated;
        document[INTERNAL_PROPS.documentCharset] = parseDocumentCharset();

        this.eventSandbox  = eventSandbox;
        this.iframeSandbox = iframeSandbox;
        this.shadowUI      = shadowUI;
        this.mutation      = nodeMutation;

        this.doc     = new DocumentSandbox(this);
        this.win     = new WindowSandbox(this, eventSandbox.message);
        this.element = new ElementSandbox(this, uploadSandbox, iframeSandbox, shadowUI);
    }

    _onBodyCreated () {
        this.eventSandbox.listeners.initDocumentBodyListening(this.document);
        this.mutation.onBodyCreated({
            body: this.document.body
        });
    }

    _overrideElement (el) {
        if (el[INTERNAL_PROPS.processedContext] !== this.window) {
            el[INTERNAL_PROPS.processedContext] = this.window;

            this.element.overrideElement(el);
            this.eventSandbox.overrideElement(el, true);
            this.shadowUI.overrideElement(el, true);
        }
    }

    overrideDomMethods (el, doc) {
        if (!el) {
            doc = doc || this.document;

            this.eventSandbox.overrideElement(doc);

            if (doc.documentElement)
                this.overrideDomMethods(doc.documentElement);
        }
        else if (el.querySelectorAll) {
            // OPTIMIZATION: Use querySelectorAll to iterate through descendant nodes.
            this._overrideElement(el);

            var children = el.querySelectorAll('*');

            for (var i = 0; i < children.length; i++)
                this._overrideElement(children[i]);
        }

        // NOTE: If querySelectorAll is not available, use a recursive algorithm.
        else if (el.nodeType === 1 || el.nodeType === 11) {
            this._overrideElement(el);

            var cnLength = el.childNodes.length;

            if (cnLength) {
                for (var j = 0; j < cnLength; j++)
                    this.overrideDomMethods(el.childNodes[j]);
            }
        }
    }

    // NOTE: DOM sandbox hides evidence of the content proxying from a page native script. Proxy replaces URLs for
    // resources. Our goal is to make the native script think that all resources are fetched from the destination
    // resource, not from proxy, and also provide proxying for dynamically created elements.
    attach (window) {
        var document = window.document;

        super.attach(window, document);

        this.iframeSandbox.on(this.iframeSandbox.IFRAME_DOCUMENT_CREATED_EVENT, e =>
                // NOTE: Override only document (In fact, we only need 'write' and 'writeln' methods).
                this.doc.attach(e.iframe.contentWindow, e.iframe.contentDocument)
        );

        window[INTERNAL_PROPS.overrideDomMethodName] = this.overrideDomMethods.bind(this);

        // NOTE: In some browsers (for example Firefox), the 'window.document' object is different when iframe is
        // created and when the document’s ready event is raised. Therefore, we need to update the 'document' object
        // to override its methods (Q527555).
        document.addEventListener('DOMContentLoaded', () => this.overrideDomMethods(null, document), false);

        this.doc.attach(window, document);
        this.win.attach(window);
        this.element.attach(window);
    }
}
