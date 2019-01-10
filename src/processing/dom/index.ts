// -------------------------------------------------------------
// WARNING: this file is used by both the client and the server.
// Do not use any browser or node-specific API!
// -------------------------------------------------------------

import INTERNAL_ATTRS from '../../processing/dom/internal-attributes';
import SHADOW_UI_CLASSNAME from '../../shadow-ui/class-name';
import { isScriptProcessed, processScript } from '../script';
import styleProcessor from '../../processing/style';
import * as urlUtils from '../../utils/url';
import trim from '../../utils/string-trim';
import { XML_NAMESPACE } from './namespaces';
import { URL_ATTR_TAGS, URL_ATTRS, TARGET_ATTR_TAGS, TARGET_ATTRS } from './attributes';

const CDATA_REG_EX: RegExp                       = /^(\s)*\/\/<!\[CDATA\[([\s\S]*)\/\/\]\]>(\s)*$/;
const HTML_COMMENT_POSTFIX_REG_EX: RegExp        = /(\/\/[^\n]*|\n\s*)-->[^\n]*([\n\s]*)?$/;
const HTML_COMMENT_PREFIX_REG_EX: RegExp         = /^(\s)*<!--[^\n]*\n/;
const HTML_COMMENT_SIMPLE_POSTFIX_REG_EX: RegExp = /-->\s*$/;
const JAVASCRIPT_PROTOCOL_REG_EX: RegExp         = /^\s*javascript\s*:/i;
const EXECUTABLE_SCRIPT_TYPES_REG_EX: RegExp     = /^\s*(application\/(x-)?(ecma|java)script|text\/(javascript(1\.[0-5])?|((x-)?ecma|x-java|js|live)script))\s*$/i;

const SVG_XLINK_HREF_TAGS: Array<string> = [
    'animate', 'animateColor', 'animateMotion', 'animateTransform', 'mpath', 'set', //animation elements
    'linearGradient', 'radialGradient', 'stop', //gradient elements
    'a', 'altglyph', 'color-profile', 'cursor', 'feimage', 'filter', 'font-face-uri', 'glyphref', 'image',
    'mpath', 'pattern', 'script', 'textpath', 'use', 'tref'
];

const INTEGRITY_ATTR_TAGS: Array<string> = ['script', 'link'];
const IFRAME_FLAG_TAGS: Array<string>    = ['a', 'form', 'area', 'input', 'button'];

const ELEMENT_PROCESSED: string = 'hammerhead|element-processed';

const AUTOCOMPLETE_ATTRIBUTE_ABSENCE_MARKER: string = 'hammerhead|autocomplete-attribute-absence-marker';

export default class DomProcessor {
    private readonly adapter: any;
    SVG_XLINK_HREF_TAGS: string[] = SVG_XLINK_HREF_TAGS;
    AUTOCOMPLETE_ATTRIBUTE_ABSENCE_MARKER: string = AUTOCOMPLETE_ATTRIBUTE_ABSENCE_MARKER;
    private readonly elementProcessorPatterns: any;
    forceProxySrcForImage: boolean = false;
    // Refactor this, see BaseDomAdapter;
    EVENTS: string[];

    constructor (adapter: any) {
        this.adapter = adapter;
        this.adapter.attachEventEmitter(this);

        this.EVENTS = this.adapter.EVENTS;
        this.elementProcessorPatterns = this._createProcessorPatterns(this.adapter);
    }

    static isTagWithTargetAttr (tagName: string) {
        return tagName && TARGET_ATTR_TAGS.target.indexOf(tagName) > -1;
    }

    static isTagWithFormTargetAttr (tagName: string) {
        return tagName && TARGET_ATTR_TAGS.formtarget.indexOf(tagName) > -1;
    }

    static isTagWithIntegrityAttr (tagName: string) {
        return tagName && INTEGRITY_ATTR_TAGS.indexOf(tagName) !== -1;
    }

    static isIframeFlagTag (tagName: string) {
        return tagName && IFRAME_FLAG_TAGS.indexOf(tagName) !== -1;
    }

    static isAddedAutocompleteAttr (attrName: string, storedAttrValue: string) {
        return attrName === 'autocomplete' && storedAttrValue === AUTOCOMPLETE_ATTRIBUTE_ABSENCE_MARKER;
    }

