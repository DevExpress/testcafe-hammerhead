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
import urlResolver from '../../utils/url-resolver';
import { sameOriginCheck, get as getDestLocation } from '../../utils/destination-location';
import { isValidEventListener, stopPropagation } from '../../utils/event';
import { processHtml, isInternalHtmlParserElement } from '../../utils/html';
import { getNativeQuerySelector, getNativeQuerySelectorAll } from '../../utils/query-selector';
import { HASH_RE } from '../../../utils/url';
import trim from '../../../utils/string-trim';
import * as windowsStorage from '../windows-storage';
import { refreshAttributesWrapper } from './attributes';
import ShadowUI from '../shadow-ui';
import DOMMutationTracker from './live-node-list/dom-mutation-tracker';
import { ATTRS_WITH_SPECIAL_PROXYING_LOGIC } from '../../../processing/dom/attributes';
import settings from '../../settings';
import { overrideDescriptor, overrideFunction } from '../../utils/overriding';
import InsertPosition from '../../utils/insert-position';
import { isFirefox } from '../../utils/browser';
import UploadSandbox from '../upload';
import IframeSandbox from '../iframe';
import EventSandbox from '../event';
import ChildWindowSandbox from '../child-window';
import BUILTIN_HEADERS from '../../../request-pipeline/builtin-header-names';
import toKebabCase from '../../utils/to-kebab-case';
import getCorrectedTargetForSinglePageMode from '../../utils/get-corrected-target-for-single-page-mode';

const RESTRICTED_META_HTTP_EQUIV_VALUES = [BUILTIN_HEADERS.refresh, BUILTIN_HEADERS.contentSecurityPolicy];

enum AttributeType { // eslint-disable-line no-shadow
    Ns,
    Node
}

export default class ElementSandbox extends SandboxBase {
    overriddenMethods: any;

    BEFORE_FORM_SUBMIT_EVENT = 'hammerhead|event|before-form-submit';
    SCRIPT_ELEMENT_ADDED_EVENT = 'hammerhead|event|script-added';

    constructor (private readonly _nodeSandbox: NodeSandbox,
        private readonly _uploadSandbox: UploadSandbox,
        private readonly _iframeSandbox: IframeSandbox,
        private readonly _shadowUI: ShadowUI,
        private readonly _eventSandbox: EventSandbox,
        private readonly _childWindowSandbox: ChildWindowSandbox) {
        super();

        this.overriddenMethods = null;
    }

    private static _onTargetChanged (el: HTMLElement): void {
        const tagName    = domUtils.getTagName(el);
        const targetAttr = domProcessor.getTargetAttr(el);

        if (!DomProcessor.isIframeFlagTag(tagName))
            return;

        let urlAttr = '';

        if (targetAttr === 'target')
            urlAttr = tagName === 'form' ? 'action' : 'href';
        else if (targetAttr === 'formtarget')
            urlAttr = 'formaction';

        const storedUrlAttr = DomProcessor.getStoredAttrName(urlAttr);

        if (el.hasAttribute(storedUrlAttr)) {
            const url = el.getAttribute(storedUrlAttr);

            if (urlUtils.isSupportedProtocol(url))
                el.setAttribute(urlAttr, url as string);
        }
    }

    private static _setProxiedSrc (img: HTMLImageElement): void {
        if (img[INTERNAL_PROPS.forceProxySrcForImage])
            return;

        const imgSrc            = nativeMethods.imageSrcGetter.call(img);
        const imgSrcset         = nativeMethods.imageSrcsetGetter.call(img);
        const skipNextLoadEvent = !!imgSrc && img.complete && !img[INTERNAL_PROPS.cachedImage];

        img[INTERNAL_PROPS.forceProxySrcForImage] = true;

        if (imgSrc)
            img.setAttribute('src', imgSrc);

        if (imgSrcset)
            img.setAttribute('srcset', imgSrcset);

        img[INTERNAL_PROPS.skipNextLoadEventForImage] = skipNextLoadEvent;
    }

    getAttributeCore (el: HTMLElement, args, isNs?: boolean) {
        const attr        = String(args[isNs ? 1 : 0]);
        const loweredAttr = attr.toLowerCase();
        const ns          = isNs ? args[0] : null;
        const getAttrMeth = isNs ? nativeMethods.getAttributeNS : nativeMethods.getAttribute;
        const tagName     = domUtils.getTagName(el);

        if (loweredAttr === 'style')
            return styleProcessor.cleanUp(getAttrMeth.apply(el, args), urlUtils.parseProxyUrl);

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
        else if (!isNs && (
            // NOTE: We simply remove the 'integrity' attribute because its value will not be relevant after the script
            // content changes (http://www.w3.org/TR/SRI/). If this causes problems in the future, we will need to generate
            // the correct SHA for the changed script. (GH-235)
            loweredAttr === 'integrity' && DomProcessor.isTagWithIntegrityAttr(tagName) ||
            // NOTE: We simply remove the 'rel' attribute if rel='prefetch' and use stored 'rel' attribute, because the prefetch
            // resource type is unknown. https://github.com/DevExpress/testcafe/issues/2528
            loweredAttr === 'rel' && tagName === 'link' ||
            loweredAttr === 'required' && domUtils.isFileInput(el) ||
            loweredAttr === 'srcdoc' && tagName === 'iframe'
        )) {
            const storedAttr = DomProcessor.getStoredAttrName(attr);

            if (nativeMethods.hasAttribute.call(el, storedAttr))
                args[0] = storedAttr;
        }

        return getAttrMeth.apply(el, args);
    }

