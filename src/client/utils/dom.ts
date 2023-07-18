import INTERNAL_ATTRS from '../../processing/dom/internal-attributes';
import INTERNAL_PROPS from '../../processing/dom/internal-properties';
import SHADOW_UI_CLASSNAME from '../../shadow-ui/class-name';
import nativeMethods from '../sandbox/native-methods';
import * as urlUtils from './url';
import { get as getStyle } from './style';
import { sameOriginCheck } from './destination-location';

import {
    isFirefox,
    isWebKit,
    isSafari,
    isChrome,
} from './browser';

import { getNativeQuerySelectorAll } from './query-selector';
import { instanceAndPrototypeToStringAreEqual } from './feature-detection';
import { isFunction, isNumber } from './types';

let scrollbarSize = 0;

const NATIVE_MAP_ELEMENT_STRINGS = [
    '[object HTMLMapElement]',
    '[object HTMLAreaElement]',
];

const WINDOW_IS_UNDEFINED              = typeof window === 'undefined';
const NATIVE_WINDOW_STR                = WINDOW_IS_UNDEFINED ? '' : instanceToString(window);
const IS_DOCUMENT_RE                   = /^\[object .*?Document]$/i;
const IS_PROCESSING_INSTRUCTION_RE     = /^\[object .*?ProcessingInstruction]$/i;
const IS_SVG_ELEMENT_RE                = /^\[object SVG\w+?Element]$/i;
const IS_HTML_ELEMENT_RE               = /^\[object HTML.*?Element]$/i;
const IS_ARRAY_BUFFER_RE               = /^\[object ArrayBuffer]$/i;
const IS_DATA_VIEW_RE                  = /^\[object DataView]$/i;
const NATIVE_TABLE_CELL_STR            = WINDOW_IS_UNDEFINED ? '' : instanceToString(nativeMethods.createElement.call(document, 'td'));
const ELEMENT_NODE_TYPE                = WINDOW_IS_UNDEFINED ? -1 : Node.ELEMENT_NODE;
const NOT_CONTENT_EDITABLE_ELEMENTS_RE = /^(select|option|applet|area|audio|canvas|datalist|keygen|map|meter|object|progress|source|track|video|img)$/;
const INPUT_ELEMENTS_RE                = /^(input|textarea|button)$/;
const SCRIPT_OR_STYLE_RE               = /^(script|style)$/i;
const EDITABLE_INPUT_TYPES_RE          = /^(email|number|password|search|tel|text|url)$/;
const NUMBER_OR_EMAIL_INPUT_RE         = /^(number|email)$/;

// NOTE: input with 'file' type processed separately in 'UploadSandbox'
const INPUT_WITH_NATIVE_DIALOG         = /^(color|date|datetime-local|month|week)$/;

// NOTE: We don't take into account the case of embedded contentEditable elements, and we
// specify the contentEditable attribute for focusable elements.
const FOCUSABLE_SELECTOR = 'input, select, textarea, button, body, iframe, [contenteditable="true"], [contenteditable=""], [tabIndex]';

function isHidden (el: HTMLElement): boolean {
    return el.offsetWidth <= 0 && el.offsetHeight <= 0;
}

function isAlwaysNotEditableElement (el: HTMLElement): boolean {
    const tagName = getTagName(el);

    return !!tagName && (NOT_CONTENT_EDITABLE_ELEMENTS_RE.test(tagName) || INPUT_ELEMENTS_RE.test(tagName));
}

function isLocationByProto (instance: any): boolean {
    let instanceCtor = null;

    try {
        // eslint-disable-next-line no-proto
        instanceCtor = instance.__proto__;
    }
    catch (e) {
        // NOTE: Try to detect cross-domain window location.
        // A cross-domain location has no the "assign" function in Safari, Chrome and FireFox.
        const shouldNotHaveAssign = isSafari || isChrome || isFirefox;

        return instance.replace && (shouldNotHaveAssign || !!instance.assign);
    }

    if (!instanceCtor)
        return false;

    const stringifiedInstanceCtor = nativeMethods.objectToString.call(instanceCtor);

    return stringifiedInstanceCtor === '[object LocationPrototype]' ||
        stringifiedInstanceCtor === '[object Location]'; // NOTE: "iPhone" Chrome device emulation case (GH-2080)
}

