import INTERNAL_ATTRS from '../../processing/dom/internal-attributes';
import INTERNAL_PROPS from '../../processing/dom/internal-properties';
import SHADOW_UI_CLASSNAME from '../../shadow-ui/class-name';
import nativeMethods from '../sandbox/native-methods';
import * as urlUtils from './url';
import { sameOriginCheck } from './destination-location';
import { isFirefox, isWebKit, isIE } from './browser';
import trim from '../../utils/string-trim';
import getNativeQuerySelectorAll from './get-native-query-selector-all';

// NOTE: We should avoid using native object prototype methods,
// since they can be overriden by the client code. (GH-245)
var arraySlice = Array.prototype.slice;

var scrollbarSize = null;

function getFocusableSelector () {
    // NOTE: We don't take into account the case of embedded contentEditable elements, and we
    // specify the contentEditable attribute for focusable elements.
    var selectorPostfix = 'input, select, textarea, button, [contenteditable="true"], [contenteditable=""], [tabIndex]';

    if (isIE)
        return 'a[href]:not([href = ""]), iframe, ' + selectorPostfix;

    return 'a[href], iframe, ' + selectorPostfix;
}

function isHidden (el) {
    return el.offsetWidth <= 0 && el.offsetHeight <= 0;
}

function isAlwaysNotEditableElement (el) {
    var tagName                          = getTagName(el);
    var notContentEditableElementsRegExp = /select|option|applet|area|audio|canvas|datalist|keygen|map|meter|object|progress|source|track|video|img/;
    var inputElementsRegExp              = /input|textarea|button/;

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
        var classNames = className.split(/\s+/);
        var setClass   = ' ' + el.className + ' ';

        for (var i = 0; i < classNames.length; i++) {
            if (setClass.indexOf(' ' + classNames[i] + ' ') === -1)
                setClass += classNames[i] + ' ';
        }

        el.className = trim(setClass);
    }
}

function removeClassFallback (el, className) {
    if (el.className && className) {
        var classNames = (className || '').split(/\s+/);

        className = (' ' + el.className + ' ').replace(/[\n\t\r]/g, ' ');

        for (var i = 0; i < classNames.length; i++)
            className = className.replace(' ' + classNames[i] + ' ', ' ');

        el.className = trim(className);
    }
}

function hasClassFallback (el, className) {
    var preparedElementClassName = (' ' + el.className + ' ').replace(/[\n\t\r]/g, ' ');

    className = ' ' + className + ' ';

    return preparedElementClassName.indexOf(className) !== -1;
}

export function getActiveElement (currentDocument) {
    var doc = currentDocument || document;


    return isDomElement(doc.activeElement) ? doc.activeElement : doc.body;
}

export function getChildVisibleIndex (select, child) {
    var childrenArray = getSelectVisibleChildren(select);

    return childrenArray.indexOf(child);
}

export function getIframeByElement (el) {
    var elWindow = el[INTERNAL_PROPS.processedContext];

    return getFrameElement(elWindow);
}

export function getIframeLocation (iframe) {
    var documentLocation = null;

    try {
        documentLocation = iframe.contentDocument.location.href;
    }
    catch (e) {
        documentLocation = null;
    }

    var srcLocation = iframe['src' + INTERNAL_ATTRS.storedAttrPostfix] || iframe.src;

    var parsedProxyDocumentLocation = documentLocation && urlUtils.isSupportedProtocol(documentLocation) &&
                                      urlUtils.parseProxyUrl(documentLocation);
    var parsedProxySrcLocation      = srcLocation && urlUtils.isSupportedProtocol(srcLocation) &&
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
    var closestMap        = closest(el, 'map');
    var closestMapName    = nativeMethods.getAttribute.call(closestMap, 'name');
    var containerSelector = '[usemap="#' + closestMapName + '"]';

    return nativeMethods.querySelector.call(findDocument(el), containerSelector);
}

export function getParentWindowWithSrc (window) {
    var parent             = window.parent;
    var parentFrameElement = null;

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
        var scrollDiv = nativeMethods.createElement.call(document, 'div');

        scrollDiv.style.height   = '100px';
        scrollDiv.style.overflow = 'scroll';
        scrollDiv.style.position = 'absolute';
        scrollDiv.style.top      = '-9999px';
        scrollDiv.style.width    = '100px';
        nativeMethods.appendChild.call(document.body, scrollDiv);

        var scrollbarWidth = scrollDiv.offsetWidth - scrollDiv.clientWidth;

        scrollbarSize = scrollbarWidth;
        scrollDiv.parentNode.removeChild(scrollDiv);
    }

    return scrollbarSize;
}

export function getSelectParent (child) {
    return closest(child.parentNode, 'select');
}

export function getSelectVisibleChildren (select) {
    var children = nativeMethods.elementQuerySelectorAll.call(select, 'optgroup, option');

    children = arraySlice.call(children);

    // NOTE: Firefox does not display groups without a label and with an empty label.
    if (isFirefox) {
        var filtered = [];

        for (var i = 0, len = children.length; i < len; i++) {
            if (getTagName(children[i]) !== 'optgroup' || !!children[i].label)
                filtered.push(children[i]);
        }

        children = filtered;
    }

    return children;
}

