import INTERNAL_PROPS from '../../processing/dom/internal-properties';
import SandboxBase from './base';
import NodeSandbox from './node/index';
import nativeMethods from './native-methods';
import * as domUtils from '../utils/dom';
import DomProcessor from '../dom-processor';
import { getOffsetPosition } from '../utils/position';
import SHADOW_UI_CLASS_NAME from '../../shadow-ui/class-name';
import { get as getStyle, set as setStyle } from '../utils/style';
import { stopPropagation } from '../utils/event';
import { getNativeQuerySelectorAll } from '../utils/query-selector';
import HTMLCollectionWrapper from './node/live-node-list/html-collection-wrapper';
import { getElementsByNameReturnsHTMLCollection } from '../utils/feature-detection';
import { isIE } from '../utils/browser';
import { DocumentCleanedEvent } from '../../typings/client';
import NodeMutation from './node/mutation';
import MessageSandbox from './event/message';
import IframeSandbox from './iframe';
import IEDebugSandbox from './ie-debug';

const IS_NON_STATIC_POSITION_RE = /fixed|relative|absolute/;
const CLASSNAME_RE              = /\.((?:\\.|[-\w]|[^\x00-\xa0])+)/g;

const IS_SHADOW_CONTAINER_FLAG            = 'hammerhead|shadow-ui|container-flag';
const IS_SHADOW_CONTAINER_COLLECTION_FLAG = 'hammerhead|shadow-ui|container-collection-flag';
const HTML_COLLECTION_WRAPPER             = 'hammerhead|shadow-ui|html-collection-wrapper';

export default class ShadowUI extends SandboxBase {
    BODY_CONTENT_CHANGED_COMMAND: string = 'hammerhead|command|body-content-changed';

    ROOT_CLASS: string = 'root';
    ROOT_ID: string = 'root';
    HIDDEN_CLASS: string = 'hidden';
    BLIND_CLASS: string = 'blind';

    root: any;
    lastActiveElement: any;
    uiStyleSheetsHtmlBackup: any;
    wrapperCreators: any;

    runTaskScriptEventCallback: Function;
    beforeDocumentCleanedEventCallback: Function;
    documentCleanedEventCallback: Function;
    documentClosedEventCallback: Function;
    bodyContentChangedEventCallback: Function;
    serviceMsgReceivedEventCallback: Function;
    bodyCreatedEventCallback: Function;

    constructor (private readonly _nodeMutation: NodeMutation,
        private readonly _messageSandbox: MessageSandbox,
        private readonly _iframeSandbox: IframeSandbox,
        private readonly _ieDebugSandbox: IEDebugSandbox) {
        super();

        this.root                    = null;
        this.lastActiveElement       = null;
        this.uiStyleSheetsHtmlBackup = null;
        this.wrapperCreators         = this._createWrapperCreators();

        this._initEventCallbacks();
    }

    _initEventCallbacks () {
        this.runTaskScriptEventCallback = (iframe: HTMLIFrameElement) => {
            const contentDocument = nativeMethods.contentDocumentGetter.call(iframe);
            const iframeHead      = contentDocument.head;
            const iframeBody      = contentDocument.body;

            this._restoreUIStyleSheets(iframeHead, this._getUIStyleSheetsHtml());
            this.markShadowUIContainers(iframeHead, iframeBody);
        };

        this.beforeDocumentCleanedEventCallback = () => {
            this.uiStyleSheetsHtmlBackup = this._getUIStyleSheetsHtml();
        };

        this.documentCleanedEventCallback = (e: DocumentCleanedEvent) => {
            this._restoreUIStyleSheets(e.document.head, this.uiStyleSheetsHtmlBackup);
            this.uiStyleSheetsHtmlBackup = null;

            this.markShadowUIContainers(this.document.head, this.document.body);
        };

        this.documentClosedEventCallback = (document: Document) => {
            this._restoreUIStyleSheets(document.head, this.uiStyleSheetsHtmlBackup);
            this.uiStyleSheetsHtmlBackup = null;

            this.markShadowUIContainers(document.head, document.body);
        };

        this.bodyContentChangedEventCallback = (body: HTMLBodyElement) => {
            // @ts-ignore
            const elContextWindow = body[INTERNAL_PROPS.processedContext];

            if (elContextWindow !== window) {
                this._messageSandbox.sendServiceMsg({
                    cmd: this.BODY_CONTENT_CHANGED_COMMAND
                }, elContextWindow);
            }
            else
                this.onBodyElementMutation();
        };

        this.serviceMsgReceivedEventCallback = e => {
            if (e.message.cmd === this.BODY_CONTENT_CHANGED_COMMAND)
                this.onBodyElementMutation();
        };

        this.bodyCreatedEventCallback = body => this.markShadowUIContainers(this.document.head, body);
    }

