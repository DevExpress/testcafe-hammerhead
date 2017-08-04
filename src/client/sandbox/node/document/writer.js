import nativeMethods from '../../native-methods';
import * as htmlUtils from '../../../utils/html';
import { getTagName, isCommentNode, isStyleElement, isScriptElement } from '../../../utils/dom';
import { isFirefox, isIE } from '../../../utils/browser';
import SHADOW_UI_CLASSNAME from '../../../../shadow-ui/class-name';
import { processScript } from '../../../../processing/script';
import styleProcessor from '../../../../processing/style';
import { getProxyUrl } from '../../../utils/url';
import INTERNAL_PROPS from '../../../../processing/dom/internal-properties';

// NOTE: We should avoid using native object prototype methods,
// since they can be overriden by the client code. (GH-245)
const arrayJoin = Array.prototype.join;

const BEGIN_MARKER_TAG_NAME = 'hammerhead_write_marker_begin';
const END_MARKER_TAG_NAME   = 'hammerhead_write_marker_end';
const BEGIN_MARKER_MARKUP   = `<${ BEGIN_MARKER_TAG_NAME }></${ BEGIN_MARKER_TAG_NAME }>`;
const END_MARKER_MARKUP     = `<${ END_MARKER_TAG_NAME }></${ END_MARKER_TAG_NAME }>`;
const BEGIN_REMOVE_RE       = new RegExp(`^[\\S\\s]*${ BEGIN_MARKER_MARKUP }`, 'g');
const END_REMOVE_RE         = new RegExp(`${ END_MARKER_MARKUP }[\\S\\s]*$`, 'g');
const REMOVE_OPENING_TAG    = /^<[^>]+>/g;
const REMOVE_CLOSING_TAG    = /<\/[^>]+>$/g;
const PENDING_RE            = /<[A-Za-z][^>]*$/g;
const UNCLOSED_ELEMENT_FLAG = 'hammerhead|unclosed-element-flag';

