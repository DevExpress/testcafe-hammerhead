import SandboxBase from '../base';
import NodeSandbox from '../node/index';
import DomProcessor from '../../../processing/dom/index';
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
import AttributesWrapper from '../code-instrumentation/properties/attributes-wrapper';

const KEYWORD_TARGETS = ['_blank', '_self', '_parent', '_top'];

const HAS_LOAD_HANDLER_FLAG = 'hammerhead|element|has-load-handler-flag';

export default class ElementSandbox extends SandboxBase {
    constructor (nodeSandbox, uploadSandbox, iframeSandbox, shadowUI, eventSandbox) {
        super();

        this.nodeSandbox   = nodeSandbox;
        this.shadowUI      = shadowUI;
        this.uploadSandbox = uploadSandbox;
        this.iframeSandbox = iframeSandbox;
        this.eventSandbox  = eventSandbox;

        this.overridedMethods = null;

        this.BEFORE_FORM_SUBMIT = 'hammerhead|event|before-form-submit';
    }

    static _isKeywordTarget (value) {
        value = value.toLowerCase();

        return KEYWORD_TARGETS.indexOf(value) !== -1;
    }

    static _onTargetChanged (el) {
        var tagName = domUtils.getTagName(el);

        if (!DomProcessor.isIframeFlagTag(tagName))
            return;

        var urlAttr       = tagName === 'form' ? 'action' : 'href';
        var storedUrlAttr = domProcessor.getStoredAttrName(urlAttr);

        if (el.hasAttribute(storedUrlAttr)) {
            var url = el.getAttribute(storedUrlAttr);

            if (urlUtils.isSupportedProtocol(url))
                el.setAttribute(urlAttr, url);
        }
    }

    static setHasLoadHandlerFlag (el) {
        el[HAS_LOAD_HANDLER_FLAG] = true;
    }

    static removeHasLoadHandlerFlag (el) {
        delete el[HAS_LOAD_HANDLER_FLAG];
    }

    static _setProxiedSrc (img) {
        if (!img[HAS_LOAD_HANDLER_FLAG]) {
            ElementSandbox.setHasLoadHandlerFlag(img);

            if (img.src)
                img.setAttribute('src', img.src);
        }
    }

    _getAttributeCore (el, args, isNs) {
        var attr        = String(args[isNs ? 1 : 0]);
        var loweredAttr = attr.toLowerCase();
        var ns          = isNs ? args[0] : null;
        var getAttrMeth = isNs ? nativeMethods.getAttributeNS : nativeMethods.getAttribute;

        // OPTIMIZATION: The hasAttribute method is very slow.
        if (domProcessor.isUrlAttr(el, loweredAttr, ns) || loweredAttr === 'sandbox' ||
            domProcessor.EVENTS.indexOf(loweredAttr) !== -1 ||
            loweredAttr === 'autocomplete' || loweredAttr === 'target') {
            var storedAttrName  = domProcessor.getStoredAttrName(attr);
            var storedAttrValue = getAttrMeth.apply(el, isNs ? [ns, storedAttrName] : [storedAttrName]);

            if (DomProcessor.isAddedAutocompleteAttr(loweredAttr, storedAttrValue))
                return null;
            else if (el.hasAttribute(storedAttrName))
                args[isNs ? 1 : 0] = storedAttrName;
        }

        return getAttrMeth.apply(el, args);
    }

