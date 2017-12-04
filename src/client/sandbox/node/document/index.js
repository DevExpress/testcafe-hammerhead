import SandboxBase from '../../base';
import IframeSandbox from '../../iframe';
import nativeMethods from '../../native-methods';
import domProcessor from '../../../dom-processor';
import * as urlUtils from '../../../utils/url';
import { isIE } from '../../../utils/browser';
import { isIframeWithoutSrc, getFrameElement } from '../../../utils/dom';
import DocumentWriter from './writer';
import ShadowUI from './../../shadow-ui';

export default class DocumentSandbox extends SandboxBase {
    constructor (nodeSandbox) {
        super();

        this.nodeSandbox    = nodeSandbox;
        this.documentWriter = null;
    }

    _isUninitializedIframeWithoutSrc (win) {
        const frameElement = getFrameElement(win);

        return win !== win.top && frameElement && isIframeWithoutSrc(frameElement) &&
               !IframeSandbox.isIframeInitialized(frameElement);
    }

    _beforeDocumentCleaned () {
        this.nodeSandbox.mutation.onBeforeDocumentCleaned({ document: this.document });
    }

    _onDocumentClosed () {
        this.nodeSandbox.mutation.onDocumentClosed({ document: this.document });
    }

    _overridedDocumentWrite (args, ln) {
        const shouldEmitEvents = this.document.readyState !== 'loading' &&
                                 this.document.readyState !== 'uninitialized';

        if (shouldEmitEvents)
            this._beforeDocumentCleaned();

        const result = this.documentWriter.write(args, ln, shouldEmitEvents);

        // NOTE: B234357
        if (!shouldEmitEvents)
            this.nodeSandbox.processNodes(null, this.document);

        return result;
    }

    _isNeedToUpdateDocumentWriter (window, document) {
        try {
            return !this.documentWriter || this.window !== window || this.document !== document;
        }
        catch (e) {
            return true;
        }
    }

    attach (window, document) {
        if (this._isNeedToUpdateDocumentWriter(window, document)) {
            this.documentWriter = new DocumentWriter(window, document);

            this.nodeSandbox.mutation.on(this.nodeSandbox.mutation.BEFORE_DOCUMENT_CLEANED_EVENT, () => {
                this.documentWriter = new DocumentWriter(window, document);
            });
        }

        super.attach(window, document);

        const documentSandbox = this;

        document.open = (...args) => {
            const isUninitializedIframe = this._isUninitializedIframeWithoutSrc(window);

            if (!isUninitializedIframe)
                this._beforeDocumentCleaned();

            const result = nativeMethods.documentOpen.apply(document, args);

            if (!isUninitializedIframe)
                this.nodeSandbox.mutation.onDocumentCleaned({ window, document });
            else
            // NOTE: If iframe initialization is in progress, we need to override the document.write and document.open
            // methods once again, because they were cleaned after the native document.open method call.
                this.attach(window, document);

            return result;
        };

        document.close = (...args) => {
            // NOTE: IE10 and IE9 raise the "load" event only when the document.close method is called. We need to
            // restore the overrided document.open and document.write methods before Hammerhead injection, if the
            // window is not initialized.
            if (isIE && !IframeSandbox.isWindowInited(window))
                nativeMethods.restoreDocumentMeths(document);

            // NOTE: IE doesn't run scripts in iframe if iframe.documentContent.designMode equals 'on' (GH-871)
            if (typeof document.designMode === 'string' && document.designMode.toLowerCase() === 'on')
                ShadowUI.removeSelfRemovingScripts(document);

            const result = nativeMethods.documentClose.apply(document, args);

            if (!this._isUninitializedIframeWithoutSrc(window))
                this._onDocumentClosed();

            return result;
        };

        document.createElement = (...args) => {
            const el = nativeMethods.createElement.apply(document, args);

            domProcessor.processElement(el, urlUtils.convertToProxyUrl);
            this.nodeSandbox.processNodes(el);

            return el;
        };

        document.createElementNS = (...args) => {
            const el = nativeMethods.createElementNS.apply(document, args);

            domProcessor.processElement(el, urlUtils.convertToProxyUrl);
            this.nodeSandbox.processNodes(el);

            return el;
        };

        document.write = function () {
            return documentSandbox._overridedDocumentWrite(arguments);
        };

        document.writeln = function () {
            return documentSandbox._overridedDocumentWrite(arguments, true);
        };

        document.createDocumentFragment = (...args) => {
            const fragment = nativeMethods.createDocumentFragment.apply(document, args);

            documentSandbox.nodeSandbox.processNodes(fragment);

            return fragment;
        };
    }
}
