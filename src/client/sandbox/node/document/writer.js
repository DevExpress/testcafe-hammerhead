import nativeMethods from '../../native-methods';
import * as htmlUtils from '../../../utils/html';
import { getTagName, isCommentNode, isStyleElement, isScriptElement } from '../../../utils/dom';
import INTERNAL_PROPS from '../../../../processing/dom/internal-properties';
import { isFirefox, isIE } from '../../../utils/browser';
import SHADOW_UI_CLASSNAME from '../../../../shadow-ui/class-name';

// NOTE: We should avoid using native object prototype methods,
// since they can be overriden by the client code. (GH-245)
var arrayJoin = Array.prototype.join;

const BEGIN_MARKER_TAG_NAME = 'hammerhead_write_marker_begin';
const END_MARKER_TAG_NAME   = 'hammerhead_write_marker_end';
const BEGIN_MARKER_MARKUP   = `<${ BEGIN_MARKER_TAG_NAME }></${ BEGIN_MARKER_TAG_NAME }>`;
const END_MARKER_MARKUP     = `<${ END_MARKER_TAG_NAME }></${ END_MARKER_TAG_NAME }>`;
const BEGIN_REMOVE_RE       = new RegExp(`^[\\S\\s]*${ BEGIN_MARKER_MARKUP }`, 'g');
const END_REMOVE_RE         = new RegExp(`${ END_MARKER_MARKUP }[\\S\\s]*$`, 'g');
const REMOVE_OPENING_TAG    = /^<[^>]+>/g;
const REMOVE_CLOSING_TAG    = /<\/[^>]+>$/g;
const PENDING_RE            = /<[A-Za-z][^>]*$/g;
const STORED_WRITE_INFO     = 'hammerhead|stored-write-info';

const ON_WINDOW_RECREATION_SCRIPT_TEMPLATE = `
    <script class="${ SHADOW_UI_CLASSNAME.script }" type="text/javascript">
        (function () {
            var hammerhead = window["%hammerhead%"];
            var sandbox = hammerhead && hammerhead.sandbox;
            var script = document.currentScript || document.scripts[document.scripts.length - 1];
            if (!sandbox) {
                try {
                    sandbox = window.parent["%hammerhead%"].get('./sandbox/backup').get(window);
                } catch(e) {}
            }
            if (sandbox) {
                sandbox.node.mutation.onDocumentCleaned({
                    window: window,
                    document: document
                });

                /* NOTE: B234357 */
                sandbox.node.processNodes(null, document);
            }

            script.parentNode.removeChild(script);
        })();
    <\/script>`.replace(/\n\s*/g, '');

export default class DocumentWriter {
    constructor (window, document) {
        this.window               = window;
        this.document             = document;
        this.pending              = '';
        this.parentTagChain       = [];
        this.storedContent        = '';
        this.needRemoveClosingTag = false;
        this.needRemoveOpeningTag = false;
        this.isClosingContentEl   = false;
        this.needNewLine          = '';
        this.isNonClosedComment   = false;
    }

    _cutPending (htmlChunk) {
        var match = htmlChunk.match(PENDING_RE);

        this.pending = match ? match[0] : '';

        return this.pending ? htmlChunk.substring(0, htmlChunk.length - this.pending.length) : htmlChunk;
    }

    _wrapHtmlChunk (htmlChunk) {
        var parentTagChainMarkup = this.parentTagChain.length ? '<' + this.parentTagChain.join('><') + '>' : '';

        if (this.isNonClosedComment)
            parentTagChainMarkup += '<!--';

        var wrapedHtmlChunk = parentTagChainMarkup + BEGIN_MARKER_MARKUP + htmlChunk + END_MARKER_MARKUP;

        // NOTE: IE9 strange behavior
        // div.innerHTML = "<div><!--<p></p><b></b>"
        // div.innerHTML === "<div><!--<p></div>"
        // div.firstChild.firstChild.text === "<!--<p>"
        // div.firstChild.firstChild.textContent === ""
        return wrapedHtmlChunk + '-->';
    }