function closestFallback (el: Node, selector: string) {
    while (el) {
        if (matches(el, selector))
            return el;

        el = nativeMethods.nodeParentNodeGetter.call(el);
    }

    return null;
}

export function instanceToString (instance: any): string {
    if (!instanceAndPrototypeToStringAreEqual)
        return nativeMethods.objectToString.call(instance);

    return instance && typeof instance === 'object'
        ? nativeMethods.objectToString.call(nativeMethods.objectGetPrototypeOf(instance))
        : '';
}

export function getActiveElement (currentDocument?: Document) {
    const doc           = currentDocument || document;
    const activeElement = nativeMethods.documentActiveElementGetter.call(doc);

    let el = isDomElement(activeElement) ? activeElement : doc.body;

    while (el && el.shadowRoot) {
        // eslint-disable-next-line no-restricted-properties
        const shadowEl = el.shadowRoot.activeElement;

        if (!shadowEl)
            break;

        el = shadowEl;
    }

    return el;
}

export function getChildVisibleIndex (select: HTMLSelectElement, child: Node): number {
    const childrenArray = getSelectVisibleChildren(select);

    return childrenArray.indexOf(child);
}

export function getIframeByElement (el: HTMLElement | Document) {
    const elWindow = el[INTERNAL_PROPS.processedContext];

    return getFrameElement(elWindow);
}

export function getIframeLocation (iframe) {
    let documentLocation = null;

    try {
        // eslint-disable-next-line no-restricted-properties
        documentLocation = nativeMethods.contentDocumentGetter.call(iframe).location.href;
    }
    catch (e) {
        documentLocation = null;
    }

    const srcLocation = nativeMethods.getAttribute.call(iframe, 'src' + INTERNAL_ATTRS.storedAttrPostfix) ||
                        nativeMethods.getAttribute.call(iframe, 'src') || nativeMethods.iframeSrcGetter.call(iframe);

    const parsedProxyDocumentLocation = documentLocation && urlUtils.isSupportedProtocol(documentLocation) &&
                                        urlUtils.parseProxyUrl(documentLocation);
    const parsedProxySrcLocation      = srcLocation && urlUtils.isSupportedProtocol(srcLocation) &&
                                        urlUtils.parseProxyUrl(srcLocation);

    return {
        documentLocation: parsedProxyDocumentLocation ? parsedProxyDocumentLocation.destUrl : documentLocation,
        srcLocation:      parsedProxySrcLocation ? parsedProxySrcLocation.destUrl : srcLocation,
    };
}

export function getFrameElement (win: Window): HTMLFrameElement | HTMLIFrameElement | null {
    try {
        return win.frameElement as HTMLFrameElement | HTMLIFrameElement;
    }
    catch (e) {
        return null;
    }
}

export function getMapContainer (el: HTMLElement) {
    const closestMap        = closest(el, 'map');
    const closestMapName    = nativeMethods.getAttribute.call(closestMap, 'name');
    const containerSelector = '[usemap="#' + closestMapName + '"]';

    return nativeMethods.querySelector.call(findDocument(el), containerSelector);
}

export function getParentWindowWithSrc (window: Window): Window {
    const parent           = window.parent;
    let parentFrameElement = null;

    if (window === window.top)
        return window;

    if (parent === window.top || isCrossDomainWindows(window, parent))
        return parent;

    try {
        parentFrameElement = parent.frameElement;
    }
    catch (e) {
        parentFrameElement = null;
    }

    if (parentFrameElement === null || !isIframeWithoutSrc(parentFrameElement))
        return parent;

    return getParentWindowWithSrc(parent);
}

export function getScrollbarSize () {
    if (!scrollbarSize) {
        const scrollDiv = nativeMethods.createElement.call(document, 'div');

        scrollDiv.style.height   = '100px';
        scrollDiv.style.overflow = 'scroll';
        scrollDiv.style.position = 'absolute';
        scrollDiv.style.top      = '-9999px';
        scrollDiv.style.width    = '100px';
        nativeMethods.appendChild.call(document.body, scrollDiv);

        const scrollbarWidth = scrollDiv.offsetWidth - scrollDiv.clientWidth;

        scrollbarSize = scrollbarWidth;

        const parent = nativeMethods.nodeParentNodeGetter.call(scrollDiv);

        parent.removeChild(scrollDiv);
    }

    return scrollbarSize;
}

