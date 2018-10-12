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
import { getNativeQuerySelectorAll } from '../utils/query-selector';
import HTMLCollectionWrapper from './node/live-node-list/html-collection-wrapper';
import { getElementsByNameReturnsHTMLCollection } from '../utils/feature-detection';

const IS_NON_STATIC_POSITION_RE = /fixed|relative|absolute/;
const CLASSNAME_RE              = /\.((?:\\.|[-\w]|[^\x00-\xa0])+)/g;

const IS_SHADOW_CONTAINER_FLAG            = 'hammerhead|shadow-ui|container-flag';
const IS_SHADOW_CONTAINER_COLLECTION_FLAG = 'hammerhead|shadow-ui|container-collection-flag';
const HTML_COLLECTION_WRAPPER             = 'hammerhead|shadow-ui|html-collection-wrapper';

export default class ShadowUI extends SandboxBase {
    constructor (nodeMutation, messageSandbox, iframeSandbox) {
        super();

        this.BODY_CONTENT_CHANGED_COMMAND = 'hammerhead|command|body-content-changed';

        this.ROOT_CLASS   = 'root';
        this.ROOT_ID      = 'root';
        this.HIDDEN_CLASS = 'hidden';
        this.BLIND_CLASS  = 'blind';

        this.nodeMutation        = nodeMutation;
        this.messageSandbox      = messageSandbox;
        this.iframeSandbox       = iframeSandbox;

        this.root                    = null;
        this.lastActiveElement       = null;
        this.uiStyleSheetsHtmlBackup = null;
        this.wrapperCreators         = this._createWrapperCreators();
    }

    static _filterElement (el) {
        return el && domUtils.isShadowUIElement(el) ? null : el;
    }

    _filterList (list, listLength, predicate) {
        const filteredList = [];

        for (let i = 0; i < listLength; i++) {
            const el = predicate(list[i]);

            if (el)
                filteredList.push(list[i]);
        }

        nativeMethods.objectDefineProperty.call(this.window.Object, filteredList, 'item', {
            value: index => index >= filteredList.length ? null : filteredList[index]
        });

        if (list.namedItem) {
            nativeMethods.objectDefineProperty.call(this.window.Object, filteredList, 'namedItem', {
                value: name => list.namedItem(name)
            });
        }

        return filteredList.length === listLength ? list : filteredList;
    }

    _filterNodeList (nodeList, nodeListLength) {
        return this._filterList(nodeList, nodeListLength, item => ShadowUI._filterElement(item));
    }

    _filterStyleSheetList (styleSheetList, styleSheetListLength) {
        return this._filterList(styleSheetList, styleSheetListLength, item => ShadowUI._filterElement(item.ownerNode));
    }

    static _getFirstNonShadowElement (nodeList) {
        for (const node of nodeList) {
            if (ShadowUI._filterElement(node))
                return node;
        }

        return null;
    }

    _createWrapperCreators () {
        const sandbox = this;

        return {
            getElementsByClassName (nativeGetElementsByClassNameFnName) {
                return function (...args) {
                    const elements = nativeMethods[nativeGetElementsByClassNameFnName].apply(this, args);
                    const length   = nativeMethods.htmlCollectionLengthGetter.call(elements);

                    return sandbox._filterNodeList(elements, length);
                };
            },

            getElementsByTagName (nativeGetElementsByTagNameFnName) {
                return function (...args) {
                    const nativeCollection = nativeMethods[nativeGetElementsByTagNameFnName].apply(this, args);
                    const tagName          = args[0];

                    if (typeof tagName !== 'string')
                        return nativeCollection;

                    if (!nativeCollection[HTML_COLLECTION_WRAPPER])
                        nativeCollection[HTML_COLLECTION_WRAPPER] = new HTMLCollectionWrapper(nativeCollection, tagName);
                    else
                        nativeCollection[HTML_COLLECTION_WRAPPER]._refreshCollection();

                    return nativeCollection[HTML_COLLECTION_WRAPPER];
                };
            },

            querySelector (nativeQuerySelectorFnName, nativeQuerySelectorAllFnName) {
                return function (...args) {
                    if (typeof args[0] === 'string')
                        args[0] = NodeSandbox.processSelector(args[0]);

                    const element         = nativeMethods[nativeQuerySelectorFnName].apply(this, args);
                    const filteredElement = ShadowUI._filterElement(element);

                    if (!element || filteredElement)
                        return filteredElement;

                    return ShadowUI._getFirstNonShadowElement(nativeMethods[nativeQuerySelectorAllFnName].apply(this, args));
                };
            },

            querySelectorAll (nativeQuerySelectorAllFnName) {
                return function (...args) {
                    if (typeof args[0] === 'string')
                        args[0] = NodeSandbox.processSelector(args[0]);

                    const list = nativeMethods[nativeQuerySelectorAllFnName].apply(this, args);
                    const length = nativeMethods.nodeListLengthGetter.call(list);

                    return sandbox._filterNodeList(list, length);
                };
            }
        };
    }

