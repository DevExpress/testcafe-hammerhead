import UrlUtil from '../../utils/url';
import Const from '../../const';
import jsProcessor from '../js/index';
import scriptProcessor from '../../processing/script';
import styleProcessor from '../../processing/style';

const CDATA_REG_EX = /^(\s)*\/\/<!\[CDATA\[([\s\S]*)\/\/\]\]>(\s)*$/;
// Ignore '//:0/' url (http://www.myntra.com/)
const EMPTY_URL_REG_EX                   = /^(\w+:)?\/\/\:0/;
const HTML_COMMENT_POSTFIX_REG_EX        = /(\/\/[^\n]*|\n\s*)-->[^\n]*([\n\s]*)?$/;
const HTML_COMMENT_PREFIX_REG_EX         = /^(\s)*<!--[^\n]*\n/;
const HTML_COMMENT_SIMPLE_POSTFIX_REG_EX = /-->\s*$/;
const HTML_STRING_REG_EX                 = /^\s*('|")\s*(<[\s\S]+>)\s*('|")\s*$/;
const JAVASCRIPT_PROTOCOL_REG_EX         = /^\s*javascript\s*:/i;
const URL_ATTRS                          = ['href', 'src', 'action', 'manifest', 'data'];

const URL_ATTR_TAGS = {
    href:     ['a', 'link', 'image', 'area', 'base'],
    src:      ['img', 'embed', 'script', 'source', 'video', 'audio', 'input', 'frame', 'iframe'],
    action:   ['form'],
    manifest: ['html'],
    data:     ['object']
};

const TARGET_ATTR_TAGS = {
    a:    true,
    form: true,
    area: true,
    base: true
};

const HTML_PROCESSING_REQUIRED = 'HTML_PROCESSING_REQUIRED';

export default class DomProcessor {
    constructor (adapter) {
        this.adapter = adapter;
        this.adapter.attachEventEmitter(this);

        this.HTML_STRING_REG_EX         = HTML_STRING_REG_EX;
        this.JAVASCRIPT_PROTOCOL_REG_EX = JAVASCRIPT_PROTOCOL_REG_EX;
        this.TARGET_ATTR_TAGS           = TARGET_ATTR_TAGS;
        this.URL_ATTR_TAGS              = URL_ATTR_TAGS;
        this.URL_ATTRS                  = URL_ATTRS;
        this.HTML_PROCESSING_REQUIRED   = HTML_PROCESSING_REQUIRED;

        this.EVENTS = this.adapter.EVENTS;

        this.elementProcessorPatterns = this._createProcessorPatterns(this.adapter);
    }

    _createProcessorPatterns (adapter) {
        var selectors = {
            HAS_HREF_ATTR: (el) => {
                var tagName = adapter.getTagName(el).toLowerCase();

                return URL_ATTR_TAGS.href.indexOf(tagName) !== -1;
            },

            HAS_SRC_ATTR: (el) => {
                var tagName = adapter.getTagName(el).toLowerCase();

                return URL_ATTR_TAGS.src.indexOf(tagName) !== -1;
            },

            HAS_ACTION_ATTR: (el) => {
                var tagName = adapter.getTagName(el).toLowerCase();

                return URL_ATTR_TAGS.action.indexOf(tagName) !== -1;
            },

            HAS_MANIFEST_ATTR: (el) => {
                var tagName = adapter.getTagName(el).toLowerCase();

                return URL_ATTR_TAGS.manifest.indexOf(tagName) !== -1;
            },

            HAS_DATA_ATTR: (el) => {
                var tagName = adapter.getTagName(el).toLowerCase();

                return URL_ATTR_TAGS.data.indexOf(tagName) !== -1;
            },

            HTTP_EQUIV_META: (el) => {
                var tagName = adapter.getTagName(el).toLowerCase();

                return tagName === 'meta' && adapter.hasAttr(el, 'http-equiv');
            },

            ALL: () => {
                return true;
            },

            IS_SCRIPT: (el) => {
                return adapter.getTagName(el).toLowerCase() === 'script';
            },

            IS_INPUT: (el) => {
                return adapter.getTagName(el).toLowerCase() === 'input';
            },

            IS_STYLE: (el) => {
                return adapter.getTagName(el).toLowerCase() === 'style';
            },

            HAS_EVENT_HANDLER: (el) => {
                return adapter.hasEventHandler(el);
            },

            IS_SANDBOXED_IFRAME: (el) => {
                return adapter.getTagName(el).toLowerCase() === 'iframe' && adapter.hasAttr(el, 'sandbox');
            }
        };

        return [
            {
                selector:          selectors.HAS_HREF_ATTR,
                urlAttr:           'href',
                elementProcessors: [this._processTargetBlank, this._processUrlAttrs, this._processUrlJsAttr]
            },
            {
                selector:          selectors.HAS_SRC_ATTR,
                urlAttr:           'src',
                elementProcessors: [this._processTargetBlank, this._processUrlAttrs, this._processUrlJsAttr]
            },
            {
                selector:          selectors.HAS_ACTION_ATTR,
                urlAttr:           'action',
                elementProcessors: [this._processTargetBlank, this._processUrlAttrs, this._processUrlJsAttr]
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
            { selector: selectors.ALL, elementProcessors: [this._processStyleAttr] },
            { selector: selectors.IS_SCRIPT, elementProcessors: [this._processScriptElement] },
            { selector: selectors.IS_STYLE, elementProcessors: [this._processStylesheetElement] },
            { selector: selectors.IS_INPUT, elementProcessors: [this._processAutoComplete] },
            { selector: selectors.HAS_EVENT_HANDLER, elementProcessors: [this._processEvtAttr] },
            { selector: selectors.IS_SANDBOXED_IFRAME, elementProcessors: [this._processSandboxedIframe] }
        ];
    }

    // API
    processPage ($, urlReplacer) {
        var $base   = $('base');
        var baseUrl = $base.length ? this.adapter.getAttr($base[0], 'href') : '';
        var domProc = this;

        var replacer = (resourceUrl, resourceType) => urlReplacer(resourceUrl, resourceType, baseUrl);
        var $all     = $('*');

        for (var i = 0; i < this.elementProcessorPatterns.length; i++) {
            var pattern = this.elementProcessorPatterns[i];

            /*eslint-disable no-loop-func*/
            $all.filter(function () {
                return pattern.selector(this);
            }).each(function () {
                if (!this[Const.ELEMENT_PROCESSED_FLAG]) {
                    for (var j = 0; j < pattern.elementProcessors.length; j++)
                        pattern.elementProcessors[j].call(domProc, this, replacer, pattern);
                }
            });
            /*eslint-enable no-loop-func*/
        }
    }

    processElement (el, urlReplacer) {
        // NOTE: When the 'script' element created it is not executed. It occurs after the element is appended to a
        // document. But in IE 9 only, if you get script's 'document', 'children' or 'all' property, the script is executed
        // at the same time (before it is appended to a document). JQuery element's 'is' function implementation gets
        // 'document' property and the script is executed too early. Therefore we should check clone element instead it. (B237231)
        var elementForSelectorCheck = this.adapter.getElementForSelectorCheck(el);

        for (var i = 0; i < this.elementProcessorPatterns.length; i++) {
            var pattern = this.elementProcessorPatterns[i];

            if (pattern.selector(elementForSelectorCheck) && !this._isShadowElement(el)) {
                for (var j = 0; j < pattern.elementProcessors.length; j++)
                    pattern.elementProcessors[j].call(this, el, urlReplacer, pattern);
            }
        }
    }

    // Utils

    getStoredAttrName (attr) {
        return attr + Const.DOM_SANDBOX_STORED_ATTR_POSTFIX;
    }

    isOpenLinkInIFrame (el) {
        var tagName = this.adapter.getTagName(el).toLowerCase();
        var target  = this.adapter.getAttr(el, 'target');

        if (target !== '_top') {
            var mustProcessTag = this.adapter.IFRAME_FLAG_TAGS.indexOf(tagName) !== -1;
            var isNameTarget   = target ? target[0] !== '_' : false;

            if (target === '_parent')
                return mustProcessTag && !this.adapter.isTopParentIFrame(el);

            if (mustProcessTag && (this.adapter.hasIFrameParent(el) || isNameTarget))
                return true;
        }

        return false;
    }

    _isShadowElement (el) {
        return typeof el.className === 'string' && el.className.indexOf(Const.SHADOW_UI_CLASSNAME_POSTFIX) > -1;
    }

    // Element processors
    _processAutoComplete (el) {
        var storedUrlAttr = this.getStoredAttrName('autocomplete');
        var processed     = this.adapter.hasAttr(el, storedUrlAttr);
        var attrValue     = this.adapter.getAttr(el, processed ? storedUrlAttr : 'autocomplete');

        if (!processed)
            this.adapter.setAttr(el, storedUrlAttr, attrValue || attrValue === '' ? attrValue : 'none');

        this.adapter.setAttr(el, 'autocomplete', 'off');
    }

    _processJsAttr (el, attr, jsProtocol) {
        var storedUrlAttr = this.getStoredAttrName(attr);
        var processed     = this.adapter.hasAttr(el, storedUrlAttr);
        var attrValue     = this.adapter.getAttr(el, processed ? storedUrlAttr : attr);

        var code    = jsProtocol ? attrValue.replace(JAVASCRIPT_PROTOCOL_REG_EX, '') : attrValue;
        var matches = code.match(HTML_STRING_REG_EX);

        var domProc = this;

        var setAttributes = function (value, processedValue, processedAttrValue) {
            if (value !== processedValue) {
                if (!processed)
                    domProc.adapter.setAttr(el, storedUrlAttr, attrValue);

                domProc.adapter.setAttr(el, attr, processedAttrValue);
            }
        };

        if (matches && jsProtocol) {
            var html = matches[2];

            this.emit(this.HTML_PROCESSING_REQUIRED, html, function (processedHTML) {
                /*eslint-disable no-script-url*/
                var processedAttrValue = 'javascript:\'' + processedHTML.replace(/'/g, "\\'") + '\'';

                /*eslint-enable no-script-url*/
                setAttributes(html, processedHTML, processedAttrValue);
            });

        }
        else {
            var processedCode      = scriptProcessor.process(code, true);
            var processedAttrValue = processedCode;

            /*eslint-disable no-script-url*/
            if (jsProtocol)
                processedAttrValue = 'javascript:' + processedAttrValue;
            /*eslint-enable no-script-url*/

            setAttributes(code, processedCode, processedAttrValue);
        }
    }

    _processEvtAttr (el) {
        var events = this.adapter.EVENTS;

        for (var i = 0; i < events.length; i++) {
            var attrValue = this.adapter.getAttr(el, events[i]);

            if (attrValue)
                this._processJsAttr(el, events[i], JAVASCRIPT_PROTOCOL_REG_EX.test(attrValue));
        }
    }

    _processMetaElement (el, urlReplacer, pattern) {
        if (this.adapter.getAttr(el, 'http-equiv').toLowerCase() === 'refresh') {
            var attr = this.adapter.getAttr(el, pattern.urlAttr);

            attr = attr.replace(/(url=)(.*)$/i, function () {
                return arguments[1] + urlReplacer(arguments[2]);
            });

            this.adapter.setAttr(el, pattern.urlAttr, attr);
        }
    }

    _processSandboxedIframe (el) {
        var attrValue = this.adapter.getAttr(el, 'sandbox');

        if (attrValue.indexOf('allow-scripts') === -1) {
            var storedAttr = this.getStoredAttrName('sandbox');

            this.adapter.setAttr(el, storedAttr, attrValue);
            this.adapter.setAttr(el, 'sandbox', attrValue + ' allow-scripts');
        }
    }

    _processScriptElement (script) {
        var scriptContent = this.adapter.getScriptContent(script);

        if (!scriptContent)
            return;

        var scriptProcessedOnServer = jsProcessor.isScriptProcessed(scriptContent);

        if (scriptProcessedOnServer)
            return;

        // NOTE: we do not process scripts that are not executed during a page loading. We process scripts with type
        // text/javascript, application/javascript etc. (list of MIME types is specified in the w3c.org html5
        // specification). If type is not set, it 'text/javascript' by default.
        var scriptType                 = this.adapter.getAttr(script, 'type');
        var executableScriptTypesRegEx = /(application\/((x-)?ecma|(x-)?java)script)|(text\/)(javascript(1\.{0-5})?|((x-)?ecma|x-java|js|live)script)/;
        var isExecutableScript         = !scriptType || executableScriptTypesRegEx.test(scriptType);

        if (isExecutableScript) {
            var result              = scriptContent;
            var commentPrefix       = '';
            var commentPrefixMatch  = result.match(HTML_COMMENT_PREFIX_REG_EX);
            var commentPostfix      = '';
            var commentPostfixMatch = null;
            var hasCDATA            = CDATA_REG_EX.test(result);

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

            result = commentPrefix + scriptProcessor.process(result) + commentPostfix;

            if (hasCDATA)
                result = '\n//<![CDATA[\n' + result + '//]]>';

            this.adapter.setScriptContent(script, result);
        }
    }

    _processStyleAttr (el, urlReplacer) {
        var style = this.adapter.getAttr(el, 'style');

        if (style)
            this.adapter.setAttr(el, 'style', styleProcessor.process(style, urlReplacer));
    }

    _processStylesheetElement (el, urlReplacer) {
        var content = this.adapter.getStyleContent(el);

        if (content && urlReplacer) {
            content = styleProcessor.process(content, urlReplacer, true);

            this.adapter.setStyleContent(el, content);
        }
    }

    _processTargetBlank (el) {
        // NOTE: replace target='_blank' to avoid popups
        var attrValue = this.adapter.getAttr(el, 'target');

        // NOTE: Value may have whitespace
        attrValue = attrValue && attrValue.replace(/\s/g, '');

        if (attrValue === '_blank' || attrValue === 'blank')
            this.adapter.setAttr(el, 'target', '_self');
    }

    _processUrlAttrs (el, urlReplacer, pattern) {
        if (urlReplacer && pattern.urlAttr) {
            var storedUrlAttr     = this.getStoredAttrName(pattern.urlAttr);
            var resourceUrl       = this.adapter.getAttr(el, pattern.urlAttr);
            var processedOnServer = !!this.adapter.getAttr(el, storedUrlAttr);

            // NOTE: page resource URL with proxy URL
            if ((resourceUrl || resourceUrl === '') && !processedOnServer) {
                if (UrlUtil.isSupportedProtocol(resourceUrl) && !EMPTY_URL_REG_EX.test(resourceUrl)) {
                    var elTagName    = this.adapter.getTagName(el).toLowerCase();
                    var isIframe     = elTagName === 'iframe';
                    var isScript     = elTagName === 'script';
                    var resourceType = null;
                    var target       = this.adapter.getAttr(el, 'target');

                    // On the server the elements shouldn't process with target=_parent,
                    // because we don't know who is the parent of the processing page (iframe or top window)
                    if (!this.adapter.needToProcessUrl(elTagName, target))
                        return;

                    if (isIframe || this.isOpenLinkInIFrame(el))
                        resourceType = UrlUtil.IFRAME;
                    else if (isScript)
                        resourceType = UrlUtil.SCRIPT;

                    var parsedResourceUrl = UrlUtil.parseUrl(resourceUrl);
                    var isRelativePath    = !parsedResourceUrl.host;
                    var proxyUrl          = '';

                    // NOTE: Only non relative iframe src can be cross-domain
                    if (isIframe && !isRelativePath) {
                        var location    = urlReplacer('/');
                        var proxyUrlObj = UrlUtil.parseProxyUrl(location);
                        var originUrl   = proxyUrlObj.originUrl;

                        if (!parsedResourceUrl.protocol)
                            resourceUrl = proxyUrlObj.originResourceInfo.protocol + resourceUrl;

                        // Cross-domain iframe
                        if (!UrlUtil.sameOriginCheck(originUrl, resourceUrl)) {
                            var proxyHostname = UrlUtil.parseUrl(location).hostname;

                            proxyUrl = resourceUrl ? this.adapter.getProxyUrl(resourceUrl, proxyHostname,
                                this.adapter.getCrossDomainPort(), proxyUrlObj.jobInfo.uid,
                                proxyUrlObj.jobInfo.ownerToken, UrlUtil.IFRAME) : '';
                        }

                    }
                    proxyUrl = proxyUrl === '' && resourceUrl ? urlReplacer(resourceUrl, resourceType) : proxyUrl;

                    this.adapter.setAttr(el, storedUrlAttr, resourceUrl);

                    if (elTagName === 'img' && proxyUrl !== '')
                        this.adapter.setAttr(el, pattern.urlAttr, UrlUtil.resolveUrlAsOrigin(resourceUrl, urlReplacer));
                    else
                        this.adapter.setAttr(el, pattern.urlAttr, proxyUrl);
                }
            }
        }
    }

    _processUrlJsAttr (el, urlReplacer, pattern) {
        if (JAVASCRIPT_PROTOCOL_REG_EX.test(this.adapter.getAttr(el, pattern.urlAttr)))
            this._processJsAttr(el, pattern.urlAttr, true);
    }
}