export function getSelectParent (child) {
    const parent = nativeMethods.nodeParentNodeGetter.call(child);

    return closest(parent, 'select');
}

export function getSelectVisibleChildren (select: HTMLSelectElement) {
    const children = nativeMethods.elementQuerySelectorAll.call(select, 'optgroup, option');
    const result   = [];
    const length   = nativeMethods.nodeListLengthGetter.call(children);

    for (let i = 0; i < length; i++) {
        const child     = children[i];
        // NOTE: Firefox does not display groups without a label and with an empty label.
        const shouldAdd = isFirefox ? getTagName(child) !== 'optgroup' || child.label : true;

        if (shouldAdd)
            result.push(child);
    }

    return result;
}

export function getTopSameDomainWindow (window: Window): Window {
    let result        = window;
    let currentWindow = window.parent;

    if (result === window.top)
        return result;

    while (currentWindow) {
        if (!isCrossDomainWindows(window, currentWindow)) {
            const frameElement = getFrameElement(currentWindow);

            if (!frameElement || !isIframeWithoutSrc(frameElement))
                result = currentWindow;
        }

        currentWindow = currentWindow !== window.top ? currentWindow.parent : null;
    }

    return result;
}

export function find (parent: Node, selector: string, handler) {
    const nodeList = getNativeQuerySelectorAll(parent).call(parent, selector);

    if (handler) {
        const length = nativeMethods.nodeListLengthGetter.call(nodeList);

        for (let i = 0; i < length; i++)
            handler(nodeList[i]);
    }

    return nodeList;
}

export function findDocument (el: any): Document {
    if (el.documentElement)
        return el;

    if (el.ownerDocument && el.ownerDocument.defaultView)
        return el.ownerDocument;

    const parent = isElementNode(el) && nativeMethods.nodeParentNodeGetter.call(el);

    return parent ? findDocument(parent) : document;
}

export function isContentEditableElement (el: Node) {
    let isContentEditable = false;
    let element           = null;

    if (isTextNode(el))
        element = el.parentElement || nativeMethods.nodeParentNodeGetter.call(el);
    else
        element = el;

    if (element) {
        isContentEditable = element.isContentEditable && !isAlwaysNotEditableElement(element);

        return isRenderedNode(element) && (isContentEditable || findDocument(el).designMode === 'on');
    }

    return false;
}

export function isCrossDomainIframe (iframe, bySrc: boolean): boolean {
    const iframeLocation = getIframeLocation(iframe);

    if (!bySrc && iframeLocation.documentLocation === null)
        return true;

    const currentLocation = bySrc ? iframeLocation.srcLocation : iframeLocation.documentLocation;

    if (currentLocation && urlUtils.isSupportedProtocol(currentLocation))
        return !sameOriginCheck(location.toString(), currentLocation);

    return false;
}

export function isCrossDomainWindows (window1: Window, window2: Window): boolean {
    try {
        if (window1 === window2)
            return false;

        const window1Location = window1.location.toString();
        const window2Location = window2.location.toString();

        if (!urlUtils.isSupportedProtocol(window1Location) || !urlUtils.isSupportedProtocol(window2Location))
            return false;

        return !sameOriginCheck(window1Location, window2Location);
    }
    catch (e) {
        return true;
    }
}

export function isIframeWindow (wnd: Window): boolean {
    return wnd !== wnd.top;
}

export function isDomElement (el): boolean {
    if (el instanceof nativeMethods.elementClass)
        return true;

    return el && IS_HTML_ELEMENT_RE.test(instanceToString(el)) && isElementNode(el) && el.tagName;
}

export function getTagName (el): string {
    // NOTE: Check for tagName being a string, because it may be a function in an Angular app (T175340).
    return el && typeof el.tagName === 'string' ? el.tagName.toLowerCase() : '';
}

export const SHADOW_ROOT_PARENT_ELEMENT = 'hammerhead|element|shadow-root-parent';

export function getNodeShadowRootParent (el: Node): Element | null {
    let parent = nativeMethods.nodeParentNodeGetter.call(el);

    while (parent && parent.nodeType !== Node.DOCUMENT_FRAGMENT_NODE)
        parent = nativeMethods.nodeParentNodeGetter.call(parent);

    return parent && parent[SHADOW_ROOT_PARENT_ELEMENT];
}