    static processJsAttrValue (value: string, { isJsProtocol, isEventAttr }: { isJsProtocol?: boolean, isEventAttr?: boolean}) {
        if (isJsProtocol)
            value = value.replace(JAVASCRIPT_PROTOCOL_REG_EX, '');

        value = processScript(value, false, isJsProtocol && !isEventAttr);

        if (isJsProtocol)
            // eslint-disable-next-line no-script-url
            value = 'javascript:' + value;

        return value;
    }

    static getStoredAttrName (attr: string) {
        return attr + INTERNAL_ATTRS.storedAttrPostfix;
    }

    static isJsProtocol (value: string) {
        return JAVASCRIPT_PROTOCOL_REG_EX.test(value);
    }

    static _isHtmlImportLink (tagName: string, relAttr: string) {
        return tagName && relAttr && tagName === 'link' && relAttr === 'import';
    }

    _getRelAttribute (el) {
        return String(this.adapter.getAttr(el, 'rel')).toLocaleLowerCase();
    }

    _createProcessorPatterns (adapter) {
        const selectors = {
            HAS_HREF_ATTR: el => this.isUrlAttr(el, 'href'),

            HAS_SRC_ATTR: el => this.isUrlAttr(el, 'src'),

            HAS_ACTION_ATTR: el => this.isUrlAttr(el, 'action'),

            HAS_FORMACTION_ATTR: el => this.isUrlAttr(el, 'formaction'),

            HAS_FORMTARGET_ATTR: el => {
                return DomProcessor.isTagWithFormTargetAttr(adapter.getTagName(el)) && adapter.hasAttr(el, 'formtarget');
            },

            HAS_MANIFEST_ATTR: el => this.isUrlAttr(el, 'manifest'),

            HAS_DATA_ATTR: el => this.isUrlAttr(el, 'data'),

            HTTP_EQUIV_META: el => {
                const tagName = adapter.getTagName(el);

                return tagName === 'meta' && adapter.hasAttr(el, 'http-equiv');
            },

            ALL: () => true,

            IS_SCRIPT: el => adapter.getTagName(el) === 'script',

            IS_LINK: el => adapter.getTagName(el) === 'link',

            IS_INPUT: el => adapter.getTagName(el) === 'input',

            IS_FILE_INPUT: el => {
                return adapter.getTagName(el) === 'input' &&
                       adapter.hasAttr(el, 'type') &&
                       adapter.getAttr(el, 'type').toLowerCase() === 'file';
            },

            IS_STYLE: el => adapter.getTagName(el) === 'style',

            HAS_EVENT_HANDLER: el => adapter.hasEventHandler(el),

            IS_SANDBOXED_IFRAME: el => {
                const tagName = adapter.getTagName(el);

                return (tagName === 'iframe' || tagName === 'frame') && adapter.hasAttr(el, 'sandbox');
            },

            IS_SVG_ELEMENT_WITH_XLINK_HREF_ATTR: el => {
                return adapter.isSVGElement(el) &&
                       adapter.hasAttr(el, 'xlink:href') &&
                       SVG_XLINK_HREF_TAGS.indexOf(adapter.getTagName(el)) !== -1;
            },

            IS_SVG_ELEMENT_WITH_XML_BASE_ATTR: el => adapter.isSVGElement(el) && adapter.hasAttr(el, 'xml:base')
        };

        return [
            {
                selector:          selectors.HAS_FORMTARGET_ATTR,
                targetAttr:        'formtarget',
                elementProcessors: [this._processTargetBlank]
            },
            {
                selector:          selectors.HAS_HREF_ATTR,
                urlAttr:           'href',
                targetAttr:        'target',
                elementProcessors: [this._processTargetBlank, this._processUrlAttrs, this._processUrlJsAttr]
            },
            {
                selector:          selectors.HAS_SRC_ATTR,
                urlAttr:           'src',
                targetAttr:        'target',
                elementProcessors: [this._processTargetBlank, this._processUrlAttrs, this._processUrlJsAttr]
            },
            {
                selector:          selectors.HAS_ACTION_ATTR,
                urlAttr:           'action',
                targetAttr:        'target',
                elementProcessors: [this._processTargetBlank, this._processUrlAttrs, this._processUrlJsAttr]
            },
            {
                selector:          selectors.HAS_FORMACTION_ATTR,
                urlAttr:           'formaction',
                targetAttr:        'formtarget',
                elementProcessors: [this._processUrlAttrs, this._processUrlJsAttr]
            },
            {
                selector:          selectors.HAS_MANIFEST_ATTR,
                urlAttr:           'manifest',
                elementProcessors: [this._processUrlAttrs, this._processUrlJsAttr]
            },
            {
                selector:          selectors.HAS_DATA_ATTR,
                urlAttr:           'data',
                elementProcessors: [this._processUrlAttrs, this._processUrlJsAttr]
            },
            {
                selector:          selectors.HTTP_EQUIV_META,
                urlAttr:           'content',
                elementProcessors: [this._processMetaElement]
            },
            {
                selector:          selectors.IS_SCRIPT,
                elementProcessors: [this._processScriptElement, this._processIntegrityAttr]
            },

            { selector: selectors.ALL, elementProcessors: [this._processStyleAttr] },
            {
                selector:          selectors.IS_LINK,
                relAttr:           'rel',
                elementProcessors: [this._processIntegrityAttr, this._processRelPrefetch]
            },
            { selector: selectors.IS_STYLE, elementProcessors: [this._processStylesheetElement] },
            { selector: selectors.IS_INPUT, elementProcessors: [this._processAutoComplete] },
            { selector: selectors.IS_FILE_INPUT, elementProcessors: [this._processRequired] },
            { selector: selectors.HAS_EVENT_HANDLER, elementProcessors: [this._processEvtAttr] },
            { selector: selectors.IS_SANDBOXED_IFRAME, elementProcessors: [this._processSandboxedIframe] },
            {
                selector:          selectors.IS_SVG_ELEMENT_WITH_XLINK_HREF_ATTR,
                urlAttr:           'xlink:href',
                elementProcessors: [this._processSVGXLinkHrefAttr, this._processUrlAttrs]
            },
            {
                selector:          selectors.IS_SVG_ELEMENT_WITH_XML_BASE_ATTR,
                urlAttr:           'xml:base',
                elementProcessors: [this._processUrlAttrs]
            }
        ];
    }

