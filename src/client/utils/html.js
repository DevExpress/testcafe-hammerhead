import INTERNAL_ATTRS from '../../processing/dom/internal-attributes';
import SHADOW_UI_CLASSNAME from '../../shadow-ui/class-name';
import nativeMethods from '../sandbox/native-methods';
import domProcessor from '../dom-processor';
import { remove as removeProcessingHeader } from '../../processing/script/header';
import styleProcessor from '../../processing/style';
import { find, getTagName, isScriptElement } from './dom';
import { convertToProxyUrl, parseProxyUrl } from './url';
import { isIE, isMSEdge } from './browser';
import * as urlResolver from './url-resolver';
import INTERNAL_PROPS from '../../processing/dom/internal-properties';

const FAKE_TAG_NAME_PREFIX    = 'hh_fake_tag_name_';
const FAKE_DOCTYPE_TAG_NAME   = 'hh_fake_doctype';
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

const FIND_SVG_RE      = /<svg\s?[^>]*>/ig;
const FIND_NS_ATTRS_RE = /\s(?:NS[0-9]+:[^"']+('|")[\S\s]*?\1|[^:]+:NS[0-9]+=(?:""|''))/g;

const ATTRS_FOR_CLEANING    = (() => {
    const attrs = [];

    for (const attr of domProcessor.URL_ATTRS)
        attrs.push({ attr, storedAttr: domProcessor.getStoredAttrName(attr) });

    attrs.push({ attr: 'autocomplete', storedAttr: domProcessor.getStoredAttrName('autocomplete') });

    return attrs;
})();
const STORED_ATTRS_SELECTOR = (() => {
    const storedAttrs = [];

    for (const { storedAttr } of ATTRS_FOR_CLEANING)
        storedAttrs.push(storedAttr);

    return '[' + storedAttrs.join('],[') + ']';
})();

const SHADOW_UI_ELEMENTS_SELECTOR                    = `[class*="${SHADOW_UI_CLASSNAME.postfix}"]`;
const HOVER_AND_FOCUS_PSEUDO_CLASS_ELEMENTS_SELECTOR = `[${INTERNAL_ATTRS.hoverPseudoClass}],[${INTERNAL_ATTRS.focusPseudoClass}]`;
const FAKE_ELEMENTS_SELECTOR                         = `${FAKE_TAG_NAME_PREFIX}head, ${FAKE_TAG_NAME_PREFIX}body`;

export const INIT_SCRIPT_FOR_IFRAME_TEMPLATE = `
    <script class="${ SHADOW_UI_CLASSNAME.selfRemovingScript }" type="text/javascript">
        (function () {
            var parentHammerhead = null;

            try {
                parentHammerhead = window.parent["${ INTERNAL_PROPS.hammerhead }"];
            } catch(e) {}

            if (parentHammerhead) parentHammerhead.sandbox.onIframeDocumentRecreated(window.frameElement);

            var script = document.currentScript || document.scripts[document.scripts.length - 1];

            script.parentNode.removeChild(script);
        })();
    <\/script>`.replace(/\n\s*/g, '');

let htmlDocument = document.implementation.createHTMLDocument('title');
let htmlParser   = htmlDocument.createDocumentFragment();

domProcessor.on(domProcessor.HTML_PROCESSING_REQUIRED_EVENT, (html, callback) => {
    if (!isPageHtml(html))
        html = `<html><body>${ html }</body></html>`;

    callback(processHtml(html));
});

