import INTERNAL_ATTRS from '../../processing/dom/internal-attributes';
import SHADOW_UI_CLASSNAME from '../../shadow-ui/class-name';
import trim from '../../utils/string-trim';
import nativeMethods from '../sandbox/native-methods';
import * as urlUtils from './url';
import { sameOriginCheck } from './destination-location';
import { isFirefox, isWebKit, isIE, isOpera } from './browser';

var scrollbarSize = null;

function getFocusableSelector () {
    // NOTE: We don't take into account the case of embedded contentEditable elements, and we
    // specify the contentEditable attribute for focusable elements.
    var selectorPostfix = 'input, select, textarea, button, [contenteditable="true"], [contenteditable=""], [tabIndex]';

    if (isIE)
        return 'a[href]:not([href = ""]), iframe, ' + selectorPostfix;

    if (isOpera)
        return selectorPostfix;

    return 'a[href], iframe, ' + selectorPostfix;
}

function isHidden (el) {
    return el.offsetWidth <= 0 && el.offsetHeight <= 0;
}

export function getActiveElement (currentDocument) {
    var doc           = currentDocument || document;
    var activeElement = doc.activeElement &&
                        doc.activeElement.tagName ? doc.activeElement : doc.body;

    if (activeElement.tagName.toLowerCase() === 'iframe') {
        try {
            return getActiveElement(activeElement.contentDocument);
        }
            /*eslint-disable no-empty */
        catch (e) {
        }
        /*eslint-enable no-empty */
    }

    return activeElement;
}

export function getChildVisibleIndex (select, child) {
    var childrenArray = getSelectVisibleChildren(select);

    return childrenArray.indexOf(child);
}

export function getIframeByElement (el) {
    var currentDocument = el.documentElement ? el : findDocument(el);
    var currentWindow   = window !== window.top && isCrossDomainWindows(window.top, window) ? window : window.top;
    var iframes         = currentWindow.document.getElementsByTagName('iframe');

    for (var i = 0; i < iframes.length; i++) {
        if (iframes[i].contentDocument === currentDocument)
            return iframes[i];
    }

    return null;
}

export function getIframeByWindow (win) {
    var iframes = window.top.document.getElementsByTagName('iframe');

    for (var i = 0; i < iframes.length; i++) {
        if (iframes[i].contentWindow === win)
            return iframes[i];
    }

    return null;
}

export function getIframeLocation (iframe) {
    var documentLocation = null;

    try {
        documentLocation = iframe.contentDocument.location.href;
    }
    catch (e) {
        documentLocation = null;
    }

    var srcLocation = nativeMethods.getAttribute.call(iframe, 'src' + INTERNAL_ATTRS.storedAttrPostfix) ||
                      nativeMethods.getAttribute.call(iframe, 'src') || iframe.src;

    var parsedProxyDocumentLocation = documentLocation && urlUtils.isSupportedProtocol(documentLocation) &&
                                      urlUtils.parseProxyUrl(documentLocation);
    var parsedProxySrcLocation      = srcLocation && urlUtils.isSupportedProtocol(srcLocation) &&
                                      urlUtils.parseProxyUrl(srcLocation);

    return {
        documentLocation: parsedProxyDocumentLocation ? parsedProxyDocumentLocation.destUrl : documentLocation,
        srcLocation:      parsedProxySrcLocation ? parsedProxySrcLocation.destUrl : srcLocation
    };
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
        document.body.appendChild(scrollDiv);

        var scrollbarWidth = scrollDiv.offsetWidth - scrollDiv.clientWidth;

        scrollbarSize = scrollbarWidth;
        scrollDiv.parentNode.removeChild(scrollDiv);
    }

    return scrollbarSize;
}

export function getSelectParent (child) {
    var parent = child.parentNode;

    while (parent) {
        if (parent.tagName && parent.tagName.toLowerCase() === 'select')
            return parent;

        parent = parent.parentNode;
    }
    return null;
}

export function getSelectVisibleChildren (select) {
    var children = nativeMethods.elementQuerySelectorAll.call(select, 'optgroup, option');

    children = Array.prototype.slice.call(children);

    // NOTE: Firefox does not display groups without a label and with an empty label.
    if (isFirefox)
        children = children.filter(item => item.tagName.toLowerCase() !== 'optgroup' || !!item.label);

    return children;
}