    // API
    processElement (el, urlReplacer) {
        if (el[ELEMENT_PROCESSED])
            return;

        for (let i = 0; i < this.elementProcessorPatterns.length; i++) {
            const pattern = this.elementProcessorPatterns[i];

            if (pattern.selector(el) && !this._isShadowElement(el)) {
                for (let j = 0; j < pattern.elementProcessors.length; j++)
                    pattern.elementProcessors[j].call(this, el, urlReplacer, pattern);
                el[ELEMENT_PROCESSED] = true;
            }
        }
    }

    // Utils
    getElementResourceType (el) {
        const tagName = this.adapter.getTagName(el);

        return urlUtils.getResourceTypeString({
            isIframe:     tagName === 'iframe' || tagName === 'frame' || this._isOpenLinkInIframe(el),
            isForm:       tagName === 'form' || tagName === 'input' || tagName === 'button',
            isScript:     tagName === 'script',
            isHtmlImport: tagName === 'link' && this._getRelAttribute(el) === 'import'
        });
    }

    isUrlAttr (el, attr: string, ns?: string): boolean {
        const tagName = this.adapter.getTagName(el);

        attr = attr ? attr.toLowerCase() : attr;

        if (URL_ATTR_TAGS[attr] && URL_ATTR_TAGS[attr].indexOf(tagName) !== -1)
            return true;

        return this.adapter.isSVGElement(el) && (attr === 'xml:base' || attr === 'base' && ns === XML_NAMESPACE);
    }

    getUrlAttr (el) {
        const tagName = this.adapter.getTagName(el);

        for (const urlAttr of URL_ATTRS) {
            if (URL_ATTR_TAGS[urlAttr].indexOf(tagName) !== -1)
                return urlAttr;
        }

        return null;
    }

    getTargetAttr (el) {
        const tagName = this.adapter.getTagName(el);

        for (const targetAttr of TARGET_ATTRS) {
            if (TARGET_ATTR_TAGS[targetAttr].indexOf(tagName) > -1)
                return targetAttr;
        }

        return null;
    }

    _isOpenLinkInIframe (el): boolean {
        const tagName    = this.adapter.getTagName(el);
        const targetAttr = this.getTargetAttr(el);
        const target     = this.adapter.getAttr(el, targetAttr);
        const rel        = this._getRelAttribute(el);

        if (target !== '_top') {
            const mustProcessTag = DomProcessor.isIframeFlagTag(tagName) ||
                                   DomProcessor._isHtmlImportLink(tagName, rel);
            const isNameTarget   = target ? target[0] !== '_' : false;

            if (target === '_parent')
                return mustProcessTag && !this.adapter.isTopParentIframe(el);

            if (mustProcessTag && (this.adapter.hasIframeParent(el) || isNameTarget && this.adapter.isExistingTarget(target)))
                return true;
        }

        return false;
    }

