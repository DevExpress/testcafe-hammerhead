import INTERNAL_ATTRS from '../../processing/dom/internal-attributes';
import SHADOW_UI_CLASSNAME from '../../shadow-ui/class-name';
import nativeMethods from '../sandbox/native-methods';
import DomProcessor from '../../processing/dom';
import domProcessor from '../dom-processor';
import { remove as removeProcessingHeader } from '../../processing/script/header';
import styleProcessor from '../../processing/style';

import {
    find,
    getTagName,
    isScriptElement,
} from './dom';

import { convertToProxyUrl, parseProxyUrl } from './url';
import urlResolver from './url-resolver';
import INTERNAL_PROPS from '../../processing/dom/internal-properties';
import { URL_ATTRS, ATTRS_WITH_SPECIAL_PROXYING_LOGIC } from '../../processing/dom/attributes';
import SELF_REMOVING_SCRIPTS from '../../utils/self-removing-scripts';
import InsertPosition from './insert-position';
import removeElement from '../utils/remove-element';

interface ProcessHTMLOptions {
    parentTag?: any;
    prepareDom?: any;
    processedContext?: any;
    isPage?: boolean;
}

const FAKE_TAG_NAME_PREFIX    = 'hh_fake_tag_name_';
const FAKE_DOCTYPE_TAG_NAME   = 'hh_fake_doctype';
const FAKE_HEAD_TAG_NAME      = `${FAKE_TAG_NAME_PREFIX}head`;
const FAKE_BODY_TAG_NAME      = `${FAKE_TAG_NAME_PREFIX}body`;
const FAKE_ATTR_WITH_TAG_NAME = 'hh_fake_attr';

const FAKE_TAG_NAME_RE   = new RegExp('(<\\/?)' + FAKE_TAG_NAME_PREFIX, 'ig');
const WRAP_TAGS_RE       = /(<\/?)(html|head|body|table|tbody|tfoot|thead|tr|td|th|caption|colgroup)((?:\s[^>]*)?>)/ig;
const WRAP_TAGS_TEMPLATE = `$1${ FAKE_TAG_NAME_PREFIX }$2$3`;

const WRAP_COL_NOSCRIPT_TAGS_RE       = /<(\/?(?:col|noscript))(\s[^>]*?)?(\s?\/)?>/ig;
const WRAP_COL_NOSCRIPT_TAGS_TEMPLATE = `<br ${ FAKE_ATTR_WITH_TAG_NAME }="$1|$3"$2>`;
const UNWRAP_COL_NOSCRIPT_TAGS_RE     = new RegExp(`<br([^>]*?) ${ FAKE_ATTR_WITH_TAG_NAME }="([^|]+)\\|([^"]*)"([^>]*)`, 'ig');

const WRAP_DOCTYPE_RE       = /<!doctype([^>]*)>/ig;
const WRAP_DOCTYPE_TEMPLATE = `<${ FAKE_DOCTYPE_TAG_NAME }>$1</${ FAKE_DOCTYPE_TAG_NAME }>`;
const UNWRAP_DOCTYPE_RE     = new RegExp(`<${ FAKE_DOCTYPE_TAG_NAME }>([\\S\\s]*?)</${ FAKE_DOCTYPE_TAG_NAME }>`, 'ig');

const STORED_ATTRS_SELECTOR = (() => {
    const storedAttrs = [];

    for (const attr of URL_ATTRS)
        storedAttrs.push(DomProcessor.getStoredAttrName(attr));

    for (const attr of ATTRS_WITH_SPECIAL_PROXYING_LOGIC)
        storedAttrs.push(DomProcessor.getStoredAttrName(attr));

    return '[' + storedAttrs.join('],[') + ']';
})();

const SHADOW_UI_ELEMENTS_SELECTOR                    = `[class*="${SHADOW_UI_CLASSNAME.postfix}"]`;
const HOVER_AND_FOCUS_PSEUDO_CLASS_ELEMENTS_SELECTOR = `[${INTERNAL_ATTRS.hoverPseudoClass}],[${INTERNAL_ATTRS.focusPseudoClass}]`;
const FAKE_ELEMENTS_SELECTOR                         = `${FAKE_HEAD_TAG_NAME}, ${FAKE_BODY_TAG_NAME}`;
const HTML_PARSER_ELEMENT_FLAG                       = 'hammerhead|html-parser-element-flag';
const SCRIPT_AND_STYLE_SELECTOR                      = 'script,link[rel="stylesheet"]';

let htmlDocument = nativeMethods.createHTMLDocument.call(document.implementation, 'title');
let htmlParser   = nativeMethods.createDocumentFragment.call(htmlDocument);

htmlParser[HTML_PARSER_ELEMENT_FLAG] = true;

