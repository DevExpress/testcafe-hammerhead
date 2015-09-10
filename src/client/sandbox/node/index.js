import SandboxBase from '../base';
import WindowSandbox from './window';
import DocumentSandbox from './document';
import ElementSandbox from './element';
import Const from '../../../const';
import { isMozilla } from '../../utils/browser';

export default class NodeSandbox extends SandboxBase {
    constructor (sandbox) {
        super(sandbox);

        this.BODY_CREATED     = 'bodyCreated';
        this.DOCUMENT_CLEANED = 'documentCleaned';

        this.raiseBodyCreatedEvent = this._onBodyCreated;

        this.doc     = new DocumentSandbox(sandbox);
        this.win     = new WindowSandbox(sandbox);
        this.element = new ElementSandbox(sandbox);
    }

    _onBodyCreated () {
        this.sandbox.event.listeners.initDocumentBodyListening(this.document);

        this._emit(this.BODY_CREATED, {
            body: this.document.body
        });
    }

    _overrideElement (el) {
        if (el[Const.DOM_SANDBOX_PROCESSED_CONTEXT] !== this.window) {
            el[Const.DOM_SANDBOX_PROCESSED_CONTEXT] = this.window;

            this.element.overrideElement(el);
            this.sandbox.event.overrideElement(el, true);
            this.sandbox.shadowUI.overrideElement(el, true);
        }
    }

    overrideDomMethods (el, doc) {
        if (!el) {
            doc = doc || this.document;

            this.sandbox.event.overrideElement(doc);

            if (doc.documentElement)
                this.overrideDomMethods(doc.documentElement);
        }
        else if (el.querySelectorAll) {
            //OPTIMIZATION: use querySelectorAll to iterate over descendant nodes
            this._overrideElement(el);

            var children = el.querySelectorAll('*');

            for (var i = 0; i < children.length; i++)
                this._overrideElement(children[i]);
        }

        //NOTE: if querySelectorAll is not available fallback to recursive algorithm
        else if (el.nodeType === 1 || el.nodeType === 11) {
            this._overrideElement(el);

            var cnLength = el.childNodes.length;

            if (cnLength) {
                for (var j = 0; j < cnLength; j++)
                    this.overrideDomMethods(el.childNodes[j]);
            }
        }
    }

    //NOTE: DOM sandbox hides evidence of the content proxying from page-native script. Proxy replaces URLs for
    //resources. Our goal is to make native script think that all resources are fetched from origin resource not
    //from proxy and also provide proxying for dynamicly created elements.
    attach (window) {
        var document = window.document;

        super.attach(window, document);

        this.sandbox.iframe.on(this.sandbox.iframe.IFRAME_DOCUMENT_CREATED, e =>
                // Override only document (In fact, we only need 'write' and 'writeln' methods)
                this.doc.attach(e.iframe.contentWindow, e.iframe.contentDocument)
        );

        window[Const.DOM_SANDBOX_OVERRIDE_DOM_METHOD_NAME] = this.overrideDomMethods.bind(this);

        // NOTE: Iframe loses its contentWindow after reinserting in the DOM (in the FF).
        if (isMozilla)
            this.element.on(this.element.IFRAME_ADDED, e => this.sandbox.iframe.overrideIframe(e.iframe));

        // NOTE: in some browsers (for example Firefox) 'window.document' are different objects when iframe is created
        // just now and on document ready event. Therefore we should update 'document' object to override its methods (Q527555).
        document.addEventListener('DOMContentLoaded', () => this.overrideDomMethods(null, document), false);

        this.doc.on(this.doc.DOCUMENT_CLEANED, e => this._emit(this.DOCUMENT_CLEANED, {
            document:           e.document,
            isIFrameWithoutSrc: isIFrameWithoutSrc
        }));

        this.doc.attach(window, document);
        this.win.attach(window);
        this.element.attach(window);
    }
}
