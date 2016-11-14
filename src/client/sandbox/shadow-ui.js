import INTERNAL_PROPS from '../../processing/dom/internal-properties';
import SandboxBase from './base';
import NodeSandbox from './node/index';
import nativeMethods from './native-methods';
import * as domUtils from '../utils/dom';
import { EVENTS } from '../dom-processor';
import { getOffsetPosition } from '../utils/position';
import SHADOW_UI_CLASS_NAME from '../../shadow-ui/class-name';
import { get as getStyle, set as setStyle } from '../utils/style';
import { stopPropagation } from '../utils/event';

export default class ShadowUI extends SandboxBase {
    constructor (nodeMutation, messageSandbox, iframeSandbox) {
        super();

        this.BODY_CONTENT_CHANGED_COMMAND = 'hammerhead|command|body-content-changed';

        this.CLASSNAME_REGEX = /\.((?:\\.|[-\w]|[^\x00-\xa0])+)/g;
        this.ROOT_CLASS      = 'root';
        this.ROOT_ID         = 'root';
        this.HIDDEN_CLASS    = 'hidden';
        this.BLIND_CLASS     = 'blind';

        this.nodeMutation   = nodeMutation;
        this.messageSandbox = messageSandbox;
        this.iframeSandbox  = iframeSandbox;

        this.root                    = null;
        this.lastActiveElement       = null;
        this.uiStyleSheetsHtmlBackup = null;
    }

    static _filterElement (el) {
        if (!el || domUtils.isDocument(el) || domUtils.isWindow(el))
            return el;

        return domUtils.isShadowUIElement(el) ? null : el;
    }

    static _filterNodeList (nodeList) {
        var filteredList = [];
        var nlLength     = nodeList.length;

        for (var i = 0; i < nlLength; i++) {
            var el = ShadowUI._filterElement(nodeList[i]);

            if (el)
                filteredList.push(el);
        }

        filteredList.item = index => index >= filteredList.length ? null : filteredList[index];

        if (nodeList.namedItem)
            filteredList.namedItem = name => nodeList.namedItem(name);

        return filteredList.length === nlLength ? nodeList : filteredList;
    }

    _bringRootToWindowTopLeft () {
        var rootHasParentWithNonStaticPosition = false;
        var parent                             = this.root.parentNode;

        while (parent) {
            var elementPosition = getStyle(parent, 'position');

            if (/fixed|relative|absolute/.test(elementPosition))
                rootHasParentWithNonStaticPosition = true;

            parent = parent.parentNode;
        }

        if (rootHasParentWithNonStaticPosition) {
            var rootOffset = getOffsetPosition(this.root);

            if (rootOffset.left !== 0 || rootOffset.top !== 0) {
                var newLeft = ((parseFloat(getStyle(this.root, 'left')) || 0) - rootOffset.left).toString() + 'px';
                var newTop  = ((parseFloat(getStyle(this.root, 'top')) || 0) - rootOffset.top).toString() + 'px';

                setStyle(this.root, 'left', newLeft);
                setStyle(this.root, 'top', newTop);
            }
        }
    }

