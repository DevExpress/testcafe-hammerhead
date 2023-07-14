import nativeMethods from '../../native-methods';
import * as htmlUtils from '../../../utils/html';

import {
    getTagName,
    isCommentNode,
    isStyleElement,
    isScriptElement,
} from '../../../utils/dom';

import { isFirefox } from '../../../utils/browser';
import { processScript } from '../../../../processing/script';
import styleProcessor from '../../../../processing/style';
import { getProxyUrl, convertToProxyUrl } from '../../../utils/url';
import SELF_REMOVING_SCRIPTS from '../../../../utils/self-removing-scripts';
import settings from '../../../settings';

const BEGIN_MARKER_TAG_NAME = 'hammerhead_write_marker_begin';
const END_MARKER_TAG_NAME   = 'hammerhead_write_marker_end';
const BEGIN_MARKER_MARKUP   = `<${ BEGIN_MARKER_TAG_NAME }></${ BEGIN_MARKER_TAG_NAME }>`;
const END_MARKER_MARKUP     = `<${ END_MARKER_TAG_NAME }></${ END_MARKER_TAG_NAME }>`;
const BEGIN_REMOVE_RE       = new RegExp(`^[\\S\\s]*${ BEGIN_MARKER_MARKUP }`, 'g');
const END_REMOVE_RE         = new RegExp(`${ END_MARKER_MARKUP }[\\S\\s]*$`, 'g');
const REMOVE_OPENING_TAG_RE = /^<[^>]+>/g;
const REMOVE_CLOSING_TAG_RE = /<\/[^<>]+>$/g;
const PENDING_RE            = /<\/?(?:[A-Za-z][^>]*)?$/g;
const UNCLOSED_ELEMENT_FLAG = 'hammerhead|unclosed-element-flag';

export default class DocumentWriter {
    window: any;
    document: any;
    pending: string;
    parentTagChain: any[];
    isBeginMarkerInDOM: boolean;
    isEndMarkerInDOM: boolean;
    isClosingContentEl: boolean;
    isNonClosedComment: boolean;
    isAddContentToEl: boolean;
    contentForProcessing: string;
    nonClosedEl: any;
    cachedStartsWithClosingTagRegExps: any;

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

        this.cachedStartsWithClosingTagRegExps = {};
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

