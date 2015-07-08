import * as DOM from '../util/dom';
import NativeMethods from './native-methods';
import DomProcessor from '../dom-processor/dom-processor';
import * as Position from '../util/position';
import Const from '../../const';
import * as Style from '../util/style';
import * as Event from '../util/event';

// Const
const CLASSNAME_REGEX = /\.((?:\\.|[-\w]|[^\x00-\xa0])+)/g;
const ROOT_CLASS      = 'root';
const ROOT_ID         = 'root';
const HIDDEN_CLASS    = 'hidden';
const BLIND_CLASS     = 'blind';

// Globals
var root              = null;
var lastActiveElement = null;

function bringRootToWindowTopLeft () {
    var rootHasParentWithNonStaticPosition = function () {
        var parent = root.parentNode;

        while (parent) {
            var elementPosition = Style.get(parent, 'position');

            if (/fixed|relative|absolute/.test(elementPosition))
                return true;

            parent = parent.parentNode;
        }
        return false;
    };

    if (rootHasParentWithNonStaticPosition()) {
        var rootOffset = Position.getOffsetPosition(root);

        if (rootOffset.left !== 0 || rootOffset.top !== 0) {
            var newLeft = ((parseFloat(Style.get(root, 'left')) || 0) - rootOffset.left).toString() + 'px';
            var newTop  = ((parseFloat(Style.get(root, 'top')) || 0) - rootOffset.top).toString() + 'px';

            Style.set(root, 'left', newLeft);
            Style.set(root, 'top', newTop);
        }
    }
}

function filterElement (element) {
    if (!element || element === document || element === window)
        return element;

    return DOM.isShadowUIElement(element) ? null : element;
}

function filterNodeList (nodeList) {
    var filteredList = [];
    var nlLength     = nodeList.length;

    for (var i = 0; i < nlLength; i++) {
        var element = filterElement(nodeList[i]);

        if (element)
            filteredList.push(element);
    }

    filteredList.item = function (index) {
        return index >= filteredList.length ? null : filteredList[index];
    };

    filteredList.namedItem = function (name) {
        return nodeList.namedItem(name);
    };

    return filteredList.length === nlLength ? nodeList : filteredList;
}

export function getRoot () {
    if (!root || /* T225944 */ !document.body.contains(root)) {
        overrideElement(document.body);

        /*eslint-disable indent */
        if (!root) {
            //B254893
            root = document.createElement('div');
            NativeMethods.setAttribute.call(root, 'id', ROOT_ID);
            NativeMethods.setAttribute.call(root, 'contenteditable', 'false');
            document.body.appendChild(root);

            NativeMethods.setAttribute.call(root, 'id', patchClassNames(ROOT_ID));

            addClass(root, ROOT_CLASS);

            for (var i = 0; i < DomProcessor.EVENTS.length; i++)
                root.addEventListener(DomProcessor.EVENTS[i], Event.stopPropagation);

            bringRootToWindowTopLeft();
            NativeMethods.documentAddEventListener.call(document, 'DOMContentLoaded', bringRootToWindowTopLeft);
        }
        else
            document.body.appendChild(root);
        /*eslint-enable indent */
    }

    return root;
}

export function init (window, document) {
    (function overrideDocument () {
        document.elementFromPoint = function () {
            //T212974
            addClass(getRoot(), HIDDEN_CLASS);

            var res = filterElement(NativeMethods.elementFromPoint.apply(document, arguments));

            removeClass(getRoot(), HIDDEN_CLASS);

            return res;
        };

        document.getElementById = function () {
            return filterElement(NativeMethods.getElementById.apply(document, arguments));
        };

        document.getElementsByClassName = function () {
            return filterNodeList(NativeMethods.getElementsByClassName.apply(document, arguments));
        };

        document.getElementsByName = function () {
            return filterNodeList(NativeMethods.getElementsByName.apply(document, arguments));
        };

        document.getElementsByTagName = function () {
            return filterNodeList(NativeMethods.getElementsByTagName.apply(document, arguments));
        };

        document.querySelector = function () {
            return filterElement(NativeMethods.querySelector.apply(document, arguments));
        };

        document.querySelectorAll = function () {
            return filterNodeList(NativeMethods.querySelectorAll.apply(document, arguments));
        };

        // T195358
        document.querySelectorAll.toString = function () {
            return NativeMethods.querySelectorAll.toString();
        };

        document.getElementsByClassName.toString = function () {
            return NativeMethods.getElementsByClassName.toString();
        };
    })();
}

export function onBodyContentChanged () {
    if (root) {
        if (!DOM.closest(root, 'html'))
            document.body.appendChild(root);
    }
}