    _overrideDocumentMethods (document) {
        var shadowUI = this;
        var docProto = document.constructor.prototype;

        docProto.elementFromPoint = function (...args) {
            // NOTE: T212974
            shadowUI.addClass(shadowUI.getRoot(), shadowUI.HIDDEN_CLASS);

            var res = ShadowUI._filterElement(nativeMethods.elementFromPoint.apply(this, args));

            shadowUI.removeClass(shadowUI.getRoot(), shadowUI.HIDDEN_CLASS);

            return res;
        };

        docProto.getElementById = function (...args) {
            return ShadowUI._filterElement(nativeMethods.getElementById.apply(this, args));
        };

        docProto.getElementsByClassName = function (...args) {
            return ShadowUI._filterNodeList(nativeMethods.getElementsByClassName.apply(this, args));
        };

        docProto.getElementsByName = function (...args) {
            return ShadowUI._filterNodeList(nativeMethods.getElementsByName.apply(this, args));
        };

        docProto.getElementsByTagName = function (...args) {
            return ShadowUI._filterNodeList(nativeMethods.getElementsByTagName.apply(this, args));
        };

        docProto.querySelector = function (...args) {
            if (typeof args[0] === 'string')
                args[0] = NodeSandbox.processSelector(args[0]);

            return ShadowUI._filterElement(nativeMethods.querySelector.apply(this, args));
        };

        docProto.querySelectorAll = function (...args) {
            if (typeof args[0] === 'string')
                args[0] = NodeSandbox.processSelector(args[0]);

            return ShadowUI._filterNodeList(nativeMethods.querySelectorAll.apply(this, args));
        };

        // NOTE: T195358
        docProto.querySelectorAll.toString       = () => nativeMethods.querySelectorAll.toString();
        docProto.getElementsByClassName.toString = () => nativeMethods.getElementsByClassName.toString();
    }

    _overrideElementMethods (window) {
        var overridedMethods = {
            getElementsByClassName () {
                return ShadowUI._filterNodeList(nativeMethods.elementGetElementsByClassName.apply(this, arguments));
            },

            getElementsByTagName () {
                return ShadowUI._filterNodeList(nativeMethods.elementGetElementsByTagName.apply(this, arguments));
            },

            querySelector () {
                if (typeof arguments[0] === 'string')
                    arguments[0] = NodeSandbox.processSelector(arguments[0]);

                return ShadowUI._filterElement(nativeMethods.elementQuerySelector.apply(this, arguments));
            },

            querySelectorAll () {
                if (typeof arguments[0] === 'string')
                    arguments[0] = NodeSandbox.processSelector(arguments[0]);

                return ShadowUI._filterNodeList(nativeMethods.elementQuerySelectorAll.apply(this, arguments));
            }
        };

        var bodyProto = window.HTMLBodyElement.prototype;
        var headProto = window.HTMLHeadElement.prototype;

        bodyProto.getElementsByClassName = overridedMethods.getElementsByClassName;
        bodyProto.getElementsByTagName   = overridedMethods.getElementsByTagName;
        bodyProto.querySelector          = overridedMethods.querySelector;
        bodyProto.querySelectorAll       = overridedMethods.querySelectorAll;
        headProto.getElementsByClassName = overridedMethods.getElementsByClassName;
        headProto.getElementsByTagName   = overridedMethods.getElementsByTagName;
        headProto.querySelector          = overridedMethods.querySelector;
        headProto.querySelectorAll       = overridedMethods.querySelectorAll;
    }

    _getUIStyleSheetsHtml () {
        var stylesheets = this.nativeMethods.querySelectorAll.call(this.document, 'link.' +
                                                                                  SHADOW_UI_CLASS_NAME.uiStylesheet);
        var result      = '';

        for (var i = 0; i < stylesheets.length; i++)
            result += stylesheets[i].outerHTML;

        return result;
    }

    _restoreUIStyleSheets (head, uiStyleSheetsHtml) {
        if (!head || !uiStyleSheetsHtml)
            return;

        var parser = this.nativeMethods.createElement.call(this.document, 'div');

        parser.innerHTML = uiStyleSheetsHtml;

        for (var i = 0; i < parser.children.length; i++) {
            var refNode = head.children[i] || null;
            var newNode = nativeMethods.cloneNode.call(parser.children[i]);

            this.nativeMethods.insertBefore.call(head, newNode, refNode);
        }
    }

