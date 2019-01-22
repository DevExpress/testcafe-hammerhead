import INTERNAL_ATTRS from '../../processing/dom/internal-attributes';
import INTERNAL_PROPS from '../../processing/dom/internal-properties';
import SHADOW_UI_CLASSNAME from '../../shadow-ui/class-name';
import nativeMethods from '../sandbox/native-methods';
import * as urlUtils from './url';
import { get as getStyle } from './style';
import { sameOriginCheck } from './destination-location';
import { isFirefox, isWebKit, isIE, isMSEdge, isSafari } from './browser';
import { getNativeQuerySelectorAll } from './query-selector';
import { instanceAndPrototypeToStringAreEqual } from '../utils/feature-detection';

let scrollbarSize = null;

const NATIVE_MAP_ELEMENT_STRINGS = [
    '[object HTMLMapElement]',
    '[object HTMLAreaElement]'
];

const NATIVE_WINDOW_STR                = instanceToString(window);
const IS_DOCUMENT_RE                   = /^\[object .*?Document]$/i;
const IS_PROCESSING_INSTRUCTION_RE     = /^\[object .*?ProcessingInstruction]$/i;
const IS_SVG_ELEMENT_RE                = /^\[object SVG\w+?Element]$/i;
const IS_HTML_ELEMENT_RE               = /^\[object HTML.*?Element]$/i;
const IS_ARRAY_BUFFER_RE               = /^\[object ArrayBuffer]$/i;
const IS_DATA_VIEW_RE                  = /^\[object DataView]$/i;
const NATIVE_TABLE_CELL_STR            = instanceToString(nativeMethods.createElement.call(document, 'td'));
const ELEMENT_NODE_TYPE                = Node.ELEMENT_NODE;
const NOT_CONTENT_EDITABLE_ELEMENTS_RE = /^(select|option|applet|area|audio|canvas|datalist|keygen|map|meter|object|progress|source|track|video|img)$/;
const INPUT_ELEMENTS_RE                = /^(input|textarea|button)$/;
const SCRIPT_OR_STYLE_RE               = /^(script|style)$/i;
const EDITABLE_INPUT_TYPES_RE          = /^(email|number|password|search|tel|text|url)$/;

function getFocusableSelector () {
    // NOTE: We don't take into account the case of embedded contentEditable elements, and we
    // specify the contentEditable attribute for focusable elements.
    return 'input, select, textarea, button, body, iframe, [contenteditable="true"], [contenteditable=""], [tabIndex]';
}

function isHidden (el: HTMLElement) {
    return el.offsetWidth <= 0 && el.offsetHeight <= 0;
}

function isAlwaysNotEditableElement (el: HTMLElement) {
    const tagName = getTagName(el);

    return tagName && (NOT_CONTENT_EDITABLE_ELEMENTS_RE.test(tagName) || INPUT_ELEMENTS_RE.test(tagName));
}

function closestFallback (el: Node, selector: string) {
    while (el) {
        if (matches(el, selector))
            return el;

        el = el.parentNode;
    }

    return null;
}

export function instanceToString (instance): string {
    if (!instanceAndPrototypeToStringAreEqual)
        return nativeMethods.objectToString.call(instance);

    return instance && typeof instance === 'object'
        ? nativeMethods.objectToString.call(nativeMethods.objectGetPrototypeOf(instance))
        : '';
}

export function getActiveElement (currentDocument?: Document) {
    // NOTE: Sometimes document.activeElement returns an empty object or null (IE11).
    // https://github.com/DevExpress/testcafe-hammerhead/issues/768
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
        srcLocation:      parsedProxySrcLocation ? parsedProxySrcLocation.destUrl : srcLocation
    };
}

