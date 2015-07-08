import { isMozilla, isIE } from '../../util/browser';
import IFrameSandbox from '../iframe';
import JSProcessor from '../../../processing/js/index';
import NativeMethods from '../native-methods';
import * as Html from '../../util/html';
import { EventEmitter } from '../../util/service';
import { isIframeWithoutSrc } from '../../util/url';

// Consts
export const BEFORE_DOCUMENT_CLEANED = 'beforeDocumentCleaned';
export const DOCUMENT_CLOSED         = 'documentClosed';
export const DOCUMENT_CLEANED        = 'documentCleaned';

var eventEmitter = new EventEmitter();

export var on  = eventEmitter.on.bind(eventEmitter);
export var off = eventEmitter.off.bind(eventEmitter);

function isUninitializedIframeWithoutSrc (window) {
    try {
        return window !== window.top && isIframeWithoutSrc(window.frameElement) &&
               !IFrameSandbox.isIframeInitialized(window.frameElement);
    }
    catch (e) {
        return false;
    }
}

export function override (window, document, overrideNewElement) {
    var storedDocumentWriteContent = '';
    var writeBlockCounter          = 0;

    function beforeDocumentCleaned () {
        eventEmitter.emit(BEFORE_DOCUMENT_CLEANED, {
            document:           document,
            isIFrameWithoutSrc: isIFrameWithoutSrc
        });
    }

    function onDocumentClosed () {
        eventEmitter.emit(DOCUMENT_CLOSED, {
            document:           document,
            isIFrameWithoutSrc: isIFrameWithoutSrc
        });
    }

    function overridedDocumentWrite (args, ln) {
        args = Array.prototype.slice.call(args);

        var separator = ln ? '\n' : '';
        var lastArg   = args.length ? args[args.length - 1] : '';
        var isBegin   = lastArg === JSProcessor.DOCUMENT_WRITE_BEGIN_PARAM;
        var isEnd     = lastArg === JSProcessor.DOCUMENT_WRITE_END_PARAM;

        if (isBegin)
            writeBlockCounter++;
        else if (isEnd)
            writeBlockCounter--;

        if (isBegin || isEnd)
            args.pop();

        var str = separator + args.join(separator);

        var needWriteOnEndMarker = isEnd && !writeBlockCounter;

        if (needWriteOnEndMarker || Html.isPageHtml(str) ||
            Html.isWellFormattedHtml(str) && !storedDocumentWriteContent) {
            writeBlockCounter          = 0;
            str                        = storedDocumentWriteContent + str;
            storedDocumentWriteContent = '';
        }
        else if (isBegin || storedDocumentWriteContent) {
            storedDocumentWriteContent += str;

            return null;
        }

        var isUninitializedIframe = isUninitializedIframeWithoutSrc(window);

        str = Html.processHtml('' + str);

        if (!isUninitializedIframe)
            beforeDocumentCleaned();

        // FireFox, IE recreate window instance during the document.write function execution T213930
        if ((isMozilla || isIE) && !Html.isPageHtml(str))
            str = Html.INIT_SCRIPT_FOR_IFRAME_TEMPLATE + str;

        var result = NativeMethods.documentWrite.call(document, str);

        if (!isUninitializedIframe) {
            eventEmitter.emit(DOCUMENT_CLEANED, { window: window, document: document });
            overrideNewElement(null, document); // B234357
        }

        return result;
    }

    document.open = function () {
        var isUninitializedIframe = isUninitializedIframeWithoutSrc(window);

        if (!isUninitializedIframe)
            beforeDocumentCleaned();

        var result = NativeMethods.documentOpen.call(document);

        if (!isUninitializedIframe)
            eventEmitter.emit(DOCUMENT_CLEANED, { window: window, document: document });
        else
        // If iframe initialization in progress, we should once again override document.write and document.open meths
        // because they were cleaned after native document.open meth calling
            override(window, document, overrideNewElement);

        return result;
    };

    document.close = function () {
        // IE10 and IE9 rise "load" event only when document.close meth called.
        // We should restore overrided document.open and document.write meths before Hammerhead injection
        // if window not initialized
        if (isIE && !IFrameSandbox.isWindowInited(window))
            NativeMethods.restoreNativeDocumentMeth(document);

        var result = NativeMethods.documentClose.call(document);

        if (!isUninitializedIframeWithoutSrc(window))
            onDocumentClosed();

        return result;
    };

    document.createElement = function (tagName) {
        var el = NativeMethods.createElement.call(document, tagName);

        overrideNewElement(el);

        return el;
    };

    document.createElementNS = function (ns, tagName) {
        var el = NativeMethods.createElementNS.call(document, ns, tagName);

        overrideNewElement(el);

        return el;
    };

    document.write = function () {
        return overridedDocumentWrite(arguments);
    };

    document.writeln = function () {
        return overridedDocumentWrite(arguments, true);
    };

    document.createDocumentFragment = function () {
        var fragment = NativeMethods.createDocumentFragment.apply(document, arguments);

        overrideNewElement(fragment);

        return fragment;
    };
}