    getRoot () {
        if (!this.root || /* NOTE: T225944 */ !this.document.body.contains(this.root)) {
            if (!this.root) {
                // NOTE: B254893
                this.root = nativeMethods.createElement.call(this.document, 'div');
                nativeMethods.setAttribute.call(this.root, 'id', ShadowUI.patchId(this.ROOT_ID));
                nativeMethods.setAttribute.call(this.root, 'contenteditable', 'false');
                this.addClass(this.root, this.ROOT_CLASS);
                nativeMethods.appendChild.call(this.document.body, this.root);

                for (var i = 0; i < EVENTS.length; i++)
                    this.root.addEventListener(EVENTS[i], stopPropagation);

                this._bringRootToWindowTopLeft();
                nativeMethods.documentAddEventListener.call(this.document, 'DOMContentLoaded', () => {
                    this.onBodyElementMutation();
                    this._bringRootToWindowTopLeft();
                });
            }
            else
                nativeMethods.appendChild.call(this.document.body, this.root);
        }

        return this.root;
    }

    attach (window) {
        super.attach(window, window.document);

        this._overrideDocumentMethods(window.document);
        this._overrideElementMethods(window);

        this.iframeSandbox.on(this.iframeSandbox.RUN_TASK_SCRIPT, e => {
            var iframeHead = e.iframe.contentDocument.head;

            this._restoreUIStyleSheets(iframeHead, this._getUIStyleSheetsHtml());
        });

        this.nodeMutation.on(this.nodeMutation.BEFORE_DOCUMENT_CLEANED_EVENT, () => {
            this.uiStyleSheetsHtmlBackup = this._getUIStyleSheetsHtml();
        });

        this.nodeMutation.on(this.nodeMutation.DOCUMENT_CLEANED_EVENT, e => {
            this._restoreUIStyleSheets(e.document.head, this.uiStyleSheetsHtmlBackup);
            this.uiStyleSheetsHtmlBackup = null;
        });
        this.nodeMutation.on(this.nodeMutation.DOCUMENT_CLOSED_EVENT, e => {
            this._restoreUIStyleSheets(e.document.head, this.uiStyleSheetsHtmlBackup);
            this.uiStyleSheetsHtmlBackup = null;
        });

        this.nodeMutation.on(this.nodeMutation.BODY_CONTENT_CHANGED_EVENT, el => {
            var elContextWindow = el[INTERNAL_PROPS.processedContext];

            if (elContextWindow !== window) {
                this.messageSandbox.sendServiceMsg({
                    cmd: this.BODY_CONTENT_CHANGED_COMMAND
                }, elContextWindow);
            }
            else
                this.onBodyElementMutation();
        });

        this.messageSandbox.on(this.messageSandbox.SERVICE_MSG_RECEIVED_EVENT, e => {
            if (e.message.cmd === this.BODY_CONTENT_CHANGED_COMMAND)
                this.onBodyElementMutation();
        });
    }

    onBodyElementMutation () {
        if (!this.root || !this.document.body)
            return;

        var isRootInDom = domUtils.closest(this.root, 'html');
        var isRootLastChild = !this.root.nextElementSibling;
        // NOTE: Fix for B239138 - The 'Cannot read property 'document' of null' error
        // is thrown on recording on the unroll.me site. There was an issue when
        // document.body was replaced, so we need to reattach a UI to a new body manually.
        var isRootInBody = this.root.parentNode === this.document.body;

        if (!(isRootInDom && isRootLastChild && isRootInBody))
            this.nativeMethods.appendChild.call(this.document.body, this.root);
    }

    // Accessors
    getFirstChild (el) {
        var childNodes = ShadowUI._filterNodeList(el.childNodes);

        return childNodes.length && childNodes[0] ? childNodes[0] : null;
    }

    getFirstElementChild (el) {
        var childNodes = ShadowUI._filterNodeList(el.childNodes);
        var cnLength   = childNodes.length;

        for (var i = 0; i < cnLength; i++) {
            if (domUtils.isElementNode(childNodes[i]))
                return childNodes[i];
        }

        return null;
    }

    getLastChild (el) {
        var childNodes = ShadowUI._filterNodeList(el.childNodes);
        var index      = childNodes.length - 1;

        return index >= 0 ? childNodes[index] : null;
    }