    _setAttributeCore (el, args, isNs) {
        var ns          = isNs ? args[0] : null;
        var attr        = String(args[isNs ? 1 : 0]);
        var loweredAttr = attr.toLowerCase();
        var valueIndex  = isNs ? 2 : 1;
        var value       = args[valueIndex];
        var setAttrMeth = isNs ? nativeMethods.setAttributeNS : nativeMethods.setAttribute;
        var tagName     = domUtils.getTagName(el);
        var urlAttr     = domProcessor.isUrlAttr(el, attr, ns);
        var isEventAttr = domProcessor.EVENTS.indexOf(attr) !== -1;

        var needToCallTargetChanged = false;

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

            if (tagName !== 'img' || el[HAS_LOAD_HANDLER_FLAG]) {
                if (value !== '' && (!isSpecialPage || tagName === 'a')) {
                    var isIframe         = tagName === 'iframe';
                    var isScript         = tagName === 'script';
                    var isCrossDomainUrl = isSupportedProtocol && !sameOriginCheck(location.toString(), value);
                    var resourceType     = domProcessor.getElementResourceType(el);
                    var elCharset        = isScript && el.charset;

                    if (loweredAttr === 'formaction') {
                        resourceType = 'f';

                        if (el.form) {
                            var parsedFormAction = urlUtils.parseProxyUrl(el.form.action);

                            if (parsedFormAction)
                                resourceType = parsedFormAction.resourceType;
                        }
                    }

                    if (ElementSandbox._isHrefAttrForBaseElement(el, attr) &&
                        domUtils.isElementInDocument(el, this.document))
                        urlResolver.updateBase(value, this.document);

                    args[valueIndex] = isIframe && isCrossDomainUrl ? urlUtils.getCrossDomainIframeProxyUrl(value) :
                                       urlUtils.getProxyUrl(value, { resourceType, charset: elCharset });
                }
            }
            else if (value && !isSpecialPage && !urlUtils.parseProxyUrl(value))
                args[valueIndex] = urlUtils.resolveUrlAsDest(value);
        }
        else if (loweredAttr === 'autocomplete') {
            var storedAutocompleteAttr = domProcessor.getStoredAttrName(attr);

            setAttrMeth.apply(el, isNs ? [ns, storedAutocompleteAttr, value] : [storedAutocompleteAttr, value]);

            args[valueIndex] = 'off';
        }
        else if (loweredAttr === 'target' && DomProcessor.isTagWithTargetAttr(tagName)) {
            var newTarget = this.getTarget(el, value);

            if (newTarget !== el.target) {
                var storedTargetAttr    = domProcessor.getStoredAttrName(attr);

                setAttrMeth.apply(el, isNs ? [ns, storedTargetAttr, value] : [storedTargetAttr, value]);
                args[valueIndex]        = newTarget;
                needToCallTargetChanged = true;
            }
            else
                return null;
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
        else if (loweredAttr === 'xlink:href' &&
                 domProcessor.SVG_XLINK_HREF_TAGS.indexOf(tagName) !== -1 &&
                 domUtils.isSVGElement(el)) {
            var storedXLinkHrefAttr = domProcessor.getStoredAttrName(attr);

            setAttrMeth.apply(el, isNs ? [ns, storedXLinkHrefAttr, value] : [storedXLinkHrefAttr, value]);

            if (!HASH_RE.test(value))
                args[valueIndex] = urlUtils.getProxyUrl(value);
        }

        var result = setAttrMeth.apply(el, args);

        if (needToCallTargetChanged)
            ElementSandbox._onTargetChanged(el);

        return result;
    }

    _hasAttributeCore (el, args, isNs) {
        var attributeNameArgIndex       = isNs ? 1 : 0;
        var hasAttrMeth                 = isNs ? nativeMethods.hasAttributeNS : nativeMethods.hasAttribute;
        var storedAutocompleteAttrName  = domProcessor.getStoredAttrName('autocomplete');
        var storedAutocompleteAttrValue = nativeMethods.getAttribute.call(el, storedAutocompleteAttrName);

        if (typeof args[attributeNameArgIndex] === 'string' &&
            DomProcessor.isAddedAutocompleteAttr(args[attributeNameArgIndex], storedAutocompleteAttrValue))
            return false;

        return hasAttrMeth.apply(el, args);
    }

