import INTERNAL_PROPS from '../../../processing/dom/internal-properties';
import SandboxBase from '../base';
import NodeSandbox from '../node/index';
import DomProcessor from '../../../processing/dom';
import nativeMethods from '../native-methods';
import domProcessor from '../../dom-processor';
import { processScript } from '../../../processing/script';
import styleProcessor from '../../../processing/style';
import * as urlUtils from '../../utils/url';
import * as domUtils from '../../utils/dom';
import * as hiddenInfo from '../upload/hidden-info';
import * as urlResolver from '../../utils/url-resolver';
import { sameOriginCheck, get as getDestLocation } from '../../utils/destination-location';
import { isValidEventListener, stopPropagation } from '../../utils/event';
import { processHtml, isParsingElement } from '../../utils/html';
import { getNativeQuerySelector, getNativeQuerySelectorAll } from '../../utils/query-selector';
import { HASH_RE } from '../../../utils/url';
import trim from '../../../utils/string-trim';
import * as windowsStorage from '../windows-storage';
import { refreshAttributesWrapper } from './attributes';
import ShadowUI from '../shadow-ui';
import DOMMutationTracker from './live-node-list/dom-mutation-tracker';
import { ATTRS_WITH_SPECIAL_PROXYING_LOGIC } from '../../../processing/dom/attributes';
import settings from '../../settings';
import { overrideDescriptor } from '../../utils/property-overriding';

const KEYWORD_TARGETS = ['_blank', '_self', '_parent', '_top'];

