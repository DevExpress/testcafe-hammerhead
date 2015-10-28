import INTERNAL_ATTRS from '../../processing/dom/internal-attributes';
import SHADOW_UI_CLASSNAME from '../../shadow-ui/class-name';
import nativeMethods from '../sandbox/native-methods';
import domProcessor from '../dom-processor';
import { remove as removeProcessingHeader } from '../../processing/script/header';
import { find } from './dom';
import { convertToProxyUrl } from '../utils/url';

const TEXT_NODE_COMMENT_MARKER = 'hammerhead|text-node-comment-marker';

export const INIT_SCRIPT_FOR_IFRAME_TEMPLATE =
    '<script class="' + SHADOW_UI_CLASSNAME.script + '" type="text/javascript">' +
    'var parentHammerhead = null;' +
    'try {' +
    '   parentHammerhead = window.parent["%hammerhead%"];' +
    '} catch(e) {}' +
    'if (parentHammerhead) parentHammerhead.sandbox.onIframeDocumentRecreated(window.frameElement);' +
    'var script = document.currentScript || document.scripts[document.scripts.length - 1];' +
    'script.parentNode.removeChild(script);' +
    '<\/script>';

var htmlDocument = document.implementation.createHTMLDocument('title');
var htmlParser   = htmlDocument.createDocumentFragment();

