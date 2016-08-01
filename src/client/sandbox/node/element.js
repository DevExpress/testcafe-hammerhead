import SandboxBase from '../base';
import NodeSandbox from '../node/index';
import nativeMethods from '../native-methods';
import domProcessor from '../../dom-processor';
import { processScript } from '../../../processing/script';
import styleProcessor from '../../../processing/style';
import * as urlUtils from '../../utils/url';
import * as domUtils from '../../utils/dom';
import * as hiddenInfo from '../upload/hidden-info';
import * as urlResolver from '../../utils/url-resolver';
import { sameOriginCheck, get as getDestLocation } from '../../utils/destination-location';
import { stopPropagation } from '../../utils/event';
import { isPageHtml, processHtml } from '../../utils/html';
import transport from '../../transport';
import getNativeQuerySelectorAll from '../../utils/get-native-query-selector-all';
import { HASH_RE } from '../../../utils/url';
import * as windowsStorage from '../windows-storage';

const KEYWORD_TARGETS = ['_blank', '_self', '_parent', '_top'];

export default class ElementSandbox extends SandboxBase {
    constructor (nodeSandbox, uploadSandbox, iframeSandbox, shadowUI) {
        super();

        this.nodeSandbox   = nodeSandbox;
        this.shadowUI      = shadowUI;
        this.uploadSandbox = uploadSandbox;
        this.iframeSandbox = iframeSandbox;

        this.overridedMethods = null;

        this.BEFORE_FORM_SUBMIT = 'hammerhead|event|before-form-submit';
    }

    static _isKeywordTarget (value) {
        value = value.toLowerCase();

        return KEYWORD_TARGETS.indexOf(value) !== -1;
    }

    static _onTargetChanged (el, newTarget) {
        var urlAttr        = domUtils.getTagName(el) === 'form' ? 'action' : 'href';
        var url            = el[urlAttr];
        var isIframeTarget = newTarget && !ElementSandbox._isKeywordTarget(newTarget);

        if (url && urlUtils.isSupportedProtocol(url)) {
            var parsedUrl = urlUtils.parseProxyUrl(url);

            if (parsedUrl) {
                var parsedResourceType = urlUtils.parseResourceType(parsedUrl.resourceType);

                if (parsedResourceType.isIframe !== isIframeTarget) {
                    var resourceType = urlUtils.stringifyResourceType({
                        isIframe: isIframeTarget,
                        isForm:   parsedResourceType.isForm,
                        isScript: parsedResourceType.isScript
                    });

                    el[urlAttr] = urlUtils.getProxyUrl(parsedUrl.destUrl, null, null, null, resourceType);
                }
            }
        }
    }

    _overridedGetAttributeCore (el, args, isNs) {
        var attr        = args[isNs ? 1 : 0];
        var ns          = isNs ? args[0] : null;
        var getAttrMeth = isNs ? nativeMethods.getAttributeNS : nativeMethods.getAttribute;

        // OPTIMIZATION: The hasAttribute method is very slow.
        if (domProcessor.isUrlAttr(el, attr, ns) || attr === 'sandbox' || domProcessor.EVENTS.indexOf(attr) !== -1 ||
            attr === 'autocomplete') {
            var storedAttr = domProcessor.getStoredAttrName(attr);

            if (attr === 'autocomplete' && getAttrMeth.apply(el, isNs ? [ns, storedAttr] : [storedAttr]) === 'none')
                return null;
            else if (el.hasAttribute(storedAttr))
                args[isNs ? 1 : 0] = storedAttr;
        }

        return getAttrMeth.apply(el, args);
    }