    _markShadowUIContainerAndCollections (containerEl) {
        nativeMethods.objectDefineProperty.call(this.window.Object, containerEl, IS_SHADOW_CONTAINER_FLAG, { value: true });
        ShadowUI.markCollectionAsShadow(containerEl.children);
        nativeMethods.objectDefineProperty.call(this.window.Object, containerEl.childNodes, IS_SHADOW_CONTAINER_COLLECTION_FLAG, { value: true });
    }

    markShadowUIContainers (head, body) {
        if (head)
            this._markShadowUIContainerAndCollections(head);

        if (body)
            this._markShadowUIContainerAndCollections(body);
    }

    _bringRootToWindowTopLeft () {
        let rootHasParentWithNonStaticPosition = false;
        let parent                             = this.root.parentNode;

        while (parent) {
            const elementPosition = getStyle(parent, 'position');

            if (IS_NON_STATIC_POSITION_RE.test(elementPosition))
                rootHasParentWithNonStaticPosition = true;

            parent = parent.parentNode;
        }

        if (rootHasParentWithNonStaticPosition) {
            const rootOffset = getOffsetPosition(this.root);

            if (rootOffset.left !== 0 || rootOffset.top !== 0) {
                const currentRootLeft = parseFloat(getStyle(this.root, 'left')) || 0;
                const currentRootTop  = parseFloat(getStyle(this.root, 'top')) || 0;
                const newRootLeft     = currentRootLeft - rootOffset.left + 'px';
                const newRootTop      = currentRootTop - rootOffset.top + 'px';

                setStyle(this.root, 'left', newRootLeft);
                setStyle(this.root, 'top', newRootTop);
            }
        }
    }