    _removeAttributeCore (el, args, isNs) {
        var attr           = String(args[isNs ? 1 : 0]);
        var formatedAttr   = attr.toLowerCase();
        var removeAttrFunc = isNs ? nativeMethods.removeAttributeNS : nativeMethods.removeAttribute;
        var tagName        = domUtils.getTagName(el);
        var result         = void 0;

        if (domProcessor.isUrlAttr(el, formatedAttr, isNs ? args[0] : null) || formatedAttr === 'sandbox' ||
            formatedAttr === 'autocomplete' ||
            domProcessor.EVENTS.indexOf(formatedAttr) !== -1 ||
            formatedAttr === 'target' && DomProcessor.isTagWithTargetAttr(tagName)) {
            var storedAttr = domProcessor.getStoredAttrName(attr);

            if (formatedAttr === 'autocomplete')
                nativeMethods.setAttribute.call(el, storedAttr, domProcessor.AUTOCOMPLETE_ATTRIBUTE_ABSENCE_MARKER);
            else
                removeAttrFunc.apply(el, isNs ? [args[0], storedAttr] : [storedAttr]);
        }

        if (ElementSandbox._isHrefAttrForBaseElement(el, formatedAttr))
            urlResolver.updateBase(getDestLocation(), this.document);

        if (formatedAttr !== 'autocomplete')
            result = removeAttrFunc.apply(el, args);

        if (formatedAttr === 'target' && DomProcessor.isTagWithTargetAttr(tagName))
            ElementSandbox._onTargetChanged(el);

        return result;
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
                transport.waitCookieMsg(() => {
                    sandbox._ensureTargetContainsExistingBrowsingContext(this);
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
                return sandbox._getAttributeCore(this, arguments);
            },

            getAttributeNS () {
                return sandbox._getAttributeCore(this, arguments, true);
            },

            setAttribute () {
                var result = sandbox._setAttributeCore(this, arguments);

                ElementSandbox._refreshAttributesWrappers(this);

                return result;
            },

            setAttributeNS () {
                var result = sandbox._setAttributeCore(this, arguments, true);

                ElementSandbox._refreshAttributesWrappers(this);

                return result;
            },

            removeAttribute () {
                var result = sandbox._removeAttributeCore(this, arguments);

                ElementSandbox._refreshAttributesWrappers(this);

                return result;
            },

            removeAttributeNS () {
                var result = sandbox._removeAttributeCore(this, arguments, true);

                ElementSandbox._refreshAttributesWrappers(this);

                return result;
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
            },

            hasAttribute () {
                return sandbox._hasAttributeCore(this, arguments, false);
            },

            hasAttributeNS () {
                return sandbox._hasAttributeCore(this, arguments, true);
            },

            hasAttributes () {
                if (this.attributes.length === 2 &&
                    this.attributes.getNamedItem('autocomplete') &&
                    this.attributes.getNamedItem(domProcessor.getStoredAttrName('autocomplete')))
                    return sandbox._hasAttributeCore(this, ['autocomplete'], false);

                return nativeMethods.hasAttributes.apply(this, arguments);
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

    static _refreshAttributesWrappers (el) {
        AttributesWrapper.refreshWrappers(el);
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

        // NOTE: recalculate `formaction` attribute value if it placed in the dom
        if (el.formAction && (domUtils.isInputElement(el) || domUtils.isButtonElement(el)) && el.form)
            el.setAttribute('formaction', el.getAttribute('formaction'));

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
        window.Element.prototype.hasAttribute              = this.overridedMethods.hasAttribute;
        window.Element.prototype.hasAttributeNS            = this.overridedMethods.hasAttributeNS;
        window.Element.prototype.hasAttributes             = this.overridedMethods.hasAttributes;
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

        if (window.Element.prototype.insertAdjacentHTML)
            window.Element.prototype.insertAdjacentHTML = this.overridedMethods.insertAdjacentHTML;
        else if (window.HTMLElement.prototype.insertAdjacentHTML)
            window.HTMLElement.prototype.insertAdjacentHTML = this.overridedMethods.insertAdjacentHTML;


        this._setValidBrowsingContextOnElementClick(window);

        // NOTE: Cookie can be set up for the page by using the request initiated by img.
        // For example: img.src = '<url that responds with the Set-Cookie header>'
        // If img has the 'load' event handler, we redirect the request through proxy.
        // For details, see https://github.com/DevExpress/testcafe-hammerhead/issues/651
        this.eventSandbox.listeners.on(this.eventSandbox.listeners.EVENT_LISTENER_ATTACHED_EVENT, e => {
            if (e.eventType === 'load' && domUtils.isImgElement(e.el))
                ElementSandbox._setProxiedSrc(e.el);
        });
        this.eventSandbox.on(this.eventSandbox.EVENT_ATTACHED_EVENT, e => {
            if (e.eventType === 'load' && domUtils.isImgElement(e.el))
                ElementSandbox._setProxiedSrc(e.el);
        });
        this.eventSandbox.listeners.on(this.eventSandbox.listeners.EVENT_LISTENER_DETACHED_EVENT, e => {
            if (e.eventType === 'load' && domUtils.isImgElement(e.el))
                ElementSandbox.removeHasLoadHandlerFlag(e.el);
        });
        this.eventSandbox.on(this.eventSandbox.EVENT_DETACHED_EVENT, e => {
            if (e.eventType === 'load' && domUtils.isImgElement(e.el))
                ElementSandbox.removeHasLoadHandlerFlag(e.el);
        });
    }

    _ensureTargetContainsExistingBrowsingContext (el) {
        var storedAttr = nativeMethods.getAttribute.call(el, domProcessor.getStoredAttrName('target'));

        el.setAttribute('target', storedAttr || el.target);
    }

    _setValidBrowsingContextOnElementClick (window) {
        this.eventSandbox.listeners.initElementListening(window, ['click']);
        this.eventSandbox.listeners.addInternalEventListener(window, ['click'], e => {
            var el = e.target;

            if (domUtils.isInputElement(el) && el.form)
                el = el.form;

            var tagName = domUtils.getTagName(el);

            if (!DomProcessor.isTagWithTargetAttr(tagName))
                return;

            this._ensureTargetContainsExistingBrowsingContext(el);
        });
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

    getTarget (el, newTarget) {
        var target = newTarget || '';

        if (target && !ElementSandbox._isKeywordTarget(target) && !windowsStorage.findByName(target) ||
            /_blank/i.test(target))
            return '_top';

        return target;
    }

    processElement (el) {
        var tagName = domUtils.getTagName(el);

        switch (tagName) {
            case 'img':
                this._setProxiedSrcUrlOnError(el);
                break;
            case 'iframe':
                this.iframeSandbox.processIframe(el);
                break;
            case 'base':
                urlResolver.updateBase(nativeMethods.getAttribute.call(el, domProcessor.getStoredAttrName('href')), this.document);
                break;
        }

        // NOTE: we need to reprocess a tag client-side if it wasn't processed on the server.
        // See the usage of Parse5DomAdapter.needToProcessUrl
        if (DomProcessor.isIframeFlagTag(tagName) && el.target === '_parent')
            domProcessor.processElement(el, urlUtils.convertToProxyUrl);
    }
}