const ON_WINDOW_RECREATION_SCRIPT_TEMPLATE = `
    <script class="${ SHADOW_UI_CLASSNAME.selfRemovingScript }" type="text/javascript">
        (function () {
            var hammerhead = window["${ INTERNAL_PROPS.hammerhead }"];
            var sandbox    = hammerhead && hammerhead.sandbox;
            var script     = document.currentScript || document.scripts[document.scripts.length - 1];

            if (!sandbox) {
                try {
                    sandbox = window.parent["${ INTERNAL_PROPS.hammerhead }"].get('./sandbox/backup').get(window);
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
        this.isBeginMarkerInDOM   = false;
        this.isEndMarkerInDOM     = false;
        this.isClosingContentEl   = false;
        this.isNonClosedComment   = false;
        this.isAddContentToEl     = false;
        this.contentForProcessing = '';
        this.nonClosedEl          = null;
    }

    _cutPending (htmlChunk) {
        const match = htmlChunk.match(PENDING_RE);

        this.pending = match ? match[0] : '';

        return this.pending ? htmlChunk.substring(0, htmlChunk.length - this.pending.length) : htmlChunk;
    }

    _wrapHtmlChunk (htmlChunk) {
        let parentTagChainMarkup = this.parentTagChain.length ? '<' + this.parentTagChain.join('><') + '>' : '';

        if (this.isNonClosedComment)
            parentTagChainMarkup += '<!--';

        const wrapedHtmlChunk = parentTagChainMarkup + BEGIN_MARKER_MARKUP + htmlChunk + END_MARKER_MARKUP;

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

        if (!this.isBeginMarkerInDOM)
            htmlChunk = this.isNonClosedComment ? htmlChunk.slice(4) : htmlChunk.replace(REMOVE_OPENING_TAG, '');

        if (!this.isEndMarkerInDOM)
            htmlChunk = this.isNonClosedComment ? htmlChunk.slice(0, -3) : htmlChunk.replace(REMOVE_CLOSING_TAG, '');

        if (!this.isBeginMarkerInDOM && this.isEndMarkerInDOM)
            this.isNonClosedComment = false;

        return htmlChunk;
    }

    static _setUnclosedElementFlag (el) {
        if (isScriptElement(el) || isStyleElement(el))
            el[UNCLOSED_ELEMENT_FLAG] = true;
    }

    static hasUnclosedElementFlag (el) {
        return !!el[UNCLOSED_ELEMENT_FLAG];
    }

    static _searchBeginMarker (container) {
        let beginMarker = nativeMethods.elementQuerySelector.call(container, BEGIN_MARKER_TAG_NAME);

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
        let endMarker = nativeMethods.elementQuerySelector.call(container, END_MARKER_TAG_NAME);

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
        let endMarkerParent = getTagName(endMarker) !== END_MARKER_TAG_NAME ? endMarker : endMarker.parentNode;

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
        const elWithContent = beginMarker;

        DocumentWriter._setUnclosedElementFlag(elWithContent);

        if (this.isClosingContentEl && (isScriptElement(elWithContent) || isStyleElement(elWithContent))) {
            this.contentForProcessing = this.nonClosedEl.textContent +
                                        elWithContent.textContent.replace(BEGIN_REMOVE_RE, '');
            elWithContent.textContent = '';
        }
        else
            elWithContent.textContent = elWithContent.textContent.replace(BEGIN_REMOVE_RE, '');

        beginMarker = nativeMethods.createElement.call(document, BEGIN_MARKER_TAG_NAME);

        nativeMethods.insertBefore.call(elWithContent.parentNode, beginMarker, elWithContent);
    }

    _processEndMarkerInContent (endMarker) {
        const elWithContent = endMarker;

        DocumentWriter._setUnclosedElementFlag(elWithContent);

        elWithContent.textContent = elWithContent.textContent.replace(END_REMOVE_RE, '') + this.pending;
        endMarker                 = nativeMethods.createElement.call(document, END_MARKER_TAG_NAME);
        this.pending              = '';

        nativeMethods.appendChild.call(elWithContent.parentNode, endMarker);
    }

    static _addOnDocumentRecreationScript (endMarker) {
        const span = nativeMethods.createElement.call(endMarker.ownerDocument, 'span');

        nativeMethods.insertBefore.call(endMarker.parentNode, span, endMarker);

        span.outerHTML = ON_WINDOW_RECREATION_SCRIPT_TEMPLATE;
    }

    _prepareDom (container, isDocumentCleaned) {
        const beginMarker = DocumentWriter._searchBeginMarker(container);
        const endMarker   = DocumentWriter._searchEndMarker(container);

        this.isBeginMarkerInDOM = getTagName(beginMarker) === BEGIN_MARKER_TAG_NAME;
        this.isEndMarkerInDOM   = getTagName(endMarker) === END_MARKER_TAG_NAME;
        this.isAddContentToEl   = beginMarker === endMarker;
        this.isClosingContentEl = !this.isBeginMarkerInDOM && !this.isAddContentToEl;

        if (!this.isAddContentToEl) {
            this._updateParentTagChain(container, endMarker);

            if (isDocumentCleaned)
                DocumentWriter._addOnDocumentRecreationScript(endMarker);
        }

        if (!this.isBeginMarkerInDOM && !this.isEndMarkerInDOM) {
            this._processBeginMarkerInContent(beginMarker);
            this._processEndMarkerInContent(endMarker);
        }
        else if (this.isBeginMarkerInDOM && !this.isEndMarkerInDOM)
            this._processEndMarkerInContent(endMarker);
        else if (!this.isBeginMarkerInDOM && this.isEndMarkerInDOM)
            this._processBeginMarkerInContent(beginMarker);
    }

    _processHtmlChunk (htmlChunk, isDocumentCleaned) {
        htmlChunk = this._cutPending(this.pending + htmlChunk);
        htmlChunk = this._wrapHtmlChunk(htmlChunk);
        htmlChunk = htmlUtils.processHtml(htmlChunk, null, container => this._prepareDom(container, isDocumentCleaned));
        htmlChunk = this._unwrapHtmlChunk(htmlChunk);

        // NOTE: Firefox and IE recreate a window instance during the document.write function execution (T213930).
        if (htmlChunk && this.isBeginMarkerInDOM && (isFirefox || isIE) && !htmlUtils.isPageHtml(htmlChunk))
            htmlChunk = htmlUtils.INIT_SCRIPT_FOR_IFRAME_TEMPLATE + htmlChunk;

        return htmlChunk;
    }

    write (args, ln, isDocumentCleaned) {
        const htmlChunk = this._processHtmlChunk(arrayJoin.call(args, ''), isDocumentCleaned);

        if (this.nonClosedEl && this.contentForProcessing) {
            if (isScriptElement(this.nonClosedEl))
                this.nonClosedEl.textContent = processScript(this.contentForProcessing, true);
            else if (isStyleElement(this.nonClosedEl))
                this.nonClosedEl.textContent = styleProcessor.process(this.contentForProcessing, getProxyUrl, true);

            this.contentForProcessing = '';
        }

        const nativeWriteMethod = ln ? nativeMethods.documentWriteLn : nativeMethods.documentWrite;
        const result            = nativeWriteMethod.call(this.document, htmlChunk);

        if (!this.isEndMarkerInDOM && !this.isAddContentToEl) {
            let el = this.document.documentElement;

            while (el.lastElementChild)
                el = el.lastElementChild;

            this.nonClosedEl = el;
        }

        return result;
    }
}