export function getParentExceptShadowRoot (el: Node) {
    const parent = nativeMethods.nodeParentNodeGetter.call(el);

    return parent && parent.nodeType === Node.DOCUMENT_FRAGMENT_NODE && parent[SHADOW_ROOT_PARENT_ELEMENT]
        ? parent[SHADOW_ROOT_PARENT_ELEMENT]
        : parent;
}

export function isElementInDocument (el: Node, currentDocument?: Document): boolean {
    const doc = currentDocument || document;

    if (!doc.documentElement)
        return false;

    if (doc.documentElement.contains(el))
        return true;

    const shadowRootParent = getNodeShadowRootParent(el);

    return shadowRootParent ? isElementInDocument(shadowRootParent) : false;
}

export function isElementInIframe (el: HTMLElement, currentDocument?: Document): boolean {
    const doc = currentDocument || findDocument(el);

    return window.document !== doc;
}

export function isHammerheadAttr (attr): boolean {
    return attr === INTERNAL_ATTRS.focusPseudoClass || attr === INTERNAL_ATTRS.hoverPseudoClass ||
           attr.indexOf(INTERNAL_ATTRS.storedAttrPostfix) !== -1;
}

export function isIframeElement (el: any): el is HTMLIFrameElement {
    return instanceToString(el) === '[object HTMLIFrameElement]';
}

export function isFrameElement (el: any): el is HTMLFrameElement {
    return instanceToString(el) === '[object HTMLFrameElement]';
}

export function isIframeWithoutSrc (iframe: HTMLIFrameElement | HTMLFrameElement): boolean {
    const iframeLocation         = getIframeLocation(iframe);
    const iframeSrcLocation      = iframeLocation.srcLocation;
    const iframeDocumentLocation = iframeLocation.documentLocation;

    // NOTE: is a cross-domain iframe
    if (iframeDocumentLocation === null)
        return false;

    // NOTE: after 'document.write' or 'document.open' call for iframe with/without src
    // we will process it as iframe without src
    if (nativeMethods.contentWindowGetter.call(iframe)[INTERNAL_PROPS.documentWasCleaned])
        return true;

    const iframeDocumentLocationHaveSupportedProtocol = urlUtils.isSupportedProtocol(iframeDocumentLocation);

    // NOTE: When an iframe has an empty src attribute (<iframe src></iframe>) or has no src attribute (<iframe></iframe>),
    // the iframe.src property is not empty but has different values in different browsers.
    // Its document location is 'about:blank'. Therefore, we should check the src attribute.
    if (!iframeDocumentLocationHaveSupportedProtocol && !nativeMethods.getAttribute.call(iframe, 'src'))
        return true;

    // In Chrome, when an iframe with the src attribute is added to DOM,
    // its documentLocation is set to "about:blank" until the iframe has been loaded.
    // So, we should check srcLocation in this case.
    if (iframeSrcLocation && urlUtils.isSupportedProtocol(iframeSrcLocation))
        return false;

    return !iframeDocumentLocationHaveSupportedProtocol;
}

export function isIframeWithSrcdoc (iframe: HTMLIFrameElement | HTMLFrameElement) {
    return nativeMethods.iframeSrcdocGetter && nativeMethods.hasAttribute.call(iframe, 'srcdoc');
}

export function isImgElement (el: any): el is HTMLImageElement {
    return instanceToString(el) === '[object HTMLImageElement]';
}

export function isInputElement (el: any): el is HTMLInputElement {
    return instanceToString(el) === '[object HTMLInputElement]';
}

export function isTitleElement (el: any): el is HTMLTitleElement {
    return instanceToString(el) === '[object HTMLTitleElement]';
}

export function isButtonElement (el: any): el is HTMLButtonElement {
    return instanceToString(el) === '[object HTMLButtonElement]';
}

export function isFieldSetElement (el: any): el is HTMLFieldSetElement {
    return instanceToString(el) === '[object HTMLFieldSetElement]';
}

export function isOptGroupElement (el: any): el is HTMLOptGroupElement {
    return instanceToString(el) === '[object HTMLOptGroupElement]';
}

export function isHtmlElement (el: any): el is HTMLHtmlElement {
    return instanceToString(el) === '[object HTMLHtmlElement]';
}

export function isBodyElement (el: any): el is HTMLBodyElement {
    return instanceToString(el) === '[object HTMLBodyElement]';
}