function getHtmlDocument () {
    try {
        htmlDocument.location.toString();
    }
    catch (e) {
        htmlDocument = nativeMethods.createHTMLDocument.call(document.implementation, 'title');
        htmlParser   = nativeMethods.createDocumentFragment.call(htmlDocument);

        htmlParser[HTML_PARSER_ELEMENT_FLAG] = true;
    }

    return htmlDocument;
}

function wrapHtmlText (html) {
    return html
        .replace(WRAP_DOCTYPE_RE, WRAP_DOCTYPE_TEMPLATE)
        .replace(WRAP_COL_NOSCRIPT_TAGS_RE, WRAP_COL_NOSCRIPT_TAGS_TEMPLATE)
        .replace(WRAP_TAGS_RE, WRAP_TAGS_TEMPLATE);
}

function unwrapHtmlText (html) {
    return html
        .replace(UNWRAP_DOCTYPE_RE, '<!doctype$1>')
        .replace(UNWRAP_COL_NOSCRIPT_TAGS_RE, '<$2$1$4$3')
        .replace(FAKE_TAG_NAME_RE, '$1');
}

export function isPageHtml (html) {
    return /^\s*(<\s*(!doctype|html|head|body)[^>]*>)/i.test(html);
}

function processHtmlInternal (html, process) {
    const container = nativeMethods.createElement.call(getHtmlDocument(), 'div');

    html = wrapHtmlText(html);

    nativeMethods.appendChild.call(htmlParser, container);
    nativeMethods.elementInnerHTMLSetter.call(container, html);

    let processedHtml = process(container) ? nativeMethods.elementInnerHTMLGetter.call(container) : html;

    removeElement(container);
    processedHtml = unwrapHtmlText(processedHtml);

    return processedHtml;
}

function cleanUpUrlAttr (el) {
    const urlAttr = domProcessor.getUrlAttr(el);

    if (!urlAttr || !nativeMethods.hasAttribute.call(el, urlAttr))
        return;

    const storedAttr = DomProcessor.getStoredAttrName(urlAttr);

    if (nativeMethods.hasAttribute.call(el, storedAttr)) {
        nativeMethods.setAttribute.call(el, urlAttr, nativeMethods.getAttribute.call(el, storedAttr));
        nativeMethods.removeAttribute.call(el, storedAttr);
    }
}

function cleanUpAutocompleteAttr (el) {
    if (!nativeMethods.hasAttribute.call(el, 'autocomplete'))
        return;

    const storedAttr = DomProcessor.getStoredAttrName('autocomplete');

    if (nativeMethods.hasAttribute.call(el, storedAttr)) {
        const storedAttrValue = nativeMethods.getAttribute.call(el, storedAttr);

        if (DomProcessor.isAddedAutocompleteAttr('autocomplete', storedAttrValue))
            nativeMethods.removeAttribute.call(el, 'autocomplete');
        else
            nativeMethods.setAttribute.call(el, 'autocomplete', storedAttrValue);

        nativeMethods.removeAttribute.call(el, storedAttr);
    }
}

function cleanUpTargetAttr (el) {
    const targetAttr = domProcessor.getTargetAttr(el);

    if (!targetAttr || !nativeMethods.hasAttribute.call(el, targetAttr))
        return;

    const storedAttr = DomProcessor.getStoredAttrName(targetAttr);

    if (nativeMethods.hasAttribute.call(el, storedAttr)) {
        nativeMethods.setAttribute.call(el, targetAttr, nativeMethods.getAttribute.call(el, storedAttr));
        nativeMethods.removeAttribute.call(el, storedAttr);
    }
}

function cleanUpSandboxAttr (el) {
    if (domProcessor.adapter.getTagName(el) !== 'iframe' || !nativeMethods.hasAttribute.call(el, 'sandbox'))
        return;

    const storedAttr = DomProcessor.getStoredAttrName('sandbox');

    if (nativeMethods.hasAttribute.call(el, storedAttr)) {
        nativeMethods.setAttribute.call(el, 'sandbox', nativeMethods.getAttribute.call(el, storedAttr));
        nativeMethods.removeAttribute.call(el, storedAttr);
    }
}

function cleanUpStyleAttr (el) {
    if (!nativeMethods.hasAttribute.call(el, 'style'))
        return;

    const storedAttr = DomProcessor.getStoredAttrName('style');

    if (nativeMethods.hasAttribute.call(el, storedAttr)) {
        nativeMethods.setAttribute.call(el, 'style', nativeMethods.getAttribute.call(el, storedAttr));
        nativeMethods.removeAttribute.call(el, storedAttr);
    }
}

