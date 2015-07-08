import * as Util from '../../utils/util';
import * as Browser from './browser';
import NativeMethods from '../sandboxes/native-methods';
import Const from '../../const';
import UrlUtil from '../util/url';

var scrollbarSize = null;

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

export function getIFrameByElement (el) {
    var currentDocument = el.documentElement ? el : findDocument(el);
    var currentWindow   = window !== window.top &&
                          isCrossDomainWindows(window.top, window) ? window : window.top;

    var iframes = currentWindow.document.getElementsByTagName('iframe');

    for (var i = 0; i < iframes.length; i++) {
        if (iframes[i].contentDocument === currentDocument)
            return iframes[i];
    }

    return null;
}

export function getIFrameByWindow (win) {
    var iframes = window.top.document.getElementsByTagName('iframe');

    for (var i = 0; i < iframes.length; i++) {
        if (iframes[i].contentWindow === win)
            return iframes[i];
    }

    return null;
}

export function getMapContainer (el) {
    var closestMap        = closest(el, 'map');
    var closestMapName    = NativeMethods.getAttribute.call(closestMap, 'name');
    var containerSelector = '[usemap=#' + closestMapName + ']';

    return NativeMethods.querySelector.call(findDocument(el), containerSelector);
}

export function getScrollbarSize () {
    if (!scrollbarSize) {
        var scrollDiv = NativeMethods.createElement.call(document, 'div');

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
    var children = NativeMethods.elementQuerySelectorAll.call(select, 'optgroup, option');

    children = Array.prototype.slice.call(children);

    if (Browser.isMozilla) {
        //NOTE: Mozilla does not display group without label and with empty label
        children = children.filter(function (item) {
            return item.tagName.toLowerCase() !== 'optgroup' || !!item.label;
        });
    }

    return children;
}

export function getTopSameDomainWindow (window) {
    try {
        if (window !== window.top && UrlUtil.isIframeWithoutSrc(window.frameElement))
            return getTopSameDomainWindow(window.parent);
    }
        /*eslint-disable no-empty */
    catch (e) {
    }
    /*eslint-enable no-empty */

    return window;
}

export function find (parent, selector, handler) {
    var elms = NativeMethods.elementQuerySelectorAll.call(parent, selector);

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
    var iframeLocation = UrlUtil.getIframeLocation(iframe);

    if (!bySrc && iframeLocation.documentLocation === null)
        return true;

    var currentLocation = bySrc ? iframeLocation.srcLocation : iframeLocation.documentLocation;

    if (currentLocation && UrlUtil.isSupportedProtocol(currentLocation))
        return !UrlUtil.sameOriginCheck(location.toString(), currentLocation);

    return false;
}

export function isCrossDomainWindows (window1, window2) {
    try {
        if (window1 === window2)
            return false;

        var window1Location = window1.location.toString();
        var window2Location = window2.location.toString();

        if (window1Location === 'about:blank' || window2Location === 'about:blank')
            return false;

        return !UrlUtil.sameOriginCheck(window1Location, window2Location);
    }
    catch (e) {
        return true;
    }
}

export function isDocumentInstance (instance) {
    if (instance instanceof NativeMethods.documentClass)
        return true;

    return instance && typeof instance === 'object' && typeof instance.referrer !== 'undefined' &&
           instance.toString &&
           (instance.toString() === '[object HTMLDocument]' || instance.toString() === '[object Document]');
}

export function isDomElement (el) {
    // T184805
    if (el && typeof el.toString === 'function' && el.toString.toString().indexOf('[native code]') !== -1 &&
        el.constructor &&
        (el.constructor.toString().indexOf(' Element') !== -1 || el.constructor.toString().indexOf(' Node') !== -1))
        return false;

    //B252941
    return el && (typeof el === 'object' || Browser.isMozilla && typeof el === 'function') &&
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
    return attr === Const.HOVER_PSEUDO_CLASS_ATTR ||
           attr.indexOf(Const.DOM_SANDBOX_STORED_ATTR_POSTFIX) !== -1;
}

export function isIframe (el) {
    return isDomElement(el) && el.tagName.toLowerCase() === 'iframe';
}

export function isInputElement (el) {
    return isDomElement(el) && el.tagName.toLowerCase() === 'input';
}

export function isInputWithoutSelectionPropertiesInMozilla (el) {
    //T101195, T133144, T101195
    return Browser.isMozilla && matches(el, 'input[type=number]');
}

export function isMapElement (el) {
    return /^map$|^area$/i.test(el.tagName);
}

export function isRenderedNode (node) {
    return !(node.nodeType === 7 || node.nodeType === 8 || /^(script|style)$/i.test(node.nodeName));
}

export function isShadowUIElement (element) {
    while (element) {
        if (element.tagName === 'BODY' || element.tagName === 'HEAD')
            return false;

        //NOTE: check className type to avoid issues with SVG elements className property
        if (typeof element.className === 'string' &&
            element.className.indexOf(Const.SHADOW_UI_CLASSNAME_POSTFIX) > -1)
            return true;

        element = element.parentNode;
    }

    return false;
}

export function isSvgElement (el) {
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
    var isElementEditingAllowed = function () {
        return !el.readOnly && el.getAttribute('readonly') !== 'readonly';
    };

    return isTextEditableElement(el) && isElementEditingAllowed();
}

export function isTextNode (node) {
    return node && typeof node === 'object' && node.nodeType === 3 && typeof node.nodeName === 'string';
}

export function isWindowInstance (instance) {
    if (instance instanceof NativeMethods.windowClass)
        return true;

    var result = instance && typeof instance === 'object' && typeof instance.top !== 'undefined' &&
                 (Browser.isMozilla ? true : instance.toString && (instance.toString() === '[object Window]' ||
                                                                   instance.toString() === '[object global]'));

    if (result && instance.top !== instance)
        return isWindowInstance(instance.top);

    return result;
}

export function matches (el, selector) {
    if (!el)
        return false;

    var matchesSelector = el.matches || el.msMatchesSelector;

    if (!matchesSelector)
        return false;

    return matchesSelector.call(el, selector);
}

export function closest (el, selector) {
    if (el && el.closest)
        return el.closest(selector);

    var closestFallback = function (el, selector) {
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

    //IE10+
    if (el && el.classList) {
        var classNames = className.split(/\s+/);

        classNames.forEach(function (item) {
            el.classList.add(item);
        });
    }
    else {
        var addClassFallback = function (el, className) {
            if (className) {
                var classNames = className.split(/\s+/);
                var setClass   = ' ' + el.className + ' ';

                for (var i = 0; i < classNames.length; i++) {
                    if (setClass.indexOf(' ' + classNames[i] + ' ') === -1)
                        setClass += classNames[i] + ' ';
                }

                el.className = Util.trim(setClass);
            }
        };

        addClassFallback(el, className);
    }
}

export function removeClass (el, className) {
    if (!el)
        return;

    //IE10+
    if (el.classList) {
        var classNames = className.split(/\s+/);

        classNames.forEach(function (item) {
            el.classList.remove(item);
        });
    }
    else {
        var removeClassFallback = function (el, className) {
            if (el.className && className) {
                var classNames = (className || '').split(/\s+/);

                className = (' ' + el.className + ' ').replace(/[\n\t\r]/g, ' ');

                for (var i = 0; i < classNames.length; i++)
                    className = className.replace(' ' + classNames[i] + ' ', ' ');

                el.className = Util.trim(className);
            }
        };

        removeClassFallback(el, className);
    }
}

export function hasClass (el, className) {
    if (!el)
        return false;

    //IE10+
    if (el.classList)
        return el.classList.contains(className);

    var hasClassFallback = function (el, className) {
        var preparedElementClassName = (' ' + el.className + ' ').replace(/[\n\t\r]/g, ' ');

        className = ' ' + className + ' ';

        return preparedElementClassName.indexOf(className) !== -1;
    };

    return hasClassFallback(el, className);
}