export function isPageBody (el: HTMLBodyElement): boolean {
    const parent = nativeMethods.nodeParentNodeGetter.call(el);

    return getTagName(parent) === 'html' && nativeMethods.nodeParentNodeGetter.call(parent)?.nodeName === '#document';
}

export function isHeadElement (el: any): el is HTMLHeadElement {
    return instanceToString(el) === '[object HTMLHeadElement]';
}

export function isHeadOrBodyElement (el: any): el is HTMLHeadElement | HTMLBodyElement {
    const elString = instanceToString(el);

    return elString === '[object HTMLHeadElement]' || elString === '[object HTMLBodyElement]';
}

export function isHeadOrBodyOrHtmlElement (el: any): el is HTMLHeadElement | HTMLBodyElement | HTMLHtmlElement {
    const elString = instanceToString(el);

    return elString === '[object HTMLHeadElement]' || elString === '[object HTMLBodyElement]' ||
           elString === '[object HTMLHtmlElement]';
}

export function isBaseElement (el: any): el is HTMLBaseElement {
    return instanceToString(el) === '[object HTMLBaseElement]';
}

export function isScriptElement (el: any): el is HTMLScriptElement {
    return instanceToString(el) === '[object HTMLScriptElement]';
}

export function isStyleElement (el: any): el is HTMLStyleElement {
    return instanceToString(el) === '[object HTMLStyleElement]';
}

export function isLabelElement (el: any): el is HTMLLabelElement {
    return instanceToString(el) === '[object HTMLLabelElement]';
}

export function isTextAreaElement (el: any): el is HTMLTextAreaElement {
    return instanceToString(el) === '[object HTMLTextAreaElement]';
}

export function isOptionElement (el: any): el is HTMLOptionElement {
    return instanceToString(el) === '[object HTMLOptionElement]';
}

export function isRadioButtonElement (el: HTMLInputElement): boolean {
    return isInputElement(el) && el.type.toLowerCase() === 'radio';
}

export function isColorInputElement (el: HTMLInputElement): boolean {
    return isInputElement(el) && el.type.toLowerCase() === 'color';
}

export function isCheckboxElement (el: HTMLInputElement): boolean {
    return isInputElement(el) && el.type.toLowerCase() === 'checkbox';
}

export function isSelectElement (el: any): el is HTMLSelectElement {
    return instanceToString(el) === '[object HTMLSelectElement]';
}

export function isFormElement (el: any): el is HTMLFormElement {
    return instanceToString(el) === '[object HTMLFormElement]';
}

export function isFileInput (el: any): el is HTMLInputElement {
    return isInputElement(el) && el.type.toLowerCase() === 'file';
}

export function isInputWithNativeDialog (el: any): boolean {
    return isInputElement(el) && INPUT_WITH_NATIVE_DIALOG.test(el.type.toLowerCase());
}

export function isBodyElementWithChildren (el: Node): boolean {
    return isBodyElement(el) && isPageBody(el) && nativeMethods.htmlCollectionLengthGetter.call(
        nativeMethods.elementChildrenGetter.call(el));
}

export function isMapElement (el: HTMLElement): el is HTMLMapElement | HTMLAreaElement {
    return NATIVE_MAP_ELEMENT_STRINGS.indexOf(instanceToString(el)) !== -1;
}

export function isRenderedNode (node: Node): boolean {
    return !(isProcessingInstructionNode(node) || isCommentNode(node) || SCRIPT_OR_STYLE_RE.test(node.nodeName));
}

export function getTabIndex (el: HTMLElement): number | null {
    // NOTE: we obtain the tabIndex value from an attribute because the el.tabIndex
    // property returns -1 for some elements (e.g. for body) with no tabIndex assigned
    let tabIndex = nativeMethods.getAttribute.call(el, 'tabIndex');

    tabIndex = parseInt(tabIndex, 10);

    return isNaN(tabIndex) ? null : tabIndex;
}

export function isElementDisabled (el: HTMLElement): boolean {
    return matches(el, ':disabled');
}