function getHtmlDocument () {
    try {
        // NOTE: IE bug: access denied.
        if (htmlDocument.location)
            htmlDocument.location.toString();
    }
    catch (e) {
        htmlDocument = document.implementation.createHTMLDocument('title');
        htmlParser   = htmlDocument.createDocumentFragment();
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
    const container = getHtmlDocument().createElement('div');

    html = wrapHtmlText(html);

    htmlParser.innerHTML = '';
    nativeMethods.appendChild.call(htmlParser, container);

    container.innerHTML = html;

    let processedHtml = process(container) ? container.innerHTML : html;

    processedHtml = unwrapHtmlText(processedHtml);

    // NOTE: hack for IE (GH-1083)
    if (isIE && !isMSEdge && html !== processedHtml)
        processedHtml = removeExtraSvgNamespeces(html, processedHtml);

    return processedHtml;
}

export function cleanUpHtml (html) {
    return processHtmlInternal(html, container => {
        let changed = false;

        find(container, STORED_ATTRS_SELECTOR, el => {
            for (const { attr, storedAttr } of ATTRS_FOR_CLEANING) {
                if (el.hasAttribute(attr))
                    nativeMethods.setAttribute.call(el, attr, nativeMethods.getAttribute.call(el, storedAttr));
                else if (attr === 'autocomplete')
                    nativeMethods.removeAttribute.call(el, attr);

                nativeMethods.removeAttribute.call(el, storedAttr);
            }

            changed = true;
        });

        find(container, SHADOW_UI_ELEMENTS_SELECTOR, el => {
            if (el.parentNode) {
                nativeMethods.removeChild.call(el.parentNode, el);
                changed = true;
            }
        });

        find(container, 'script', el => {
            const textContent        = el.textContent;
            const cleanedTextContent = removeProcessingHeader(textContent);

            if (textContent !== cleanedTextContent) {
                el.textContent = cleanedTextContent;

                changed = true;
            }
        });

        find(container, 'style', el => {
            const textContent        = el.textContent;
            const cleanedTextContent = styleProcessor.cleanUp(textContent, parseProxyUrl);

            if (textContent !== cleanedTextContent) {
                el.textContent = cleanedTextContent;

                changed = true;
            }
        });

        find(container, HOVER_AND_FOCUS_PSEUDO_CLASS_ELEMENTS_SELECTOR, el => {
            nativeMethods.removeAttribute.call(el, INTERNAL_ATTRS.hoverPseudoClass);
            nativeMethods.removeAttribute.call(el, INTERNAL_ATTRS.focusPseudoClass);

            changed = true;
        });

        find(container, FAKE_ELEMENTS_SELECTOR, el => {
            if (el.innerHTML.indexOf(INIT_SCRIPT_FOR_IFRAME_TEMPLATE) !== -1) {
                el.innerHTML = el.innerHTML.replace(INIT_SCRIPT_FOR_IFRAME_TEMPLATE, '');

                changed = true;
            }
        });

        return changed;
    });
}

export function processHtml (html, parentTag, prepareDom) {
    return processHtmlInternal(html, container => {
        const htmlElements  = [];
        let children        = [];
        const storedBaseUrl = urlResolver.getBaseUrl(document);

        if (prepareDom)
            prepareDom(container);

        // NOTE: We check this condition to avoid unnecessary calls of the querySelectorAll function.
        if (container.children.length === 1 && container.children[0].children && !container.children[0].children.length)
            children = [container.children[0]];
        else if (container.children.length)
            children = nativeMethods.elementQuerySelectorAll.call(container, '*');

        const base = nativeMethods.elementQuerySelector.call(container, 'base');

        if (base)
            urlResolver.updateBase(nativeMethods.getAttribute.call(base, 'href'), document);

        for (const child of children) {
            if (isScriptElement(child))
                child.textContent = unwrapHtmlText(child.textContent);

            domProcessor.processElement(child, convertToProxyUrl);

            const elTagName = getTagName(child);

            if (elTagName === `${FAKE_TAG_NAME_PREFIX}head` || elTagName === `${FAKE_TAG_NAME_PREFIX}body`)
                htmlElements.push(child);
        }

        if (!parentTag) {
            for (const htmlElement of htmlElements)
                htmlElement.innerHTML = INIT_SCRIPT_FOR_IFRAME_TEMPLATE + htmlElement.innerHTML;
        }

        urlResolver.updateBase(storedBaseUrl, document);

        return true;
    });
}

function removeExtraSvgNamespeces (html, processedHtml) {
    const initialSvgStrs = html.match(FIND_SVG_RE);
    let index            = 0;

    if (!initialSvgStrs)
        return processedHtml;

    return processedHtml.replace(FIND_SVG_RE, svgStr => {
        const initialSvgStr = initialSvgStrs[index];
        let initialNSAttrs  = initialSvgStr ? initialSvgStr.match(FIND_NS_ATTRS_RE) : null;

        if (initialSvgStr)
            index++;

        return initialSvgStr ? svgStr.replace(FIND_NS_ATTRS_RE, () => {
            const replacement = initialNSAttrs ? initialNSAttrs.join('') : '';

            if (initialNSAttrs)
                initialNSAttrs = null;

            return replacement;
        }) : svgStr;
    });
}