    _isShadowElement (el): boolean {
        const className = this.adapter.getClassName(el);

        return typeof className === 'string' && className.indexOf(SHADOW_UI_CLASSNAME.postfix) > -1;
    }

    // Element processors
    _processAutoComplete (el) {
        const storedUrlAttr = DomProcessor.getStoredAttrName('autocomplete');
        const processed     = this.adapter.hasAttr(el, storedUrlAttr);
        const attrValue     = this.adapter.getAttr(el, processed ? storedUrlAttr : 'autocomplete');

        if (!processed) {
            this.adapter.setAttr(el, storedUrlAttr, attrValue || attrValue ===
                                                                 ''
                ? attrValue
                : AUTOCOMPLETE_ATTRIBUTE_ABSENCE_MARKER);
        }

        this.adapter.setAttr(el, 'autocomplete', 'off');
    }

    _processRequired (el) {
        const storedRequired  = DomProcessor.getStoredAttrName('required');
        const hasRequiredAttr = this.adapter.hasAttr(el, 'required');
        const processed       = this.adapter.hasAttr(el, storedRequired) && !hasRequiredAttr;

        if (!processed && hasRequiredAttr) {
            const attrValue = this.adapter.getAttr(el, 'required');

            this.adapter.setAttr(el, storedRequired, attrValue);
            this.adapter.removeAttr(el, 'required');
        }
    }

    // NOTE: We simply remove the 'integrity' attribute because its value will not be relevant after the script
    // content changes (http://www.w3.org/TR/SRI/). If this causes problems in the future, we will need to generate
    // the correct SHA for the changed script.
    // In addition, we create stored 'integrity' attribute with the current 'integrity' attribute value. (GH-235)
    _processIntegrityAttr (el) {
        const storedIntegrityAttr = DomProcessor.getStoredAttrName('integrity');
        const processed           = this.adapter.hasAttr(el, storedIntegrityAttr) && !this.adapter.hasAttr(el, 'integrity');
        const attrValue           = this.adapter.getAttr(el, processed ? storedIntegrityAttr : 'integrity');

        if (attrValue)
            this.adapter.setAttr(el, storedIntegrityAttr, attrValue);

        if (!processed)
            this.adapter.removeAttr(el, 'integrity');
    }

    // NOTE: We simply remove the 'rel' attribute if rel='prefetch' and use stored 'rel' attribute, because the prefetch
    // resource type is unknown. https://github.com/DevExpress/testcafe/issues/2528
    _processRelPrefetch (el, _urlReplacer, pattern) {
        const storedRelAttr = DomProcessor.getStoredAttrName(pattern.relAttr);
        const processed     = this.adapter.hasAttr(el, storedRelAttr) && !this.adapter.hasAttr(el, pattern.relAttr);
        const attrValue     = this.adapter.getAttr(el, processed ? storedRelAttr : pattern.relAttr);

        if (attrValue) {
            const formatedValue = trim(attrValue.toLowerCase());

            if (formatedValue === 'prefetch') {
                this.adapter.setAttr(el, storedRelAttr, attrValue);

                if (!processed)
                    this.adapter.removeAttr(el, pattern.relAttr);
            }
        }
    }

    _processJsAttr (el, attrName: string, { isJsProtocol, isEventAttr }: { isJsProtocol?: boolean, isEventAttr?: boolean}) {
        const storedUrlAttr  = DomProcessor.getStoredAttrName(attrName);
        const processed      = this.adapter.hasAttr(el, storedUrlAttr);
        const attrValue      = this.adapter.getAttr(el, processed ? storedUrlAttr : attrName);
        const processedValue = DomProcessor.processJsAttrValue(attrValue, { isJsProtocol, isEventAttr });

        if (attrValue !== processedValue) {
            this.adapter.setAttr(el, storedUrlAttr, attrValue);

            this.adapter.setAttr(el, attrName, processedValue);
        }
    }

    _processEvtAttr (el) {
        const events = this.adapter.EVENTS;

        for (let i = 0; i < events.length; i++) {
            const attrValue = this.adapter.getAttr(el, events[i]);

            if (attrValue) {
                this._processJsAttr(el, events[i], {
                    isJsProtocol: DomProcessor.isJsProtocol(attrValue),
                    isEventAttr:  true
                });
            }
        }
    }