export function isElementFocusable (el: HTMLElement): boolean {
    if (!el)
        return false;

    const tabIndex              = getTabIndex(el);
    const isDisabledElement     = isElementDisabled(el);
    const isInvisibleElement    = getStyle(el, 'visibility') === 'hidden';
    const isNotDisplayedElement = getStyle(el, 'display') === 'none';
    const isHiddenElement       = isWebKit ? isHidden(el) && !isOptionElement(el) : isHidden(el);

    if (isDisabledElement || isInvisibleElement || isNotDisplayedElement || isHiddenElement)
        return false;

    if (isAnchorElement(el)) {
        if (tabIndex !== null)
            return true;

        return matches(el, 'a[href]');
    }

    return matches(el, FOCUSABLE_SELECTOR) || tabIndex !== null;
}

export function isShadowUIElement (element: any): boolean {
    // @ts-ignore
    return !!element[INTERNAL_PROPS.shadowUIElement];
}

export function isWindow (instance: any): instance is Window {
    try {
        if (!instance || !instance.toString || NATIVE_WINDOW_STR !== instanceToString(instance))
            return false;
    }
    catch (e) {
        try {
            // NOTE: If a cross-domain object has the 'top' field, this object is a window
            // (not a document or location).
            return !!instance.top;
        }
        catch {
            return false;
        }
    }

    try {
        nativeMethods.winLocalStorageGetter.call(instance);
    }
    catch {
        return false;
    }

    return true;
}

export function isDocument (instance: any): instance is Document {
    if (instance instanceof nativeMethods.documentClass)
        return true;

    try {
        return instance && IS_DOCUMENT_RE.test(instanceToString(instance));
    }
    catch (e) {
        // NOTE: For cross-domain objects (windows, documents or locations), we return false because
        // it's impossible to work with them in any case.
        return false;
    }
}

export function isBlob (instance: any): instance is Blob {
    return instance && instanceToString(instance) === '[object Blob]';
}

export function isLocation (instance: any): instance is Location {
    if (!instance)
        return false;

    if (isSafari || isChrome || isFirefox)
        return isLocationByProto(instance);

    return instance instanceof nativeMethods.locationClass ||
        nativeMethods.objectToString.call(instance) === '[object Location]';
}

export function isSVGElement (instance: any): boolean {
    if (instance instanceof nativeMethods.svgElementClass)
        return true;

    return instance && IS_SVG_ELEMENT_RE.test(instanceToString(instance));
}

export function isSVGElementOrChild (el): boolean {
    return !!closest(el, 'svg');
}

export function isFetchHeaders (instance: any): instance is Headers {
    if (nativeMethods.Headers && instance instanceof nativeMethods.Headers)
        return true;

    return instance && instanceToString(instance) === '[object Headers]';
}

export function isFetchRequest (instance: any): instance is Request {
    if (nativeMethods.Request && instance instanceof nativeMethods.Request)
        return true;

    return instance && instanceToString(instance) === '[object Request]';
}

export function isElementReadOnly (el): boolean {
    return el.readOnly || el.getAttribute('readonly') === 'readonly';
}

export function isTextEditableInput (el): boolean {
    const attrType = el.getAttribute('type');

    return isInputElement(el) &&
           attrType ? EDITABLE_INPUT_TYPES_RE.test(attrType) : EDITABLE_INPUT_TYPES_RE.test(el.type);
}

export function isTextEditableElement (el): boolean {
    return isTextEditableInput(el) || isTextAreaElement(el);
}

export function isTextEditableElementAndEditingAllowed (el): boolean {
    return isTextEditableElement(el) && !isElementReadOnly(el);
}

export function isElementNode (node): boolean {
    return node && node.nodeType === ELEMENT_NODE_TYPE;
}

export function isTextNode (node: any): node is Text {
    return instanceToString(node) === '[object Text]';
}

export function isProcessingInstructionNode (node): boolean {
    return IS_PROCESSING_INSTRUCTION_RE.test(instanceToString(node));
}

export function isCommentNode (node: any): node is Comment {
    return instanceToString(node) === '[object Comment]';
}

export function isDocumentFragmentNode (node: any): node is DocumentFragment {
    return instanceToString(node) === '[object DocumentFragment]';
}

export function isShadowRoot (root: any): root is ShadowRoot {
    return instanceToString(root) === '[object ShadowRoot]';
}

export function isAnchorElement (el: any): el is HTMLAnchorElement {
    return instanceToString(el) === '[object HTMLAnchorElement]';
}

export function isTableElement (el: any): el is HTMLTableElement {
    return instanceToString(el) === '[object HTMLTableElement]';
}

export function isTableDataCellElement (el: any): el is HTMLTableCellElement {
    return instanceToString(el) === NATIVE_TABLE_CELL_STR;
}