    _overridedSetAttributeCore (el, args, isNs) {
        var ns          = isNs ? args[0] : null;
        var attr        = args[isNs ? 1 : 0];
        var valueIndex  = isNs ? 2 : 1;
        var value       = args[valueIndex];
        var setAttrMeth = isNs ? nativeMethods.setAttributeNS : nativeMethods.setAttribute;
        var tagName     = domUtils.getTagName(el);
        var urlAttr     = domProcessor.isUrlAttr(el, attr, ns);
        var isEventAttr = domProcessor.EVENTS.indexOf(attr) !== -1;

        value = String(value);

        var isSpecialPage       = urlUtils.isSpecialPage(value);
        var isSupportedProtocol = urlUtils.isSupportedProtocol(value);

        if (urlAttr && !isSupportedProtocol && !isSpecialPage || isEventAttr) {
            var isJsProtocol = domProcessor.JAVASCRIPT_PROTOCOL_REG_EX.test(value);
            var storedJsAttr = domProcessor.getStoredAttrName(attr);

            if (urlAttr && isJsProtocol || isEventAttr) {
                var valueWithoutProtocol = value.replace(domProcessor.JAVASCRIPT_PROTOCOL_REG_EX, '');
                var matches              = valueWithoutProtocol.match(domProcessor.HTML_STRING_REG_EX);
                var processedValue       = '';

                if (matches && isJsProtocol) {
                    var html        = matches[2];
                    var stringQuote = matches[1];

                    if (!isPageHtml(html))
                        html = '<html><body>' + html + '</body></html>';

                    html = html.replace(new RegExp('\\\\' + stringQuote, 'g'), stringQuote);
                    html = processHtml(html);
                    html = html.replace(new RegExp(stringQuote, 'g'), '\\' + stringQuote);

                    /*eslint-disable no-script-url */
                    processedValue = 'javascript:' + stringQuote + html + stringQuote;
                    /*eslint-enable no-script-url */
                }
                else {
                    /*eslint-disable no-script-url */
                    processedValue = (isJsProtocol ? 'javascript:' : '') +
                                     processScript(valueWithoutProtocol, false);
                    /*eslint-enable no-script-url */
                }

                setAttrMeth.apply(el, isNs ? [ns, storedJsAttr, value] : [storedJsAttr, value]);
                args[valueIndex]         = processedValue;
            }
            else
                setAttrMeth.apply(el, isNs ? [ns, storedJsAttr, value] : [storedJsAttr, value]);
        }
        else if (urlAttr && (isSupportedProtocol || isSpecialPage)) {
            var storedUrlAttr = domProcessor.getStoredAttrName(attr);

            setAttrMeth.apply(el, isNs ? [ns, storedUrlAttr, value] : [storedUrlAttr, value]);

            if (tagName !== 'img') {
                if (value !== '' && (!isSpecialPage || tagName === 'a')) {
                    var isIframe         = tagName === 'iframe';
                    var isScript         = tagName === 'script';
                    var isCrossDomainUrl = isSupportedProtocol && !sameOriginCheck(location.toString(), value);
                    var resourceType     = domProcessor.getElementResourceType(el);
                    var elCharset        = isScript && el.charset;

                    if (ElementSandbox._isHrefAttrForBaseElement(el, attr) &&
                        domUtils.isElementInDocument(el, this.document))
                        urlResolver.updateBase(value, this.document);

                    args[valueIndex] = isIframe && isCrossDomainUrl ? urlUtils.getCrossDomainIframeProxyUrl(value) :
                                       urlUtils.getProxyUrl(value, null, null, null, resourceType, elCharset);
                }
            }
            else if (value && !isSpecialPage && !urlUtils.parseProxyUrl(value))
                args[valueIndex] = urlUtils.resolveUrlAsDest(value);
        }
        else if (attr === 'autocomplete') {
            var storedAutocompleteAttr = domProcessor.getStoredAttrName(attr);

            setAttrMeth.apply(el, isNs ? [ns, storedAutocompleteAttr, value] : [storedAutocompleteAttr, value]);

            args[valueIndex] = 'off';
        }
        else if (attr === 'target' && domProcessor.TARGET_ATTR_TAGS[tagName]) {
            if (/_blank/i.test(value))
                return null;

            if (!ElementSandbox._isKeywordTarget(value) && !windowsStorage.findByName(value)) {
                value = '_self';
                args[valueIndex] = value;
            }

            ElementSandbox._onTargetChanged(el, value);
        }
        else if (attr === 'sandbox') {
            var storedSandboxAttr = domProcessor.getStoredAttrName(attr);
            var allowSameOrigin   = value.indexOf('allow-same-origin') !== -1;
            var allowScripts      = value.indexOf('allow-scripts') !== -1;

            setAttrMeth.apply(el, isNs ? [ns, storedSandboxAttr, value] : [storedSandboxAttr, value]);

            if (!allowSameOrigin || !allowScripts) {
                args[valueIndex] += !allowSameOrigin ? ' allow-same-origin' : '';
                args[valueIndex] += !allowScripts ? ' allow-scripts' : '';
            }
        }
        // TODO: remove after https://github.com/DevExpress/testcafe-hammerhead/issues/244 implementation
        else if (tagName === 'meta' && ['http-equiv', 'content'].indexOf(attr) !== -1)
            return null;
        else if (attr === 'xlink:href' &&
                 domProcessor.SVG_XLINK_HREF_TAGS.indexOf(tagName) !== -1 &&
                 domUtils.isSVGElement(el)) {
            var storedXLinkHrefAttr = domProcessor.getStoredAttrName(attr);

            setAttrMeth.apply(el, isNs ? [ns, storedXLinkHrefAttr, value] : [storedXLinkHrefAttr, value]);

            if (!HASH_RE.test(value))
                args[valueIndex] = urlUtils.getProxyUrl(value);
        }

        return setAttrMeth.apply(el, args);
    }