    setAttributeCore (el: HTMLElement, args, isNs?: boolean) {
        const ns          = isNs ? args[0] : null;
        const attr        = String(args[isNs ? 1 : 0]);
        const loweredAttr = attr.toLowerCase();
        const valueIndex  = isNs ? 2 : 1;
        const value       = String(args[valueIndex]);
        const setAttrMeth = isNs ? nativeMethods.setAttributeNS : nativeMethods.setAttribute;
        const tagName     = domUtils.getTagName(el);
        const isUrlAttr   = domProcessor.isUrlAttr(el, attr, ns);
        const isEventAttr = domProcessor.EVENTS.indexOf(attr) !== -1;
        const isUrlsSet   = attr === 'srcset';

        let needToCallTargetChanged = false;
        let needToRecalcHref        = false;

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
                    const isCrossDomainUrl = !settings.nativeAutomation && isSupportedProtocol && !sameOriginCheck(this.window.location.toString(), value);
                    let resourceType       = domProcessor.getElementResourceType(el);
                    const elCharset        = isScript && (el as HTMLScriptElement).charset; // eslint-disable-line no-extra-parens
                    const currentDocument  = el.ownerDocument || this.document;

                    if (loweredAttr === 'formaction' && !nativeMethods.hasAttribute.call(el, 'formtarget')) {
                        resourceType = urlUtils.stringifyResourceType({ isForm: true });

                        if ((el as HTMLFormElement).form && nativeMethods.hasAttribute.call((el as HTMLFormElement).form, 'action')) { // eslint-disable-line no-extra-parens
                            const parsedFormAction = urlUtils.parseProxyUrl(nativeMethods.formActionGetter.call((el as HTMLFormElement).form)); // eslint-disable-line no-extra-parens

                            if (parsedFormAction)
                                resourceType = parsedFormAction.resourceType;
                        }
                    }

                    if (ElementSandbox._isHrefAttrForBaseElement(el, attr) &&
                        domUtils.isElementInDocument(el, currentDocument))
                        urlResolver.updateBase(value, currentDocument);

                    if (settings.nativeAutomation)
                        args[valueIndex] = value;
                    else {
                        args[valueIndex] = isIframe && isCrossDomainUrl
                            ? urlUtils.getCrossDomainIframeProxyUrl(value)
                            : urlUtils.getProxyUrl(value, { resourceType, charset: elCharset, doc: currentDocument, isUrlsSet });
                    }
                }
            }
            else if (value && !isSpecialPage && !urlUtils.parseProxyUrl(value))
                args[valueIndex] = urlUtils.resolveUrlAsDest(value, isUrlsSet);

            if (!nativeMethods.nodeParentNodeGetter.call(el)) {
                nativeMethods.objectDefineProperty(el, INTERNAL_PROPS.currentBaseUrl, {
                    value:        urlResolver.getBaseUrl(document),
                    configurable: true,
                    writable:     true,
                });
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
            const newTarget     = getCorrectedTargetForSinglePageMode(value);

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

            if (el[this._nodeSandbox.win.SANDBOX_DOM_TOKEN_LIST_UPDATE_FN])
                (el[this._nodeSandbox.win.SANDBOX_DOM_TOKEN_LIST_UPDATE_FN] as Function)(value);
        }
        // TODO: remove after https://github.com/DevExpress/testcafe-hammerhead/issues/244 implementation
        else if (tagName === 'meta' && toKebabCase(attr) === 'http-equiv') {
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
        else if (loweredAttr === 'style')
            args[valueIndex] = styleProcessor.process(value, urlUtils.getProxyUrl);

        else if (!isNs && loweredAttr === 'integrity' && DomProcessor.isTagWithIntegrityAttr(tagName)) {
            const storedIntegrityAttr = DomProcessor.getStoredAttrName(attr);

            return setAttrMeth.apply(el, [storedIntegrityAttr, value]);
        }
        else if (!isNs && loweredAttr === 'rel' && tagName === 'link') {
            const currentValue  = nativeMethods.getAttribute.call(el, 'rel');
            const formatedValue = trim(value.toLowerCase());
            const storedRelAttr = DomProcessor.getStoredAttrName(attr);

            needToRecalcHref = value !== currentValue && (value === domProcessor.MODULE_PRELOAD_LINK_REL ||
                                                          currentValue === domProcessor.MODULE_PRELOAD_LINK_REL);

            if (formatedValue === 'prefetch') {
                nativeMethods.removeAttribute.call(el, attr);
                args[0] = storedRelAttr;
            }
            else
                nativeMethods.removeAttribute.call(el, storedRelAttr);
        }
        else if (!isNs && loweredAttr === 'as' && tagName === 'link') {
            const currentValue = nativeMethods.getAttribute.call(el, 'as');

            needToRecalcHref = value !== currentValue && (value === domProcessor.PROCESSED_PRELOAD_LINK_CONTENT_TYPE ||
                                                          currentValue === domProcessor.PROCESSED_PRELOAD_LINK_CONTENT_TYPE);
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
        else if (!isNs && loweredAttr === 'srcdoc' && tagName === 'iframe') {
            const storedAttr = DomProcessor.getStoredAttrName(attr);

            setAttrMeth.apply(el, [storedAttr, value]);

            args[valueIndex] = domProcessor.adapter.processSrcdocAttr(value);
        }

        const result = setAttrMeth.apply(el, args);

        if (tagName === 'img' && !el[INTERNAL_PROPS.forceProxySrcForImage] && (el as HTMLImageElement).complete && !isFirefox) // eslint-disable-line no-extra-parens
            el[INTERNAL_PROPS.cachedImage] = true;

        if (needToCallTargetChanged)
            ElementSandbox._onTargetChanged(el);

        if (needToRecalcHref && nativeMethods.hasAttribute.call(el, 'href'))
            this.setAttributeCore(el, ['href', nativeMethods.getAttribute.call(el, 'href')]);

        return result;
    }

    private _hasAttributeCore (el: HTMLElement, args, isNs: boolean) {
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

    private static _removeStoredAttrNode (node: Node & { name: string, namespaceURI: string }) {
        let storedNode: Node;
        const storedAttr = DomProcessor.getStoredAttrName(node.name);

        if (node.namespaceURI)
            storedNode = nativeMethods.getAttributeNodeNS.call(this, node.namespaceURI, storedAttr);
        else
            storedNode = nativeMethods.getAttributeNode.call(this, storedAttr);

        if (storedNode)
            nativeMethods.removeAttributeNode.call(this, storedNode);
    }

    removeAttributeCore (el: HTMLElement, args, isNsNode?: AttributeType) {
        let attr: string;
        let node: Node & { name: string, namespaceURI: string };
        let removeStoredAttrFunc: Function;
        const isNs = isNsNode === AttributeType.Ns;
        const isNode = isNsNode === AttributeType.Node;

        if (isNode) {
            node = args[0];
            attr = node.name;
            removeStoredAttrFunc = ElementSandbox._removeStoredAttrNode;
        }
        else {
            attr = String(args[isNs ? 1 : 0]);
            removeStoredAttrFunc = isNs ? nativeMethods.removeAttributeNS : nativeMethods.removeAttribute;
        }

        const formatedAttr   = attr.toLowerCase();
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
                removeStoredAttrFunc.apply(el, isNs ? [args[0], storedAttr] : [isNode ? node : storedAttr]);
        }
        else if (!isNs && formatedAttr === 'rel' && tagName === 'link') {
            const storedRelAttr = DomProcessor.getStoredAttrName(attr);

            removeStoredAttrFunc.apply(el, [isNode ? node : storedRelAttr]);
        }
        else if (!isNs && formatedAttr === 'required' && domUtils.isFileInput(el)) {
            const storedRequiredAttr = DomProcessor.getStoredAttrName(attr);

            removeStoredAttrFunc.call(el, isNode ? node : storedRequiredAttr);
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

        if (formatedAttr !== 'autocomplete') {
            if (isNode) {
                const removeArgs = [nativeMethods.getAttributeNodeNS.call(el, node.namespaceURI, node.name)];

                for (let i = 1, ilen = args.length; i < ilen; ++i) removeArgs.push(args[i]);
                result = nativeMethods.removeAttributeNode.apply(el, removeArgs);
            }
            else {
                const removeAttrFunc = isNs ? nativeMethods.removeAttributeNS : nativeMethods.removeAttribute;

                result = removeAttrFunc.apply(el, args);
            }
        }

        if (formatedAttr === 'target' && DomProcessor.isTagWithTargetAttr(tagName) ||
            formatedAttr === 'formtarget' && DomProcessor.isTagWithFormTargetAttr(tagName))
            ElementSandbox._onTargetChanged(el);

        return result;
    }

    private static _getChildNodesArray (args: (string | Node)[], range: [number, number]): Node[] {
        const result       = [] as Node[];
        const [start, end] = range;

        if (args.length === 0)
            return result;

        for (let i = start; i < end; i++) {
            const node = args[i];

            if (domUtils.isDocumentFragmentNode(node)) {
                const childNodes = nativeMethods.nodeChildNodesGetter.call(node);

                result.push.apply(result, domUtils.nodeListToArray(childNodes));
            }
            else if (typeof node !== 'string')
                result.push(node);
        }

        return result;
    }

    private static _ensureStringArguments (...args): string[] {
        const result = [];

        for (let i = 0; i < args.length; i++)
            result.push(String(args[i]));

        return result;
    }

    private _addNodeCore<K, A extends (string | Node)[]> (
        parent: Element | Node & ParentNode, context: Element | Node & ParentNode,
        newNodesRange: [number, number], args: A, nativeFn: (...args: A) => K, checkBody = true, stringifyNode = false): K {// eslint-disable-line no-shadow

        this._prepareNodesForInsertion(args, newNodesRange, parent, stringifyNode);

        let result            = null;
        const childNodesArray = ElementSandbox._getChildNodesArray(args, newNodesRange);

        // NOTE: Before the page's <body> is processed and added to DOM,
        // some javascript frameworks create their own body element, perform
        // certain manipulations and then remove it.
        // Therefore, we need to check if the body element is present in DOM
        if (checkBody && domUtils.isBodyElementWithChildren(parent) && domUtils.isElementInDocument(parent)) {
            const newNodes = nativeMethods.arraySlice.apply(args, newNodesRange);

            result = this._shadowUI.insertBeforeRoot(newNodes);
        }
        else
            result = nativeFn.apply(context, args);

        for (const child of childNodesArray)
            this._onElementAdded(child);

        if (domUtils.getTagName(parent) === 'form')
            hiddenInfo.moveInputToFormBottom(parent as HTMLFormElement);

        return result;
    }

    private _removeNodeCore <K, A extends Node[]> (context: Node, args: A, removingNode: Node, nativeFn: (...args: A) => K): K { // eslint-disable-line no-shadow
        this._onRemoveFileInputInfo(removingNode);
        this._onRemoveIframe(removingNode);

        const result = nativeFn.apply(context, args);

        this._onElementRemoved(removingNode);

        return result;
    }

    private _prepareNodesForInsertion (args: (string | Node | any)[], newNodesRange: [number, number], parentNode: Node, stringifyNode = false): void {
        if (args.length === 0)
            return;

        const [start, end] = newNodesRange;

        for (let i = start; i < end; i++) {
            let node = args[i];

            if (domUtils.isTextNode(node))
                node.data = ElementSandbox._processTextContent(node.data, parentNode);
            else if (domUtils.isDomElement(node) ||
                domUtils.isDocumentFragmentNode(node) ||
                domUtils.isCommentNode(node))
                this._nodeSandbox.processNodes(node as Element | DocumentFragment);
            else {
                if (stringifyNode)
                    node = String(node);

                if (typeof node === 'string')
                    args[i] = ElementSandbox._processTextContent(node, parentNode);
            }
        }
    }

    private _insertAdjacentTextOrElement<K, A extends [string, string | Element]> (
        context: Element, args: A, nativeFn: (...args: A) => K): K { // eslint-disable-line no-shadow

        const position = args[0]?.toLocaleLowerCase?.();
        const parent   = position === InsertPosition.beforeBegin || position === InsertPosition.afterEnd
            ? nativeMethods.nodeParentNodeGetter.call(context)
            : context;

        if (!parent)
            return nativeMethods.insertAdjacentElement.apply(context, args);

        return this._addNodeCore(parent, context, [1, 2], args,
            nativeFn, position === InsertPosition.beforeEnd);
    }

    private _createOverriddenMethods () {
        // NOTE: We need the closure because a context of overridden methods is an html element
        const sandbox = this;

        this.overriddenMethods = {
            appendData (this: CharacterData, text: string) {
                const parentNode = nativeMethods.nodeParentNodeGetter.call(this);

                nativeMethods.nodeTextContentSetter.call(this, nativeMethods.nodeTextContentGetter.call(this) + text);

                if (parentNode)
                    this.data = ElementSandbox._processTextContent(this.data, parentNode);
            },

            insertRow () {
                const nativeMeth = domUtils.isTableElement(this)
                    ? nativeMethods.insertTableRow
                    : nativeMethods.insertTBodyRow;
                const row        = nativeMeth.apply(this, arguments);

                sandbox._nodeSandbox.processNodes(row);

                return row;
            },

            insertCell () {
                const cell = nativeMethods.insertCell.apply(this, arguments);

                sandbox._nodeSandbox.processNodes(cell);

                return cell;
            },

            insertAdjacentHTML (this: Element, ...args: Parameters<Element['insertAdjacentHTML']>) {
                const position = args[0]?.toLocaleLowerCase?.();
                const html     = args[1];
                const parent   = position === InsertPosition.beforeBegin || position === InsertPosition.afterEnd
                    ? nativeMethods.nodeParentNodeGetter.call(this)
                    : this;

                if (args.length > 1 && html !== null && parent) {
                    args[1] = processHtml(String(html), {
                        parentTag:        parent['tagName'],
                        processedContext: parent[INTERNAL_PROPS.processedContext],
                    });
                }

                nativeMethods.insertAdjacentHTML.apply(this, args);

                if (!parent)
                    return;

                sandbox._nodeSandbox.processNodes(parent);
                DOMMutationTracker.onChildrenChanged(parent);
            },

            insertAdjacentElement (this: Element, ...args: Parameters<Element['insertAdjacentElement']>) {
                return sandbox._insertAdjacentTextOrElement(this, args, nativeMethods.insertAdjacentElement);
            },

            insertAdjacentText (this: Element, ...args: Parameters<Element['insertAdjacentText']>) {
                const [ where, data ] = ElementSandbox._ensureStringArguments(...args);

                return sandbox._insertAdjacentTextOrElement(this, [ where, data ], nativeMethods.insertAdjacentText);
            },

            formSubmit () {
                sandbox._ensureTargetContainsExistingBrowsingContext(this);

                const args = { form: this, preventSubmit: false };

                sandbox.emit(sandbox.BEFORE_FORM_SUBMIT_EVENT, args);

                // HACK: For https://github.com/DevExpress/testcafe/issues/3560
                // We have to cancel every form submit after a test is done
                // to prevent requests to a closed session
                if (!args.preventSubmit)
                    return nativeMethods.formSubmit.apply(this, arguments);

                return null;
            },

            insertBefore (this: Node & ParentNode, ...args: Parameters<Node['insertBefore']>) {
                return sandbox._addNodeCore(this, this, [0, 1], args, nativeMethods.insertBefore, !args[1]);
            },

            appendChild (this: Node & ParentNode, ...args: Parameters<Node['appendChild']>) {
                return sandbox._addNodeCore(this, this, [0, 1], args, nativeMethods.appendChild);
            },

            append (this: Element, ...args: Parameters<Element['append']>) {
                return sandbox._addNodeCore(this, this, [0, args.length], args, nativeMethods.append, true, true);
            },

            prepend (this: Element, ...args: Parameters<Element['prepend']>) {
                return sandbox._addNodeCore(this, this, [0, args.length], args, nativeMethods.prepend, false);
            },

            after (this: Element, ...args: Parameters<Element['after']>) {
                const parent = nativeMethods.nodeParentNodeGetter.call(this);

                if (!parent)
                    return nativeMethods.after.apply(this, args);

                return sandbox._addNodeCore(parent, this, [0, args.length], args, nativeMethods.after, false);
            },

            removeChild (this: Node, ...args: Parameters<Node['removeChild']>) {
                return sandbox._removeNodeCore(this, args, args[0], nativeMethods.removeChild);
            },

            remove (this: Element, ...args: Parameters<Element['remove']>) {
                return sandbox._removeNodeCore(this, args, this, nativeMethods.remove);
            },

            elementReplaceWith (this: Element, ...args: Parameters<Element['replaceWith']>) {
                const parentNode = nativeMethods.nodeParentNodeGetter.call(this);

                if (!parentNode)
                    return nativeMethods.elementReplaceWith.apply(this, args);

                const newNodesRange = [0, args.length] as [number, number];

                sandbox._prepareNodesForInsertion(args, newNodesRange, parentNode);

                const childNodesArray = ElementSandbox._getChildNodesArray(args, newNodesRange);

                sandbox._onRemoveFileInputInfo(this);
                sandbox._onRemoveIframe(this);

                const result = nativeMethods.elementReplaceWith.apply(this, args);

                sandbox._onElementRemoved(this);

                for (const child of childNodesArray)
                    sandbox._onElementAdded(child);

                return result;
            },

            replaceChild (this: Node, ...args: Parameters<Node['replaceChild']>) {
                const [newChild, oldChild] = args;

                if (domUtils.isTextNode(newChild))
                    newChild.data = ElementSandbox._processTextContent(newChild.data, this);

                sandbox._onRemoveFileInputInfo(oldChild);

                const result = nativeMethods.replaceChild.apply(this, arguments);

                sandbox._onAddFileInputInfo(newChild);
                DOMMutationTracker.onElementChanged(newChild);
                DOMMutationTracker.onElementChanged(oldChild);

                return result;
            },

            cloneNode () {
                const clone = nativeMethods.cloneNode.apply(this, arguments);

                sandbox._nodeSandbox.processNodes(clone);

                return clone;
            },

            attachShadow (...args: Parameters<Element['attachShadow']>) {
                const root = nativeMethods.attachShadow.apply(this, args);

                nativeMethods.objectDefineProperty(root, domUtils.SHADOW_ROOT_PARENT_ELEMENT, { value: this });

                return root;
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
                const result = sandbox.removeAttributeCore(this, arguments);

                refreshAttributesWrapper(this);

                return result;
            },

            removeAttributeNS () {
                const result = sandbox.removeAttributeCore(this, arguments, AttributeType.Ns);

                refreshAttributesWrapper(this);

                return result;
            },

            removeAttributeNode () {
                const result = sandbox.removeAttributeCore(this, arguments, AttributeType.Node);

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
                return urlUtils.getDestinationUrl(nativeMethods.anchorToString.call(this));
            },

            registerElement (...args) {
                const opts = args[1];

                if (opts && opts.prototype && opts.prototype.createdCallback) {
                    const storedCreatedCallback = opts.prototype.createdCallback;

                    opts.prototype.createdCallback = function () {
                        if (!isInternalHtmlParserElement(this))
                            storedCreatedCallback.call(this);
                    };
                }

                return nativeMethods.registerElement.apply(this, args);
            },
        };
    }

    private static _processTextContent (str: string, parentNode: Node): string {
        if (!parentNode['tagName'])
            return str;

        if (domUtils.isScriptElement(parentNode))
            return processScript(str, true, false, urlUtils.convertToProxyUrl, void 0, settings.nativeAutomation);

        if (domUtils.isStyleElement(parentNode))
            return styleProcessor.process(str, urlUtils.getProxyUrl);

        return str;
    }

    private static _isHrefAttrForBaseElement (el: HTMLElement, attr: string): boolean {
        return domUtils.isBaseElement(el) && attr === 'href';
    }

    private static _removeFileInputInfo (el: HTMLInputElement): void {
        hiddenInfo.removeInputInfo(el);
    }

    private static _hasShadowUIParentOrContainsShadowUIClassPostfix (el: Node): boolean {
        const parent = nativeMethods.nodeParentNodeGetter.call(el);

        return parent && domUtils.isShadowUIElement(parent) || ShadowUI.containsShadowUIClassPostfix(el);
    }

    private _isFirstBaseTagOnPage (el: HTMLBaseElement): boolean {
        const doc = el.ownerDocument || this.document;

        return nativeMethods.querySelector.call(doc, 'base') === el;
    }

    private _onAddFileInputInfo (el): void {
        if (!domUtils.isDomElement(el))
            return;

        const fileInputs = domUtils.getFileInputs(el);

        for (const fileInput of fileInputs)
            this.addFileInputInfo(fileInput);
    }

    private _onRemoveFileInputInfo (el: Node): void {
        if (!domUtils.isDomElement(el))
            return;

        if (domUtils.isFileInput(el))
            ElementSandbox._removeFileInputInfo(el);
        else
            domUtils.find(el, 'input[type=file]', ElementSandbox._removeFileInputInfo);
    }

    private _onRemoveIframe (el: Node): void {
        if (domUtils.isDomElement(el) && domUtils.isIframeElement(el))
            windowsStorage.remove(nativeMethods.contentWindowGetter.call(el));
    }

    private _onElementAdded (el: Node): void {
        if (ElementSandbox._hasShadowUIParentOrContainsShadowUIClassPostfix(el))
            ShadowUI.markElementAndChildrenAsShadow(el);

        if ((domUtils.isDomElement(el) || domUtils.isDocument(el)) && domUtils.isElementInDocument(el)) {
            const iframes = domUtils.getIframes(el);

            for (const iframe of iframes)
                this.onIframeAddedToDOM(iframe);

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
            this._shadowUI.onBodyElementMutation();

        this._onAddFileInputInfo(el);

        if (domUtils.isBaseElement(el) && this._isFirstBaseTagOnPage(el)) {
            const storedHrefAttrName  = DomProcessor.getStoredAttrName('href');
            const storedHrefAttrValue = el.getAttribute(storedHrefAttrName);

            if (storedHrefAttrValue !== null)
                urlResolver.updateBase(storedHrefAttrValue, this.document);
        }
    }

    private _onElementRemoved (el: Node): void {
        if (domUtils.isBodyElement(el))
            this._shadowUI.onBodyElementMutation();

        else if (domUtils.isBaseElement(el)) {
            const firstBaseEl    = nativeMethods.querySelector.call(this.document, 'base');
            const storedHrefAttr = firstBaseEl && firstBaseEl.getAttribute(DomProcessor.getStoredAttrName('href'));

            urlResolver.updateBase(storedHrefAttr || getDestLocation(), this.document);
        }

        DOMMutationTracker.onElementChanged(el);
    }

    private _reprocessElementsAssociatedWithIframe (iframe: HTMLIFrameElement | HTMLFrameElement): void {
        if (!iframe.name)
            return;

        const escapedIframeName  = iframe.name.replace(/("|\\)/g, '\\$1');
        const elementsWithTarget = nativeMethods.querySelectorAll.call(this.document, `*[target="${escapedIframeName}"]`);

        for (const el of elementsWithTarget)
            this._reprocessElementAssociatedWithIframe(el);
    }

    private _reprocessElementAssociatedWithIframe (el: HTMLFormElement | HTMLLinkElement): void {
        const urlAttrName = domProcessor.getUrlAttr(el);
        const storedUrlAttrName = DomProcessor.getStoredAttrName(urlAttrName);

        nativeMethods.removeAttribute.call(el, storedUrlAttrName);
        DomProcessor.setElementProcessed(el, false);

        domProcessor.processElement(el, urlUtils.convertToProxyUrl);
    }

    addFileInputInfo (el: HTMLInputElement): void {
        const infoManager = this._uploadSandbox.infoManager;
        const files       = infoManager.getFiles(el);

        hiddenInfo.addInputInfo(el, files, infoManager.getValue(el));
    }

    onIframeAddedToDOM (iframe: HTMLIFrameElement | HTMLFrameElement): void {
        if (!domUtils.isCrossDomainIframe(iframe, true))
            this._nodeSandbox.mutation.onIframeAddedToDOM(iframe);

        windowsStorage.add(nativeMethods.contentWindowGetter.call(iframe));

        this._reprocessElementsAssociatedWithIframe(iframe);
    }

    attach (window) {
        super.attach(window);

        this._createOverriddenMethods();

        if (nativeMethods.attachShadow)
            overrideFunction(window.Element.prototype, 'attachShadow', this.overriddenMethods.attachShadow);

        overrideFunction(window.Node.prototype, 'appendChild', this.overriddenMethods.appendChild);
        overrideFunction(window.Node.prototype, 'removeChild', this.overriddenMethods.removeChild);
        overrideFunction(window.Node.prototype, 'insertBefore', this.overriddenMethods.insertBefore);

        if (nativeMethods.append)
            overrideFunction(window.Element.prototype, 'append', this.overriddenMethods.append);

        if (nativeMethods.prepend)
            overrideFunction(window.Element.prototype, 'prepend', this.overriddenMethods.prepend);

        if (nativeMethods.after)
            overrideFunction(window.Element.prototype, 'after', this.overriddenMethods.after);

        if (nativeMethods.remove)
            overrideFunction(window.Element.prototype, 'remove', this.overriddenMethods.remove);

        if (nativeMethods.elementReplaceWith)
            overrideFunction(window.Element.prototype, 'replaceWith', this.overriddenMethods.elementReplaceWith);

        overrideFunction(window.Element.prototype, 'insertAdjacentHTML', this.overriddenMethods.insertAdjacentHTML);
        overrideFunction(window.Element.prototype, 'insertAdjacentElement', this.overriddenMethods.insertAdjacentElement);
        overrideFunction(window.Element.prototype, 'insertAdjacentText', this.overriddenMethods.insertAdjacentText);

        if (settings.nativeAutomation)
            return;

        overrideFunction(window.Element.prototype, 'setAttribute', this.overriddenMethods.setAttribute);
        overrideFunction(window.Element.prototype, 'setAttributeNS', this.overriddenMethods.setAttributeNS);
        overrideFunction(window.Element.prototype, 'getAttribute', this.overriddenMethods.getAttribute);
        overrideFunction(window.Element.prototype, 'getAttributeNS', this.overriddenMethods.getAttributeNS);
        overrideFunction(window.Element.prototype, 'removeAttribute', this.overriddenMethods.removeAttribute);
        overrideFunction(window.Element.prototype, 'removeAttributeNS', this.overriddenMethods.removeAttributeNS);
        overrideFunction(window.Element.prototype, 'removeAttributeNode', this.overriddenMethods.removeAttributeNode);
        overrideFunction(window.Element.prototype, 'cloneNode', this.overriddenMethods.cloneNode);
        overrideFunction(window.Element.prototype, 'querySelector', this.overriddenMethods.querySelector);
        overrideFunction(window.Element.prototype, 'querySelectorAll', this.overriddenMethods.querySelectorAll);
        overrideFunction(window.Element.prototype, 'hasAttribute', this.overriddenMethods.hasAttribute);
        overrideFunction(window.Element.prototype, 'hasAttributeNS', this.overriddenMethods.hasAttributeNS);
        overrideFunction(window.Element.prototype, 'hasAttributes', this.overriddenMethods.hasAttributes);

        overrideFunction(window.Node.prototype, 'cloneNode', this.overriddenMethods.cloneNode);
        overrideFunction(window.Node.prototype, 'replaceChild', this.overriddenMethods.replaceChild);

        overrideFunction(window.DocumentFragment.prototype, 'querySelector', this.overriddenMethods.querySelector);
        overrideFunction(window.DocumentFragment.prototype, 'querySelectorAll', this.overriddenMethods.querySelectorAll);

        overrideFunction(window.HTMLTableElement.prototype, 'insertRow', this.overriddenMethods.insertRow);

        overrideFunction(window.HTMLTableSectionElement.prototype, 'insertRow', this.overriddenMethods.insertRow);

        overrideFunction(window.HTMLTableRowElement.prototype, 'insertCell', this.overriddenMethods.insertCell);

        overrideFunction(window.HTMLFormElement.prototype, 'submit', this.overriddenMethods.formSubmit);

        overrideFunction(window.HTMLAnchorElement.prototype, 'toString', this.overriddenMethods.anchorToString);

        overrideFunction(window.CharacterData.prototype, 'appendData', this.overriddenMethods.appendData);

        if (window.Document.prototype.registerElement)
            overrideFunction(window.Document.prototype, 'registerElement', this.overriddenMethods.registerElement);

        this._setValidBrowsingContextOnElementClick(window);

        // NOTE: Cookie can be set up for the page by using the request initiated by img.
        // For example: img.src = '<url that responds with the Set-Cookie header>'
        // If img has the 'load' event handler, we redirect the request through proxy.
        // For details, see https://github.com/DevExpress/testcafe-hammerhead/issues/651
        this._eventSandbox.listeners.on(this._eventSandbox.listeners.EVENT_LISTENER_ATTACHED_EVENT, e => {
            if (e.eventType === 'load' && domUtils.isImgElement(e.el))
                ElementSandbox._setProxiedSrc(e.el);
        });

        this.overrideDescriptorOnload(window);
    }

    private _setValidBrowsingContextOnElementClick (window): void {
        this._eventSandbox.listeners.initElementListening(window, ['click']);
        this._eventSandbox.listeners.addInternalEventBeforeListener(window, ['click'], (e: MouseEvent) => {
            let el = nativeMethods.eventTargetGetter.call(e);

            if (domUtils.isInputElement(el) && el.form)
                el = el.form;

            const tagName = domUtils.getTagName(el);

            if (!DomProcessor.isTagWithTargetAttr(tagName))
                return;

            this._ensureTargetContainsExistingBrowsingContext(el);
        });
    }

    private _ensureTargetContainsExistingBrowsingContext (el: HTMLElement): void {
        if (settings.get().allowMultipleWindows)
            return;

        if (!nativeMethods.hasAttribute.call(el, 'target'))
            return;

        const attr       = nativeMethods.getAttribute.call(el, 'target');
        const storedAttr = nativeMethods.getAttribute.call(el, DomProcessor.getStoredAttrName('target'));

        el.setAttribute('target', storedAttr || attr);
    }

    private overrideDescriptorOnload (window) {
        overrideDescriptor(window.HTMLElement.prototype, 'onload', {
            getter: null,
            setter: function (handler) {
                if (domUtils.isImgElement(this) && isValidEventListener(handler))
                    ElementSandbox._setProxiedSrc(this);

                nativeMethods.htmlElementOnloadSetter.call(this, handler);
            },
        });
    }

    processElement (el: Element): void {
        const tagName = domUtils.getTagName(el);

        switch (tagName) {
            case 'a':
                this._childWindowSandbox.handleClickOnLinkOrArea(el as HTMLLinkElement);
                break;
            case 'img':
                this._handleImageLoadEventRaising(el as HTMLImageElement);
                break;
            case 'iframe':
            case 'frame':
                this._iframeSandbox.processIframe(el as HTMLIFrameElement);
                break;
            case 'base':
                this._processBaseTag(el as HTMLBaseElement);
                break;
            case 'area':
                this._childWindowSandbox.handleClickOnLinkOrArea(el as HTMLAreaElement);
                break;
        }

        // NOTE: we need to reprocess a tag client-side if it wasn't processed on the server.
        // See the usage of Parse5DomAdapter.needToProcessUrl
        this._reProcessElementWithTargetAttr(el, tagName);
    }

    private _handleImageLoadEventRaising (el: HTMLImageElement): void {
        if (settings.nativeAutomation)
            return;

        this._eventSandbox.listeners.initElementListening(el, ['load']);
        this._eventSandbox.listeners.addInternalEventBeforeListener(el, ['load'], (_e, _dispatched, preventEvent, _cancelHandlers, stopEventPropagation) => {
            if (el[INTERNAL_PROPS.cachedImage])
                el[INTERNAL_PROPS.cachedImage] = false;

            if (!el[INTERNAL_PROPS.skipNextLoadEventForImage])
                return;

            el[INTERNAL_PROPS.skipNextLoadEventForImage] = false;

            preventEvent();
            stopEventPropagation();
        });

        if (!el[INTERNAL_PROPS.forceProxySrcForImage] && !settings.get().forceProxySrcForImage)
            this._setProxiedSrcUrlOnError(el as HTMLImageElement);
    }

    private _setProxiedSrcUrlOnError (img: HTMLImageElement): void {
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

    private _processBaseTag (el: HTMLBaseElement): void {
        if (!this._isFirstBaseTagOnPage(el))
            return;

        const storedUrlAttr = nativeMethods.getAttribute.call(el, DomProcessor.getStoredAttrName('href'));

        if (storedUrlAttr !== null)
            urlResolver.updateBase(storedUrlAttr, el.ownerDocument || this.document);
    }

    private _reProcessElementWithTargetAttr (el: Element, tagName: string): void {
        const targetAttr = domProcessor.getTargetAttr(el);

        if (DomProcessor.isIframeFlagTag(tagName) && nativeMethods.getAttribute.call(el, targetAttr) === '_parent')
            domProcessor.processElement(el, urlUtils.convertToProxyUrl);
    }
}