    _overrideDocumentMethods (document) {
        const shadowUI = this;
        const docProto = document.constructor.prototype;

        docProto.elementFromPoint = function (...args) {
            // NOTE: T212974
            shadowUI.addClass(shadowUI.getRoot(), shadowUI.HIDDEN_CLASS);

            const res = ShadowUI._filterElement(nativeMethods.elementFromPoint.apply(this, args));

            shadowUI.removeClass(shadowUI.getRoot(), shadowUI.HIDDEN_CLASS);

            return res;
        };

        if (document.caretRangeFromPoint) {
            docProto.caretRangeFromPoint = function (...args) {
                shadowUI.addClass(shadowUI.getRoot(), shadowUI.HIDDEN_CLASS);

                let res = nativeMethods.caretRangeFromPoint.apply(this, args);

                if (res && res.startContainer && !ShadowUI._filterElement(res.startContainer))
                    res = null;

                shadowUI.removeClass(shadowUI.getRoot(), shadowUI.HIDDEN_CLASS);

                return res;
            };
        }

        if (document.caretPositionFromPoint) {
            docProto.caretPositionFromPoint = function (...args) {
                shadowUI.addClass(shadowUI.getRoot(), shadowUI.HIDDEN_CLASS);

                let res = nativeMethods.caretPositionFromPoint.apply(this, args);

                if (res && res.offsetNode && !ShadowUI._filterElement(res.offsetNode))
                    res = null;

                shadowUI.removeClass(shadowUI.getRoot(), shadowUI.HIDDEN_CLASS);

                return res;
            };
        }

        docProto.getElementById = function (...args) {
            return ShadowUI._filterElement(nativeMethods.getElementById.apply(this, args));
        };

        docProto.getElementsByName = function (...args) {
            const elements = nativeMethods.getElementsByName.apply(this, args);
            const length   = getElementsByNameReturnsHTMLCollection
                ? nativeMethods.htmlCollectionLengthGetter.call(elements)
                : nativeMethods.nodeListLengthGetter.call(elements);

            return shadowUI._filterNodeList(elements, length);
        };

        docProto.getElementsByClassName = this.wrapperCreators.getElementsByClassName('getElementsByClassName');
        docProto.getElementsByTagName   = this.wrapperCreators.getElementsByTagName('getElementsByTagName');
        docProto.querySelector          = this.wrapperCreators.querySelector('querySelector', 'querySelectorAll');
        docProto.querySelectorAll       = this.wrapperCreators.querySelectorAll('querySelectorAll');

        // NOTE: T195358
        docProto.querySelectorAll.toString       = () => nativeMethods.querySelectorAll.toString();
        docProto.getElementsByClassName.toString = () => nativeMethods.getElementsByClassName.toString();
    }

    _overrideElementMethods (window) {
        const bodyProto = window.HTMLBodyElement.prototype;
        const headProto = window.HTMLHeadElement.prototype;

        bodyProto.getElementsByClassName = this.wrapperCreators.getElementsByClassName('elementGetElementsByClassName');
        bodyProto.getElementsByTagName   = this.wrapperCreators.getElementsByTagName('elementGetElementsByTagName');
        bodyProto.querySelector          = this.wrapperCreators.querySelector('elementQuerySelector', 'elementQuerySelectorAll');
        bodyProto.querySelectorAll       = this.wrapperCreators.querySelectorAll('elementQuerySelectorAll');

        headProto.getElementsByClassName = bodyProto.getElementsByClassName;
        headProto.getElementsByTagName   = bodyProto.getElementsByTagName;
        headProto.querySelector          = bodyProto.querySelector;
        headProto.querySelectorAll       = bodyProto.querySelectorAll;
    }

    _getUIStyleSheetsHtml () {
        const stylesSelector = 'link.' + SHADOW_UI_CLASS_NAME.uiStylesheet;
        const stylesheets    = this.nativeMethods.querySelectorAll.call(this.document, stylesSelector);
        let result           = '';

        for (const stylesheet of stylesheets)
            result += nativeMethods.elementOuterHTMLGetter.call(stylesheet);

        return result;
    }

    _restoreUIStyleSheets (head, uiStyleSheetsHtml) {
        if (!head || !uiStyleSheetsHtml)
            return;

        const parser = this.nativeMethods.createElement.call(this.document, 'div');

        nativeMethods.elementInnerHTMLSetter.call(parser, uiStyleSheetsHtml);

        for (let i = 0; i < parser.children.length; i++) {
            const refNode = head.children[i] || null;
            const newNode = nativeMethods.cloneNode.call(parser.children[i]);

            ShadowUI._markElementAsShadow(newNode);
            this.nativeMethods.insertBefore.call(head, newNode, refNode);
        }
    }

