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
import { getNativeQuerySelector, getNativeQuerySelectorAll } from '../../utils/query-selector';
import { HASH_RE } from '../../../utils/url';
import * as windowsStorage from '../windows-storage';
import AttributesWrapper from '../code-instrumentation/properties/attributes-wrapper';
import ShadowUI from '../shadow-ui';
import DOMMutationTracker from './live-node-list/dom-mutation-tracker';

const KEYWORD_TARGETS                   = ['_blank', '_self', '_parent', '_top'];
const ATTRS_WITH_SPECIAL_PROXYING_LOGIC = ['sandbox', 'autocomplete', 'target', 'style'];

const HAS_LOAD_HANDLER_FLAG = 'hammerhead|element|has-load-handler-flag';

// NOTE: We should avoid using native object prototype methods,
// since they can be overriden by the client code. (GH-245)
const arraySlice = Array.prototype.slice;

export default class ElementSandbox extends SandboxBase {
    constructor (nodeSandbox, uploadSandbox, iframeSandbox, shadowUI, eventSandbox) {
        super();

        this.nodeSandbox   = nodeSandbox;
        this.shadowUI      = shadowUI;
        this.uploadSandbox = uploadSandbox;
        this.iframeSandbox = iframeSandbox;
        this.eventSandbox  = eventSandbox;

        this.overridedMethods = null;

        this.BEFORE_FORM_SUBMIT_EVENT   = 'hammerhead|event|before-form-submit';
        this.SCRIPT_ELEMENT_ADDED_EVENT = 'hammerhead|event|script-added';
    }

    static _isKeywordTarget (value) {
        value = value.toLowerCase();

        return KEYWORD_TARGETS.indexOf(value) !== -1;
    }