    _overridedRemoveAttributeCore (el, args, isNs) {
        var attr           = args[isNs ? 1 : 0];
        var removeAttrFunc = isNs ? nativeMethods.removeAttributeNS : nativeMethods.removeAttribute;

        if (domProcessor.isUrlAttr(el, attr, isNs ? args[0] : null) || attr === 'sandbox' || attr === 'autocomplete' ||
            domProcessor.EVENTS.indexOf(attr) !== -1) {
            var storedAttr = domProcessor.getStoredAttrName(attr);

            if (attr === 'autocomplete')
                nativeMethods.setAttribute.call(el, storedAttr, 'none');
            else
                removeAttrFunc.apply(el, isNs ? [args[0], storedAttr] : [storedAttr]);
        }

        if (attr === 'target')
            ElementSandbox._onTargetChanged(el, null);

        if (ElementSandbox._isHrefAttrForBaseElement(el, attr))
            urlResolver.updateBase(getDestLocation(), this.document);

        if (attr !== 'autocomplete')
            return removeAttrFunc.apply(el, args);

        return void 0;
    }

    _prepareNodeForInsertion (node, parentNode) {
        if (domUtils.isTextNode(node))
            ElementSandbox._processTextNodeContent(node, parentNode);

        this.nodeSandbox.processNodes(node);
    }

