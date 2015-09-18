import SandboxBase from '../base';
import jsProcessor from '../../../processing/js/index';
import nativeMethods from '../native-methods';
import * as htmlUtils from '../../utils/html';
import { isMozilla, isIE } from '../../utils/browser';
import { isIframeWithoutSrc } from '../../utils/url';

export default class DocumentSandbox extends SandboxBase {
    constructor (sandbox) {
        super(sandbox);

        this.BEFORE_DOCUMENT_CLEANED_EVENT = 'beforeDocumentCleaned';
        this.DOCUMENT_CLOSED_EVENT         = 'documentClosed';
        this.DOCUMENT_CLEANED_EVENT        = 'documentCleaned';

        this.storedDocumentWriteContent = '';
        this.writeBlockCounter          = 0;
    }

    _isUninitializedIframeWithoutSrc (window) {
        try {
            return window !== window.top && isIframeWithoutSrc(window.frameElement) &&
                   !this.sandbox.iframe.isIframeInitialized(window.frameElement);
        }
        catch (e) {
            return false;
        }
    }

    _beforeDocumentCleaned () {
        this._emit(this.BEFORE_DOCUMENT_CLEANED_EVENT, {
            document:           this.document,
            isIFrameWithoutSrc: isIFrameWithoutSrc
        });
    }

    _onDocumentClosed () {
        this._emit(this.DOCUMENT_CLOSED_EVENT, {
            document:           this.document,
            isIFrameWithoutSrc: isIFrameWithoutSrc
        });
    }

    _overridedDocumentWrite (args, ln) {
        args = Array.prototype.slice.call(args);

        var separator = ln ? '\n' : '';
        var lastArg   = args.length ? args[args.length - 1] : '';
        var isBegin   = lastArg === jsProcessor.DOCUMENT_WRITE_BEGIN_PARAM;
        var isEnd     = lastArg === jsProcessor.DOCUMENT_WRITE_END_PARAM;

        if (isBegin)
            this.writeBlockCounter++;
        else if (isEnd)
            this.writeBlockCounter--;

        if (isBegin || isEnd)
            args.pop();

        var str = separator + args.join(separator);

        var needWriteOnEndMarker = isEnd && !this.writeBlockCounter;

        if (needWriteOnEndMarker || htmlUtils.isPageHtml(str) ||
            htmlUtils.isWellFormattedHtml(str) && !this.storedDocumentWriteContent) {
            this.writeBlockCounter          = 0;
            str                             = this.storedDocumentWriteContent + str;
            this.storedDocumentWriteContent = '';
        }
        else if (isBegin || this.storedDocumentWriteContent) {
            this.storedDocumentWriteContent += str;

            return null;
        }

        var isUninitializedIframe = this._isUninitializedIframeWithoutSrc(this.window);

        str = htmlUtils.processHtml('' + str);

        if (!isUninitializedIframe)
            this._beforeDocumentCleaned();

        // FireFox, IE recreate window instance during the document.write function execution T213930
        if ((isMozilla || isIE) && !htmlUtils.isPageHtml(str))
            str = htmlUtils.INIT_SCRIPT_FOR_IFRAME_TEMPLATE + str;

        var result = nativeMethods.documentWrite.call(this.document, str);

        if (!isUninitializedIframe) {
            this._emit(this.DOCUMENT_CLEANED_EVENT, { window: this.window, document: this.document });
            this.sandbox.node.overrideDomMethods(null, this.document); // B234357
        }

        return result;
    }

    attach (window, document) {
        super.attach(window, document);

        var documentSandbox = this;

        document.open = () => {
            var isUninitializedIframe = this._isUninitializedIframeWithoutSrc(window);

            if (!isUninitializedIframe)
                this._beforeDocumentCleaned();

            var result = nativeMethods.documentOpen.call(document);

            if (!isUninitializedIframe)
                this._emit(this.DOCUMENT_CLEANED_EVENT, { window: window, document: document });
            else
            // If iframe initialization in progress, we should once again override document.write and document.open meths
            // because they were cleaned after native document.open meth calling
                this.attach(window, document);

            return result;
        };

        document.close = () => {
            // IE10 and IE9 rise "load" event only when document.close meth called.
            // We should restore overrided document.open and document.write meths before Hammerhead injection
            // if window not initialized
            if (isIE && !this.sandbox.iframe.isWindowInited(window))
                nativeMethods.restoreNativeDocumentMeth(document);

            var result = nativeMethods.documentClose.call(document);

            if (!this._isUninitializedIframeWithoutSrc(window))
                this._onDocumentClosed();

            return result;
        };

        document.createElement = tagName => {
            var el = nativeMethods.createElement.call(document, tagName);

            this.sandbox.node.overrideDomMethods(el);

            return el;
        };

        document.createElementNS = (ns, tagName) => {
            var el = nativeMethods.createElementNS.call(document, ns, tagName);

            this.sandbox.node.overrideDomMethods(el);

            return el;
        };

        document.write = function () {
            return documentSandbox._overridedDocumentWrite(arguments);
        };

        document.writeln = function () {
            return documentSandbox._overridedDocumentWrite(arguments, true);
        };

        document.createDocumentFragment = function () {
            var fragment = nativeMethods.createDocumentFragment.apply(document, arguments);

            documentSandbox.sandbox.node.overrideDomMethods(fragment);

            return fragment;
        };
    }
}
