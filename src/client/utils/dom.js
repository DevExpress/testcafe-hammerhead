import INTERNAL_ATTRS from '../../processing/dom/internal-attributes';
import INTERNAL_PROPS from '../../processing/dom/internal-properties';
import SHADOW_UI_CLASSNAME from '../../shadow-ui/class-name';
import nativeMethods from '../sandbox/native-methods';
import * as urlUtils from './url';
import { get as getStyle } from './style';
import { sameOriginCheck } from './destination-location';
import { isFirefox, isWebKit, isIE, version as browserVersion } from './browser';
import trim from '../../utils/string-trim';
import getNativeQuerySelectorAll from './get-native-query-selector-all';
import { instanceAndPrototypeToStringAreEqual } from '../utils/feature-detection';

// NOTE: We should avoid using native object prototype methods,
// since they can be overriden by the client code. (GH-245)
const arraySlice = Array.prototype.slice;

let scrollbarSize = null;

/*eslint-disable no-restricted-globals*/
const NATIVE_ELEMENT_PROTOTYPE_STRINGS = [
    instanceToString(nativeMethods.elementClass.prototype),
    instanceToString(Object.getPrototypeOf(nativeMethods.elementClass.prototype))
];
/*eslint-enable no-restricted-globals*/

const NATIVE_MAP_ELEMENT_STRINGS = [
    '[object HTMLMapElement]',
    '[object HTMLAreaElement]'
];

const NATIVE_WINDOW_STR     = instanceToString(window);
const NATIVE_DOCUMENT_STR   = instanceToString(document);
const IS_SVG_ELEMENT_RE     = /^\[object SVG\w+?Element]$/i;
const NATIVE_TABLE_CELL_STR = instanceToString(nativeMethods.createElement.call(document, 'td'));


function getFocusableSelector () {
    // NOTE: We don't take into account the case of embedded contentEditable elements, and we
    // specify the contentEditable attribute for focusable elements.
    return 'input, select, textarea, button, body, iframe, [contenteditable="true"], [contenteditable=""], [tabIndex]';
}

function isHidden (el) {
    return el.offsetWidth <= 0 && el.offsetHeight <= 0;
}

function isAlwaysNotEditableElement (el) {
    const tagName                          = getTagName(el);
    const notContentEditableElementsRegExp = /select|option|applet|area|audio|canvas|datalist|keygen|map|meter|object|progress|source|track|video|img/;
    const inputElementsRegExp              = /input|textarea|button/;

    return tagName && (notContentEditableElementsRegExp.test(tagName) || inputElementsRegExp.test(tagName));
}

function closestFallback (el, selector) {
    while (el) {
        if (matches(el, selector))
            return el;

        el = el.parentNode;
    }

    return null;
}

function addClassFallback (el, className) {
    if (className) {
        const classNames = className.split(/\s+/);
        let setClass     = ' ' + el.className + ' ';

        for (const currentClassName of classNames) {
            if (setClass.indexOf(' ' + currentClassName + ' ') === -1)
                setClass += currentClassName + ' ';
        }

        el.className = trim(setClass);
    }
}

function removeClassFallback (el, className) {
    if (el.className && className) {
        const classNames = (className || '').split(/\s+/);

        className = (' ' + el.className + ' ').replace(/[\n\t\r]/g, ' ');

        for (let i = 0; i < classNames.length; i++)
            className = className.replace(' ' + classNames[i] + ' ', ' ');

        el.className = trim(className);
    }
}

function hasClassFallback (el, className) {
    const preparedElementClassName = (' ' + el.className + ' ').replace(/[\n\t\r]/g, ' ');

    className = ' ' + className + ' ';

    return preparedElementClassName.indexOf(className) !== -1;
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
    const doc = currentDocument || document;

    let el = isDomElement(doc.activeElement) ? doc.activeElement : doc.body;

    while (el && el.shadowRoot) {
        const shadowEl = el.shadowRoot.activeElement;

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
        documentLocation = iframe.contentDocument.location.href;
    }
    catch (e) {
        documentLocation = null;
    }

    const srcLocation = nativeMethods.getAttribute.call(iframe, 'src' + INTERNAL_ATTRS.storedAttrPostfix) ||
                        nativeMethods.getAttribute.call(iframe, 'src') || iframe.src;

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
        isContentEditable = element.isContentEditable && !isAlwaysNotEditableElement(element) &&
                            !isTextEditableElement(element);
    }

    return isRenderedNode(element) && (isContentEditable || findDocument(el).designMode === 'on');
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

    // NOTE: T184805
    if (el && NATIVE_ELEMENT_PROTOTYPE_STRINGS.indexOf(instanceToString(el)) !== -1)
        return false;

    // NOTE: B252941
    return el && !isDocumentFragmentNode(el) && typeof el.nodeName === 'string' && el.tagName;
}

export function getTagName (el) {
    // NOTE: Check for tagName being a string, because it may be a function in an Angular app (T175340).
    return el && typeof el.tagName === 'string' ? el.tagName.toLowerCase() : '';
}