        return parentTagChainMarkup + BEGIN_MARKER_MARKUP + htmlChunk + END_MARKER_MARKUP;
    }

    _unwrapHtmlChunk (htmlChunk) {
        if (!htmlChunk)
            return htmlChunk;

        htmlChunk = htmlChunk
            .replace(BEGIN_REMOVE_RE, '')
            .replace(END_REMOVE_RE, '');

        if (!this.isBeginMarkerInDOM)
            htmlChunk = this.isNonClosedComment ? htmlChunk.slice(4) : htmlChunk.replace(REMOVE_OPENING_TAG_RE, '');

        if (!this.isEndMarkerInDOM)
            htmlChunk = this.isNonClosedComment ? htmlChunk.slice(0, -3) : htmlChunk.replace(REMOVE_CLOSING_TAG_RE, '');

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

        while (nativeMethods.elementFirstElementChildGetter.call(beginMarker))
            beginMarker = nativeMethods.elementFirstElementChildGetter.call(beginMarker);

        const beginMarkerParent = nativeMethods.nodeParentNodeGetter.call(beginMarker);

        if (nativeMethods.nodeFirstChildGetter.call(beginMarkerParent) !== beginMarker)
            beginMarker = nativeMethods.nodeFirstChildGetter.call(beginMarkerParent);
        else if (isCommentNode(nativeMethods.nodeFirstChildGetter.call(beginMarker)))
            beginMarker = nativeMethods.nodeFirstChildGetter.call(beginMarker);

        return beginMarker;
    }

    static _searchEndMarker (container) {
        let endMarker = nativeMethods.elementQuerySelector.call(container, END_MARKER_TAG_NAME);

        if (endMarker)
            return endMarker;

        endMarker = container;

        while (nativeMethods.elementLastElementChildGetter.call(endMarker))
            endMarker = nativeMethods.elementLastElementChildGetter.call(endMarker);

        const endMarkerParent = nativeMethods.nodeParentNodeGetter.call(endMarker);

        if (nativeMethods.nodeLastChildGetter.call(endMarkerParent) !== endMarker)
            endMarker = nativeMethods.nodeLastChildGetter.call(endMarkerParent);
        else if (isCommentNode(nativeMethods.nodeLastChildGetter.call(endMarker)))
            endMarker = nativeMethods.nodeLastChildGetter.call(endMarker);

        return endMarker;
    }

    _updateParentTagChain (container, endMarker) {
        let endMarkerParent = getTagName(endMarker) !== END_MARKER_TAG_NAME ? endMarker : nativeMethods.nodeParentNodeGetter.call(endMarker);

        if (isCommentNode(endMarker)) {
            this.isNonClosedComment = true;
            endMarkerParent         = nativeMethods.nodeParentNodeGetter.call(endMarker);
        }

        this.parentTagChain = [];

        while (endMarkerParent !== container) {
            this.parentTagChain.unshift(getTagName(endMarkerParent));
            endMarkerParent = nativeMethods.nodeParentNodeGetter.call(endMarkerParent);
        }
    }

    _processBeginMarkerInContent (beginMarker) {
        const elWithContent = beginMarker;

        DocumentWriter._setUnclosedElementFlag(elWithContent);

        if (this.isClosingContentEl && (isScriptElement(elWithContent) || isStyleElement(elWithContent))) {
            this.contentForProcessing = nativeMethods.nodeTextContentGetter.call(this.nonClosedEl) +
                                        nativeMethods.nodeTextContentGetter.call(elWithContent).replace(BEGIN_REMOVE_RE, '');

            nativeMethods.nodeTextContentSetter.call(elWithContent, '');
        }
        else {
            const textContent = nativeMethods.nodeTextContentGetter.call(elWithContent);

            nativeMethods.nodeTextContentSetter.call(elWithContent, textContent.replace(BEGIN_REMOVE_RE, ''));
        }

        beginMarker = nativeMethods.createElement.call(document, BEGIN_MARKER_TAG_NAME);

        const elWithContentParent = nativeMethods.nodeParentNodeGetter.call(elWithContent);

        nativeMethods.insertBefore.call(elWithContentParent, beginMarker, elWithContent);
    }

    static _createStartsWithClosingTagRegExp (tagName) {
        const regExpStrParts = [tagName.charAt(tagName.length - 1), '?'];

        for (let i = tagName.length - 2; i > -1; i--) {
            regExpStrParts.unshift('(?:', tagName.charAt(i));
            regExpStrParts.push(')?');
        }

        regExpStrParts.unshift('^</');
        regExpStrParts.push('$');

        return new RegExp(regExpStrParts.join(''), 'i');
    }

    _getStartsWithClosingTagRegExp (tagName) {
        tagName = tagName.toLowerCase();

        if (!this.cachedStartsWithClosingTagRegExps[tagName])
            this.cachedStartsWithClosingTagRegExps[tagName] = DocumentWriter._createStartsWithClosingTagRegExp(tagName);

        return this.cachedStartsWithClosingTagRegExps[tagName];
    }

    _processEndMarkerInContent (endMarker) {
        const elWithContent = endMarker;
        const textContent   = nativeMethods.nodeTextContentGetter.call(elWithContent);

        DocumentWriter._setUnclosedElementFlag(elWithContent);

        nativeMethods.nodeTextContentSetter.call(elWithContent, textContent.replace(END_REMOVE_RE, ''));

        endMarker = nativeMethods.createElement.call(document, END_MARKER_TAG_NAME);

        if (this.pending) {
            const startsWithClosingTagRegExp        = this._getStartsWithClosingTagRegExp(elWithContent.tagName);
            const isPendingStartsWithClosingTagPart = startsWithClosingTagRegExp.test(this.pending);

            if (!isPendingStartsWithClosingTagPart) {
                const newContent = nativeMethods.nodeTextContentGetter.call(elWithContent) + this.pending;

                nativeMethods.nodeTextContentSetter.call(elWithContent, newContent);

                this.pending = '';
            }
        }

        const elWithContentParent = nativeMethods.nodeParentNodeGetter.call(elWithContent);

        nativeMethods.appendChild.call(elWithContentParent, endMarker);
    }

    static _addOnDocumentRecreationScript (endMarker) {
        const span            = nativeMethods.createElement.call(endMarker.ownerDocument, 'span');
        const endMarkerParent = nativeMethods.nodeParentNodeGetter.call(endMarker);

        nativeMethods.insertBefore.call(endMarkerParent, span, endMarker);
        nativeMethods.elementOuterHTMLSetter.call(span, SELF_REMOVING_SCRIPTS.onWindowRecreation);
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
        htmlChunk = htmlUtils.processHtml(htmlChunk, {
            prepareDom:       container => this._prepareDom(container, isDocumentCleaned),
            processedContext: this.window,
        });
        htmlChunk = this._unwrapHtmlChunk(htmlChunk);

        // NOTE: Firefox recreate a window instance during the document.write function execution (T213930).
        if (htmlChunk && this.isBeginMarkerInDOM && isFirefox && !htmlUtils.isPageHtml(htmlChunk))
            htmlChunk = SELF_REMOVING_SCRIPTS.iframeInit + htmlChunk;

        return htmlChunk;
    }

    write (args, ln, isDocumentCleaned) {
        const htmlChunk = this._processHtmlChunk(nativeMethods.arrayJoin.call(args, ''), isDocumentCleaned);

        if (this.nonClosedEl && this.contentForProcessing) {
            let processedContent = this.contentForProcessing;

            if (isScriptElement(this.nonClosedEl))
                processedContent = processScript(this.contentForProcessing, true, false, convertToProxyUrl, void 0, settings.nativeAutomation);
            else if (isStyleElement(this.nonClosedEl))
                processedContent = styleProcessor.process(this.contentForProcessing, getProxyUrl, true);

            nativeMethods.nodeTextContentSetter.call(this.nonClosedEl, processedContent);

            this.contentForProcessing = '';
        }

        const nativeWriteMethod = ln ? nativeMethods.documentWriteLn : nativeMethods.documentWrite;
        const result            = nativeWriteMethod.call(this.document, htmlChunk);

        if (!this.isEndMarkerInDOM && !this.isAddContentToEl) {
            let el = this.document.documentElement;

            while (nativeMethods.elementLastElementChildGetter.call(el))
                el = nativeMethods.elementLastElementChildGetter.call(el);

            this.nonClosedEl = el;
        }

        return result;
    }
}