//NOTE: fix for B239138 - unroll.me 'Cannot read property 'document' of null' error raised during recording
//There were an issue then document.body was replaced, so we need to reattach UI to new body manually
export function onBodyElementMutation () {
    if (root) {
        if (root.parentNode !== document.body) {
            overrideElement(document.body);
            document.body.appendChild(root);
        }
    }
}

export function overrideElement (el) {
    var tagName = el && el.tagName && el.tagName.toLowerCase();

    if (tagName && (tagName === 'body' || tagName === 'head')) {
        el.getElementsByClassName = function () {
            return filterNodeList(NativeMethods.elementGetElementsByClassName.apply(el, arguments));
        };

        el.getElementsByTagName = function () {
            return filterNodeList(NativeMethods.elementGetElementsByTagName.apply(el, arguments));
        };

        el.querySelector = function () {
            return filterElement(NativeMethods.elementQuerySelector.apply(el, arguments));
        };

        el.querySelectorAll = function () {
            return filterNodeList(NativeMethods.elementQuerySelectorAll.apply(el, arguments));
        };
    }
}

// Accessors
export function getFirstChild (el) {
    var childNodes = filterNodeList(el.childNodes);

    return childNodes.length && childNodes[0] ? childNodes[0] : null;
}

export function getFirstElementChild (el) {
    var childNodes = filterNodeList(el.childNodes);
    var cnLength   = childNodes.length;

    for (var i = 0; i < cnLength; i++) {
        if (childNodes[i].nodeType === 1)
            return childNodes[i];
    }

    return null;
}

export function getLastChild (el) {
    var childNodes = filterNodeList(el.childNodes);
    var index      = childNodes.length - 1;

    return index >= 0 ? childNodes[index] : null;
}

export function getLastElementChild (el) {
    var childNodes = filterNodeList(el.childNodes);
    var cnLength   = childNodes.length;

    for (var i = cnLength - 1; i >= 0; i--) {
        if (childNodes[i].nodeType === 1)
            return childNodes[i];
    }

    return null;
}

// Utils
export function checkElementsPosition (collection) {
    if (collection.length) {
        var parent           = collection[0].parentNode || collection[0].parentElement;
        var shadowUIElements = [];

        if (parent) {
            for (var i = 0; i < collection.length; i++) {
                if (DOM.isShadowUIElement(collection[i]))
                    shadowUIElements.push(collection[i]);
            }

            for (var j = 0; j < shadowUIElements.length; j++)
                NativeMethods.appendChild.call(parent, shadowUIElements[j]);
        }
    }
}

export function isShadowContainer (el) {
    if (DOM.isDomElement(el)) {
        var tagName = el.tagName.toLowerCase();

        return tagName === 'head' || tagName === 'body';
    }

    return false;
}

export function isShadowContainerCollection (collection) {
    var parent = null;

    try {
        if (collection.length && !DOM.isWindowInstance(collection) && collection[0] && collection[0].nodeType) {
            parent = collection[0].parentNode || collection[0].parentElement;

            if (parent && (parent.childNodes === collection || parent.children === collection))
                return isShadowContainer(parent);
        }
    }
        /*eslint-disable no-empty */
    catch (e) {
    }
    /*eslint-disable no-empty */

    return false;
}

export function isShadowUIMutation (mutation) {
    if (mutation.removedNodes && mutation.removedNodes.length === 1) {
        if (DOM.isShadowUIElement(mutation.removedNodes[0]))
            return true;
    }

    if (mutation.addedNodes && mutation.addedNodes.length === 1) {
        if (DOM.isShadowUIElement(mutation.addedNodes[0]))
            return true;
    }

    return false;
}

// API
export function addClass (elem, value) {
    var patchedClass = patchClassNames(value);

    DOM.addClass(elem, patchedClass);
}

export function hasClass (elem, value) {
    var patchedClass = patchClassNames(value);

    return DOM.hasClass(elem, patchedClass);
}

export function patchClassNames (value) {
    var names = value.split(/\s+/);

    for (var i = 0; i < names.length; i++)
        names[i] += Const.SHADOW_UI_CLASSNAME_POSTFIX;

    return names.join(' ');
}

export function removeClass (elem, value) {
    var patchedClass = patchClassNames(value);

    DOM.removeClass(elem, patchedClass);
}

export function select (selector, context) {
    var patchedSelector = selector.replace(CLASSNAME_REGEX, function (className) {
        return className + Const.SHADOW_UI_CLASSNAME_POSTFIX;
    });

    return context ? NativeMethods.elementQuerySelectorAll.call(context, patchedSelector) :
           NativeMethods.querySelectorAll.call(document, patchedSelector);
}

export function setBlind (value) {
    if (value)
        addClass(getRoot(), BLIND_CLASS);
    else
        removeClass(getRoot(), BLIND_CLASS);
}

export function getLastActiveElement () {
    return lastActiveElement;
}

export function setLastActiveElement (el) {
    lastActiveElement = el;
}