export function getTopSameDomainWindow (window) {
    try {
        if (window !== window.top && isIframeWithoutSrc(window.frameElement))
            return getTopSameDomainWindow(window.parent);
    }
        /*eslint-disable no-empty */
    catch (e) {
    }
    /*eslint-enable no-empty */

    return window;
}

export function find (parent, selector, handler) {
    var elms = nativeMethods.elementQuerySelectorAll.call(parent, selector);

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
    var isAlwaysNotEditableElement = function (el) {
        var tagName                          = el.tagName.toLowerCase();
        var notContentEditableElementsRegExp = /select|option|applet|area|audio|canvas|datalist|keygen|map|meter|object|progress|source|track|video|img/;
        var inputElementsRegExp              = /input|textarea|button/;

        return tagName && (notContentEditableElementsRegExp.test(tagName) || inputElementsRegExp.test(tagName));
    };

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
    // NOTE: T184805
    if (el && typeof el.toString === 'function' && el.toString.toString().indexOf('[native code]') !== -1 &&
        el.constructor &&
        (el.constructor.toString().indexOf(' Element') !== -1 || el.constructor.toString().indexOf(' Node') !== -1))
        return false;

    // NOTE: B252941
    return el && (typeof el === 'object' || isFirefox && typeof el === 'function') &&
           el.nodeType !== 11 && typeof el.nodeName === 'string' && el.tagName;
}

export function isElementInDocument (el, currentDocument) {
    var doc        = currentDocument || document;
    var curElement = el.parentNode;

    while (curElement) {
        if (curElement === doc)
            return true;

        curElement = curElement.parentNode;
    }

    return false;
}

export function isElementInIframe (el, currentDocument) {
    var doc = currentDocument || findDocument(el);

    return window.document !== doc;
}

export function isFileInput (el) {
    return isInputElement(el) && el.type.toLowerCase() === 'file';
}

export function isHammerheadAttr (attr) {
    return attr === INTERNAL_ATTRS.hoverPseudoClass || attr.indexOf(INTERNAL_ATTRS.storedAttrPostfix) !== -1;
}

export function isIframe (el) {
    return isDomElement(el) && el.tagName.toLowerCase() === 'iframe';
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
    var windowLocation       = parentWindowWithSrc.location.toString();
    var parsedWindowLocation = urlUtils.parseProxyUrl(windowLocation);

    if (iframeDocumentLocation === (parsedWindowLocation ? parsedWindowLocation.destUrl : windowLocation) ||
        iframeSrcLocation === (parsedWindowLocation ? parsedWindowLocation.destUrl : windowLocation))
        return true;


    // NOTE: In Chrome, an iframe with an src has its documentLocation set to 'about:blank' when it is created. So,
    // we should check srcLocation in this case.
    if (iframeSrcLocation && urlUtils.isSupportedProtocol(iframeSrcLocation))
        return false;

    return !iframeDocumentLocationHaveSupportedProtocol;
}

export function isImgElement (el) {
    return isDomElement(el) && el.tagName.toLowerCase() === 'img';
}

export function isInputElement (el) {
    return isDomElement(el) && el.tagName.toLowerCase() === 'input';
}

export function isInputWithoutSelectionPropertiesInFirefox (el) {
    // NOTE: T101195, T133144, T101195
    return isFirefox && matches(el, 'input[type=number]');
}

export function isMapElement (el) {
    return /^map$|^area$/i.test(el.tagName);
}

export function isRenderedNode (node) {
    return !(node.nodeType === 7 || node.nodeType === 8 || /^(script|style)$/i.test(node.nodeName));
}

export function isElementFocusable (el) {
    if (!el)
        return false;

    var isAnchorWithoutHref = el.tagName &&
                              el.tagName.toLowerCase() === 'a' &&
                              el.getAttribute('href') === '' && !el.getAttribute('tabIndex');

    var isFocusable = !isAnchorWithoutHref &&
                      matches(el, getFocusableSelector() + ', body') && !matches(el, ':disabled') &&
                      el.getAttribute('tabIndex') !== -1 &&
                      getComputedStyle(el)['visibility'] !== 'hidden';

    if (!isFocusable)
        return false;

    if (isWebKit || isOpera)
        return !isHidden(el) || el.tagName && el.tagName.toLowerCase() === 'option';

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

    var result = instance && typeof instance === 'object' && typeof instance.top !== 'undefined' &&
                 (isFirefox ? true : instance.toString && (instance.toString() === '[object Window]' ||
                                                           instance.toString() === '[object global]'));

    if (result && instance.top !== instance)
        return isWindow(instance.top);

    return result;
}