export function getTopSameDomainWindow (window) {
    var result        = window;
    var currentWindow = window.parent;

    if (result === window.top)
        return result;

    while (currentWindow) {
        if (!isCrossDomainWindows(window, currentWindow)) {
            var frameElement = getFrameElement(currentWindow);

            if (!frameElement || !isIframeWithoutSrc(frameElement))
                result = currentWindow;
        }

        currentWindow = currentWindow !== window.top ? currentWindow.parent : null;
    }

    return result;
}

export function find (parent, selector, handler) {
    var elms = getNativeQuerySelectorAll(parent).call(parent, selector);

    if (handler) {
        for (var i = 0; i < elms.length; i++)
            handler(elms[i]);
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
    var isContentEditable = false;
    var element           = null;

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
    var iframeLocation = getIframeLocation(iframe);

    if (!bySrc && iframeLocation.documentLocation === null)
        return true;

    var currentLocation = bySrc ? iframeLocation.srcLocation : iframeLocation.documentLocation;

    if (currentLocation && urlUtils.isSupportedProtocol(currentLocation))
        return !sameOriginCheck(location.toString(), currentLocation);

    return false;
}

export function isCrossDomainWindows (window1, window2) {
    try {
        if (window1 === window2)
            return false;

        var window1Location = window1.location.toString();
        var window2Location = window2.location.toString();

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
    if (el && typeof el.toString === 'function' && el.toString.toString().indexOf('[native code]') !== -1 &&
        el.constructor &&
        (el.constructor.toString().indexOf(' Element') !== -1 || el.constructor.toString().indexOf(' Node') !== -1))
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
    var doc = currentDocument || document;

    return doc.documentElement.contains(el);
}

export function isElementInIframe (el, currentDocument) {
    var doc = currentDocument || findDocument(el);

    return window.document !== doc;
}

export function isHammerheadAttr (attr) {
    return attr === INTERNAL_ATTRS.focusPseudoClass || attr === INTERNAL_ATTRS.hoverPseudoClass ||
           attr.indexOf(INTERNAL_ATTRS.storedAttrPostfix) !== -1;
}

export function isIframeElement (el) {
    return getTagName(el) === 'iframe';
}

export function isIframeWithoutSrc (iframe) {
    var iframeLocation         = getIframeLocation(iframe);
    var iframeSrcLocation      = iframeLocation.srcLocation;
    var iframeDocumentLocation = iframeLocation.documentLocation;

    if (iframeDocumentLocation === null) // is a cross-domain iframe
        return false;

    var iframeDocumentLocationHaveSupportedProtocol = urlUtils.isSupportedProtocol(iframeDocumentLocation);

    // NOTE: When an iframe has an empty src attribute (<iframe src></iframe>), the iframe.src property is not
    // empty but has different values in different browsers. Its document location is 'about:blank'. Therefore,
    // we should check the src attribute.
    if (!iframeDocumentLocationHaveSupportedProtocol && !(iframe.attributes['src'] && iframe.attributes['src'].value))
        return true;

    var parentWindowWithSrc  = getParentWindowWithSrc(iframe.contentWindow);
    var parsedWindowLocation = urlUtils.parseProxyUrl(parentWindowWithSrc.location.toString());
    var windowLocation       = parsedWindowLocation ? parsedWindowLocation.destUrl : parentWindowWithSrc.location.toString();

    if (iframeDocumentLocationHaveSupportedProtocol)
        return iframeDocumentLocation === windowLocation;

    if (iframeSrcLocation === windowLocation)
        return true;

    // NOTE: In Chrome, an iframe with an src has its documentLocation set to 'about:blank' when it is created. So,
    // we should check srcLocation in this case.
    if (iframeSrcLocation && urlUtils.isSupportedProtocol(iframeSrcLocation))
        return false;

    return !iframeDocumentLocationHaveSupportedProtocol;
}

export function isImgElement (el) {
    return getTagName(el) === 'img';
}

export function isInputElement (el) {
    return getTagName(el) === 'input';
}

export function isHtmlElement (el) {
    return getTagName(el) === 'html';
}

export function isBodyElement (el) {
    return getTagName(el) === 'body';
}

export function isHeadElement (el) {
    return getTagName(el) === 'head';
}

export function isBaseElement (el) {
    return getTagName(el) === 'base';
}

export function isScriptElement (el) {
    return getTagName(el) === 'script';
}

export function isStyleElement (el) {
    return getTagName(el) === 'style';
}

export function isLabelElement (el) {
    return getTagName(el) === 'label';
}

export function isTextAreaElement (el) {
    return getTagName(el) === 'textarea';
}

export function isOptionElement (el) {
    return getTagName(el) === 'option';
}

export function isSelectElement (el) {
    return getTagName(el) === 'select';
}

export function isFormElement (el) {
    return getTagName(el) === 'form';
}

export function isFileInput (el) {
    return isInputElement(el) && el.type.toLowerCase() === 'file';
}

export function isBodyElementWithChildren (el) {
    return isBodyElement(el) && el.children.length;
}

export function isMapElement (el) {
    return /^map$|^area$/i.test(getTagName(el));
}

export function isRenderedNode (node) {
    return !(isProcessingInstructionNode(node) || isCommentNode(node) || /^(script|style)$/i.test(node.nodeName));
}

export function isElementFocusable (el) {
    if (!el)
        return false;

    var isAnchorWithoutHref = isAnchorElement(el) && el.getAttribute('href') === '' && !el.getAttribute('tabIndex');

    var isFocusable = !isAnchorWithoutHref &&
                      matches(el, getFocusableSelector() + ', body') && !matches(el, ':disabled') &&
                      el.getAttribute('tabIndex') !== -1 &&
                      getComputedStyle(el)['visibility'] !== 'hidden';

    if (!isFocusable)
        return false;

    if (isWebKit)
        return !isHidden(el) || isOptionElement(el);

    return !isHidden(el);
}

export function isShadowUIElement (element) {
    while (element) {
        if (element.tagName === 'BODY' || element.tagName === 'HEAD')
            return false;

        // NOTE: Check the className type to avoid issues with a SVG element’s className property.
        if (typeof element.className === 'string' && element.className.indexOf(SHADOW_UI_CLASSNAME.postfix) > -1)
            return true;

        element = element.parentNode;
    }

    return false;
}

export function isWindow (instance) {
    if (instance instanceof nativeMethods.windowClass)
        return true;

    try {
        return instance && typeof instance === 'object' && instance.top !== void 0 && instance.toString &&
               (instance.toString() === '[object Window]' || instance.toString() === '[object global]');
    }
    catch (e) {
        // NOTE: If a cross-domain object has the 'top' field, this object is a window
        // (not a document or location).
        return true;
    }
}

export function isDocument (instance) {
    if (instance instanceof nativeMethods.documentClass)
        return true;

    try {
        return instance && typeof instance === 'object' && instance.toString &&
               (instance.toString() === '[object HTMLDocument]' || instance.toString() === '[object Document]');
    }
    catch (e) {
        // NOTE: For cross-domain objects (windows, documents or locations), we return false because
        // it's impossible to work with them in any case.
        return false;
    }
}

export function isBlob (instance) {
    return instance && typeof instance === 'object' && typeof instance.slice === 'function' &&
           instance.toString && instance.toString() === '[object Blob]';
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

    return instance && typeof instance === 'object' && instance.ownerSVGElement !== void 0 && instance.toString &&
           instance.toString().toLowerCase() === '[object svg' + getTagName(instance) + 'element]';
}

export function isSVGElementOrChild (el) {
    return !!closest(el, 'svg');
}

export function isFetchHeaders (instance) {
    if (nativeMethods.Headers && instance instanceof nativeMethods.Headers)
        return true;

    return instance && typeof instance === 'object' && instance.getAll !== void 0 &&
           typeof instance.toString === 'function' && instance.toString() === '[object Headers]';
}

export function isFetchRequest (instance) {
    if (nativeMethods.Request && instance instanceof nativeMethods.Request)
        return true;

    return instance && typeof instance === 'object' && typeof instance.json === 'function' &&
           typeof instance.toString === 'function' && instance.toString() === '[object Request]';
}

export function isTextEditableInput (el) {
    var editableInputTypesRegEx = /^(datetime|email|number|password|search|tel|text|url)$/;

    return isInputElement(el) && editableInputTypesRegEx.test(el.type);
}

export function isTextEditableElement (el) {
    return isTextEditableInput(el) || isTextAreaElement(el);
}

export function isTextEditableElementAndEditingAllowed (el) {
    var isElementEditingAllowed = () => !el.readOnly && el.getAttribute('readonly') !== 'readonly';

    return isTextEditableElement(el) && isElementEditingAllowed();
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
    return getTagName(el) === 'a';
}

export function isTableElement (el) {
    return getTagName(el) === 'table';
}

export function matches (el, selector) {
    if (!el)
        return false;

    var matchesSelector = el.matches || el.webkitMatchesSelector || el.msMatchesSelector;

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
        var classNames = className.split(/\s+/);

        for (var i = 0, len = classNames.length; i < len; i++)
            el.classList.add(classNames[i]);
    }
    else
        addClassFallback(el, className);
}

export function removeClass (el, className) {
    if (!el)
        return;

    // NOTE: IE10+
    if (el.classList) {
        var classNames = className.split(/\s+/);

        for (var i = 0, len = classNames.length; i < len; i++)
            el.classList.remove(classNames[i]);
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
    var metaCharset = nativeMethods.querySelector.call(document, '.' + SHADOW_UI_CLASSNAME.charset);

    return metaCharset && metaCharset.getAttribute('charset');
}

export function getParents (el, selector) {
    var parent  = el.parentNode;
    var parents = [];

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
    return isIframeElement(el) ? [el] : getNativeQuerySelectorAll(el).call(el, 'iframe');
}
