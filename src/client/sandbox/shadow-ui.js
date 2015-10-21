import INTERNAL_PROPS from '../../processing/dom/internal-properties';
import SandboxBase from './base';
import nativeMethods from './native-methods';
import * as domUtils from '../utils/dom';
import { isWebKit } from '../utils/browser';
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

        this.root              = null;
        this.lastActiveElement = null;
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

    _filterElement (el) {
        if (!el || el === this.document || el === this.window)
            return el;

        return domUtils.isShadowUIElement(el) ? null : el;
    }

    _filterNodeList (nodeList) {
        var filteredList = [];
        var nlLength     = nodeList.length;

        for (var i = 0; i < nlLength; i++) {
            var el = this._filterElement(nodeList[i]);

            if (el)
                filteredList.push(el);
        }

        filteredList.item = index => index >= filteredList.length ? null : filteredList[index];

        if (nodeList.namedItem)
            filteredList.namedItem = name => nodeList.namedItem(name);

        return filteredList.length === nlLength ? nodeList : filteredList;
    }

    _overrideDocumentMethods (document) {
        var shadowUI = this;

        document.elementFromPoint = function () {
            // NOTE: T212974
            shadowUI.addClass(shadowUI.getRoot(), shadowUI.HIDDEN_CLASS);

            var res = shadowUI._filterElement(nativeMethods.elementFromPoint.apply(document, arguments));

            shadowUI.removeClass(shadowUI.getRoot(), shadowUI.HIDDEN_CLASS);

            return res;
        };

        document.getElementById = function () {
            return shadowUI._filterElement(nativeMethods.getElementById.apply(document, arguments));
        };

        document.getElementsByClassName = function () {
            return shadowUI._filterNodeList(nativeMethods.getElementsByClassName.apply(document, arguments));
        };

        document.getElementsByName = function () {
            return shadowUI._filterNodeList(nativeMethods.getElementsByName.apply(document, arguments));
        };

        document.getElementsByTagName = function () {
            return shadowUI._filterNodeList(nativeMethods.getElementsByTagName.apply(document, arguments));
        };

        document.querySelector = function () {
            return shadowUI._filterElement(nativeMethods.querySelector.apply(document, arguments));
        };

        document.querySelectorAll = function () {
            return shadowUI._filterNodeList(nativeMethods.querySelectorAll.apply(document, arguments));
        };

        // NOTE: T195358
        document.querySelectorAll.toString       = () => nativeMethods.querySelectorAll.toString();
        document.getElementsByClassName.toString = () => nativeMethods.getElementsByClassName.toString();
    }

    getRoot () {
        if (!this.root || /* NOTE: T225944 */ !this.document.body.contains(this.root)) {
            this.overrideElement(this.document.body);

            if (!this.root) {
                // NOTE: B254893
                this.root = this.document.createElement('div');
                nativeMethods.setAttribute.call(this.root, 'id', this.ROOT_ID);
                nativeMethods.setAttribute.call(this.root, 'contenteditable', 'false');
                this.document.body.appendChild(this.root);

                nativeMethods.setAttribute.call(this.root, 'id', ShadowUI.patchClassNames(this.ROOT_ID));

                this.addClass(this.root, this.ROOT_CLASS);

                for (var i = 0; i < EVENTS.length; i++)
                    this.root.addEventListener(EVENTS[i], stopPropagation);

                this._bringRootToWindowTopLeft();
                nativeMethods.documentAddEventListener.call(this.document, 'DOMContentLoaded', () => this._bringRootToWindowTopLeft);
            }
            else
                this.document.body.appendChild(this.root);
        }

        return this.root;
    }

    attach (window) {
        super.attach(window, window.document);

        this._overrideDocumentMethods(window.document);

        this.iframeSandbox.on(this.iframeSandbox.IFRAME_READY_TO_INIT_EVENT, e => {
            var style = this.getUIStylesheet();

            if (style) {
                style = style.cloneNode(true);

                var iframeDocumentHead = e.iframe.contentDocument.head;

                iframeDocumentHead.insertBefore(style, iframeDocumentHead.firstChild);
            }
        });

        // NOTE: T174435
        if (isWebKit) {
            var styleLink  = null;
            var shadowRoot = null;

            this.nodeMutation.on(this.nodeMutation.BEFORE_DOCUMENT_CLEANED_EVENT, () => {
                styleLink = this.getUIStylesheet();

                if (window.top === window.self) {
                    if (this.select('.root').length) {
                        shadowRoot = this.getRoot();
                        shadowRoot.parentNode.removeChild(shadowRoot);
                    }
                    else
                        shadowRoot = null;
                }
            });

            var restoreStyle = e => {
                if (!this.getUIStylesheet()) {
                    var headElemenet = e.document.head;

                    if (styleLink && headElemenet) {
                        styleLink = styleLink.cloneNode(true);
                        headElemenet.insertBefore(styleLink, headElemenet.firstChild);

                        if (window.top === window.self && shadowRoot)
                            e.document.body.appendChild(shadowRoot);
                    }
                }
            };

            this.nodeMutation.on(this.nodeMutation.DOCUMENT_CLEANED_EVENT, restoreStyle);
            this.nodeMutation.on(this.nodeMutation.DOCUMENT_CLOSED_EVENT, restoreStyle);
        }

        this.nodeMutation.on(this.nodeMutation.BODY_CONTENT_CHANGED_EVENT, el => {
            var elContextWindow = el[INTERNAL_PROPS.processedContext];

            if (elContextWindow !== window) {
                this.messageSandbox.sendServiceMsg({
                    cmd: this.BODY_CONTENT_CHANGED_COMMAND
                }, elContextWindow);
            }
            else
                this.onBodyContentChanged();
        });

        this.messageSandbox.on(this.messageSandbox.SERVICE_MSG_RECEIVED_EVENT, e => {
            if (e.message.cmd === this.BODY_CONTENT_CHANGED_COMMAND)
                this.onBodyContentChanged();
        });
    }

    onBodyContentChanged () {
        if (this.root) {
            if (!domUtils.closest(this.root, 'html'))
                this.document.body.appendChild(this.root);
        }
    }

    // NOTE: Fix for B239138 - unroll.me 'Cannot read property 'document' of null' error raised during recording
    // There were an issue when document.body was replaced, so we need to reattach UI to a new body manually.
    onBodyElementMutation () {
        if (this.root) {
            if (this.document.body && this.root.parentNode !== this.document.body) {
                this.overrideElement(this.document.body);
                this.document.body.appendChild(this.root);
            }
        }
    }

    overrideElement (el) {
        var shadowUI = this;
        var tagName  = el && el.tagName && el.tagName.toLowerCase();

        if (tagName && (tagName === 'body' || tagName === 'head')) {
            el.getElementsByClassName = function () {
                return shadowUI._filterNodeList(nativeMethods.elementGetElementsByClassName.apply(el, arguments));
            };

            el.getElementsByTagName = function () {
                return shadowUI._filterNodeList(nativeMethods.elementGetElementsByTagName.apply(el, arguments));
            };

            el.querySelector = function () {
                return shadowUI._filterElement(nativeMethods.elementQuerySelector.apply(el, arguments));
            };

            el.querySelectorAll = function () {
                return shadowUI._filterNodeList(nativeMethods.elementQuerySelectorAll.apply(el, arguments));
            };
        }
    }

    // Accessors
    getFirstChild (el) {
        var childNodes = this._filterNodeList(el.childNodes);

        return childNodes.length && childNodes[0] ? childNodes[0] : null;
    }

    getFirstElementChild (el) {
        var childNodes = this._filterNodeList(el.childNodes);
        var cnLength   = childNodes.length;

        for (var i = 0; i < cnLength; i++) {
            if (childNodes[i].nodeType === 1)
                return childNodes[i];
        }

        return null;
    }

    getLastChild (el) {
        var childNodes = this._filterNodeList(el.childNodes);
        var index      = childNodes.length - 1;

        return index >= 0 ? childNodes[index] : null;
    }

    getLastElementChild (el) {
        var childNodes = this._filterNodeList(el.childNodes);
        var cnLength   = childNodes.length;

        for (var i = cnLength - 1; i >= 0; i--) {
            if (childNodes[i].nodeType === 1)
                return childNodes[i];
        }

        return null;
    }

    // Utils
    static checkElementsPosition (collection) {
        if (collection.length) {
            var parent           = collection[0].parentNode || collection[0].parentElement;
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
        if (domUtils.isDomElement(el)) {
            var tagName = el.tagName.toLowerCase();

            return tagName === 'head' || tagName === 'body';
        }

        return false;
    }

    static isShadowContainerCollection (collection) {
        var parent = null;

        try {
            if (collection.length && !domUtils.isWindow(collection) && collection[0] && collection[0].nodeType) {
                parent = collection[0].parentNode || collection[0].parentElement;

                if (parent && (parent.childNodes === collection || parent.children === collection))
                    return ShadowUI.isShadowContainer(parent);
            }
        }
            /*eslint-disable no-empty */
        catch (e) {
        }
        /*eslint-disable no-empty */

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

    static patchClassNames (value) {
        var names = value.split(/\s+/);

        for (var i = 0; i < names.length; i++)
            names[i] += SHADOW_UI_CLASS_NAME.postfix;

        return names.join(' ');
    }

    getUIStylesheet () {
        return nativeMethods.querySelector.call(this.document, 'link.' + SHADOW_UI_CLASS_NAME.uiStylesheet);
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
}