    static _filterElement (el) {
        return el && domUtils.isShadowUIElement(el) ? null : el;
    }

    _filterList (list, listLength: number, predicate) {
        const filteredList = [];

        for (let i = 0; i < listLength; i++) {
            const el = predicate(list[i]);

            if (el)
                filteredList.push(list[i]);
        }

        nativeMethods.objectDefineProperty(filteredList, 'item', {
            value: index => index >= filteredList.length ? null : filteredList[index]
        });

        if (list.namedItem) {
            nativeMethods.objectDefineProperty(filteredList, 'namedItem', {
                value: name => list.namedItem(name)
            });
        }

        return filteredList.length === listLength ? list : filteredList;
    }

    _filterNodeList (nodeList, originLength: number) {
        return this._filterList(nodeList, originLength, item => ShadowUI._filterElement(item));
    }

    _filterStyleSheetList (styleSheetList, originLength: number) {
        return this._filterList(styleSheetList, originLength, item => ShadowUI._filterElement(item.ownerNode));
    }

    static _getFirstNonShadowElement (nodeList) {
        const length = nativeMethods.nodeListLengthGetter.call(nodeList);

        for (let i = 0; i < length; i++) {
            if (ShadowUI._filterElement(nodeList[i]))
                return nodeList[i];
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

                    if (typeof tagName !== 'string' || !domUtils.isHeadOrBodyOrHtmlElement(this) && !domUtils.isFormElement(this) &&
                        tagName.toLowerCase() !== 'input' && nativeGetElementsByTagNameFnName !== 'getElementsByTagName')
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

                    const list   = nativeMethods[nativeQuerySelectorAllFnName].apply(this, args);
                    const length = nativeMethods.nodeListLengthGetter.call(list);

                    return sandbox._filterNodeList(list, length);
                };
            }
        };
    }

    _markShadowUIContainerAndCollections (containerEl) {
        ShadowUI._markAsShadowContainer(containerEl);
        ShadowUI.markAsShadowContainerCollection(containerEl.children);
        ShadowUI.markAsShadowContainerCollection(nativeMethods.nodeChildNodesGetter.call(containerEl));
    }

    markShadowUIContainers (head, body) {
        if (head)
            this._markShadowUIContainerAndCollections(head);

        if (body)
            this._markShadowUIContainerAndCollections(body);
    }

    _bringRootToWindowTopLeft () {
        let rootHasParentWithNonStaticPosition = false;
        let parent                             = nativeMethods.nodeParentNodeGetter.call(this.root);

        while (parent) {
            const elementPosition = getStyle(parent, 'position');

            if (IS_NON_STATIC_POSITION_RE.test(elementPosition))
                rootHasParentWithNonStaticPosition = true;

            parent = nativeMethods.nodeParentNodeGetter.call(parent);
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

    _overrideDocumentMethods (window, document) {
        const shadowUI = this;
        const docProto = window.Document.prototype;

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
        const elementProto = window.Element.prototype;
        const bodyProto    = window.HTMLBodyElement.prototype;
        const headProto    = window.HTMLHeadElement.prototype;

        elementProto.getElementsByTagName = this.wrapperCreators.getElementsByTagName('elementGetElementsByTagName');

        bodyProto.getElementsByClassName = this.wrapperCreators.getElementsByClassName('elementGetElementsByClassName');
        bodyProto.querySelector          = this.wrapperCreators.querySelector('elementQuerySelector', 'elementQuerySelectorAll');
        bodyProto.querySelectorAll       = this.wrapperCreators.querySelectorAll('elementQuerySelectorAll');

        headProto.getElementsByClassName = bodyProto.getElementsByClassName;
        headProto.querySelector          = bodyProto.querySelector;
        headProto.querySelectorAll       = bodyProto.querySelectorAll;
    }

    _getUIStyleSheetsHtml () {
        const stylesSelector = 'link.' + SHADOW_UI_CLASS_NAME.uiStylesheet;
        const stylesheets    = this.nativeMethods.querySelectorAll.call(this.document, stylesSelector);
        const length         = this.nativeMethods.nodeListLengthGetter.call(stylesheets);
        let result           = '';

        for (let i = 0; i < length; i++)
            result += nativeMethods.elementOuterHTMLGetter.call(stylesheets[i]);

        return result;
    }

    _restoreUIStyleSheets (head, uiStyleSheetsHtml: string) {
        if (!head || !uiStyleSheetsHtml)
            return;

        const parser = this.nativeMethods.createElement.call(this.document, 'div');

        nativeMethods.elementInnerHTMLSetter.call(parser, uiStyleSheetsHtml);

        const length = nativeMethods.htmlCollectionLengthGetter.call(parser.children);

        for (let i = 0; i < length; i++) {
            const refNode = head.children[i] || null;
            const newNode = nativeMethods.cloneNode.call(parser.children[i]);

            ShadowUI.markElementAsShadow(newNode);
            this.nativeMethods.insertBefore.call(head, newNode, refNode);
        }
    }

    _markScriptsAndStylesAsShadowInHead (head) {
        // NOTE: document.head equals null after call 'document.open' function
        if (!head)
            return;

        const length = nativeMethods.htmlCollectionLengthGetter.call(head.children);

        for (let i = 0; i < length; i++) {
            const headChild = head.children[i];

            if (ShadowUI.containsShadowUIClassPostfix(headChild))
                ShadowUI.markElementAsShadow(headChild);
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
                ShadowUI.markElementAsShadow(this.root);
                nativeMethods.appendChild.call(this.document.body, this.root);

                const nativeDocumentAddEventListener = nativeMethods.documentAddEventListener || nativeMethods.addEventListener;

                for (const event of DomProcessor.EVENTS)
                    nativeMethods.addEventListener.call(this.root, event, stopPropagation);

                this._bringRootToWindowTopLeft();
                nativeDocumentAddEventListener.call(this.document, 'DOMContentLoaded', () => {
                    this.onBodyElementMutation();
                    this._bringRootToWindowTopLeft();
                });
            }
            else
                nativeMethods.appendChild.call(this.document.body, this.root);
        }

        return this.root;
    }

    attach (window: Window) {
        super.attach(window, window.document);

        this.markShadowUIContainers(this.document.head, this.document.body);
        this._overrideDocumentMethods(window, window.document);
        this._overrideElementMethods(window);
        this._markScriptsAndStylesAsShadowInHead(window.document.head);
        this._initEvents();
    }

    _initEvents () {
        this._iframeSandbox.on(this._iframeSandbox.RUN_TASK_SCRIPT_EVENT, this.runTaskScriptEventCallback);
        this._nodeMutation.on(this._nodeMutation.BEFORE_DOCUMENT_CLEANED_EVENT, this.beforeDocumentCleanedEventCallback);
        this._nodeMutation.on(this._nodeMutation.DOCUMENT_CLEANED_EVENT, this.documentCleanedEventCallback);
        this._nodeMutation.on(this._nodeMutation.DOCUMENT_CLOSED_EVENT, this.documentClosedEventCallback);
        this._nodeMutation.on(this._nodeMutation.BODY_CONTENT_CHANGED_EVENT, this.bodyContentChangedEventCallback);
        this._messageSandbox.on(this._messageSandbox.SERVICE_MSG_RECEIVED_EVENT, this.serviceMsgReceivedEventCallback);
        this._nodeMutation.on(this._nodeMutation.BODY_CREATED_EVENT, this.bodyCreatedEventCallback);
    }

    onBodyElementMutation () {
        if (!this.root || !this.document.body)
            return;

        const isRootInDom     = domUtils.closest(this.root, 'html');
        const isRootLastChild = !this.nativeMethods.elementNextElementSiblingGetter.call(this.root);
        // NOTE: Fix for B239138 - The 'Cannot read property 'document' of null' error
        // is thrown on recording on the unroll.me site. There was an issue when
        // document.body was replaced, so we need to reattach a UI to a new body manually.
        const isRootInBody = nativeMethods.nodeParentNodeGetter.call(this.root) === this.document.body;

        if (!(isRootInDom && isRootLastChild && isRootInBody))
            this.nativeMethods.appendChild.call(this.document.body, this.root);

        this.markShadowUIContainers(this.document.head, this.document.body);
    }

    // Accessors
    getFirstChild (el) {
        const childNodes    = nativeMethods.nodeChildNodesGetter.call(el);
        const length        = nativeMethods.nodeListLengthGetter.call(childNodes);
        const filteredNodes = this._filterNodeList(childNodes, length);

        return filteredNodes[0] || null;
    }

    getFirstElementChild (el) {
        const length        = nativeMethods.htmlCollectionLengthGetter.call(el.children);
        const filteredNodes = this._filterNodeList(el.children, length);

        return filteredNodes[0] || null;
    }

    getLastChild (el) {
        const childNodes    = nativeMethods.nodeChildNodesGetter.call(el);
        const length        = nativeMethods.nodeListLengthGetter.call(childNodes);
        const filteredNodes = this._filterNodeList(childNodes, length);
        const index         = childNodes === filteredNodes ? length - 1 : filteredNodes.length - 1;

        return index >= 0 ? filteredNodes[index] : null;
    }

    getLastElementChild (el) {
        const length         = nativeMethods.htmlCollectionLengthGetter.call(el.children);
        const filteredNodes  = this._filterNodeList(el.children, length);
        const index          = el.children === filteredNodes ? length - 1 : filteredNodes.length - 1;

        return index >= 0 ? filteredNodes[index] : null;
    }

    getNextSibling (el) {
        if (!el)
            return el;

        do
            el = nativeMethods.nodeNextSiblingGetter.call(el);
        while (el && domUtils.isShadowUIElement(el));

        return el;
    }

    getPrevSibling (el) {
        if (!el)
            return el;

        do
            el = nativeMethods.nodePrevSiblingGetter.call(el);
        while (el && domUtils.isShadowUIElement(el));

        return el;
    }

    getMutationRecordNextSibling (el) {
        if (!el)
            return el;

        while (el && domUtils.isShadowUIElement(el))
            el = nativeMethods.nodeNextSiblingGetter.call(el);

        return el;
    }

    getMutationRecordPrevSibling (el) {
        if (!el)
            return el;

        while (el && domUtils.isShadowUIElement(el))
            el = nativeMethods.nodePrevSiblingGetter.call(el);

        return el;
    }

    getNextElementSibling (el) {
        do
            el = nativeMethods.elementNextElementSiblingGetter.call(el);
        while (el && domUtils.isShadowUIElement(el));

        return el;
    }

    getPrevElementSibling (el) {
        do
            el = nativeMethods.elementPrevElementSiblingGetter.call(el);
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

        const collectionOwner = shadowUIElements.length && nativeMethods.nodeParentNodeGetter.call(shadowUIElements[0]);

        for (const shadowUIElement of shadowUIElements)
            nativeMethods.appendChild.call(collectionOwner, shadowUIElement);
    }

    private static _hasFlag (obj, flag: string): boolean {
        try {
            return !!obj[flag];
        }
        catch (e) {
            return false;
        }
    }

    // IE11 and Edge have a strange behavior: shadow container collection flag may be lost (GH-1763 and GH-2034)
    private static _hasCollectionFlagForIE (obj: any, flag: string): boolean {
        try {
            if (flag in obj)
                return obj[flag];

            const parent = nativeMethods.nodeParentNodeGetter.call(obj[0]);
            const result = domUtils.isHeadOrBodyElement(parent) || domUtils.isFormElement(parent);

            nativeMethods.objectDefineProperty(obj, IS_SHADOW_CONTAINER_COLLECTION_FLAG, { value: result, configurable: true });

            return result;
        }
        catch (e) {
            return false;
        }
    }

    static isShadowContainer (el) {
        return ShadowUI._hasFlag(el, IS_SHADOW_CONTAINER_FLAG);
    }

    static isShadowContainerCollection (collection, length?: number) {
        return isIE && length
            ? ShadowUI._hasCollectionFlagForIE(collection, IS_SHADOW_CONTAINER_COLLECTION_FLAG)
            : ShadowUI._hasFlag(collection, IS_SHADOW_CONTAINER_COLLECTION_FLAG);
    }

    static _isShadowUIChildListMutation (mutation) {
        if (domUtils.isShadowUIElement(mutation.target))
            return true;

        const removedNodesLength = nativeMethods.nodeListLengthGetter.call(mutation.removedNodes);

        for (let i = 0; i < removedNodesLength; i++) {
            if (domUtils.isShadowUIElement(mutation.removedNodes[i]))
                return true;
        }

        const addedNodesLength = nativeMethods.nodeListLengthGetter.call(mutation.addedNodes);

        for (let i = 0; i < addedNodesLength; i++) {
            if (domUtils.isShadowUIElement(mutation.addedNodes[i]))
                return true;
        }

        return false;
    }

    static _isShadowUIAttributeMutation (mutation) {
        return domUtils.isShadowUIElement(mutation.target) || domUtils.isHammerheadAttr(mutation.attributeName);
    }

    static _isShadowUICharacterDataMutation (mutation) {
        return domUtils.isShadowUIElement(mutation.target);
    }

    static isShadowUIMutation (mutation) {
        switch (mutation.type) {
            case 'childList':
                return ShadowUI._isShadowUIChildListMutation(mutation);
            case 'attributes':
                return ShadowUI._isShadowUIAttributeMutation(mutation);
            case 'characterData':
                return ShadowUI._isShadowUICharacterDataMutation(mutation);
            default:
                return false;
        }
    }

    static removeSelfRemovingScripts (document) {
        const selfRemovingScripts = nativeMethods.querySelectorAll.call(document,
            '.' + SHADOW_UI_CLASS_NAME.selfRemovingScript);
        const length              = nativeMethods.nodeListLengthGetter.call(selfRemovingScripts);

        for (let i = 0; i < length; i++) {
            const parent = nativeMethods.nodeParentNodeGetter.call(selfRemovingScripts[i]);

            nativeMethods.removeChild.call(parent, selfRemovingScripts[i]);
        }
    }

    // API
    getShadowUICollectionLength (collection, length: number) {
        let shadowUIElementCount = 0;

        for (let i = 0; i < length; i++) {
            if (domUtils.isShadowUIElement(collection[i]))
                shadowUIElementCount++;
        }

        if (shadowUIElementCount && !this._ieDebugSandbox.isDebuggerInitiator())
            ShadowUI._checkElementsPosition(collection, length);

        return length - shadowUIElementCount;
    }

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

    static hasClass (el, value: string) {
        const patchedClass = ShadowUI.patchClassNames(value);

        return domUtils.hasClass(el, patchedClass);
    }

    static patchId (value: string) {
        return value + SHADOW_UI_CLASS_NAME.postfix;
    }

    static patchClassNames (value: string) {
        const names = value.split(/\s+/);

        for (let i = 0; i < names.length; i++)
            names[i] += SHADOW_UI_CLASS_NAME.postfix;

        return names.join(' ');
    }

    select (selector: string, context) {
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
        const rootParent      = this.nativeMethods.nodeParentNodeGetter.call(this.getRoot());
        const lastParentChild = this.nativeMethods.nodeLastChildGetter.call(rootParent);

        return nativeMethods.insertBefore.call(rootParent, el, lastParentChild);
    }

    static markElementAsShadow (el) {
        el[INTERNAL_PROPS.shadowUIElement] = true;
    }

    // GH-2009
    static markFormAsShadow (form) {
        ShadowUI._markAsShadowContainer(form);
        ShadowUI.markAsShadowContainerCollection(form.elements);
        ShadowUI.markAsShadowContainerCollection(form.children);

        const childNodes = nativeMethods.nodeChildNodesGetter.call(form);

        ShadowUI.markAsShadowContainerCollection(childNodes);
    }

    static markElementAndChildrenAsShadow (el) {
        ShadowUI.markElementAsShadow(el);

        // NOTE: For Text, Comment and ProcessingInstruction nodes
        if (!el.querySelectorAll)
            return;

        const childElements = getNativeQuerySelectorAll(el).call(el, '*');
        const length        = nativeMethods.nodeListLengthGetter.call(childElements);

        for (let i = 0; i < length; i++)
            ShadowUI.markElementAsShadow(childElements[i]);
    }

    static _markAsShadowContainer (container) {
        nativeMethods.objectDefineProperty(container, IS_SHADOW_CONTAINER_FLAG, { value: true });
    }

    static markAsShadowContainerCollection (collection) {
        nativeMethods.objectDefineProperty(collection, IS_SHADOW_CONTAINER_COLLECTION_FLAG, { value: true, configurable: true });
    }

    static containsShadowUIClassPostfix (element) {
        return typeof element.className === 'string' &&
               element.className.indexOf(SHADOW_UI_CLASS_NAME.postfix) !== -1;
    }
}