export function cleanUpHtml (html) {
    return processHtmlInternal(html, container => {
        let changed = false;

        find(container, STORED_ATTRS_SELECTOR, el => {
            cleanUpUrlAttr(el);
            cleanUpAutocompleteAttr(el);
            cleanUpTargetAttr(el);
            cleanUpSandboxAttr(el);
            cleanUpStyleAttr(el);

            changed = true;
        });

        find(container, SHADOW_UI_ELEMENTS_SELECTOR, el => {
            const parent = nativeMethods.nodeParentNodeGetter.call(el);

            if (parent) {
                nativeMethods.removeChild.call(parent, el);
                changed = true;
            }
        });

        find(container, 'script', el => {
            const textContent        = nativeMethods.nodeTextContentGetter.call(el);
            const cleanedTextContent = removeProcessingHeader(textContent);

            if (textContent !== cleanedTextContent) {
                nativeMethods.nodeTextContentSetter.call(el, cleanedTextContent);

                changed = true;
            }
        });

        find(container, 'style', el => {
            const textContent        = nativeMethods.nodeTextContentGetter.call(el);
            const cleanedTextContent = styleProcessor.cleanUp(textContent, parseProxyUrl);

            if (textContent !== cleanedTextContent) {
                nativeMethods.nodeTextContentSetter.call(el, cleanedTextContent);

                changed = true;
            }
        });

        find(container, HOVER_AND_FOCUS_PSEUDO_CLASS_ELEMENTS_SELECTOR, el => {
            nativeMethods.removeAttribute.call(el, INTERNAL_ATTRS.hoverPseudoClass);
            nativeMethods.removeAttribute.call(el, INTERNAL_ATTRS.focusPseudoClass);

            changed = true;
        });

        find(container, FAKE_ELEMENTS_SELECTOR, el => {
            const innerHtml = nativeMethods.elementInnerHTMLGetter.call(el);

            if (innerHtml.indexOf(SELF_REMOVING_SCRIPTS.iframeInit) !== -1) {
                nativeMethods.elementInnerHTMLSetter.call(el, innerHtml.replace(SELF_REMOVING_SCRIPTS.iframeInit, ''));

                changed = true;
            }
        });

        return changed;
    });
}

export function processHtml (html, options: ProcessHTMLOptions = {}) {
    const { parentTag, prepareDom, processedContext, isPage } = options;

    return processHtmlInternal(html, container => {
        const htmlElements  = [];
        let children        = [];
        let length          = 0;
        const storedBaseUrl = urlResolver.getBaseUrl(document);

        if (prepareDom)
            prepareDom(container);

        if (nativeMethods.htmlCollectionLengthGetter.call(nativeMethods.elementChildrenGetter.call(container))) {
            children = nativeMethods.elementQuerySelectorAll.call(container, '*');
            length   = nativeMethods.nodeListLengthGetter.call(children);
        }

        const base = nativeMethods.elementQuerySelector.call(container, 'base');

        if (base)
            urlResolver.updateBase(nativeMethods.getAttribute.call(base, 'href'), document);

        for (let i = 0; i < length; i++) {
            const child = children[i];

            if (isScriptElement(child)) {
                const scriptContent = nativeMethods.nodeTextContentGetter.call(child);

                nativeMethods.nodeTextContentSetter.call(child, unwrapHtmlText(scriptContent));
            }

            child[INTERNAL_PROPS.processedContext] = processedContext;
            domProcessor.processElement(child, convertToProxyUrl);

            const elTagName = getTagName(child);

            if (elTagName === FAKE_HEAD_TAG_NAME || elTagName === FAKE_BODY_TAG_NAME)
                htmlElements.push(child);
        }

        if (!parentTag) {
            if (htmlElements.length) {
                for (const htmlElement of htmlElements) {
                    const firstScriptOrStyle = nativeMethods.elementQuerySelector.call(htmlElement, SCRIPT_AND_STYLE_SELECTOR);

                    if (firstScriptOrStyle)
                        nativeMethods.insertAdjacentHTML.call(firstScriptOrStyle, InsertPosition.beforeBegin, SELF_REMOVING_SCRIPTS.iframeInit);
                    else
                        nativeMethods.insertAdjacentHTML.call(htmlElement, InsertPosition.beforeEnd, SELF_REMOVING_SCRIPTS.iframeInit);
                }
            }
            else if (isPage)
                nativeMethods.insertAdjacentHTML.call(container, InsertPosition.afterBegin, SELF_REMOVING_SCRIPTS.iframeInit);
        }

        urlResolver.updateBase(storedBaseUrl, document);

        return true;
    });
}

export function dispose () {
    htmlParser   = null;
    htmlDocument = null;
}

export function isInternalHtmlParserElement (el) {
    while (nativeMethods.nodeParentNodeGetter.call(el))
        el = nativeMethods.nodeParentNodeGetter.call(el);

    return !!el[HTML_PARSER_ELEMENT_FLAG];
}