export function isDocument (instance) {
    if (instance instanceof nativeMethods.documentClass)
        return true;

    return instance && typeof instance === 'object' && typeof instance.referrer !== 'undefined' &&
           instance.toString &&
           (instance.toString() === '[object HTMLDocument]' || instance.toString() === '[object Document]');
}

export function isLocation (instance) {
    if (instance instanceof nativeMethods.locationClass)
        return true;

    return instance && typeof instance === 'object' && typeof instance.href !== 'undefined' &&
           typeof instance.assign !== 'undefined';
}

export function isSVGElement (obj) {
    return window.SVGElement && obj instanceof window.SVGElement;
}

export function isSVGElementOrChild (el) {
    return !!closest(el, 'svg');
}

export function isTextEditableInput (el) {
    var editableInputTypesRegEx = /^(datetime|email|number|password|search|tel|text|url)$/;
    var tagName                 = el.tagName ? el.tagName.toLowerCase() : '';

    return tagName === 'input' && editableInputTypesRegEx.test(el.type);
}

export function isTextEditableElement (el) {
    var tagName = el.tagName ? el.tagName.toLowerCase() : '';

    return isTextEditableInput(el) || tagName === 'textarea';
}

export function isTextEditableElementAndEditingAllowed (el) {
    var isElementEditingAllowed = () => !el.readOnly && el.getAttribute('readonly') !== 'readonly';

    return isTextEditableElement(el) && isElementEditingAllowed();
}

export function isTextNode (node) {
    return node && typeof node === 'object' && node.nodeType === 3 && typeof node.nodeName === 'string';
}

export function isAnchor (el) {
    return isDomElement(el) && el.tagName.toLowerCase() === 'a';
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

    var closestFallback = (el, selector) => {
        while (el) {
            if (matches(el, selector))
                return el;

            el = el.parentNode;
        }

        return null;
    };

    return closestFallback(el, selector);
}

export function addClass (el, className) {
    if (!el)
        return;

    // NOTE: IE10+
    if (el && el.classList) {
        var classNames = className.split(/\s+/);

        classNames.forEach(item => el.classList.add(item));
    }
    else {
        var addClassFallback = (el, className) => {
            if (className) {
                var classNames = className.split(/\s+/);
                var setClass   = ' ' + el.className + ' ';

                for (var i = 0; i < classNames.length; i++) {
                    if (setClass.indexOf(' ' + classNames[i] + ' ') === -1)
                        setClass += classNames[i] + ' ';
                }

                el.className = trim(setClass);
            }
        };

        addClassFallback(el, className);
    }
}

export function removeClass (el, className) {
    if (!el)
        return;

    // NOTE: IE10+
    if (el.classList) {
        var classNames = className.split(/\s+/);

        classNames.forEach(item => el.classList.remove(item));
    }
    else {
        var removeClassFallback = function (el, className) {
            if (el.className && className) {
                var classNames = (className || '').split(/\s+/);

                className = (' ' + el.className + ' ').replace(/[\n\t\r]/g, ' ');

                for (var i = 0; i < classNames.length; i++)
                    className = className.replace(' ' + classNames[i] + ' ', ' ');

                el.className = trim(className);
            }
        };

        removeClassFallback(el, className);
    }
}

export function hasClass (el, className) {
    if (!el)
        return false;

    // NOTE: IE10+
    if (el.classList)
        return el.classList.contains(className);

    var hasClassFallback = (el, className) => {
        var preparedElementClassName = (' ' + el.className + ' ').replace(/[\n\t\r]/g, ' ');

        className = ' ' + className + ' ';

        return preparedElementClassName.indexOf(className) !== -1;
    };

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
        if (parent.nodeType === 1 && !selector || selector && matches(parent, selector))
            parents.push(parent);

        parent = parent.parentNode;
    }

    return parents;
}