const RESTRICTED_META_HTTP_EQUIV_VALUES = ['refresh', 'content-security-policy'];

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

        this.overriddenMethods = null;

        this.BEFORE_FORM_SUBMIT_EVENT   = 'hammerhead|event|before-form-submit';
        this.SCRIPT_ELEMENT_ADDED_EVENT = 'hammerhead|event|script-added';
    }

    static _isKeywordTarget (value) {
        value = value.toLowerCase();

        return KEYWORD_TARGETS.indexOf(value) !== -1;
    }

    static _onTargetChanged (el) {
        const tagName    = domUtils.getTagName(el);
        const targetAttr = domProcessor.getTargetAttr(el);

        if (!DomProcessor.isIframeFlagTag(tagName))
            return;

        let urlAttr;

        if (targetAttr === 'target')
            urlAttr = tagName === 'form' ? 'action' : 'href';
        else if (targetAttr === 'formtarget')
            urlAttr = 'formaction';

        const storedUrlAttr = DomProcessor.getStoredAttrName(urlAttr);

        if (el.hasAttribute(storedUrlAttr)) {
            const url = el.getAttribute(storedUrlAttr);

            if (urlUtils.isSupportedProtocol(url))
                el.setAttribute(urlAttr, url);
        }
    }

    static _setProxiedSrc (img) {
        if (!img[INTERNAL_PROPS.forceProxySrcForImage]) {
            const imgSrc            = nativeMethods.imageSrcGetter.call(img);
            const skipNextLoadEvent = !!imgSrc && img.complete;

            img[INTERNAL_PROPS.forceProxySrcForImage] = true;

            if (imgSrc)
                img.setAttribute('src', imgSrc);

            img[INTERNAL_PROPS.skipNextLoadEventForImage] = skipNextLoadEvent;
        }
    }

    getAttributeCore (el, args, isNs) {
        const attr        = String(args[isNs ? 1 : 0]);
        const loweredAttr = attr.toLowerCase();
        const ns          = isNs ? args[0] : null;
        const getAttrMeth = isNs ? nativeMethods.getAttributeNS : nativeMethods.getAttribute;
        const tagName     = domUtils.getTagName(el);

        // OPTIMIZATION: The hasAttribute method is very slow.
        if (domProcessor.isUrlAttr(el, loweredAttr, ns) ||
            domProcessor.EVENTS.indexOf(loweredAttr) !== -1 ||
            ATTRS_WITH_SPECIAL_PROXYING_LOGIC.indexOf(loweredAttr) !== -1) {
            const storedAttrName  = DomProcessor.getStoredAttrName(attr);
            const storedAttrValue = getAttrMeth.apply(el, isNs ? [ns, storedAttrName] : [storedAttrName]);

            if (DomProcessor.isAddedAutocompleteAttr(loweredAttr, storedAttrValue))
                return null;
            else if (el.hasAttribute(storedAttrName))
                args[isNs ? 1 : 0] = storedAttrName;
        }
        // NOTE: We simply remove the 'integrity' attribute because its value will not be relevant after the script
        // content changes (http://www.w3.org/TR/SRI/). If this causes problems in the future, we will need to generate
        // the correct SHA for the changed script. (GH-235)
        else if (!isNs && loweredAttr === 'integrity' && DomProcessor.isTagWithIntegrityAttr(tagName)) {
            const storedIntegrityAttr = DomProcessor.getStoredAttrName(attr);

            if (nativeMethods.hasAttribute.call(el, storedIntegrityAttr))
                args[0] = storedIntegrityAttr;
        }
        // NOTE: We simply remove the 'rel' attribute if rel='prefetch' and use stored 'rel' attribute, because the prefetch
        // resource type is unknown. https://github.com/DevExpress/testcafe/issues/2528
        else if (!isNs && loweredAttr === 'rel' && tagName === 'link') {
            const storedRelAttr = DomProcessor.getStoredAttrName(attr);

            if (nativeMethods.hasAttribute.call(el, storedRelAttr))
                args[0] = storedRelAttr;
        }
        else if (!isNs && loweredAttr === 'required' && domUtils.isFileInput(el)) {
            const storedRequiredAttr = DomProcessor.getStoredAttrName(attr);

            if (nativeMethods.hasAttribute.call(el, storedRequiredAttr))
                args[0] = storedRequiredAttr;
        }

        return getAttrMeth.apply(el, args);
    }

    setAttributeCore (el, args, isNs) {
        const ns          = isNs ? args[0] : null;
        const attr        = String(args[isNs ? 1 : 0]);
        const loweredAttr = attr.toLowerCase();
        const valueIndex  = isNs ? 2 : 1;
        const value       = String(args[valueIndex]);
        const setAttrMeth = isNs ? nativeMethods.setAttributeNS : nativeMethods.setAttribute;
        const tagName     = domUtils.getTagName(el);
        const isUrlAttr   = domProcessor.isUrlAttr(el, attr, ns);
        const isEventAttr = domProcessor.EVENTS.indexOf(attr) !== -1;

        let needToCallTargetChanged = false;

        const isSpecialPage       = urlUtils.isSpecialPage(value);
        const isSupportedProtocol = urlUtils.isSupportedProtocol(value);

        if (isUrlAttr && !isSupportedProtocol && !isSpecialPage || isEventAttr) {
            const isJsProtocol = DomProcessor.isJsProtocol(value);
            const storedJsAttr = DomProcessor.getStoredAttrName(attr);

            if (isUrlAttr && isJsProtocol || isEventAttr)
                args[valueIndex] = DomProcessor.processJsAttrValue(value, { isJsProtocol, isEventAttr });

            setAttrMeth.apply(el, isNs ? [ns, storedJsAttr, value] : [storedJsAttr, value]);
        }
        else if (isUrlAttr && (isSupportedProtocol || isSpecialPage)) {
            const storedUrlAttr = DomProcessor.getStoredAttrName(attr);

            setAttrMeth.apply(el, isNs ? [ns, storedUrlAttr, value] : [storedUrlAttr, value]);

            if (tagName !== 'img' || el[INTERNAL_PROPS.forceProxySrcForImage]) {
                if (tagName === 'img')
                    el[INTERNAL_PROPS.skipNextLoadEventForImage] = false;

                if (value !== '' && (!isSpecialPage || tagName === 'a')) {
                    const isIframe         = tagName === 'iframe' || tagName === 'frame';
                    const isScript         = tagName === 'script';
                    const isCrossDomainUrl = isSupportedProtocol && !sameOriginCheck(location.toString(), value);
                    let resourceType       = domProcessor.getElementResourceType(el);
                    const elCharset        = isScript && el.charset;
                    const currentDocument  = el.ownerDocument || this.document;

                    if (loweredAttr === 'formaction' && !nativeMethods.hasAttribute.call(el, 'formtarget')) {
                        resourceType = 'f';

                        if (el.form && nativeMethods.hasAttribute.call(el.form, 'action')) {
                            const parsedFormAction = urlUtils.parseProxyUrl(nativeMethods.formActionGetter.call(el.form));

                            if (parsedFormAction)
                                resourceType = parsedFormAction.resourceType;
                        }
                    }

                    if (ElementSandbox._isHrefAttrForBaseElement(el, attr) &&
                        domUtils.isElementInDocument(el, currentDocument))
                        urlResolver.updateBase(value, currentDocument);

                    args[valueIndex] = isIframe && isCrossDomainUrl
                        ? urlUtils.getCrossDomainIframeProxyUrl(value)
                        : urlUtils.getProxyUrl(value, { resourceType, charset: elCharset, doc: currentDocument });
                }
            }
            else if (value && !isSpecialPage && !urlUtils.parseProxyUrl(value)) {
                args[valueIndex] = el[INTERNAL_PROPS.forceProxySrcForImage]
                    ? urlUtils.getProxyUrl(value)
                    : urlUtils.resolveUrlAsDest(value);
            }
        }
        else if (loweredAttr === 'autocomplete') {
            const storedAutocompleteAttr = DomProcessor.getStoredAttrName(attr);

            setAttrMeth.apply(el, isNs ? [ns, storedAutocompleteAttr, value] : [storedAutocompleteAttr, value]);

            args[valueIndex] = 'off';
        }
        else if (loweredAttr === 'target' && DomProcessor.isTagWithTargetAttr(tagName) ||
                 loweredAttr === 'formtarget' && DomProcessor.isTagWithFormTargetAttr(tagName)) {
            const currentTarget = nativeMethods.getAttribute.call(el, loweredAttr);
            const newTarget     = this.getTarget(el, value);

            if (newTarget !== currentTarget) {
                const storedTargetAttr = DomProcessor.getStoredAttrName(attr);

                setAttrMeth.apply(el, isNs ? [ns, storedTargetAttr, value] : [storedTargetAttr, value]);
                args[valueIndex] = newTarget;

                needToCallTargetChanged = true;
            }
            else
                return null;
        }
        else if (attr === 'sandbox') {
            const storedSandboxAttr = DomProcessor.getStoredAttrName(attr);
            const allowSameOrigin   = value.indexOf('allow-same-origin') !== -1;
            const allowScripts      = value.indexOf('allow-scripts') !== -1;

            setAttrMeth.apply(el, isNs ? [ns, storedSandboxAttr, value] : [storedSandboxAttr, value]);

            if (!allowSameOrigin || !allowScripts) {
                args[valueIndex] += !allowSameOrigin ? ' allow-same-origin' : '';
                args[valueIndex] += !allowScripts ? ' allow-scripts' : '';
            }

            if (el[this.nodeSandbox.win.SANDBOX_DOM_TOKEN_LIST_UPDATE_FN])
                el[this.nodeSandbox.win.SANDBOX_DOM_TOKEN_LIST_UPDATE_FN](value);
        }
        // TODO: remove after https://github.com/DevExpress/testcafe-hammerhead/issues/244 implementation
        else if (tagName === 'meta' && attr === 'http-equiv') {
            const loweredValue = value.toLowerCase();

            if (RESTRICTED_META_HTTP_EQUIV_VALUES.indexOf(loweredValue) !== -1)
                return null;
        }
        else if (loweredAttr === 'xlink:href' &&
                 domProcessor.SVG_XLINK_HREF_TAGS.indexOf(tagName) !== -1 &&
                 domUtils.isSVGElement(el)) {
            const storedXLinkHrefAttr = DomProcessor.getStoredAttrName(attr);

            setAttrMeth.apply(el, isNs ? [ns, storedXLinkHrefAttr, value] : [storedXLinkHrefAttr, value]);

            if (!HASH_RE.test(value))
                args[valueIndex] = urlUtils.getProxyUrl(value);
        }
        else if (loweredAttr === 'style') {
            const storedStyleAttr = DomProcessor.getStoredAttrName(attr);

            setAttrMeth.apply(el, isNs ? [ns, storedStyleAttr, value] : [storedStyleAttr, value]);
            args[valueIndex] = styleProcessor.process(value, urlUtils.getProxyUrl);
        }
        else if (!isNs && loweredAttr === 'integrity' && DomProcessor.isTagWithIntegrityAttr(tagName)) {
            const storedIntegrityAttr = DomProcessor.getStoredAttrName(attr);

            return setAttrMeth.apply(el, [storedIntegrityAttr, value]);
        }
        else if (!isNs && loweredAttr === 'rel' && tagName === 'link') {
            const formatedValue = trim(value.toLowerCase());
            const storedRelAttr = DomProcessor.getStoredAttrName(attr);

            if (formatedValue === 'prefetch') {
                nativeMethods.removeAttribute.call(el, attr);
                args[0] = storedRelAttr;
            }
            else
                nativeMethods.removeAttribute.call(el, storedRelAttr);
        }
        else if (!isNs && loweredAttr === 'required' && domUtils.isFileInput(el)) {
            const storedRequiredAttr = DomProcessor.getStoredAttrName(attr);

            nativeMethods.removeAttribute.call(el, attr);
            args[0] = storedRequiredAttr;
        }
        else if (!isNs && loweredAttr === 'type' && domUtils.isInputElement(el)) {
            const currentType        = nativeMethods.getAttribute.call(el, loweredAttr);
            const newType            = value.toLowerCase();
            const storedRequiredAttr = DomProcessor.getStoredAttrName('required');
            const currentRequired    = nativeMethods.hasAttribute.call(el, storedRequiredAttr)
                ? nativeMethods.getAttribute.call(el, storedRequiredAttr)
                : nativeMethods.getAttribute.call(el, 'required');
            const typeIsChanged      = !currentType || newType !== currentType.toLowerCase();

            if (typeIsChanged && currentRequired !== null) {
                if (newType === 'file') {
                    nativeMethods.setAttribute.call(el, storedRequiredAttr, currentRequired);
                    nativeMethods.removeAttribute.call(el, 'required');
                }
                else if (currentType === 'file') {
                    nativeMethods.setAttribute.call(el, 'required', currentRequired);
                    nativeMethods.removeAttribute.call(el, storedRequiredAttr);
                }
            }
        }

        const result = setAttrMeth.apply(el, args);

        if (needToCallTargetChanged)
            ElementSandbox._onTargetChanged(el);

        return result;
    }

    _hasAttributeCore (el, args, isNs) {
        const attributeNameArgIndex       = isNs ? 1 : 0;
        const hasAttrMeth                 = isNs ? nativeMethods.hasAttributeNS : nativeMethods.hasAttribute;
        const storedAutocompleteAttrName  = DomProcessor.getStoredAttrName('autocomplete');
        const storedAutocompleteAttrValue = nativeMethods.getAttribute.call(el, storedAutocompleteAttrName);
        const tagName                     = domUtils.getTagName(el);

        if (typeof args[attributeNameArgIndex] === 'string' &&
            DomProcessor.isAddedAutocompleteAttr(args[attributeNameArgIndex], storedAutocompleteAttrValue))
            return false;
        // NOTE: We simply remove the 'integrity' attribute because its value will not be relevant after the script
        // content changes (http://www.w3.org/TR/SRI/). If this causes problems in the future, we will need to generate
        // the correct SHA for the changed script.
        // _hasAttributeCore returns true for 'integrity' attribute if the stored attribute is exists. (GH-235)
        else if (!isNs && args[0] === 'integrity' &&
                 DomProcessor.isTagWithIntegrityAttr(tagName))
            args[0] = DomProcessor.getStoredAttrName('integrity');
        // NOTE: We simply remove the 'rel' attribute if rel='prefetch' and use stored 'rel' attribute, because the prefetch
        // resource type is unknown.
        // _hasAttributeCore returns true for 'rel' attribute if the original 'rel' or stored attribute is exists.
        // https://github.com/DevExpress/testcafe/issues/2528
        else if (!isNs && args[0] === 'rel' && tagName === 'link') {
            const storedRelAttr = DomProcessor.getStoredAttrName(args[0]);

            return hasAttrMeth.apply(el, args) || hasAttrMeth.apply(el, [storedRelAttr]);
        }
        else if (!isNs && args[0] === 'required' && domUtils.isFileInput(el)) {
            const storedRequiredAttr = DomProcessor.getStoredAttrName(args[0]);

            return hasAttrMeth.apply(el, args) || hasAttrMeth.call(el, storedRequiredAttr);
        }

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
            formatedAttr === 'target' && DomProcessor.isTagWithTargetAttr(tagName) ||
            formatedAttr === 'formtarget' && DomProcessor.isTagWithFormTargetAttr(tagName)) {
            const storedAttr = DomProcessor.getStoredAttrName(attr);

            if (formatedAttr === 'autocomplete')
                nativeMethods.setAttribute.call(el, storedAttr, domProcessor.AUTOCOMPLETE_ATTRIBUTE_ABSENCE_MARKER);
            else
                removeAttrFunc.apply(el, isNs ? [args[0], storedAttr] : [storedAttr]);
        }
        else if (!isNs && formatedAttr === 'rel' && tagName === 'link') {
            const storedRelAttr = DomProcessor.getStoredAttrName(attr);

            removeAttrFunc.apply(el, [storedRelAttr]);
        }
        else if (!isNs && formatedAttr === 'required' && domUtils.isFileInput(el)) {
            const storedRequiredAttr = DomProcessor.getStoredAttrName(attr);

            removeAttrFunc.call(el, storedRequiredAttr);
        }
        else if (!isNs && formatedAttr === 'type' && domUtils.isInputElement(el)) {
            const storedRequiredAttr = DomProcessor.getStoredAttrName('required');

            if (nativeMethods.hasAttribute.call(el, storedRequiredAttr)) {
                const currentRequired = nativeMethods.getAttribute.call(el, storedRequiredAttr);

                nativeMethods.setAttribute.call(el, 'required', currentRequired);
                nativeMethods.removeAttribute.call(el, storedRequiredAttr);
            }
        }

        if (ElementSandbox._isHrefAttrForBaseElement(el, formatedAttr))
            urlResolver.updateBase(getDestLocation(), this.document);

        if (formatedAttr !== 'autocomplete')
            result = removeAttrFunc.apply(el, args);

        if (formatedAttr === 'target' && DomProcessor.isTagWithTargetAttr(tagName) ||
            formatedAttr === 'formtarget' && DomProcessor.isTagWithFormTargetAttr(tagName))
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

        this.overriddenMethods = {
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
                const el       = this;
                const parentEl = el.parentNode;

                if (args.length > 1 && html !== null) {
                    args[1] = processHtml(String(html), {
                        parentTag:        parentEl && parentEl.tagName,
                        processedContext: el[INTERNAL_PROPS.processedContext]
                    });
                }

                nativeMethods.insertAdjacentHTML.apply(el, args);
                sandbox.nodeSandbox.processNodes(parentEl || el);

                if (position === 'afterbegin' || position === 'beforeend')
                    DOMMutationTracker.onChildrenChanged(el);
                else if (parentEl)
                    DOMMutationTracker.onChildrenChanged(parentEl);
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
                return sandbox.getAttributeCore(this, arguments);
            },

            getAttributeNS () {
                return sandbox.getAttributeCore(this, arguments, true);
            },

            setAttribute () {
                const result = sandbox.setAttributeCore(this, arguments);

                refreshAttributesWrapper(this);

                return result;
            },

            setAttributeNS () {
                const result = sandbox.setAttributeCore(this, arguments, true);

                refreshAttributesWrapper(this);

                return result;
            },

            removeAttribute () {
                const result = sandbox._removeAttributeCore(this, arguments);

                refreshAttributesWrapper(this);

                return result;
            },

            removeAttributeNS () {
                const result = sandbox._removeAttributeCore(this, arguments, true);

                refreshAttributesWrapper(this);

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
                if (nativeMethods.elementAttributesGetter.call(this).length === 2 &&
                    nativeMethods.elementAttributesGetter.call(this).getNamedItem('autocomplete') &&
                    nativeMethods.elementAttributesGetter.call(this).getNamedItem(DomProcessor.getStoredAttrName('autocomplete')))
                    return sandbox._hasAttributeCore(this, ['autocomplete'], false);

                return nativeMethods.hasAttributes.apply(this, arguments);
            },

            anchorToString () {
                const href            = nativeMethods.anchorToString.call(this);
                const parsedProxyHref = urlUtils.parseProxyUrl(href);

                return parsedProxyHref ? parsedProxyHref.destUrl : href;
            },

            registerElement (...args) {
                const opts = args[1];

                if (opts && opts.prototype && opts.prototype.createdCallback) {
                    const storedCreatedCallback = opts.prototype.createdCallback;

                    opts.prototype.createdCallback = function () {
                        if (!isParsingElement(this))
                            storedCreatedCallback.call(this);
                    };
                }

                return nativeMethods.registerElement.apply(this, args);
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

    static _hasShadowUIParentOrContainsShadowUIClassPostfix (el) {
        return el.parentNode && domUtils.isShadowUIElement(el.parentNode) || ShadowUI.containsShadowUIClassPostfix(el);
    }

    _isFirstBaseTagOnPage (el) {
        const doc = el.ownerDocument || this.document;

        return nativeMethods.querySelector.call(doc, 'base') === el;
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
            const storedHrefAttrName  = DomProcessor.getStoredAttrName('href');
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
            const storedHrefAttr = firstBaseEl && firstBaseEl.getAttribute(DomProcessor.getStoredAttrName('href'));

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

        window.Element.prototype.insertBefore              = this.overriddenMethods.insertBefore;
        window.Element.prototype.appendChild               = this.overriddenMethods.appendChild;
        window.Element.prototype.replaceChild              = this.overriddenMethods.replaceChild;
        window.Element.prototype.removeChild               = this.overriddenMethods.removeChild;
        window.Element.prototype.setAttribute              = this.overriddenMethods.setAttribute;
        window.Element.prototype.setAttributeNS            = this.overriddenMethods.setAttributeNS;
        window.Element.prototype.getAttribute              = this.overriddenMethods.getAttribute;
        window.Element.prototype.getAttributeNS            = this.overriddenMethods.getAttributeNS;
        window.Element.prototype.removeAttribute           = this.overriddenMethods.removeAttribute;
        window.Element.prototype.removeAttributeNS         = this.overriddenMethods.removeAttributeNS;
        window.Element.prototype.cloneNode                 = this.overriddenMethods.cloneNode;
        window.Element.prototype.querySelector             = this.overriddenMethods.querySelector;
        window.Element.prototype.querySelectorAll          = this.overriddenMethods.querySelectorAll;
        window.Element.prototype.hasAttribute              = this.overriddenMethods.hasAttribute;
        window.Element.prototype.hasAttributeNS            = this.overriddenMethods.hasAttributeNS;
        window.Element.prototype.hasAttributes             = this.overriddenMethods.hasAttributes;
        window.Node.prototype.cloneNode                    = this.overriddenMethods.cloneNode;
        window.Node.prototype.appendChild                  = this.overriddenMethods.appendChild;
        window.Node.prototype.removeChild                  = this.overriddenMethods.removeChild;
        window.Node.prototype.insertBefore                 = this.overriddenMethods.insertBefore;
        window.Node.prototype.replaceChild                 = this.overriddenMethods.replaceChild;
        window.DocumentFragment.prototype.querySelector    = this.overriddenMethods.querySelector;
        window.DocumentFragment.prototype.querySelectorAll = this.overriddenMethods.querySelectorAll;
        window.HTMLTableElement.prototype.insertRow        = this.overriddenMethods.insertRow;
        window.HTMLTableSectionElement.prototype.insertRow = this.overriddenMethods.insertRow;
        window.HTMLTableRowElement.prototype.insertCell    = this.overriddenMethods.insertCell;
        window.HTMLFormElement.prototype.submit            = this.overriddenMethods.formSubmit;
        window.HTMLAnchorElement.prototype.toString        = this.overriddenMethods.anchorToString;

        if (window.Document.prototype.registerElement)
            window.Document.prototype.registerElement = this.overriddenMethods.registerElement;

        if (window.Element.prototype.insertAdjacentHTML)
            window.Element.prototype.insertAdjacentHTML = this.overriddenMethods.insertAdjacentHTML;
        else if (window.HTMLElement.prototype.insertAdjacentHTML)
            window.HTMLElement.prototype.insertAdjacentHTML = this.overriddenMethods.insertAdjacentHTML;

        this._setValidBrowsingContextOnElementClick(window);

        // NOTE: Cookie can be set up for the page by using the request initiated by img.
        // For example: img.src = '<url that responds with the Set-Cookie header>'
        // If img has the 'load' event handler, we redirect the request through proxy.
        // For details, see https://github.com/DevExpress/testcafe-hammerhead/issues/651
        this.eventSandbox.listeners.on(this.eventSandbox.listeners.EVENT_LISTENER_ATTACHED_EVENT, e => {
            if (e.eventType === 'load' && domUtils.isImgElement(e.el))
                ElementSandbox._setProxiedSrc(e.el);
        });

        overrideDescriptor(window.HTMLElement.prototype, 'onload', {
            getter: null,
            setter: function (handler) {
                if (domUtils.isImgElement(this) && isValidEventListener(handler))
                    ElementSandbox._setProxiedSrc(this);

                nativeMethods.htmlElementOnloadSetter.call(this, handler);
            }
        });
    }

    _ensureTargetContainsExistingBrowsingContext (el) {
        if (!nativeMethods.hasAttribute.call(el, 'target'))
            return;

        const attr       = nativeMethods.getAttribute.call(el, 'target');
        const storedAttr = nativeMethods.getAttribute.call(el, DomProcessor.getStoredAttrName('target'));

        el.setAttribute('target', storedAttr || attr);
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
            const storedAttr = nativeMethods.getAttribute.call(img, DomProcessor.getStoredAttrName('src'));
            const imgSrc     = nativeMethods.imageSrcGetter.call(img);

            if (storedAttr && !urlUtils.parseProxyUrl(imgSrc) &&
                urlUtils.isSupportedProtocol(imgSrc) && !urlUtils.isSpecialPage(imgSrc)) {
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
                this.eventSandbox.listeners.initElementListening(el, ['load']);
                this.eventSandbox.listeners.addInternalEventListener(el, ['load'], (e, dispatched, preventEvent, cancelHandlers, stopEventPropagation) => {
                    if (!el[INTERNAL_PROPS.skipNextLoadEventForImage])
                        return;

                    el[INTERNAL_PROPS.skipNextLoadEventForImage] = false;

                    preventEvent();
                    stopEventPropagation();
                });

                if (!el[INTERNAL_PROPS.forceProxySrcForImage] && !settings.get().forceProxySrcForImage)
                    this._setProxiedSrcUrlOnError(el);
                break;
            case 'iframe':
            case 'frame':
                this.iframeSandbox.processIframe(el);
                break;
            case 'base': {
                if (!this._isFirstBaseTagOnPage(el))
                    break;

                const storedUrlAttr = nativeMethods.getAttribute.call(el, DomProcessor.getStoredAttrName('href'));

                if (storedUrlAttr !== null)
                    urlResolver.updateBase(storedUrlAttr, el.ownerDocument || this.document);

                break;
            }
        }

        // NOTE: we need to reprocess a tag client-side if it wasn't processed on the server.
        // See the usage of Parse5DomAdapter.needToProcessUrl
        const targetAttr = domProcessor.getTargetAttr(el);

        if (DomProcessor.isIframeFlagTag(tagName) && nativeMethods.getAttribute.call(el, targetAttr) === '_parent')
            domProcessor.processElement(el, urlUtils.convertToProxyUrl);
    }
}
