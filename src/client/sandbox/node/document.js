import SandboxBase from '../base';
import IframeSandbox from '../iframe';
import INTERNAL_LITERAL from '../../../processing/script/internal-literal';
import nativeMethods from '../native-methods';
import domProcessor from '../../dom-processor';
import * as htmlUtils from '../../utils/html';
import * as urlUtils from '../../utils/url';
import { isFirefox, isIE, isIE9, isIE10 } from '../../utils/browser';
import { isIframeWithoutSrc, getFrameElement } from '../../utils/dom';

// NOTE: We should avoid using native object prototype methods,
// since they can be overriden by the client code. (GH-245)
var arraySlice = Array.prototype.slice;

export default class DocumentSandbox extends SandboxBase {
    constructor (nodeSandbox) {
        super();

        this.storedDocumentWriteContent = '';
        this.writeBlockCounter          = 0;
        this.nodeSandbox                = nodeSandbox;
        this.readyStateForIE            = null;
    }

    _isUninitializedIframeWithoutSrc (doc) {
        var wnd          = doc.defaultView;
        var frameElement = getFrameElement(wnd);

        return wnd !== wnd.top && frameElement && isIframeWithoutSrc(frameElement) &&
               !IframeSandbox.isIframeInitialized(frameElement);
    }

    _beforeDocumentCleaned () {
        this.nodeSandbox.mutation.onBeforeDocumentCleaned({
            document:           this.document,
            isIframeWithoutSrc: isIframeWithoutSrc
        });
    }

    _onDocumentClosed () {
        this.nodeSandbox.mutation.onDocumentClosed({
            document:           this.document,
            isIframeWithoutSrc: isIframeWithoutSrc
        });
    }

    _overridedDocumentWrite (args, ln) {
        args = arraySlice.call(args);

        var lastArg = args.length ? args[args.length - 1] : '';
        var isBegin = lastArg === INTERNAL_LITERAL.documentWriteBegin;
        var isEnd   = lastArg === INTERNAL_LITERAL.documentWriteEnd;

        if (isBegin)
            this.writeBlockCounter++;
        else if (isEnd)
            this.writeBlockCounter--;

        if (isBegin || isEnd)
            args.pop();

        var str = args.join('');

        var needWriteOnEndMarker = isEnd && !this.writeBlockCounter;

        if (needWriteOnEndMarker || !this.storedDocumentWriteContent && htmlUtils.isWellFormattedHtml(str)) {
            this.writeBlockCounter          = 0;
            str                             = this.storedDocumentWriteContent + str;
            this.storedDocumentWriteContent = '';
        }
        else if (isBegin || this.storedDocumentWriteContent) {
            this.storedDocumentWriteContent += str;

            return null;
        }

        var shouldEmitEvents = (this.readyStateForIE || this.document.readyState) !== 'loading' &&
                               this.document.readyState !== 'uninitialized';

        str = htmlUtils.processHtml('' + str);

        if (shouldEmitEvents)
            this._beforeDocumentCleaned();

        // NOTE: Firefox and IE recreate a window instance during the document.write function execution (T213930).
        if ((isFirefox || isIE) && !htmlUtils.isPageHtml(str))
            str = htmlUtils.INIT_SCRIPT_FOR_IFRAME_TEMPLATE + str;

        var targetNativeMethod = ln ? nativeMethods.documentWriteLn : nativeMethods.documentWrite;
        var result             = targetNativeMethod.call(this.document, str);

        if (shouldEmitEvents) {
            this.nodeSandbox.mutation.onDocumentCleaned({
                window:             this.window,
                document:           this.document,
                isIframeWithoutSrc: isIframeWithoutSrc
            });
        }

        // NOTE: B234357
        this.nodeSandbox.processNodes(null, this.document);

        return result;
    }

    attach (window, document) {
        super.attach(window, document);

        // NOTE: https://connect.microsoft.com/IE/feedback/details/792880/document-readystat
        var frameElement = getFrameElement(window);

        if (frameElement && !isIframeWithoutSrc(frameElement) && (isIE9 || isIE10)) {
            this.readyStateForIE = 'loading';

            nativeMethods.addEventListener.call(this.document, 'DOMContentLoaded', () => this.readyStateForIE = null);
        }

        var documentSandbox = this;

        document.open = (...args) => {
            var isUninitializedIframe = this._isUninitializedIframeWithoutSrc(document);

            if (!isUninitializedIframe)
                this._beforeDocumentCleaned();

            var result = nativeMethods.documentOpen.apply(document, args);

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

            var result = nativeMethods.documentClose.apply(document, args);

            if (!this._isUninitializedIframeWithoutSrc(document))
                this._onDocumentClosed();

            return result;
        };

        document.createElement = (...args) => {
            var el = nativeMethods.createElement.apply(document, args);

            domProcessor.processElement(el, urlUtils.convertToProxyUrl);
            this.nodeSandbox.processNodes(el);

            return el;
        };

        document.createElementNS = (...args) => {
            var el = nativeMethods.createElementNS.apply(document, args);

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
            var fragment = nativeMethods.createDocumentFragment.apply(document, args);

            documentSandbox.nodeSandbox.processNodes(fragment);

            return fragment;
        };
    }
}