export function getFrameElement (win: Window) {
    try {
        return win.frameElement;
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

export function getParentWindowWithSrc (window: Window) {
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
        scrollDiv.parentNode.removeChild(scrollDiv);
    }

    return scrollbarSize;
}

export function getSelectParent (child) {
    return closest(child.parentNode, 'select');
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

export function findDocument (el): Document {
    if (el.documentElement)
        return el;

    if (el.ownerDocument && el.ownerDocument.defaultView)
        return el.ownerDocument;

    return el.parentNode ? findDocument(el.parentNode) : document;
}

export function isContentEditableElement (el: Node) {
    let isContentEditable = false;
    let element           = null;

    if (isTextNode(el))
        element = el.parentElement || el.parentNode;
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

export function isDomElement (el): boolean {
    if (el instanceof nativeMethods.elementClass)
        return true;

    return el && IS_HTML_ELEMENT_RE.test(instanceToString(el)) && isElementNode(el) && el.tagName;
}

export function getTagName (el): string {
    // NOTE: Check for tagName being a string, because it may be a function in an Angular app (T175340).
    return el && typeof el.tagName === 'string' ? el.tagName.toLowerCase() : '';
}

export function isElementInDocument (el, currentDocument?: Document): boolean {
    const doc = currentDocument || document;

    return doc.documentElement.contains(el);
}

export function isElementInIframe (el: HTMLElement, currentDocument?: Document): boolean {
    const doc = currentDocument || findDocument(el);

    return window.document !== doc;
}

export function isHammerheadAttr (attr): boolean {
    return attr === INTERNAL_ATTRS.focusPseudoClass || attr === INTERNAL_ATTRS.hoverPseudoClass ||
           attr.indexOf(INTERNAL_ATTRS.storedAttrPostfix) !== -1;
}

export function isIframeElement (el): boolean {
    return instanceToString(el) === '[object HTMLIFrameElement]';
}

export function isIframeWithoutSrc (iframe): boolean {
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

export function isImgElement (el): boolean {
    return instanceToString(el) === '[object HTMLImageElement]';
}

export function isInputElement (el): boolean {
    return instanceToString(el) === '[object HTMLInputElement]';
}

export function isButtonElement (el): boolean {
    return instanceToString(el) === '[object HTMLButtonElement]';
}

export function isHtmlElement (el): boolean {
    return instanceToString(el) === '[object HTMLHtmlElement]';
}

export function isBodyElement (el): boolean {
    return instanceToString(el) === '[object HTMLBodyElement]';
}

export function isHeadElement (el): boolean {
    return instanceToString(el) === '[object HTMLHeadElement]';
}

export function isHeadOrBodyElement (el): boolean {
    const elString = instanceToString(el);

    return elString === '[object HTMLHeadElement]' || elString === '[object HTMLBodyElement]';
}

export function isBaseElement (el): boolean {
    return instanceToString(el) === '[object HTMLBaseElement]';
}

export function isScriptElement (el): boolean {
    return instanceToString(el) === '[object HTMLScriptElement]';
}

export function isStyleElement (el): boolean {
    return instanceToString(el) === '[object HTMLStyleElement]';
}

export function isLabelElement (el): boolean {
    return instanceToString(el) === '[object HTMLLabelElement]';
}

export function isTextAreaElement (el): boolean {
    return instanceToString(el) === '[object HTMLTextAreaElement]';
}

export function isOptionElement (el): boolean {
    return instanceToString(el) === '[object HTMLOptionElement]';
}

export function isSelectElement (el): boolean {
    return instanceToString(el) === '[object HTMLSelectElement]';
}

export function isFormElement (el): boolean {
    return instanceToString(el) === '[object HTMLFormElement]';
}

export function isFileInput (el): boolean {
    return isInputElement(el) && el.type.toLowerCase() === 'file';
}

export function isBodyElementWithChildren (el): boolean {
    return isBodyElement(el) && nativeMethods.htmlCollectionLengthGetter.call(el.children);
}

export function isMapElement (el): boolean {
    return NATIVE_MAP_ELEMENT_STRINGS.indexOf(instanceToString(el)) !== -1;
}

export function isRenderedNode (node): boolean {
    return !(isProcessingInstructionNode(node) || isCommentNode(node) || SCRIPT_OR_STYLE_RE.test(node.nodeName));
}

export function getTabIndex (el) {
    // NOTE: we obtain the tabIndex value from an attribute because the el.tabIndex
    // property returns -1 for some elements (e.g. for body) with no tabIndex assigned
    let tabIndex = nativeMethods.getAttribute.call(el, 'tabIndex');

    tabIndex = parseInt(tabIndex, 10);

    return isNaN(tabIndex) ? null : tabIndex;
}

export function isElementFocusable (el): boolean {
    if (!el)
        return false;

    const tabIndex              = getTabIndex(el);
    const isDisabledElement     = matches(el, ':disabled');
    const isInvisibleElement    = getStyle(el, 'visibility') === 'hidden';
    const isNotDisplayedElement = getStyle(el, 'display') === 'none';
    const isHiddenElement       = isWebKit ? isHidden(el) && !isOptionElement(el) : isHidden(el);

    if (isDisabledElement || isInvisibleElement || isNotDisplayedElement || isHiddenElement)
        return false;

    if (isOptionElement(el) && isIE)
        return false;

    if (isAnchorElement(el)) {
        if (tabIndex !== null)
            return true;

        return matches(el, 'a[href]');
    }

    if (isTableDataCellElement(el) && isIE)
        return true;

    return matches(el, getFocusableSelector()) || tabIndex !== null;
}

export function isShadowUIElement (element): boolean {
    return !!element[INTERNAL_PROPS.shadowUIElement];
}

export function isWindow (instance): boolean {
    if (instance instanceof nativeMethods.windowClass)
        return true;

    try {
        // NOTE: The instanceToString call result has a strange values for the MessageEvent.target property:
        // * [object DispHTMLWindow2] for IE11
        // * [object Object] for MSEdge.
        if ((isIE || isMSEdge) && instance && instance === instance.window)
            instance = instance.window;

        return instance && instance.toString && NATIVE_WINDOW_STR === instanceToString(instance);
    }
    catch (e) {
        try {
            // NOTE: If a cross-domain object has the 'top' field, this object is a window
            // (not a document or location).
            return !!instance.top;
        }
        catch (x) {
            return false;
        }
    }
}

export function isDocument (instance): boolean {
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

export function isBlob (instance): boolean {
    return instance && instanceToString(instance) === '[object Blob]';
}

export function isLocation (instance): boolean {
    if (!instance)
        return false;

    if (isIE || isSafari) {
        let instanceCtor = null;

        try {
            // eslint-disable-next-line no-proto
            instanceCtor = instance.__proto__ && instance.__proto__.constructor;
        }
        catch (e) {
            // NOTE: Try to detect cross-domain window location.
            // A cross-domain location has no the "assign" function in Safari.
            return instance.replace && (isSafari || !!instance.assign);
        }

        if (instanceCtor) {
            let toStringMeth = null;

            if (typeof instanceCtor === 'object')
                toStringMeth = nativeMethods.objectToString;
            else if (typeof instanceCtor === 'function')
                toStringMeth = nativeMethods.functionToString;

            return toStringMeth && toStringMeth.call(instanceCtor).indexOf('Location') > -1;
        }

        return false;
    }

    return instance instanceof nativeMethods.locationClass ||
           nativeMethods.objectToString.call(instance) === '[object Location]';
}

export function isSVGElement (instance): boolean {
    if (instance instanceof nativeMethods.svgElementClass)
        return true;

    return instance && IS_SVG_ELEMENT_RE.test(instanceToString(instance));
}

export function isSVGElementOrChild (el): boolean {
    return !!closest(el, 'svg');
}

export function isFetchHeaders (instance): boolean {
    if (nativeMethods.Headers && instance instanceof nativeMethods.Headers)
        return true;

    return instance && instanceToString(instance) === '[object Headers]';
}

export function isFetchRequest (instance): boolean {
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

export function isTextNode (node): boolean {
    return instanceToString(node) === '[object Text]';
}

export function isProcessingInstructionNode (node): boolean {
    return IS_PROCESSING_INSTRUCTION_RE.test(instanceToString(node));
}

export function isCommentNode (node): boolean {
    return instanceToString(node) === '[object Comment]';
}

export function isDocumentFragmentNode (node): boolean {
    return instanceToString(node) === '[object DocumentFragment]';
}

export function isShadowRoot (root): boolean {
    return instanceToString(root) === '[object ShadowRoot]';
}

export function isAnchorElement (el): boolean {
    return instanceToString(el) === '[object HTMLAnchorElement]';
}

export function isTableElement (el): boolean {
    return instanceToString(el) === '[object HTMLTableElement]';
}

export function isTableDataCellElement (el): boolean {
    return instanceToString(el) === NATIVE_TABLE_CELL_STR;
}

export function isWebSocket (ws): boolean {
    return instanceToString(ws) === '[object WebSocket]';
}

export function isMessageEvent (e): boolean {
    return instanceToString(e) === '[object MessageEvent]';
}

export function isPerformanceNavigationTiming (entry): boolean {
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
    // eslint-disable-next-line no-restricted-properties
    let parent = el.parentNode || el.host;

    const parents = [];

    while (parent) {
        if (!selector && isElementNode(parent) ||
            selector && matches(parent, selector))
            parents.push(parent);

        // eslint-disable-next-line no-restricted-properties
        parent = parent.parentNode || parent.host;
    }

    return parents;
}

export function findParent (node, includeSelf = false, predicate) {
    if (!includeSelf)
        node = node.parentNode;

    while (node) {
        if (typeof predicate !== 'function' || predicate(node))
            return node;

        node = node.parentNode;
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