    _markScriptsAndStylesAsShadowInHead (head) {
        // NOTE: document.head equals null after call 'document.open' function
        if (!head)
            return;

        for (const headChild of head.children) {
            if (ShadowUI.containsShadowUIClassPostfix(headChild))
                ShadowUI._markElementAsShadow(headChild);
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
                ShadowUI._markElementAsShadow(this.root);
                nativeMethods.appendChild.call(this.document.body, this.root);

                for (const event of EVENTS)
                    this.root.addEventListener(event, stopPropagation);

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

        this.markShadowUIContainers(this.document.head, this.document.body);
        this._overrideDocumentMethods(window.document);
        this._overrideElementMethods(window);
        this._markScriptsAndStylesAsShadowInHead(window.document.head);

        this.iframeSandbox.on(this.iframeSandbox.RUN_TASK_SCRIPT_EVENT, e => {
            const iframeHead = e.iframe.contentDocument.head;
            const iframeBody = e.iframe.contentDocument.body;

            this._restoreUIStyleSheets(iframeHead, this._getUIStyleSheetsHtml());
            this.markShadowUIContainers(iframeHead, iframeBody);
        });

        this.nodeMutation.on(this.nodeMutation.BEFORE_DOCUMENT_CLEANED_EVENT, () => {
            this.uiStyleSheetsHtmlBackup = this._getUIStyleSheetsHtml();
        });

        this.nodeMutation.on(this.nodeMutation.DOCUMENT_CLEANED_EVENT, e => {
            this._restoreUIStyleSheets(e.document.head, this.uiStyleSheetsHtmlBackup);
            this.uiStyleSheetsHtmlBackup = null;

            this.markShadowUIContainers(this.document.head, this.document.body);
        });

        this.nodeMutation.on(this.nodeMutation.DOCUMENT_CLOSED_EVENT, e => {
            this._restoreUIStyleSheets(e.document.head, this.uiStyleSheetsHtmlBackup);
            this.uiStyleSheetsHtmlBackup = null;

            this.markShadowUIContainers(e.document.head, e.document.body);
        });

        this.nodeMutation.on(this.nodeMutation.BODY_CONTENT_CHANGED_EVENT, el => {
            const elContextWindow = el[INTERNAL_PROPS.processedContext];

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

        this.nodeMutation.on(this.nodeMutation.BODY_CREATED_EVENT, ({ body }) =>
            this.markShadowUIContainers(this.document.head, body));
    }

    onBodyElementMutation () {
        if (!this.root || !this.document.body)
            return;

        const isRootInDom     = domUtils.closest(this.root, 'html');
        const isRootLastChild = !this.nativeMethods.elementNextElementSiblingGetter.call(this.root);
        // NOTE: Fix for B239138 - The 'Cannot read property 'document' of null' error
        // is thrown on recording on the unroll.me site. There was an issue when
        // document.body was replaced, so we need to reattach a UI to a new body manually.
        const isRootInBody = this.root.parentNode === this.document.body;

        if (!(isRootInDom && isRootLastChild && isRootInBody))
            this.nativeMethods.appendChild.call(this.document.body, this.root);

        this.markShadowUIContainers(this.document.head, this.document.body);
    }

    // Accessors
    getFirstChild (el) {
        const length        = nativeMethods.nodeListLengthGetter.call(el.childNodes);
        const filteredNodes = this._filterNodeList(el.childNodes, length);

        return filteredNodes[0] || null;
    }

    getFirstElementChild (el) {
        const length        = nativeMethods.htmlCollectionLengthGetter.call(el.children);
        const filteredNodes = this._filterNodeList(el.children, length);

        return filteredNodes[0] || null;
    }

    getLastChild (el) {
        const length        = nativeMethods.nodeListLengthGetter.call(el.childNodes);
        const filteredNodes = this._filterNodeList(el.childNodes, length);
        const index         = el.childNodes === filteredNodes ? length - 1 : filteredNodes.length - 1;

        return index >= 0 ? filteredNodes[index] : null;
    }

    getLastElementChild (el) {
        const length         = nativeMethods.htmlCollectionLengthGetter.call(el.children);
        const filteredNodes  = this._filterNodeList(el.children, length);
        const index          = el.children === filteredNodes ? length - 1 : filteredNodes.length - 1;

        return index >= 0 ? filteredNodes[index] : null;
    }

    getNextSibling (el) {
        do
            el = nativeMethods.nodeNextSiblingGetter.call(el);
        while (el && domUtils.isShadowUIElement(el));

        return el;
    }

    getNextElementSibling (el) {
        do
            el = nativeMethods.elementNextElementSiblingGetter.call(el);
        while (el && domUtils.isShadowUIElement(el));

        return el;
    }

    // Utils
    static _checkElementsPosition (collection, length) {
        if (!length)
            return;

        const shadowUIElements = [];

        for (let i = 0; i < length; i++) {
            const item = collection[i];

            if (domUtils.isShadowUIElement(item))
                shadowUIElements.push(item);
        }

        const collectionOwner = shadowUIElements.length && shadowUIElements[0].parentNode;

        for (const shadowUIElement of shadowUIElements)
            nativeMethods.appendChild.call(collectionOwner, shadowUIElement);
    }

    static _hasFlag (obj, flag) {
        try {
            return !!obj[flag];
        }
        catch (e) {
            return false;
        }
    }

    static isShadowContainer (el) {
        return ShadowUI._hasFlag(el, IS_SHADOW_CONTAINER_FLAG);
    }

    static isShadowContainerCollection (collection) {
        return ShadowUI._hasFlag(collection, IS_SHADOW_CONTAINER_COLLECTION_FLAG);
    }

    static getShadowUICollectionLength (collection, length) {
        let shadowUIElementCount = 0;

        for (let i = 0; i < length; i++) {
            if (domUtils.isShadowUIElement(collection[i]))
                shadowUIElementCount++;
        }

        if (shadowUIElementCount)
            ShadowUI._checkElementsPosition(collection, length);

        return length - shadowUIElementCount;
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
        const selfRemovingScripts = nativeMethods.querySelectorAll.call(document,
            '.' + SHADOW_UI_CLASS_NAME.selfRemovingScript);

        for (const selfRemovingScript of selfRemovingScripts)
            nativeMethods.removeChild.call(selfRemovingScript.parentNode, selfRemovingScript);
    }

    // API
    // NOTE: this method cannot be static because it is a part of the public API
    addClass (el, value) {
        const patchedClass = ShadowUI.patchClassNames(value);

        domUtils.addClass(el, patchedClass);
    }

    // NOTE: this method cannot be static because it is a part of the public API
    removeClass (elem, value) {
        const patchedClass = ShadowUI.patchClassNames(value);

        domUtils.removeClass(elem, patchedClass);
    }

    static hasClass (el, value) {
        const patchedClass = ShadowUI.patchClassNames(value);

        return domUtils.hasClass(el, patchedClass);
    }

    static patchId (value) {
        return value + SHADOW_UI_CLASS_NAME.postfix;
    }

    static patchClassNames (value) {
        const names = value.split(/\s+/);

        for (let i = 0; i < names.length; i++)
            names[i] += SHADOW_UI_CLASS_NAME.postfix;

        return names.join(' ');
    }

    select (selector, context) {
        const patchedSelector = selector.replace(CLASSNAME_RE,
            className => className + SHADOW_UI_CLASS_NAME.postfix);

        return context
            ? nativeMethods.elementQuerySelectorAll.call(context, patchedSelector)
            : nativeMethods.querySelectorAll.call(this.document, patchedSelector);
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
        const rootParent      = this.getRoot().parentNode;
        const lastParentChild = this.nativeMethods.nodeLastChildGetter.call(rootParent);

        return nativeMethods.insertBefore.call(rootParent, el, lastParentChild);
    }

    static _markElementAsShadow (el) {
        el[INTERNAL_PROPS.shadowUIElement] = true;
    }

    static markElementAndChildrenAsShadow (el) {
        ShadowUI._markElementAsShadow(el);

        const childElements = getNativeQuerySelectorAll(el).call(el, '*');

        for (const childElement of childElements)
            ShadowUI._markElementAsShadow(childElement);
    }

    static markCollectionAsShadow (collection) {
        nativeMethods.objectDefineProperty(collection, IS_SHADOW_CONTAINER_COLLECTION_FLAG, { value: true });
    }

    static containsShadowUIClassPostfix (element) {
        return typeof element.className === 'string' &&
               element.className.indexOf(SHADOW_UI_CLASS_NAME.postfix) !== -1;
    }
}