    _createOverridedMethods () {
        // NOTE: We need the closure because a context of overridden methods is an html element
        var sandbox = this;

        this.overridedMethods = {
            insertRow () {
                var nativeMeth = domUtils.isTableElement(this) ? nativeMethods.insertTableRow : nativeMethods.insertTBodyRow;
                var row        = nativeMeth.apply(this, arguments);

                sandbox.nodeSandbox.processNodes(row);

                return row;
            },

            insertCell () {
                var cell = nativeMethods.insertCell.apply(this, arguments);

                sandbox.nodeSandbox.processNodes(cell);

                return cell;
            },

            insertAdjacentHTML () {
                var html = arguments[1];

                if (arguments.length > 1 && html !== null)
                    arguments[1] = processHtml('' + html, this.parentNode && this.parentNode.tagName);

                nativeMethods.insertAdjacentHTML.apply(this, arguments);
                sandbox.nodeSandbox.processNodes(this.parentNode || this);
            },

            formSubmit () {
                // TODO: Don't wait cookie, put them in a form hidden input and parse on the server (GH-199)
                transport.waitCookieMsg().then(() => {
                    sandbox.emit(sandbox.BEFORE_FORM_SUBMIT, { form: this });

                    return nativeMethods.formSubmit.apply(this, arguments);
                });
            },

            insertBefore () {
                var newNode = arguments[0];
                var refNode = arguments[1];

                sandbox._prepareNodeForInsertion(newNode, this);

                var result = null;

                // NOTE: Before the page's <body> is processed and added to DOM,
                // some javascript frameworks create their own body element, perform
                // certain manipulations and then remove it.
                // Therefore, we need to check if the body element is present in DOM
                if (domUtils.isBodyElementWithChildren(this) && !refNode && domUtils.isElementInDocument(this))
                    result = sandbox.shadowUI.insertBeforeRoot(newNode);
                else
                    result = nativeMethods.insertBefore.apply(this, arguments);

                sandbox._onElementAdded(newNode);

                return result;
            },

            appendChild () {
                var child = arguments[0];

                sandbox._prepareNodeForInsertion(child, this);

                var result = null;

                // NOTE: Before the page's <body> is processed and added to DOM,
                // some javascript frameworks create their own body element, perform
                // certain manipulations and then remove it.
                // Therefore, we need to check if the body element is present in DOM
                if (domUtils.isBodyElementWithChildren(this) && domUtils.isElementInDocument(this))
                    result = sandbox.shadowUI.insertBeforeRoot(child);
                else
                    result = nativeMethods.appendChild.apply(this, arguments);

                sandbox._onElementAdded(child);

                return result;
            },

            removeChild () {
                var child = arguments[0];

                sandbox._onRemoveFileInputInfo(child);
                sandbox._onRemoveIframe(child);

                var result = nativeMethods.removeChild.apply(this, arguments);

                sandbox.onElementRemoved(child);

                return result;
            },

            replaceChild () {
                var newChild = arguments[0];
                var oldChild = arguments[1];

                if (domUtils.isTextNode(newChild))
                    ElementSandbox._processTextNodeContent(newChild, this);

                sandbox._onRemoveFileInputInfo(oldChild);

                var result = nativeMethods.replaceChild.apply(this, arguments);

                sandbox._onAddFileInputInfo(newChild);

                return result;
            },

            cloneNode () {
                var clone = nativeMethods.cloneNode.apply(this, arguments);

                sandbox.nodeSandbox.processNodes(clone);

                return clone;
            },

            getAttribute () {
                return sandbox._overridedGetAttributeCore(this, arguments);
            },

            getAttributeNS () {
                return sandbox._overridedGetAttributeCore(this, arguments, true);
            },

            setAttribute () {
                return sandbox._overridedSetAttributeCore(this, arguments);
            },

            setAttributeNS () {
                return sandbox._overridedSetAttributeCore(this, arguments, true);
            },

            removeAttribute () {
                return sandbox._overridedRemoveAttributeCore(this, arguments);
            },

            removeAttributeNS () {
                return sandbox._overridedRemoveAttributeCore(this, arguments, true);
            },

            querySelector () {
                if (typeof arguments[0] === 'string')
                    arguments[0] = NodeSandbox.processSelector(arguments[0]);

                var nativeQuerySelector = domUtils.isDocumentFragmentNode(this) ? nativeMethods.documentFragmentQuerySelector
                    : nativeMethods.elementQuerySelector;

                return nativeQuerySelector.apply(this, arguments);
            },

            querySelectorAll () {
                if (typeof arguments[0] === 'string')
                    arguments[0] = NodeSandbox.processSelector(arguments[0]);

                return getNativeQuerySelectorAll(this).apply(this, arguments);
            }
        };
    }

    static _processTextNodeContent (node, parentNode) {
        if (!parentNode.tagName)
            return;

        if (domUtils.isScriptElement(parentNode))
            node.data = processScript(node.data, true);
        else if (domUtils.isStyleElement(parentNode))
            node.data = styleProcessor.process(node.data, urlUtils.getProxyUrl);
    }

    static _isHrefAttrForBaseElement (el, attr) {
        return domUtils.isBaseElement(el) && attr === 'href';
    }

    static _removeFileInputInfo (el) {
        hiddenInfo.removeInputInfo(el);
    }

    _onAddFileInputInfo (el) {
        if (!domUtils.isDomElement(el))
            return;

        var fileInputs = domUtils.getFileInputs(el);

        for (var i = 0; i < fileInputs.length; i++)
            this.addFileInputInfo(fileInputs[i]);
    }

    _onRemoveFileInputInfo (el) {
        if (!domUtils.isDomElement(el))
            return;

        if (domUtils.isFileInput(el))
            ElementSandbox._removeFileInputInfo(el);

        else
            domUtils.find(el, 'input[type=file]', ElementSandbox._removeFileInputInfo);
    }

    _onRemoveIframe (el) {
        if (domUtils.isDomElement(el) && domUtils.isIframeElement(el))
            windowsStorage.remove(el.contentWindow);
    }

    _onElementAdded (el) {
        if ((domUtils.isElementNode(el) || domUtils.isDocumentNode(el)) && domUtils.isElementInDocument(el)) {
            var iframes = domUtils.getIframes(el);

            for (var i = 0; i < iframes.length; i++) {
                this.onIframeAddedToDOM(iframes[i]);
                windowsStorage.add(iframes[i].contentWindow);
            }

        }

        if (domUtils.isBodyElement(el))
            this.shadowUI.onBodyElementMutation();

        this._onAddFileInputInfo(el);

        if (domUtils.isBaseElement(el)) {
            var storedHrefAttrName  = domProcessor.getStoredAttrName('href');
            var storedHrefAttrValue = el.getAttribute(storedHrefAttrName);

            urlResolver.updateBase(storedHrefAttrValue, this.document);
        }
    }