domProcessor.on(domProcessor.HTML_PROCESSING_REQUIRED_EVENT, (html, callback) => {
    if (!isPageHtml(html))
        html = '<html><body>' + html + '</body></html>';

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

export function isPageHtml (html) {
    return /^\s*(<\s*(!doctype|html|head|body)[^>]*>)/i.test(html);
}

function processPageTag (pageTagHtml, process) {
    pageTagHtml = pageTagHtml.replace(/^(\s*<\s*)(head|body|html)/i, '$1fakeTagName_$2');

    return process(pageTagHtml).replace(/<\/fakeTagName_[\s\S]+$/i, '').replace(/fakeTagName_/i, '');
}

function processPageHtml (html, process) {
    var doctypeRegEx     = /^(\s*<\s*!doctype[^>]*>)([\s\S]*)$/i;
    var headBodyRegEx    = /^(\s*<\s*(head|body)[^>]*>)([\s\S]*?)(<\s*\/(head|body)\s*>\s*)?$/i;
    var htmlContentRegEx = /^(\s*<\s*head[^>]*>)([\s\S]*?)(<\s*\/head\s*>\s*)(<\s*body[^>]*>)([\s\S]*?)(<\s*\/body\s*>\s*)?$/i;
    var htmlRegEx        = /^(\s*<\s*html[^>]*>)([\s\S]*?)(<\s*\/html\s*>\s*)?$/i;

    var doctypeMatches = html.match(doctypeRegEx);

    if (doctypeMatches)
        return doctypeMatches[1] + process(doctypeMatches[2]);

    var htmlMatches = html.match(htmlRegEx);

    if (htmlMatches) {
        return processPageTag(htmlMatches[1], process) +
               process(htmlMatches[2], 'html') +
               (htmlMatches[3] || '');
    }

    var htmlContentMatches = html.match(htmlContentRegEx);

    if (htmlContentMatches) {
        return processPageTag(htmlContentMatches[1], process) +
               process(htmlContentMatches[2], 'head') +
               (htmlContentMatches[3] || '') +
               processPageTag(htmlContentMatches[4], process) +
               process(htmlContentMatches[5], 'body') +
               (htmlContentMatches[6] || '');
    }

    var headBodyMatches = html.match(headBodyRegEx);

    if (headBodyMatches) {
        return processPageTag(headBodyMatches[1], process) +
               process(headBodyMatches[3], headBodyMatches[2]) +
               (headBodyMatches[4] || '');
    }
}

function wrapTextNodes (html) {
    var textNodeRegEx = /(<\s*(table|tbody|\/tbody|\/tfoot|\/thead|\/tr|tfoot|thead|tr|\/td)[^>]*>)(\s*[^<\s]+[^<]*)(?=<)/ig;
    var index         = 0;

    return html.replace(textNodeRegEx, (str, p1, p2, p3) => {
        var marker = TEXT_NODE_COMMENT_MARKER + (index++).toString();

        return p1 + '<!--' + marker + p3 + marker + '-->';
    });
}

function unwrapTextNodes (html) {
    var i      = 0;
    var marker = '';

    do {
        marker = TEXT_NODE_COMMENT_MARKER + i;
        html   = html.replace('<!--' + marker, '').replace(marker + '-->', '');
    } while (html.indexOf(TEXT_NODE_COMMENT_MARKER + ++i) !== -1);

    return html;
}

function processHtmlInternal (html, parentTag, process) {
    html = wrapTextNodes(html);

    var container = getHtmlDocument().createElement('div');

    htmlParser.innerHTML = '';
    nativeMethods.appendChild.call(htmlParser, container);

    parentTag = parentTag ? parentTag.toLowerCase() : '';

    var isRow    = parentTag === 'tr';
    var isTable  = parentTag === 'table' || parentTag === 'tbody';
    var isScript = parentTag === 'script';

    if (isTable)
        html = '<table>' + html + '</table>';
    else if (isRow)
        html = '<table><tr>' + html + '</tr></table>';
    else if (isScript)
        html = '<script>' + html + '</script>';

    container.innerHTML = html;

    if (process(container))
        html = container.innerHTML;

    if (isTable)
        html = html.replace(/^<table>(<tbody>)?|(<\/tbody>)?<\/table>$/ig, '');
    else if (isRow)
        html = html.replace(/^<table>(<tbody>)?<tr>|<\/tr>(<\/tbody>)?<\/table>$/ig, '');
    else if (isScript)
        html = html.replace(/^<script>|<\/script>$/ig, '');

    return unwrapTextNodes(html);
}

export function cleanUpHtml (html, parentTag) {
    if (isPageHtml(html))
        return processPageHtml(html, cleanUpHtml);

    return processHtmlInternal(html, parentTag, container => {
        var changed = false;

        /*eslint-disable no-loop-func */
        for (var i = 0; i < domProcessor.URL_ATTRS.length; i++) {
            var attr       = domProcessor.URL_ATTRS[i];
            var storedAttr = domProcessor.getStoredAttrName(attr);

            find(container, '[' + storedAttr + ']', el => {
                if (el.hasAttribute(attr)) {
                    nativeMethods.setAttribute.call(el, attr, nativeMethods.getAttribute.call(el, storedAttr));
                    nativeMethods.removeAttribute.call(el, storedAttr);

                    changed = true;
                }
            });
        }
        /*eslint-disable no-loop-func */

        find(container, '[class*="' + SHADOW_UI_CLASSNAME.postfix + '"]', el => {
            if (el.parentNode) {
                el.parentNode.removeChild(el);
                changed = true;
            }
        });

        find(container, 'script', el => {
            var innerHTML        = el.innerHTML;
            var cleanedInnerHTML = removeProcessingHeader(innerHTML);

            if (innerHTML !== cleanedInnerHTML) {
                el.innerHTML = cleanedInnerHTML;

                changed = true;
            }
        });

        find(container, '[' + INTERNAL_ATTRS.hoverPseudoClass + ']', el => {
            nativeMethods.removeAttribute.call(el, INTERNAL_ATTRS.hoverPseudoClass);

            changed = true;
        });

        if (parentTag === 'head' || parentTag === 'body') {
            if (container.innerHTML.indexOf(INIT_SCRIPT_FOR_IFRAME_TEMPLATE) !== -1) {
                container.innerHTML = container.innerHTML.replace(INIT_SCRIPT_FOR_IFRAME_TEMPLATE, '');

                changed = true;
            }
        }

        return changed;
    });
}

export function processHtml (html, parentTag) {
    if (isPageHtml(html))
        return processPageHtml(html, processHtml);

    return processHtmlInternal(html, parentTag, container => {
        // NOTE: We check this condition to avoid unnecessary calls of the querySelectorAll function.
        if (container.children.length === 1 && container.children[0].children && !container.children[0].children.length)
            domProcessor.processElement(container.children[0], convertToProxyUrl);
        else {
            var children = container.querySelectorAll('*');

            for (var i = 0; i < children.length; i++)
                domProcessor.processElement(children[i], convertToProxyUrl);
        }

        if (parentTag === 'head' || parentTag === 'body')
            container.innerHTML = INIT_SCRIPT_FOR_IFRAME_TEMPLATE + container.innerHTML;

        return true;
    });
}

export function isWellFormattedHtml (html) {
    var tagStack = [];

    // NOTE: http://www.w3.org/TR/html5/syntax.html#void-elements.
    var voidElements = ['area', 'base', 'basefont', 'br', 'col', 'embed', 'frame', 'hr', 'img', 'input', 'keygen', 'isindex', 'link', 'meta', 'param', 'source', 'track', 'wbr'];

    // NOTE: Real cases are very hard - http://www.w3.org/TR/html5/syntax.html#optional-tags Using a simplified
    // algorithm. And going without checking self-closed elements for SVG(http://www.w3.org/TR/SVG/struct.html) and
    // MathML(http://www.w3.org/wiki/MathML/Elements).
    var selfClosedTags = ['colgroup', 'dd', 'dt', 'li', 'options', 'p', 'td', 'tfoot', 'th', 'thead', 'tr'];

    var lastItem      = arr => arr[arr.length - 1];
    var contains      = (arr, item) => arr.indexOf(item) !== -1;
    var parseStartTag = (tag, tagName, attributes, unary) => {
        if (!contains(voidElements, tagName)) {
            if (!unary) {
                tagName = tagName.toLowerCase();
                tagStack.push(tagName);
            }
        }
    };

    var parseEndTag = (tag, tagName) => {
        tagName = tagName.toLowerCase();

        if (tagName === lastItem(tagStack))
            tagStack.pop();
        else if (contains(selfClosedTags, lastItem(tagStack))) {
            tagStack.pop();
            parseEndTag(tag, tagName);
        }
        else if (contains(voidElements, tagName))
            throw new Error('Empty tags cannot have end-closed tag part');
        else
            throw new Error('Cannot find open tag for ' + lastItem(tagStack));
    };

    var startTagReg = /^<(\w+)([\s\S]*?)(\/?)>/;
    var endTagReg   = /^<\/(\w+)[^>]*>/;
    var doctypeReg  = /^<!doctype[^>]*>/i;

    // NOTE: http://www.w3.org/TR/html5/syntax.html#raw-text-elements.
    var rawTextElements = ['script', 'style'];

    var BEGIN_COMMENT       = '<!--';
    var END_COMMENT         = '-->';
    var BEGIN_TAG           = '<';
    var END_TAG             = '</';
    var DOCTYPE_DECLARATION = '<!';

    var charIndex        = null;
    var isPlanText       = null;
    var match            = null;
    var previousStepHtml = html;
    var wellFormatted    = true;

    try {
        while (html) {
            isPlanText = true;

            // NOTE: Not in a script or style element.
            if (!lastItem(tagStack) || !contains(rawTextElements, lastItem(tagStack))) {
                // html comment
                if (html.indexOf(BEGIN_COMMENT) === 0) {
                    charIndex  = html.indexOf(END_COMMENT);
                    html       = html.substring(charIndex + 3);
                    isPlanText = false;
                }
                // NOTE: Doctype declaration.
                else if (html.indexOf(DOCTYPE_DECLARATION) === 0) {
                    match = html.match(doctypeReg);

                    if (match) {
                        html       = html.substring(match[0].length);
                        isPlanText = false;
                    }
                }
                // NOTE: End tag.
                else if (html.indexOf(END_TAG) === 0) {
                    match = html.match(endTagReg);

                    if (match) {
                        html       = html.substring(match[0].length);
                        match[0].replace(endTagReg, parseEndTag);
                        isPlanText = false;
                    }
                }
                else if (html.indexOf(BEGIN_TAG) === 0) {
                    match = html.match(startTagReg);

                    if (match) {
                        html       = html.substring(match[0].length);
                        match[0].replace(startTagReg, parseStartTag);
                        isPlanText = false;
                    }
                }

                if (isPlanText) {
                    charIndex = html.indexOf(BEGIN_TAG);
                    html      = charIndex === -1 ? '' : html.substring(charIndex);
                }
            }
            else {
                var tagContentReg = new RegExp('^([\\s\\S]*?)<\/' + lastItem(tagStack) + '[^>]*>');

                match = html.match(tagContentReg);

                if (match) {
                    html = html.substring(match[0].length);
                    parseEndTag('', lastItem(tagStack));
                }
                else
                    throw new Error('Cannot process rawTextElement content');
            }

            if (html === previousStepHtml)
                throw new Error('Html parser error');

            previousStepHtml = html;
        }
        if (lastItem(tagStack))
            throw new Error('There are non closed tag -' + lastItem(tagStack));
    }
    catch (err) {
        wellFormatted = false;
    }

    return wellFormatted;
}
