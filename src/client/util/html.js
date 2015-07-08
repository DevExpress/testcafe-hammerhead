import NativeMethods from '../sandboxes/native-methods';
import * as DOM from './dom';
import DomProcessor from '../dom-processor/dom-processor';
import ScriptProcessor from '../../processing/script';
import * as Const from '../../const';
import UrlUtil from '../util/url';

const TEXT_NODE_COMMENT_MARKER = '16c959db8754';

export const INIT_SCRIPT_FOR_IFRAME_TEMPLATE =
    '<script class="' + Const.SHADOW_UI_SCRIPT_CLASSNAME + '" type="text/javascript">' +
    'var parentHammerhead = null;' +
    'try {' +
    '   parentHammerhead = window.parent.Hammerhead;' +
    '} catch(e) {}' +
    'if (parentHammerhead) parentHammerhead._rebindDomSandboxToIframe(window.frameElement);' +
    'var script = document.currentScript || document.scripts[document.scripts.length - 1];' +
    'script.parentNode.removeChild(script);' +
    '<\/script>';

var htmlDocument = document.implementation.createHTMLDocument('title');
var htmlParser   = htmlDocument.createDocumentFragment();

DomProcessor.on(DomProcessor.HTML_PROCESSING_REQUIRED, function (html, callback) {
    if (!isPageHtml(html))
        html = '<html><body>' + html + '</body></html>';

    callback(processHtml(html));
});