export function isWebSocket (ws: any): ws is WebSocket {
    return instanceToString(ws) === '[object WebSocket]';
}

export function isMessageEvent (e: any): e is MessageEvent {
    return instanceToString(e) === '[object MessageEvent]';
}

export function isPerformanceNavigationTiming (entry: any): entry is PerformanceNavigationTiming {
    return instanceToString(entry) === '[object PerformanceNavigationTiming]';
}

export function isArrayBuffer (data): boolean {
    if (data instanceof nativeMethods.ArrayBuffer)
        return true;

    return data && IS_ARRAY_BUFFER_RE.test(instanceToString(data));
}

export function isArrayBufferView (data): boolean {
    return data && nativeMethods.arrayBufferIsView(data);
}

export function isDataView (data): boolean {
    if (data instanceof nativeMethods.DataView)
        return true;

    return data && IS_DATA_VIEW_RE.test(instanceToString(data));
}

export function matches (el, selector) {
    if (!isElementNode(el))
        return false;

    return nativeMethods.matches.call(el, selector);
}

export function closest (el, selector) {
    if (!isElementNode(el))
        return null;

    if (nativeMethods.closest)
        return nativeMethods.closest.call(el, selector);

    return closestFallback(el, selector);
}

export function addClass (el, className) {
    if (!el)
        return;

    const classNames = className.split(/\s+/);

    for (const currentClassName of classNames)
        nativeMethods.tokenListAdd.call(nativeMethods.elementClassListGetter.call(el), currentClassName);
}

export function removeClass (el, className) {
    if (!el)
        return;

    const classNames = className.split(/\s+/);

    for (const currentClassName of classNames)
        nativeMethods.tokenListRemove.call(nativeMethods.elementClassListGetter.call(el), currentClassName);
}

export function hasClass (el, className) {
    if (!el)
        return false;

    return nativeMethods.tokenListContains.call(nativeMethods.elementClassListGetter.call(el), className);
}

export function parseDocumentCharset () {
    const metaCharset = nativeMethods.querySelector.call(document, '.' + SHADOW_UI_CLASSNAME.charset);

    return metaCharset && metaCharset.getAttribute('charset');
}

export function getParents (el, selector?) {
    const parents = [];

    let parent = getParent(el);

    while (parent) {
        if (!selector && isElementNode(parent) || selector && matches(parent, selector))
            parents.push(parent);

        parent = getParent(parent);
    }

    return parents;
}

function getParent (el) {
    el = el.assignedSlot || el;

    // eslint-disable-next-line no-restricted-properties
    return nativeMethods.nodeParentNodeGetter.call(el) || el.host;
}

export function findParent (node, includeSelf = false, predicate) {
    if (!includeSelf)
        node = getParent(node);

    while (node) {
        if (!isFunction(predicate) || predicate(node))
            return node;

        node = getParent(node);
    }

    return null;
}

export function nodeListToArray (nodeList) {
    const result = [];
    const length = nativeMethods.nodeListLengthGetter.call(nodeList);

    for (let i = 0; i < length; i++)
        result.push(nodeList[i]);

    return result;
}

export function getFileInputs (el) {
    return isFileInput(el) ? [el] : nodeListToArray(getNativeQuerySelectorAll(el).call(el, 'input[type=file]'));
}

export function getIframes (el) {
    return isIframeElement(el) ? [el] : nodeListToArray(getNativeQuerySelectorAll(el).call(el, 'iframe,frame'));
}

export function getScripts (el) {
    return isScriptElement(el) ? [el] : nodeListToArray(getNativeQuerySelectorAll(el).call(el, 'script'));
}

export function isNumberOrEmailInput (el): boolean {
    return isInputElement(el) && NUMBER_OR_EMAIL_INPUT_RE.test(el.type);
}

export function isInputWithoutSelectionProperties (el): boolean {
    if (!isNumberOrEmailInput(el))
        return false;

    const hasSelectionProperties = isNumber(el.selectionStart) && isNumber(el.selectionEnd);

    return !hasSelectionProperties;
}

export function getAssociatedElement (el: HTMLElement): HTMLElement | null {
    if (!isLabelElement(el))
        return null;

    const doc = findDocument(el);

    return el.control || el.htmlFor && nativeMethods.getElementById.call(doc, el.htmlFor);
}