export function getNodeType (node) {
    return node && node.nodeType;
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

    if (iframeDocumentLocation === null) // is a cross-domain iframe
        return false;

    const iframeDocumentLocationHaveSupportedProtocol = urlUtils.isSupportedProtocol(iframeDocumentLocation);

    // NOTE: When an iframe has an empty src attribute (<iframe src></iframe>) or has no src attribute (<iframe></iframe>),
    // the iframe.src property is not empty but has different values in different browsers.
    // Its document location is 'about:blank'. Therefore, we should check the src attribute.
    if (!iframeDocumentLocationHaveSupportedProtocol && !(iframe.attributes['src'] && iframe.attributes['src'].value))
        return true;

    const parentWindowWithSrc        = getParentWindowWithSrc(iframe.contentWindow);
    const parsedParentWindowLocation = urlUtils.parseProxyUrl(parentWindowWithSrc.location.toString());
    const parentWindowLocation       = parsedParentWindowLocation ? parsedParentWindowLocation.destUrl : parentWindowWithSrc.location.toString();

    if (iframeDocumentLocationHaveSupportedProtocol) {
        // NOTE: In IE, after document.open is called for a same-domain iframe or an iframe with a javascript src,
        // the iframe window location becomes equal to the location of the parent window with src.
        const parsedIframeSrcLocation = urlUtils.isSupportedProtocol(iframeSrcLocation) ? urlUtils.parseUrl(iframeSrcLocation)
            : null;

        if (parsedIframeSrcLocation && parsedIframeSrcLocation.partAfterHost &&
            iframeDocumentLocation === parentWindowLocation)
            return false;

        return iframeDocumentLocation === parentWindowLocation;
    }

    if (iframeSrcLocation === parentWindowLocation)
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
    return !(isProcessingInstructionNode(node) || isCommentNode(node) || /^(script|style)$/i.test(node.nodeName));
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

        return isIE && browserVersion < 11 ?
               matches(el, 'a[href]:not([href = ""])') :
               matches(el, 'a[href]');
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
        return instance && NATIVE_DOCUMENT_STR === instanceToString(instance);
    }
    catch (e) {
        // NOTE: For cross-domain objects (windows, documents or locations), we return false because
        // it's impossible to work with them in any case.
        return false;
    }
}

export function isXMLHttpRequest (instance) {
    return instance && (instance instanceof XMLHttpRequest || instanceToString(instance) === '[object XMLHttpRequest]');
}

export function isBlob (instance) {
    return instance && instanceToString(instance) === '[object Blob]';
}

export function isLocation (instance) {
    if (instance instanceof nativeMethods.locationClass)
        return true;

    try {
        return instance && typeof instance === 'object' && instance.href !== void 0 && instance.assign !== void 0;
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
    const editableInputTypesRegEx = /^(email|number|password|search|tel|text|url)$/;
    const attrType                = el.getAttribute('type');

    return isInputElement(el) &&
           attrType ? editableInputTypesRegEx.test(attrType) : editableInputTypesRegEx.test(el.type);
}

export function isTextEditableElement (el) {
    return isTextEditableInput(el) || isTextAreaElement(el);
}

export function isTextEditableElementAndEditingAllowed (el) {
    return isTextEditableElement(el) && !isElementReadOnly(el);
}

export function isElementNode (node) {
    return getNodeType(node) === 1;
}

export function isTextNode (node) {
    return getNodeType(node) === 3;
}

export function isProcessingInstructionNode (node) {
    return getNodeType(node) === 7;
}

export function isCommentNode (node) {
    return getNodeType(node) === 8;
}

export function isDocumentNode (node) {
    return getNodeType(node) === 9;
}

export function isDocumentFragmentNode (el) {
    return getNodeType(el) === 11;
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

export function matches (el, selector) {
    if (!el)
        return false;

    const matchesSelector = el.matches || el.webkitMatchesSelector || el.msMatchesSelector;

    if (!matchesSelector)
        return false;

    return matchesSelector.call(el, selector);
}

export function closest (el, selector) {
    if (el && el.closest)
        return el.closest(selector);

    return closestFallback(el, selector);
}

export function addClass (el, className) {
    if (!el)
        return;

    // NOTE: IE10+
    if (el && el.classList) {
        const classNames = className.split(/\s+/);

        for (const currentClassName of classNames)
            el.classList.add(currentClassName);
    }
    else
        addClassFallback(el, className);
}

export function removeClass (el, className) {
    if (!el)
        return;

    // NOTE: IE10+
    if (el.classList) {
        const classNames = className.split(/\s+/);

        for (const currentClassName of classNames)
            el.classList.remove(currentClassName);
    }
    else
        removeClassFallback(el, className);
}

export function hasClass (el, className) {
    if (!el)
        return false;

    // NOTE: IE10+
    if (el.classList)
        return el.classList.contains(className);

    return hasClassFallback(el, className);
}

export function parseDocumentCharset () {
    const metaCharset = nativeMethods.querySelector.call(document, '.' + SHADOW_UI_CLASSNAME.charset);

    return metaCharset && metaCharset.getAttribute('charset');
}

export function getParents (el, selector) {
    let parent  = el.parentNode;
    const parents = [];

    while (parent) {
        if (isElementNode(parent) && !selector || selector && matches(parent, selector))
            parents.push(parent);

        parent = parent.parentNode;
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