    _processMetaElement (el, urlReplacer, pattern) {
        const httpEquivAttrValue = this.adapter.getAttr(el, 'http-equiv').toLowerCase();

        if (httpEquivAttrValue === 'refresh') {
            let attr = this.adapter.getAttr(el, pattern.urlAttr);

            attr = attr.replace(/(url=)(.*)$/i, (_match, prefix, url) => prefix + urlReplacer(url));

            this.adapter.setAttr(el, pattern.urlAttr, attr);
        }
        // TODO: remove after https://github.com/DevExpress/testcafe-hammerhead/issues/244 implementation
        else if (httpEquivAttrValue === 'content-security-policy') {
            this.adapter.removeAttr(el, 'http-equiv');
            this.adapter.removeAttr(el, 'content');
        }
    }

    _processSandboxedIframe (el) {
        let attrValue         = this.adapter.getAttr(el, 'sandbox');
        const allowSameOrigin = attrValue.indexOf('allow-same-origin') !== -1;
        const allowScripts    = attrValue.indexOf('allow-scripts') !== -1;
        const storedAttr      = DomProcessor.getStoredAttrName('sandbox');

        this.adapter.setAttr(el, storedAttr, attrValue);

        if (!allowSameOrigin || !allowScripts) {
            attrValue += !allowSameOrigin ? ' allow-same-origin' : '';
            attrValue += !allowScripts ? ' allow-scripts' : '';
        }

        this.adapter.setAttr(el, 'sandbox', attrValue);
    }

    _processScriptElement (script) {
        const scriptContent = this.adapter.getScriptContent(script);

        if (!scriptContent || !this.adapter.needToProcessContent(script))
            return;

        const scriptProcessedOnServer = isScriptProcessed(scriptContent);

        if (scriptProcessedOnServer)
            return;

        // NOTE: We do not process scripts that are not executed during page load. We process scripts of types like
        // text/javascript, application/javascript etc. (a complete list of MIME types is specified in the w3c.org
        // html5 specification). If the type is not set, it is considered 'text/javascript' by default.
        const scriptType         = this.adapter.getAttr(script, 'type');
        const isExecutableScript = !scriptType || EXECUTABLE_SCRIPT_TYPES_REG_EX.test(scriptType);

        if (isExecutableScript) {
            let result               = scriptContent;
            let commentPrefix        = '';
            const commentPrefixMatch = result.match(HTML_COMMENT_PREFIX_REG_EX);
            let commentPostfix       = '';
            let commentPostfixMatch  = null;
            const hasCDATA           = CDATA_REG_EX.test(result);

            if (commentPrefixMatch) {
                commentPrefix       = commentPrefixMatch[0];
                commentPostfixMatch = result.match(HTML_COMMENT_POSTFIX_REG_EX);

                if (commentPostfixMatch)
                    commentPostfix = commentPostfixMatch[0];
                else if (!HTML_COMMENT_SIMPLE_POSTFIX_REG_EX.test(commentPrefix))
                    commentPostfix = '//-->';

                result = result.replace(commentPrefix, '').replace(commentPostfix, '');
            }

            if (hasCDATA)
                result = result.replace(CDATA_REG_EX, '$2');

            result = commentPrefix + processScript(result, true, false) + commentPostfix;

            if (hasCDATA)
                result = '\n//<![CDATA[\n' + result + '//]]>';

            this.adapter.setScriptContent(script, result);
        }
    }

    _processStyleAttr (el, urlReplacer) {
        const style = this.adapter.getAttr(el, 'style');

        if (style)
            this.adapter.setAttr(el, 'style', styleProcessor.process(style, urlReplacer, false));
    }

    _processStylesheetElement (el, urlReplacer) {
        let content = this.adapter.getStyleContent(el);

        if (content && urlReplacer && this.adapter.needToProcessContent(el)) {
            content = styleProcessor.process(content, urlReplacer, true);

            this.adapter.setStyleContent(el, content);
        }
    }

    _processTargetBlank (el, _urlReplacer, pattern) {
        const storedTargetAttr = DomProcessor.getStoredAttrName(pattern.targetAttr);
        const processed        = this.adapter.hasAttr(el, storedTargetAttr);

        if (!processed) {
            let attrValue = this.adapter.getAttr(el, pattern.targetAttr);

            // NOTE: Value may have whitespace.
            attrValue = attrValue && attrValue.replace(/\s/g, '');

            if (attrValue === '_blank' || attrValue === 'blank') {
                this.adapter.setAttr(el, pattern.targetAttr, '_top');
                this.adapter.setAttr(el, storedTargetAttr, attrValue);
            }
        }
    }