    getLastElementChild (el) {
        var childNodes = ShadowUI._filterNodeList(el.childNodes);
        var cnLength   = childNodes.length;

        for (var i = cnLength - 1; i >= 0; i--) {
            if (domUtils.isElementNode(childNodes[i]))
                return childNodes[i];
        }

        return null;
    }

    // Utils
    static checkElementsPosition (collection) {
        if (collection.length) {
            var parent           = collection[0].parentNode;
            var shadowUIElements = [];

            if (parent) {
                for (var i = 0; i < collection.length; i++) {
                    if (domUtils.isShadowUIElement(collection[i]))
                        shadowUIElements.push(collection[i]);
                }

                for (var j = 0; j < shadowUIElements.length; j++)
                    nativeMethods.appendChild.call(parent, shadowUIElements[j]);
            }
        }
    }

    static isShadowContainer (el) {
        if (domUtils.isDomElement(el))
            return domUtils.isBodyElement(el) || domUtils.isHeadElement(el);

        return false;
    }

    static isShadowContainerCollection (collection) {
        try {
            if (collection && collection.length && !domUtils.isWindow(collection) && collection[0] &&
                collection[0].nodeType) {
                var parent = collection[0].parentNode;

                if (parent && (parent.childNodes === collection || parent.children === collection))
                    return ShadowUI.isShadowContainer(parent);
            }
        }
            /*eslint-disable no-empty */
        catch (e) {
        }
        /*eslint-enable no-empty */

        return false;
    }

    static isShadowUIMutation (mutation) {
        if (mutation.removedNodes && mutation.removedNodes.length === 1) {
            if (domUtils.isShadowUIElement(mutation.removedNodes[0]))
                return true;
        }

        if (mutation.addedNodes && mutation.addedNodes.length === 1) {
            if (domUtils.isShadowUIElement(mutation.addedNodes[0]))
                return true;
        }

        return false;
    }

    static removeSelfRemovingScripts (document) {
        var selfRemovingScripts = nativeMethods.querySelectorAll.call(document,
            '.' + SHADOW_UI_CLASS_NAME.selfRemovingScript);

        for (var i = 0; i < selfRemovingScripts.length; i++) {
            var script = selfRemovingScripts[i];

            nativeMethods.removeChild.call(script.parentNode, script);
        }
    }

    // API
    // NOTE: this method cannot be static because it is a part of the public API
    addClass (el, value) {
        var patchedClass = ShadowUI.patchClassNames(value);

        domUtils.addClass(el, patchedClass);
    }

    // NOTE: this method cannot be static because it is a part of the public API
    removeClass (elem, value) {
        var patchedClass = ShadowUI.patchClassNames(value);

        domUtils.removeClass(elem, patchedClass);
    }

    static hasClass (el, value) {
        var patchedClass = ShadowUI.patchClassNames(value);

        return domUtils.hasClass(el, patchedClass);
    }

    static patchId (value) {
        return value + SHADOW_UI_CLASS_NAME.postfix;
    }

    static patchClassNames (value) {
        var names = value.split(/\s+/);

        for (var i = 0; i < names.length; i++)
            names[i] += SHADOW_UI_CLASS_NAME.postfix;

        return names.join(' ');
    }

    select (selector, context) {
        var patchedSelector = selector.replace(this.CLASSNAME_REGEX,
            className => className + SHADOW_UI_CLASS_NAME.postfix);

        return context ? nativeMethods.elementQuerySelectorAll.call(context, patchedSelector) :
               nativeMethods.querySelectorAll.call(this.document, patchedSelector);
    }

    setBlind (value) {
        if (value)
            this.addClass(this.getRoot(), this.BLIND_CLASS);
        else
            this.removeClass(this.getRoot(), this.BLIND_CLASS);
    }

    getLastActiveElement () {
        return this.lastActiveElement;
    }

    setLastActiveElement (el) {
        this.lastActiveElement = el;
    }

    insertBeforeRoot (el) {
        var rootParent = this.getRoot().parentNode;

        return nativeMethods.insertBefore.call(rootParent, el, rootParent.lastChild);
    }
}