    static _onTargetChanged (el) {
        const tagName = domUtils.getTagName(el);

        if (!DomProcessor.isIframeFlagTag(tagName))
            return;

        const urlAttr       = tagName === 'form' ? 'action' : 'href';
        const storedUrlAttr = domProcessor.getStoredAttrName(urlAttr);

        if (el.hasAttribute(storedUrlAttr)) {
            const url = el.getAttribute(storedUrlAttr);

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
        const attr        = String(args[isNs ? 1 : 0]);
        const loweredAttr = attr.toLowerCase();
        const ns          = isNs ? args[0] : null;
        const getAttrMeth = isNs ? nativeMethods.getAttributeNS : nativeMethods.getAttribute;

        // OPTIMIZATION: The hasAttribute method is very slow.
        if (domProcessor.isUrlAttr(el, loweredAttr, ns) ||
            domProcessor.EVENTS.indexOf(loweredAttr) !== -1 ||
            ATTRS_WITH_SPECIAL_PROXYING_LOGIC.indexOf(loweredAttr) !== -1) {
            const storedAttrName  = domProcessor.getStoredAttrName(attr);
            const storedAttrValue = getAttrMeth.apply(el, isNs ? [ns, storedAttrName] : [storedAttrName]);

            if (DomProcessor.isAddedAutocompleteAttr(loweredAttr, storedAttrValue))
                return null;
            else if (el.hasAttribute(storedAttrName))
                args[isNs ? 1 : 0] = storedAttrName;
        }

        return getAttrMeth.apply(el, args);
    }

    _setAttributeCore (el, args, isNs) {
        const ns          = isNs ? args[0] : null;
        const attr        = String(args[isNs ? 1 : 0]);
        const loweredAttr = attr.toLowerCase();
        const valueIndex  = isNs ? 2 : 1;
        let value         = args[valueIndex];
        const setAttrMeth = isNs ? nativeMethods.setAttributeNS : nativeMethods.setAttribute;
        const tagName     = domUtils.getTagName(el);
        const urlAttr     = domProcessor.isUrlAttr(el, attr, ns);
        const isEventAttr = domProcessor.EVENTS.indexOf(attr) !== -1;

        let needToCallTargetChanged = false;

        value = String(value);

        const isSpecialPage       = urlUtils.isSpecialPage(value);
        const isSupportedProtocol = urlUtils.isSupportedProtocol(value);

        if (urlAttr && !isSupportedProtocol && !isSpecialPage || isEventAttr) {
            const isJsProtocol = domProcessor.JAVASCRIPT_PROTOCOL_REG_EX.test(value);
            const storedJsAttr = domProcessor.getStoredAttrName(attr);

            if (urlAttr && isJsProtocol || isEventAttr) {
                const valueWithoutProtocol = value.replace(domProcessor.JAVASCRIPT_PROTOCOL_REG_EX, '');
                const matches              = valueWithoutProtocol.match(domProcessor.HTML_STRING_REG_EX);
                let processedValue         = '';

                if (matches && isJsProtocol) {
                    let html          = matches[2];
                    const stringQuote = matches[1];

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
                args[valueIndex] = processedValue;
            }
            else
                setAttrMeth.apply(el, isNs ? [ns, storedJsAttr, value] : [storedJsAttr, value]);
        }
        else if (urlAttr && (isSupportedProtocol || isSpecialPage)) {
            const storedUrlAttr = domProcessor.getStoredAttrName(attr);

            setAttrMeth.apply(el, isNs ? [ns, storedUrlAttr, value] : [storedUrlAttr, value]);

            if (tagName !== 'img' || el[HAS_LOAD_HANDLER_FLAG]) {
                if (value !== '' && (!isSpecialPage || tagName === 'a')) {
                    const isIframe         = tagName === 'iframe' || tagName === 'frame';
                    const isScript         = tagName === 'script';
                    const isCrossDomainUrl = isSupportedProtocol && !sameOriginCheck(location.toString(), value);
                    let resourceType       = domProcessor.getElementResourceType(el);
                    const elCharset        = isScript && el.charset;

                    if (loweredAttr === 'formaction') {
                        resourceType = 'f';

                        if (el.form) {
                            const parsedFormAction = urlUtils.parseProxyUrl(el.form.action);

                            if (parsedFormAction)
                                resourceType = parsedFormAction.resourceType;
                        }
                    }

                    if (ElementSandbox._isHrefAttrForBaseElement(el, attr) &&
                        domUtils.isElementInDocument(el, this.document))
                        urlResolver.updateBase(value, this.document);

                    args[valueIndex] = isIframe && isCrossDomainUrl
                        ? urlUtils.getCrossDomainIframeProxyUrl(value)
                        : urlUtils.getProxyUrl(value, { resourceType, charset: elCharset });
                }
            }
            else if (value && !isSpecialPage && !urlUtils.parseProxyUrl(value)) {
                args[valueIndex] = el[this.nodeSandbox.win.FORCE_PROXY_SRC_FOR_IMAGE]
                    ? urlUtils.getProxyUrl(value)
                    : urlUtils.resolveUrlAsDest(value);
            }
        }
        else if (loweredAttr === 'autocomplete') {
            const storedAutocompleteAttr = domProcessor.getStoredAttrName(attr);

            setAttrMeth.apply(el, isNs ? [ns, storedAutocompleteAttr, value] : [storedAutocompleteAttr, value]);

            args[valueIndex] = 'off';
        }
        else if (loweredAttr === 'target' && DomProcessor.isTagWithTargetAttr(tagName)) {
            const newTarget = this.getTarget(el, value);

            if (newTarget !== el.target) {
                const storedTargetAttr = domProcessor.getStoredAttrName(attr);

                setAttrMeth.apply(el, isNs ? [ns, storedTargetAttr, value] : [storedTargetAttr, value]);
                args[valueIndex]        = newTarget;
                needToCallTargetChanged = true;
            }
            else
                return null;
        }
        else if (attr === 'sandbox') {
            const storedSandboxAttr = domProcessor.getStoredAttrName(attr);
            const allowSameOrigin   = value.indexOf('allow-same-origin') !== -1;
            const allowScripts      = value.indexOf('allow-scripts') !== -1;

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
            const storedXLinkHrefAttr = domProcessor.getStoredAttrName(attr);

            setAttrMeth.apply(el, isNs ? [ns, storedXLinkHrefAttr, value] : [storedXLinkHrefAttr, value]);

            if (!HASH_RE.test(value))
                args[valueIndex] = urlUtils.getProxyUrl(value);
        }
        else if (loweredAttr === 'style') {
            const storedStyleAttr = domProcessor.getStoredAttrName(attr);

            setAttrMeth.apply(el, isNs ? [ns, storedStyleAttr, value] : [storedStyleAttr, value]);
            args[valueIndex] = styleProcessor.process(value, urlUtils.getProxyUrl);
        }

        const result = setAttrMeth.apply(el, args);

        if (needToCallTargetChanged)
            ElementSandbox._onTargetChanged(el);

        return result;
    }

    _hasAttributeCore (el, args, isNs) {
        const attributeNameArgIndex       = isNs ? 1 : 0;
        const hasAttrMeth                 = isNs ? nativeMethods.hasAttributeNS : nativeMethods.hasAttribute;
        const storedAutocompleteAttrName  = domProcessor.getStoredAttrName('autocomplete');
        const storedAutocompleteAttrValue = nativeMethods.getAttribute.call(el, storedAutocompleteAttrName);

        if (typeof args[attributeNameArgIndex] === 'string' &&
            DomProcessor.isAddedAutocompleteAttr(args[attributeNameArgIndex], storedAutocompleteAttrValue))
            return false;

        return hasAttrMeth.apply(el, args);
    }

    _removeAttributeCore (el, args, isNs) {
        const attr           = String(args[isNs ? 1 : 0]);
        const formatedAttr   = attr.toLowerCase();
        const removeAttrFunc = isNs ? nativeMethods.removeAttributeNS : nativeMethods.removeAttribute;
        const tagName        = domUtils.getTagName(el);
        let result           = void 0;

        if (domProcessor.isUrlAttr(el, formatedAttr, isNs ? args[0] : null) || formatedAttr === 'sandbox' ||
            formatedAttr === 'autocomplete' ||
            domProcessor.EVENTS.indexOf(formatedAttr) !== -1 ||
            formatedAttr === 'target' && DomProcessor.isTagWithTargetAttr(tagName)) {
            const storedAttr = domProcessor.getStoredAttrName(attr);

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

    _addNodeCore ({ parentNode, args, nativeFn, checkBody }) {
        const newNode = args[0];

        this._prepareNodeForInsertion(newNode, parentNode);

        let result     = null;
        let childNodes = null;

        if (domUtils.isDocumentFragmentNode(newNode))
            childNodes = arraySlice.call(newNode.childNodes);

        // NOTE: Before the page's <body> is processed and added to DOM,
        // some javascript frameworks create their own body element, perform
        // certain manipulations and then remove it.
        // Therefore, we need to check if the body element is present in DOM
        if (checkBody && domUtils.isBodyElementWithChildren(parentNode) && domUtils.isElementInDocument(parentNode))
            result = this.shadowUI.insertBeforeRoot(newNode);
        else
            result = nativeFn.apply(parentNode, args);

        if (childNodes) {
            for (const child of childNodes)
                this._onElementAdded(child);
        }
        else
            this._onElementAdded(newNode);

        return result;
    }

    _prepareNodeForInsertion (node, parentNode) {
        if (domUtils.isTextNode(node))
            ElementSandbox._processTextNodeContent(node, parentNode);

        this.nodeSandbox.processNodes(node);
    }

    _createOverridedMethods () {
        // NOTE: We need the closure because a context of overridden methods is an html element
        const sandbox = this;

        this.overridedMethods = {
            insertRow () {
                const nativeMeth = domUtils.isTableElement(this)
                    ? nativeMethods.insertTableRow
                    : nativeMethods.insertTBodyRow;
                const row        = nativeMeth.apply(this, arguments);

                sandbox.nodeSandbox.processNodes(row);

                return row;
            },

            insertCell () {
                const cell = nativeMethods.insertCell.apply(this, arguments);

                sandbox.nodeSandbox.processNodes(cell);

                return cell;
            },

            insertAdjacentHTML (...args) {
                const position = args[0];
                const html     = args[1];

                if (args.length > 1 && html !== null)
                    args[1] = processHtml('' + html, this.parentNode && this.parentNode.tagName);

                nativeMethods.insertAdjacentHTML.apply(this, args);
                sandbox.nodeSandbox.processNodes(this.parentNode || this);

                if (position === 'afterbegin' || position === 'beforeend')
                    DOMMutationTracker.onChildrenChanged(this);
                else if (this.parentNode)
                    DOMMutationTracker.onChildrenChanged(this.parentNode);
            },

            formSubmit () {
                sandbox._ensureTargetContainsExistingBrowsingContext(this);
                sandbox.emit(sandbox.BEFORE_FORM_SUBMIT_EVENT, { form: this });

                return nativeMethods.formSubmit.apply(this, arguments);
            },

            insertBefore (...args) {
                return sandbox._addNodeCore({
                    parentNode: this,
                    nativeFn:   nativeMethods.insertBefore,
                    checkBody:  !args[1],

                    args
                });
            },

            appendChild (...args) {
                return sandbox._addNodeCore({
                    parentNode: this,
                    nativeFn:   nativeMethods.appendChild,
                    checkBody:  true,

                    args
                });
            },

            removeChild () {
                const child = arguments[0];

                sandbox._onRemoveFileInputInfo(child);
                sandbox._onRemoveIframe(child);

                const result = nativeMethods.removeChild.apply(this, arguments);

                sandbox._onElementRemoved(child);

                return result;
            },

            replaceChild () {
                const newChild = arguments[0];
                const oldChild = arguments[1];

                if (domUtils.isTextNode(newChild))
                    ElementSandbox._processTextNodeContent(newChild, this);

                sandbox._onRemoveFileInputInfo(oldChild);

                const result = nativeMethods.replaceChild.apply(this, arguments);

                sandbox._onAddFileInputInfo(newChild);
                DOMMutationTracker.onElementChanged(newChild);
                DOMMutationTracker.onElementChanged(oldChild);

                return result;
            },

            cloneNode () {
                const clone = nativeMethods.cloneNode.apply(this, arguments);

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
                const result = sandbox._setAttributeCore(this, arguments);

                ElementSandbox._refreshAttributesWrappers(this);

                return result;
            },

            setAttributeNS () {
                const result = sandbox._setAttributeCore(this, arguments, true);

                ElementSandbox._refreshAttributesWrappers(this);

                return result;
            },

            removeAttribute () {
                const result = sandbox._removeAttributeCore(this, arguments);

                ElementSandbox._refreshAttributesWrappers(this);

                return result;
            },

            removeAttributeNS () {
                const result = sandbox._removeAttributeCore(this, arguments, true);

                ElementSandbox._refreshAttributesWrappers(this);

                return result;
            },

            querySelector () {
                if (typeof arguments[0] === 'string')
                    arguments[0] = NodeSandbox.processSelector(arguments[0]);

                return getNativeQuerySelector(this).apply(this, arguments);
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

    static _hasShadowUIParentOrContainsShadowUIClassPostfix (el) {
        return el.parentNode && domUtils.isShadowUIElement(el.parentNode) || ShadowUI.containsShadowUIClassPostfix(el);
    }

    _isFirstBaseTagOnPage (el) {
        return nativeMethods.querySelector.call(this.document, 'base') === el;
    }

    _onAddFileInputInfo (el) {
        if (!domUtils.isDomElement(el))
            return;

        const fileInputs = domUtils.getFileInputs(el);

        for (const fileInput of fileInputs)
            this.addFileInputInfo(fileInput);
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
        if (ElementSandbox._hasShadowUIParentOrContainsShadowUIClassPostfix(el))
            ShadowUI.markElementAndChildrenAsShadow(el);

        if ((domUtils.isDomElement(el) || domUtils.isDocument(el)) && domUtils.isElementInDocument(el)) {
            const iframes = domUtils.getIframes(el);

            for (const iframe of iframes) {
                this.onIframeAddedToDOM(iframe);
                windowsStorage.add(iframe.contentWindow);
            }

            const scripts = domUtils.getScripts(el);

            for (const script of scripts)
                this.emit(this.SCRIPT_ELEMENT_ADDED_EVENT, { el: script });

            DOMMutationTracker.onElementChanged(el);
        }

        // NOTE: recalculate `formaction` attribute value if it placed in the dom
        if ((domUtils.isInputElement(el) || domUtils.isButtonElement(el)) && el.form &&
            nativeMethods.hasAttribute.call(el, 'formaction'))
            el.setAttribute('formaction', el.getAttribute('formaction'));

        if (domUtils.isBodyElement(el))
            this.shadowUI.onBodyElementMutation();

        this._onAddFileInputInfo(el);

        if (domUtils.isBaseElement(el) && this._isFirstBaseTagOnPage(el)) {
            const storedHrefAttrName  = domProcessor.getStoredAttrName('href');
            const storedHrefAttrValue = el.getAttribute(storedHrefAttrName);

            if (storedHrefAttrValue !== null)
                urlResolver.updateBase(storedHrefAttrValue, this.document);
        }
    }

    _onElementRemoved (el) {
        if (domUtils.isBodyElement(el))
            this.shadowUI.onBodyElementMutation();

        else if (domUtils.isBaseElement(el)) {
            const firstBaseEl    = nativeMethods.querySelector.call(this.document, 'base');
            const storedHrefAttr = firstBaseEl && firstBaseEl.getAttribute(domProcessor.getStoredAttrName('href'));

            urlResolver.updateBase(storedHrefAttr || getDestLocation(), this.document);
        }

        DOMMutationTracker.onElementChanged(el);
    }

    addFileInputInfo (el) {
        const infoManager = this.uploadSandbox.infoManager;

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
        const storedAttr = nativeMethods.getAttribute.call(el, domProcessor.getStoredAttrName('target'));

        el.setAttribute('target', storedAttr || el.target);
    }

    _setValidBrowsingContextOnElementClick (window) {
        this.eventSandbox.listeners.initElementListening(window, ['click']);
        this.eventSandbox.listeners.addInternalEventListener(window, ['click'], e => {
            let el = e.target;

            if (domUtils.isInputElement(el) && el.form)
                el = el.form;

            const tagName = domUtils.getTagName(el);

            if (!DomProcessor.isTagWithTargetAttr(tagName))
                return;

            this._ensureTargetContainsExistingBrowsingContext(el);
        });
    }

    _setProxiedSrcUrlOnError (img) {
        img.addEventListener('error', e => {
            const storedAttr = nativeMethods.getAttribute.call(img, domProcessor.getStoredAttrName('src'));

            if (storedAttr && !urlUtils.parseProxyUrl(img.src) &&
                urlUtils.isSupportedProtocol(img.src) && !urlUtils.isSpecialPage(img.src)) {
                nativeMethods.setAttribute.call(img, 'src', urlUtils.getProxyUrl(storedAttr));
                stopPropagation(e);
            }
        }, false);
    }

    getTarget (el, newTarget) {
        const target = newTarget || '';

        if (target && !ElementSandbox._isKeywordTarget(target) && !windowsStorage.findByName(target) ||
            /_blank/i.test(target))
            return '_top';

        return target;
    }

    processElement (el) {
        const tagName = domUtils.getTagName(el);

        switch (tagName) {
            case 'img':
                if (!el[this.nodeSandbox.win.FORCE_PROXY_SRC_FOR_IMAGE])
                    this._setProxiedSrcUrlOnError(el);
                break;
            case 'iframe':
            case 'frame':
                this.iframeSandbox.processIframe(el);
                break;
            case 'base': {
                if (!this._isFirstBaseTagOnPage(el))
                    break;

                const storedUrlAttr = nativeMethods.getAttribute.call(el, domProcessor.getStoredAttrName('href'));

                if (storedUrlAttr !== null)
                    urlResolver.updateBase(storedUrlAttr, this.document);

                break;
            }
        }

        // NOTE: we need to reprocess a tag client-side if it wasn't processed on the server.
        // See the usage of Parse5DomAdapter.needToProcessUrl
        if (DomProcessor.isIframeFlagTag(tagName) && el.target === '_parent')
            domProcessor.processElement(el, urlUtils.convertToProxyUrl);
    }
}