    _processUrlAttrs (el, urlReplacer, pattern) {
        if (urlReplacer && pattern.urlAttr) {
            const storedUrlAttr     = DomProcessor.getStoredAttrName(pattern.urlAttr);
            let resourceUrl         = this.adapter.getAttr(el, pattern.urlAttr);
            const isSpecialPage     = urlUtils.isSpecialPage(resourceUrl);
            const processedOnServer = this.adapter.hasAttr(el, storedUrlAttr);

            // NOTE: Page resource URL with proxy URL.
            if ((resourceUrl || resourceUrl === '') && !processedOnServer) {
                if (urlUtils.isSupportedProtocol(resourceUrl) || isSpecialPage) {
                    const elTagName = this.adapter.getTagName(el);
                    const isIframe  = elTagName === 'iframe' || elTagName === 'frame';
                    const isScript  = elTagName === 'script';
                    const isAnchor  = elTagName === 'a';
                    const target    = this.adapter.getAttr(el, pattern.targetAttr);

                    // NOTE: Elements with target=_parent shouldn’t be processed on the server,because we don't
                    // know what is the parent of the processed page (an iframe or the top window).
                    if (!this.adapter.needToProcessUrl(elTagName, target))
                        return;

                    const resourceType      = this.getElementResourceType(el);
                    const parsedResourceUrl = urlUtils.parseUrl(resourceUrl);
                    const isRelativePath    = parsedResourceUrl.protocol !== 'file:' && !parsedResourceUrl.host;
                    let proxyUrl            = '';
                    const charsetAttrValue  = isScript && this.adapter.getAttr(el, 'charset');

                    // NOTE: Only a non-relative iframe src can be cross-domain.
                    if (isIframe && !isSpecialPage && !isRelativePath) {
                        const location    = urlReplacer('/');
                        const proxyUrlObj = urlUtils.parseProxyUrl(location);
                        const destUrl     = proxyUrlObj.destUrl;

                        if (!parsedResourceUrl.protocol)
                            resourceUrl = proxyUrlObj.destResourceInfo.protocol + resourceUrl;

                        // NOTE: Cross-domain iframe.
                        if (!this.adapter.sameOriginCheck(destUrl, resourceUrl)) {
                            const proxyHostname      = urlUtils.parseUrl(location).hostname;
                            const proxyPort          = this.adapter.getCrossDomainPort();
                            const iframeResourceType = urlUtils.getResourceTypeString({ isIframe: true });

                            proxyUrl = resourceUrl ? this.adapter.getProxyUrl(resourceUrl, {
                                proxyHostname,
                                proxyPort,

                                sessionId:    proxyUrlObj.sessionId,
                                resourceType: iframeResourceType
                            }) : '';
                        }

                    }

                    if (isSpecialPage && !isAnchor)
                        proxyUrl = resourceUrl;

                    proxyUrl = proxyUrl === '' && resourceUrl
                        ? urlReplacer(resourceUrl, resourceType, charsetAttrValue)
                        : proxyUrl;

                    this.adapter.setAttr(el, storedUrlAttr, resourceUrl);

                    if (elTagName === 'img' && proxyUrl !== '' && !isSpecialPage) {
                        const attrValue = this.forceProxySrcForImage ? proxyUrl : urlUtils.resolveUrlAsDest(resourceUrl, urlReplacer);

                        this.adapter.setAttr(el, pattern.urlAttr, attrValue);
                    }
                    else
                        this.adapter.setAttr(el, pattern.urlAttr, proxyUrl);
                }
            }
        }
    }

    _processUrlJsAttr (el, _urlReplacer, pattern) {
        if (DomProcessor.isJsProtocol(this.adapter.getAttr(el, pattern.urlAttr)))
            this._processJsAttr(el, pattern.urlAttr, { isJsProtocol: true, isEventAttr: false });
    }

    _processSVGXLinkHrefAttr (el, _urlReplacer, pattern) {
        const attrValue = this.adapter.getAttr(el, pattern.urlAttr);

        if (urlUtils.HASH_RE.test(attrValue)) {
            const storedUrlAttr = DomProcessor.getStoredAttrName(pattern.urlAttr);

            this.adapter.setAttr(el, storedUrlAttr, attrValue);
        }
    }
}