    onElementRemoved (el) {
        if (domUtils.isBodyElement(el))
            this.shadowUI.onBodyElementMutation();

        else if (domUtils.isBaseElement(el))
            urlResolver.updateBase(getDestLocation(), this.document);
    }

    addFileInputInfo (el) {
        var infoManager = this.uploadSandbox.infoManager;

        hiddenInfo.addInputInfo(el, infoManager.getFiles(el), infoManager.getValue(el));
    }

    onIframeAddedToDOM (iframe) {
        if (!domUtils.isCrossDomainIframe(iframe, true))
            this.nodeSandbox.mutation.onIframeAddedToDOM({ iframe });
    }

    attach (window) {
        super.attach(window);

        this._createOverridedMethods();

        window.Element.prototype.insertBefore              = this.overridedMethods.insertBefore;
        window.Element.prototype.appendChild               = this.overridedMethods.appendChild;
        window.Element.prototype.replaceChild              = this.overridedMethods.replaceChild;
        window.Element.prototype.removeChild               = this.overridedMethods.removeChild;
        window.Element.prototype.setAttribute              = this.overridedMethods.setAttribute;
        window.Element.prototype.setAttributeNS            = this.overridedMethods.setAttributeNS;
        window.Element.prototype.getAttribute              = this.overridedMethods.getAttribute;
        window.Element.prototype.getAttributeNS            = this.overridedMethods.getAttributeNS;
        window.Element.prototype.removeAttribute           = this.overridedMethods.removeAttribute;
        window.Element.prototype.removeAttributeNS         = this.overridedMethods.removeAttributeNS;
        window.Element.prototype.cloneNode                 = this.overridedMethods.cloneNode;
        window.Element.prototype.querySelector             = this.overridedMethods.querySelector;
        window.Element.prototype.querySelectorAll          = this.overridedMethods.querySelectorAll;
        window.Element.prototype.insertAdjacentHTML        = this.overridedMethods.insertAdjacentHTML;
        window.Node.prototype.cloneNode                    = this.overridedMethods.cloneNode;
        window.Node.prototype.appendChild                  = this.overridedMethods.appendChild;
        window.Node.prototype.removeChild                  = this.overridedMethods.removeChild;
        window.Node.prototype.insertBefore                 = this.overridedMethods.insertBefore;
        window.Node.prototype.replaceChild                 = this.overridedMethods.replaceChild;
        window.DocumentFragment.prototype.querySelector    = this.overridedMethods.querySelector;
        window.DocumentFragment.prototype.querySelectorAll = this.overridedMethods.querySelectorAll;
        window.HTMLTableElement.prototype.insertRow        = this.overridedMethods.insertRow;
        window.HTMLTableSectionElement.prototype.insertRow = this.overridedMethods.insertRow;
        window.HTMLTableRowElement.prototype.insertCell    = this.overridedMethods.insertCell;
        window.HTMLFormElement.prototype.submit            = this.overridedMethods.formSubmit;
    }

    _setProxiedSrcUrlOnError (img) {
        img.addEventListener('error', e => {
            var storedAttr = nativeMethods.getAttribute.call(img, domProcessor.getStoredAttrName('src'));

            if (storedAttr && !urlUtils.parseProxyUrl(img.src) &&
                urlUtils.isSupportedProtocol(img.src) && !urlUtils.isSpecialPage(img.src)) {
                nativeMethods.setAttribute.call(img, 'src', urlUtils.getProxyUrl(storedAttr));
                stopPropagation(e);
            }
        }, false);
    }

    processElement (el) {
        if (domUtils.isImgElement(el))
            this._setProxiedSrcUrlOnError(el);
        else if (domUtils.isIframeElement(el))
            this.iframeSandbox.processIframe(el);
        else if (domUtils.isBaseElement(el))
            urlResolver.updateBase(nativeMethods.getAttribute.call(el, domProcessor.getStoredAttrName('href')), this.document);
    }
}
