import INTERNAL_ATTRS from '../../processing/dom/internal-attributes';
import INTERNAL_PROPS from '../../processing/dom/internal-properties';
import SHADOW_UI_CLASSNAME from '../../shadow-ui/class-name';
import nativeMethods from '../sandbox/native-methods';
import * as urlUtils from './url';
import { get as getStyle } from './style';
import { sameOriginCheck } from './destination-location';
import { isFirefox, isWebKit, isIE, isMSEdge } from './browser';
import { getNativeQuerySelectorAll } from './query-selector';
import { instanceAndPrototypeToStringAreEqual } from '../utils/feature-detection';

// NOTE: We should avoid using native object prototype methods,
// since they can be overriden by the client code. (GH-245)
const arraySlice = Array.prototype.slice;

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

function isHidden (el) {
    return el.offsetWidth <= 0 && el.offsetHeight <= 0;
}

function isAlwaysNotEditableElement (el) {
    const tagName = getTagName(el);

    return tagName && (NOT_CONTENT_EDITABLE_ELEMENTS_RE.test(tagName) || INPUT_ELEMENTS_RE.test(tagName));
}

function closestFallback (el, selector) {
    while (el) {
        if (matches(el, selector))
            return el;

        el = el.parentNode;
    }

    return null;
}

export function instanceToString (instance) {
    if (!instanceAndPrototypeToStringAreEqual)
        return nativeMethods.objectToString.call(instance);

    /*eslint-disable no-restricted-globals*/
    return instance && typeof instance === 'object'
        ? nativeMethods.objectToString.call(Object.getPrototypeOf(instance))
        : '';
    /*eslint-enable no-restricted-globals*/
}

export function getActiveElement (currentDocument) {
    // NOTE: Sometimes document.activeElement returns an empty object or null (IE11).
    // https://github.com/DevExpress/testcafe-hammerhead/issues/768
    const doc           = currentDocument || document;
    const activeElement = nativeMethods.documentActiveElementGetter.call(doc);

    let el = isDomElement(activeElement) ? activeElement : doc.body;

    while (el && el.shadowRoot) {
        /*eslint-disable no-restricted-properties*/
        const shadowEl = el.shadowRoot.activeElement;
        /*eslint-enable no-restricted-properties*/

        if (!shadowEl)
            break;

        el = shadowEl;
    }

    return el;
}

export function getChildVisibleIndex (select, child) {
    const childrenArray = getSelectVisibleChildren(select);

    return childrenArray.indexOf(child);
}

export function getIframeByElement (el) {
    const elWindow = el[INTERNAL_PROPS.processedContext];

    return getFrameElement(elWindow);
}