    _unwrapHtmlChunk (htmlChunk) {
        if (!htmlChunk)
            return htmlChunk;

        htmlChunk = htmlChunk
            .replace(BEGIN_REMOVE_RE, '')
            .replace(END_REMOVE_RE, '');

        if (this.needRemoveOpeningTag)
            htmlChunk = this.isNonClosedComment ? htmlChunk.slice(4) : htmlChunk.replace(REMOVE_OPENING_TAG, '');

        if (this.needRemoveClosingTag)
            htmlChunk = this.isNonClosedComment ? htmlChunk.slice(0, -3) : htmlChunk.replace(REMOVE_CLOSING_TAG, '');

        if (this.needRemoveOpeningTag && !this.needRemoveClosingTag)
            this.isNonClosedComment = false;

        this.needRemoveClosingTag = false;
        this.needRemoveOpeningTag = false;

        return htmlChunk;
    }

    static _searchBeginMarker (container) {
        var beginMarker = nativeMethods.elementQuerySelector.call(container, BEGIN_MARKER_TAG_NAME);

        if (beginMarker)
            return beginMarker;

        beginMarker = container;

        while (beginMarker.firstElementChild)
            beginMarker = beginMarker.firstElementChild;

        if (beginMarker.parentNode.firstChild !== beginMarker)
            beginMarker = beginMarker.parentNode.firstChild;
        else if (isCommentNode(beginMarker.firstChild))
            beginMarker = beginMarker.firstChild;

        return beginMarker;
    }

    static _searchEndMarker (container) {
        var endMarker = nativeMethods.elementQuerySelector.call(container, END_MARKER_TAG_NAME);

        if (endMarker)
            return endMarker;

        endMarker = container;

        while (endMarker.lastElementChild)
            endMarker = endMarker.lastElementChild;

        if (endMarker.parentNode.lastChild !== endMarker)
            endMarker = endMarker.parentNode.lastChild;
        else if (isCommentNode(endMarker.lastChild))
            endMarker = endMarker.lastChild;

        return endMarker;
    }

    _updateParentTagChain (container, endMarker) {
        var endMarkerParent = getTagName(endMarker) !== END_MARKER_TAG_NAME ? endMarker : endMarker.parentNode;

        if (isCommentNode(endMarker)) {
            this.isNonClosedComment = true;
            endMarkerParent         = endMarker.parentNode;
        }

        this.parentTagChain = [];

        while (endMarkerParent !== container) {
            this.parentTagChain.unshift(getTagName(endMarkerParent));
            endMarkerParent = endMarkerParent.parentNode;
        }
    }

    _processBeginMarkerInContent (beginMarker) {
        var elWithContent = beginMarker;

        if (!this.isNonClosedComment) {
            if (isScriptElement(elWithContent) || isStyleElement(elWithContent)) {
                elWithContent.textContent = this.storedContent + elWithContent.textContent.replace(BEGIN_REMOVE_RE, '');
                this.storedContent        = '';
            }
            else
                elWithContent.textContent = elWithContent.textContent.replace(BEGIN_REMOVE_RE, '');
        }
        else
            elWithContent.textContent = elWithContent.textContent.replace(BEGIN_REMOVE_RE, '');

        beginMarker               = nativeMethods.createElement.call(document, BEGIN_MARKER_TAG_NAME);
        this.needRemoveOpeningTag = true;
        this.isClosingContentEl   = true;

        nativeMethods.insertBefore.call(elWithContent.parentNode, beginMarker, elWithContent);
    }

    _processEndMarkerInContent (endMarker) {
        var elWithContent = endMarker;

        if (!this.isNonClosedComment) {
            if (isScriptElement(elWithContent) || isStyleElement(elWithContent)) {
                this.storedContent += elWithContent.textContent.replace(END_REMOVE_RE, '') + this.pending +
                                      (this.needNewLine ? '\n' : '');
                elWithContent.textContent = '';
            }
            else
                elWithContent.textContent = elWithContent.textContent.replace(END_REMOVE_RE, '') + this.pending;
        }
        else
            elWithContent.textContent = elWithContent.textContent.replace(END_REMOVE_RE, '') + this.pending;

        endMarker                 = nativeMethods.createElement.call(document, END_MARKER_TAG_NAME);
        this.needRemoveClosingTag = true;
        this.pending              = '';

        nativeMethods.appendChild.call(elWithContent.parentNode, endMarker);
    }