function getHtmlDocument () {
    try {
        // IE bug: access denied
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
    var htmlContentRegEx = /^(\s*<\s*head[^>]*>)([\s\S]*?)(<\s*\/head\s*>\s*<\s*body[^>]*>)([\s\S]*?)(<\s*\/body\s*>\s*)?$/i;
    var htmlRegEx        = /^(\s*<\s*html[^>]*>)([\s\S]*?)(<\s*\/html\s*>\s*)?$/i;

    var doctypeMatches = html.match(doctypeRegEx);

    if (doctypeMatches)
        return doctypeMatches[1] + process(doctypeMatches[2]);

    var htmlMatches = html.match(htmlRegEx);

    if (htmlMatches)
        return [processPageTag(htmlMatches[1], process), process(htmlMatches[2], 'html'), htmlMatches[3]].join('');

    var htmlContentMatches = html.match(htmlContentRegEx);

    if (htmlContentMatches) {
        return [htmlContentMatches[1], process(htmlContentMatches[2], 'head'), htmlContentMatches[3],
            process(htmlContentMatches[4], 'body'), htmlContentMatches[5]].join('');
    }

    var headBodyMatches = html.match(headBodyRegEx);

    if (headBodyMatches)
        return [processPageTag(headBodyMatches[1], process), process(headBodyMatches[3], headBodyMatches[2]), headBodyMatches[4]].join('');
}

function wrapTextNodes (html) {
    var textNodeRegEx = /(<\s*(table|tbody|\/tbody|\/tfoot|\/thead|\/tr|tfoot|thead|tr|\/td)[^>]*>)(\s*[^<\s]+[^<]*)(?=<)/ig;
    var index         = 0;

    return html.replace(textNodeRegEx, function (str, p1, p2, p3) {
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
    NativeMethods.appendChild.call(htmlParser, container);

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

    return processHtmlInternal(html, parentTag, function (container) {
        var changed = false;

        /*eslint-disable no-loop-func */
        for (var i = 0; i < DomProcessor.URL_ATTRS.length; i++) {
            var attr       = DomProcessor.URL_ATTRS[i];
            var storedAttr = DomProcessor.getStoredAttrName(attr);

            DOM.find(container, '[' + storedAttr + ']', function (el) {
                if (el.hasAttribute(attr)) {
                    NativeMethods.setAttribute.call(el, attr, NativeMethods.getAttribute.call(el, storedAttr));
                    NativeMethods.removeAttribute.call(el, storedAttr);

                    changed = true;
                }
            });
        }
        /*eslint-disable no-loop-func */

        DOM.find(container, '[class*="' + Const.SHADOW_UI_CLASSNAME_POSTFIX + '"]', function (el) {
            if (el.parentNode) {
                el.parentNode.removeChild(el);
                changed = true;
            }
        });

        DOM.find(container, 'script', function (el) {
            var innerHTML = el.innerHTML;

            if (ScriptProcessor.SCRIPT_HEADER_REG_EX.test(innerHTML)) {
                el.innerHTML = innerHTML.replace(ScriptProcessor.SCRIPT_HEADER_REG_EX, '');

                changed = true;
            }
        });

        DOM.find(container, '[' + Const.HOVER_PSEUDO_CLASS_ATTR + ']', function (el) {
            NativeMethods.removeAttribute.call(el, Const.HOVER_PSEUDO_CLASS_ATTR);

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

    return processHtmlInternal(html, parentTag, function (container) {
        //NOTE: we check this condition to avoid unnecessary calling the querySelectorAll function
        if (container.children.length === 1 && container.children[0].children && !container.children[0].children.length)
            DomProcessor.processElement(container.children[0], UrlUtil.convertToProxyUrl);
        else {
            var children = container.querySelectorAll('*');

            for (var i = 0; i < children.length; i++)
                DomProcessor.processElement(children[i], UrlUtil.convertToProxyUrl);
        }

        if (parentTag === 'head' || parentTag === 'body')
            container.innerHTML = INIT_SCRIPT_FOR_IFRAME_TEMPLATE + container.innerHTML;

        return true;
    });
}

export function isWellFormattedHtml (html) {
    var tagStack = [];

    //http://www.w3.org/TR/html5/syntax.html#void-elements
    var voidElements = ['area', 'base', 'basefont', 'br', 'col', 'embed', 'frame', 'hr', 'img', 'input', 'keygen', 'isindex', 'link', 'meta', 'param', 'source', 'track', 'wbr'];

    //Real cases are very hard - http://www.w3.org/TR/html5/syntax.html#optional-tags
    //Use a simplified algorithm
    //Also not check self-closed elements for SVG(http://www.w3.org/TR/SVG/struct.html) and MathML(http://www.w3.org/wiki/MathML/Elements)
    var selfClosedTags = ['colgroup', 'dd', 'dt', 'li', 'options', 'p', 'td', 'tfoot', 'th', 'thead', 'tr'];

    var lastItem = function (arr) {
        return arr[arr.length - 1];
    };

    var contains = function (arr, item) {
        return arr.indexOf(item) !== -1;
    };

    var parseStartTag = function (tag, tagName, attributes, unary) {
        if (!contains(voidElements, tagName)) {
            if (!unary) {
                tagName = tagName.toLowerCase();
                tagStack.push(tagName);
            }
        }
    };

    var parseEndTag = function (tag, tagName) {
        tagName = tagName.toLowerCase();

        /*eslint-disable indent */
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
        /*eslint-enable indent */
    };

    var startTagReg = /^<(\w+)([\s\S]*?)(\/?)>/;
    var endTagReg   = /^<\/(\w+)[^>]*>/;
    var doctypeReg  = /^<!doctype[^>]*>/i;

    //http://www.w3.org/TR/html5/syntax.html#raw-text-elements
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

            // Not in a script or style element
            if (!lastItem(tagStack) || !contains(rawTextElements, lastItem(tagStack))) {
                // html comment
                if (html.indexOf(BEGIN_COMMENT) === 0) {
                    charIndex  = html.indexOf(END_COMMENT);
                    html       = html.substring(charIndex + 3);
                    isPlanText = false;
                }
                // doctype declaration
                else if (html.indexOf(DOCTYPE_DECLARATION) === 0) {
                    match = html.match(doctypeReg);

                    if (match) {
                        html       = html.substring(match[0].length);
                        isPlanText = false;
                    }
                }
                // end tag
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

                /*eslint-disable indent */
                if (match) {
                    html = html.substring(match[0].length);
                    parseEndTag('', lastItem(tagStack));
                }
                else
                    throw new Error('Cannot process rawTextElement content');
                /*eslint-enable indent */
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