export function getIframeLocation (iframe) {
    let documentLocation = null;

    try {
        /*eslint-disable no-restricted-properties*/
        documentLocation = iframe.contentDocument.location.href;
        /*eslint-enable no-restricted-properties*/
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

export function getFrameElement (win) {
    try {
        return win.frameElement;
    }
    catch (e) {
        return null;
    }
}

export function getMapContainer (el) {
    const closestMap        = closest(el, 'map');
    const closestMapName    = nativeMethods.getAttribute.call(closestMap, 'name');
    const containerSelector = '[usemap="#' + closestMapName + '"]';

    return nativeMethods.querySelector.call(findDocument(el), containerSelector);
}

export function getParentWindowWithSrc (window) {
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

export function getSelectVisibleChildren (select) {
    let children = nativeMethods.elementQuerySelectorAll.call(select, 'optgroup, option');

    children = arraySlice.call(children);

    // NOTE: Firefox does not display groups without a label and with an empty label.
    if (isFirefox) {
        const filtered = [];

        for (const child of children) {
            if (getTagName(child) !== 'optgroup' || !!child.label)
                filtered.push(child);
        }

        children = filtered;
    }

    return children;
}

export function getTopSameDomainWindow (window) {
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

export function find (parent, selector, handler) {
    const elms = getNativeQuerySelectorAll(parent).call(parent, selector);

    if (handler) {
        for (const elm of elms)
            handler(elm);
    }

    return elms;
}

export function findDocument (el) {
    if (el.documentElement)
        return el;

    if (el.ownerDocument && el.ownerDocument.defaultView)
        return el.ownerDocument;

    return el.parentNode ? findDocument(el.parentNode) : document;
}

export function isContentEditableElement (el) {
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

export function isCrossDomainIframe (iframe, bySrc) {
    const iframeLocation = getIframeLocation(iframe);

    if (!bySrc && iframeLocation.documentLocation === null)
        return true;

    const currentLocation = bySrc ? iframeLocation.srcLocation : iframeLocation.documentLocation;

    if (currentLocation && urlUtils.isSupportedProtocol(currentLocation))
        return !sameOriginCheck(location.toString(), currentLocation);

    return false;
}

export function isCrossDomainWindows (window1, window2) {
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

export function isDomElement (el) {
    if (el instanceof nativeMethods.elementClass)
        return true;

    return el && IS_HTML_ELEMENT_RE.test(instanceToString(el)) && isElementNode(el) && el.tagName;
}

export function getTagName (el) {
    // NOTE: Check for tagName being a string, because it may be a function in an Angular app (T175340).
    return el && typeof el.tagName === 'string' ? el.tagName.toLowerCase() : '';
}

export function isElementInDocument (el, currentDocument) {
    const doc = currentDocument || document;

    return doc.documentElement.contains(el);
}

export function isElementInIframe (el, currentDocument) {
    const doc = currentDocument || findDocument(el);

    return window.document !== doc;
}

export function isHammerheadAttr (attr) {
    return attr === INTERNAL_ATTRS.focusPseudoClass || attr === INTERNAL_ATTRS.hoverPseudoClass ||
           attr.indexOf(INTERNAL_ATTRS.storedAttrPostfix) !== -1;
}

export function isIframeElement (el) {
    return instanceToString(el) === '[object HTMLIFrameElement]';
}

export function isIframeWithoutSrc (iframe) {
    const iframeLocation         = getIframeLocation(iframe);
    const iframeSrcLocation      = iframeLocation.srcLocation;
    const iframeDocumentLocation = iframeLocation.documentLocation;

    // NOTE: is a cross-domain iframe
    if (iframeDocumentLocation === null)
        return false;

    // NOTE: after 'document.write' or 'document.open' call for iframe with/without src
    // we will process it as iframe without src
    if (iframe.contentWindow[INTERNAL_PROPS.documentWasCleaned])
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

export function isImgElement (el) {
    return instanceToString(el) === '[object HTMLImageElement]';
}

export function isInputElement (el) {
    return instanceToString(el) === '[object HTMLInputElement]';
}

export function isButtonElement (el) {
    return instanceToString(el) === '[object HTMLButtonElement]';
}

export function isHtmlElement (el) {
    return instanceToString(el) === '[object HTMLHtmlElement]';
}

export function isBodyElement (el) {
    return instanceToString(el) === '[object HTMLBodyElement]';
}

export function isHeadElement (el) {
    return instanceToString(el) === '[object HTMLHeadElement]';
}

export function isBaseElement (el) {
    return instanceToString(el) === '[object HTMLBaseElement]';
}

export function isScriptElement (el) {
    return instanceToString(el) === '[object HTMLScriptElement]';
}

export function isStyleElement (el) {
    return instanceToString(el) === '[object HTMLStyleElement]';
}

export function isLabelElement (el) {
    return instanceToString(el) === '[object HTMLLabelElement]';
}

export function isTextAreaElement (el) {
    return instanceToString(el) === '[object HTMLTextAreaElement]';
}

export function isOptionElement (el) {
    return instanceToString(el) === '[object HTMLOptionElement]';
}

export function isSelectElement (el) {
    return instanceToString(el) === '[object HTMLSelectElement]';
}

export function isFormElement (el) {
    return instanceToString(el) === '[object HTMLFormElement]';
}

export function isFileInput (el) {
    return isInputElement(el) && el.type.toLowerCase() === 'file';
}

export function isBodyElementWithChildren (el) {
    return isBodyElement(el) && el.children.length;
}

export function isMapElement (el) {
    return NATIVE_MAP_ELEMENT_STRINGS.indexOf(instanceToString(el)) !== -1;
}

export function isRenderedNode (node) {
    return !(isProcessingInstructionNode(node) || isCommentNode(node) || SCRIPT_OR_STYLE_RE.test(node.nodeName));
}

export function getTabIndex (el) {
    // NOTE: we obtain the tabIndex value from an attribute because the el.tabIndex
    // property returns -1 for some elements (e.g. for body) with no tabIndex assigned
    let tabIndex = nativeMethods.getAttribute.call(el, 'tabIndex');

    tabIndex = parseInt(tabIndex, 10);

    return isNaN(tabIndex) ? null : tabIndex;
}

export function isElementFocusable (el) {
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

export function isShadowUIElement (element) {
    return !!element[INTERNAL_PROPS.shadowUIElement];
}

export function isWindow (instance) {
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

export function isDocument (instance) {
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

export function isBlob (instance) {
    return instance && instanceToString(instance) === '[object Blob]';
}

export function isLocation (instance) {
    if (instance instanceof nativeMethods.locationClass)
        return true;

    try {
        /*eslint-disable no-restricted-properties*/
        return instance && typeof instance === 'object' && instance.href !== void 0 && instance.assign !== void 0;
        /*eslint-enable no-restricted-properties*/
    }
    catch (e) {
        // NOTE: Try to detect cross-domain window location.
        return instance.replace && instance.assign;
    }
}

export function isSVGElement (instance) {
    if (instance instanceof nativeMethods.svgElementClass)
        return true;

    return instance && IS_SVG_ELEMENT_RE.test(instanceToString(instance));
}

export function isSVGElementOrChild (el) {
    return !!closest(el, 'svg');
}

export function isFetchHeaders (instance) {
    if (nativeMethods.Headers && instance instanceof nativeMethods.Headers)
        return true;

    return instance && instanceToString(instance) === '[object Headers]';
}

export function isFetchRequest (instance) {
    if (nativeMethods.Request && instance instanceof nativeMethods.Request)
        return true;

    return instance && instanceToString(instance) === '[object Request]';
}

export function isElementReadOnly (el) {
    return el.readOnly || el.getAttribute('readonly') === 'readonly';
}

export function isTextEditableInput (el) {
    const attrType = el.getAttribute('type');

    return isInputElement(el) &&
           attrType ? EDITABLE_INPUT_TYPES_RE.test(attrType) : EDITABLE_INPUT_TYPES_RE.test(el.type);
}

export function isTextEditableElement (el) {
    return isTextEditableInput(el) || isTextAreaElement(el);
}

export function isTextEditableElementAndEditingAllowed (el) {
    return isTextEditableElement(el) && !isElementReadOnly(el);
}

export function isElementNode (node) {
    return node && node.nodeType === ELEMENT_NODE_TYPE;
}

export function isTextNode (node) {
    return instanceToString(node) === '[object Text]';
}

export function isProcessingInstructionNode (node) {
    return IS_PROCESSING_INSTRUCTION_RE.test(instanceToString(node));
}

export function isCommentNode (node) {
    return instanceToString(node) === '[object Comment]';
}

export function isDocumentFragmentNode (node) {
    return instanceToString(node) === '[object DocumentFragment]';
}

export function isShadowRoot (root) {
    return instanceToString(root) === '[object ShadowRoot]';
}

export function isAnchorElement (el) {
    return instanceToString(el) === '[object HTMLAnchorElement]';
}

export function isTableElement (el) {
    return instanceToString(el) === '[object HTMLTableElement]';
}

export function isTableDataCellElement (el) {
    return instanceToString(el) === NATIVE_TABLE_CELL_STR;
}

export function isWebSocket (ws) {
    return instanceToString(ws) === '[object WebSocket]';
}

export function isMessageEvent (e) {
    return instanceToString(e) === '[object MessageEvent]';
}

export function isPerformanceNavigationTiming (entry) {
    return instanceToString(entry) === '[object PerformanceNavigationTiming]';
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
        el.classList.add(currentClassName);
}

export function removeClass (el, className) {
    if (!el)
        return;

    const classNames = className.split(/\s+/);

    for (const currentClassName of classNames)
        el.classList.remove(currentClassName);
}

export function hasClass (el, className) {
    if (!el)
        return false;

    return el.classList.contains(className);
}

export function parseDocumentCharset () {
    const metaCharset = nativeMethods.querySelector.call(document, '.' + SHADOW_UI_CLASSNAME.charset);

    return metaCharset && metaCharset.getAttribute('charset');
}

export function getParents (el, selector) {
    /*eslint-disable no-restricted-properties*/
    let parent = el.parentNode || el.host;
    /*eslint-enable no-restricted-properties*/

    const parents = [];

    while (parent) {
        if (!selector && isElementNode(parent) ||
            selector && matches(parent, selector))
            parents.push(parent);

        /*eslint-disable no-restricted-properties*/
        parent = parent.parentNode || parent.host;
        /*eslint-enable no-restricted-properties*/
    }

    return parents;
}

export function getFileInputs (el) {
    return isFileInput(el) ? [el] : getNativeQuerySelectorAll(el).call(el, 'input[type=file]');
}

export function getIframes (el) {
    return isIframeElement(el) ? [el] : getNativeQuerySelectorAll(el).call(el, 'iframe,frame');
}

export function getScripts (el) {
    return isScriptElement(el) ? [el] : getNativeQuerySelectorAll(el).call(el, 'script');
}