    _addOnDocumentRecreationScript (endMarker) {
        var span = nativeMethods.createElement.call(endMarker.ownerDocument, 'span');

        nativeMethods.insertBefore.call(endMarker.parentNode, span, endMarker);

        span.outerHTML = ON_WINDOW_RECREATION_SCRIPT_TEMPLATE;
    }

    _prepareDom (container, isDocumentCleaned) {
        var beginMarker        = DocumentWriter._searchBeginMarker(container);
        var endMarker          = DocumentWriter._searchEndMarker(container);
        var isBeginMarkerInDom = getTagName(beginMarker) === BEGIN_MARKER_TAG_NAME;
        var isEndMarkerInDom   = getTagName(endMarker) === END_MARKER_TAG_NAME;

        if (beginMarker !== endMarker) {
            this._updateParentTagChain(container, endMarker);

            if (isDocumentCleaned)
                this._addOnDocumentRecreationScript(endMarker);
        }

        if (beginMarker === endMarker && !this.isNonClosedComment &&
            (isScriptElement(endMarker) || isStyleElement(endMarker))) {
            this.storedContent += beginMarker.textContent
                .replace(BEGIN_REMOVE_RE, '')
                .replace(END_REMOVE_RE, '');

            if (this.needNewLine)
                this.storedContent += '\n';

            container.textContent = '';
        }
        else if (!isBeginMarkerInDom && !isEndMarkerInDom) {
            this._processBeginMarkerInContent(beginMarker);
            this._processEndMarkerInContent(endMarker);
        }
        else if (isBeginMarkerInDom && !isEndMarkerInDom)
            this._processEndMarkerInContent(endMarker);
        else if (!isBeginMarkerInDom && isEndMarkerInDom)
            this._processBeginMarkerInContent(beginMarker);
    }

    _processHtmlChunk (htmlChunk, ln, isDocumentCleaned) {
        htmlChunk               = this._cutPending(this.pending + htmlChunk);
        this.isClosingContentEl = false;
        this.needNewLine        = ln;

        if (htmlChunk || isDocumentCleaned) {
            htmlChunk = this._wrapHtmlChunk(htmlChunk);
            htmlChunk = htmlUtils.processHtml(htmlChunk, null, container => this._prepareDom(container, isDocumentCleaned));
            htmlChunk = this._unwrapHtmlChunk(htmlChunk);
        }

        if (this.window[STORED_WRITE_INFO] && this.storedContent)
            this.window[STORED_WRITE_INFO].content = this.storedContent;

        if (this.window[STORED_WRITE_INFO] && this.isClosingContentEl)
            delete this.window[STORED_WRITE_INFO];

        // NOTE: Firefox and IE recreate a window instance during the document.write function execution (T213930).
        if (htmlChunk && !this.isClosingContentEl && (isFirefox || isIE) && !htmlUtils.isPageHtml(htmlChunk))
            htmlChunk = htmlUtils.INIT_SCRIPT_FOR_IFRAME_TEMPLATE + htmlChunk;

        return htmlChunk;
    }

    write (args, ln, isDocumentCleaned) {
        var htmlChunk         = this._processHtmlChunk(arrayJoin.call(args, ''), ln, isDocumentCleaned);
        var nativeWriteMethod = ln && !this.storedContent ? nativeMethods.documentWriteLn : nativeMethods.documentWrite;
        var result            = nativeWriteMethod.call(this.document, htmlChunk);

        if (this.storedContent && !this.window[STORED_WRITE_INFO]) {
            var el = this.document.documentElement;

            while (el.lastElementChild)
                el = el.lastElementChild;

            this.window[STORED_WRITE_INFO] = {
                element: el,
                content: this.storedContent
            };
        }

        return result;
    }

    static getPendingElementContent (el) {
        var window     = el[INTERNAL_PROPS.processedContext];
        var storedInfo = window && window[STORED_WRITE_INFO];

        return storedInfo && el === storedInfo.element ? storedInfo.content : void 0;
    }
}
