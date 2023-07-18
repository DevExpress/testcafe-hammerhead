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
import { isChrome } from '../utils/browser';
import { DocumentCleanedEvent } from '../../typings/client';
import NodeMutation from './node/mutation';
import MessageSandbox from './event/message';
import IframeSandbox from './iframe';
import removeElement from '../utils/remove-element';
import { overrideFunction } from '../utils/overriding';

const IS_NON_STATIC_POSITION_RE = /fixed|relative|absolute/;
const CLASSNAME_RE              = /\.((?:\\.|[-\w]|[^\x00-\xa0])+)/g; // eslint-disable-line no-control-regex

const IS_SHADOW_CONTAINER_FLAG            = 'hammerhead|shadow-ui|container-flag';
const IS_SHADOW_CONTAINER_COLLECTION_FLAG = 'hammerhead|shadow-ui|container-collection-flag';
const HTML_COLLECTION_WRAPPER             = 'hammerhead|shadow-ui|html-collection-wrapper';

export default class ShadowUI extends SandboxBase {
    BODY_CONTENT_CHANGED_COMMAND = 'hammerhead|command|body-content-changed';

    ROOT_CLASS = 'root';
    ROOT_ID = 'root';
    HIDDEN_CLASS = 'hidden';
    BLIND_CLASS = 'blind';

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
        private readonly _iframeSandbox: IframeSandbox) {
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
            const elContextWindow = body[INTERNAL_PROPS.processedContext];

            if (elContextWindow !== window) {
                this._messageSandbox.sendServiceMsg({
                    cmd: this.BODY_CONTENT_CHANGED_COMMAND,
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
            value: index => index >= filteredList.length ? null : filteredList[index],
        });

        if (list.namedItem) {
            nativeMethods.objectDefineProperty(filteredList, 'namedItem', {
                value: name => list.namedItem(name),
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
                return function (this: HTMLElement, ...args) {
                    const elements = nativeMethods[nativeGetElementsByClassNameFnName].apply(this, args);
                    const length   = nativeMethods.htmlCollectionLengthGetter.call(elements);

                    return sandbox._filterNodeList(elements, length);
                };
            },

            getElementsByTagName (nativeGetElementsByTagNameFnName) {
                return function (this: HTMLElement, ...args) {
                    const nativeCollection = nativeMethods[nativeGetElementsByTagNameFnName].apply(this, args);
                    const tagName          = args[0];

                    if (typeof tagName !== 'string' || !domUtils.isHeadOrBodyOrHtmlElement(this) && !domUtils.isFormElement(this) &&
                        tagName.toLowerCase() !== 'input' && nativeGetElementsByTagNameFnName !== 'getElementsByTagName')
                        return nativeCollection;

                    if (!nativeCollection[HTML_COLLECTION_WRAPPER])
                        // NOTE: This changes how the native method behaves. The returned collection will have this wrapper attached
                        // if the method was called with the same tagName parameter.
                        // This allows skipping the search if the DOM tree has not changed since the last call.
                        nativeCollection[HTML_COLLECTION_WRAPPER] = new HTMLCollectionWrapper(nativeCollection, tagName);
                    else
                        nativeCollection[HTML_COLLECTION_WRAPPER]._refreshCollection();

                    return nativeCollection[HTML_COLLECTION_WRAPPER];
                };
            },

            querySelector (nativeQuerySelectorFnName, nativeQuerySelectorAllFnName) {
                return function (this: HTMLElement, ...args) {
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
                return function (this: HTMLElement, ...args) {
                    if (typeof args[0] === 'string')
                        args[0] = NodeSandbox.processSelector(args[0]);

                    const list   = nativeMethods[nativeQuerySelectorAllFnName].apply(this, args);
                    const length = nativeMethods.nodeListLengthGetter.call(list);

                    return sandbox._filterNodeList(list, length);
                };
            },
        };
    }

    _markShadowUIContainerAndCollections (containerEl) {
        const children = nativeMethods.elementChildrenGetter.call(containerEl);

        ShadowUI._markAsShadowContainer(containerEl);
        ShadowUI.markAsShadowContainerCollection(children);
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

        overrideFunction(docProto, 'elementFromPoint', function (this: Document, ...args: [number, number]) {
            // NOTE: T212974
            shadowUI.addClass(shadowUI.getRoot(), shadowUI.HIDDEN_CLASS);

            const res = ShadowUI._filterElement(nativeMethods.elementFromPoint.apply(this, args));

            shadowUI.removeClass(shadowUI.getRoot(), shadowUI.HIDDEN_CLASS);

            return res;
        });

        if (document.caretRangeFromPoint) {
            overrideFunction(docProto, 'caretRangeFromPoint', function (this: Document, ...args) {
                shadowUI.addClass(shadowUI.getRoot(), shadowUI.HIDDEN_CLASS);

                let res = nativeMethods.caretRangeFromPoint.apply(this, args);

                if (res && res.startContainer && !ShadowUI._filterElement(res.startContainer))
                    res = null;

                shadowUI.removeClass(shadowUI.getRoot(), shadowUI.HIDDEN_CLASS);

                return res;
            });
        }

        if (document.caretPositionFromPoint) {
            overrideFunction(docProto, 'caretPositionFromPoint', function (this: Document, ...args) {
                shadowUI.addClass(shadowUI.getRoot(), shadowUI.HIDDEN_CLASS);

                let res = nativeMethods.caretPositionFromPoint.apply(this, args);

                if (res && res.offsetNode && !ShadowUI._filterElement(res.offsetNode))
                    res = null;

                shadowUI.removeClass(shadowUI.getRoot(), shadowUI.HIDDEN_CLASS);

                return res;
            });
        }

        overrideFunction(docProto, 'getElementById', function (this: Document, ...args: [string]) {
            return ShadowUI._filterElement(nativeMethods.getElementById.apply(this, args));
        });

        overrideFunction(docProto, 'getElementsByName', function (this: Document, ...args: [string]) {
            const elements = nativeMethods.getElementsByName.apply(this, args);
            const length   = nativeMethods.nodeListLengthGetter.call(elements);

            return shadowUI._filterNodeList(elements, length);
        });

        overrideFunction(docProto, 'getElementsByClassName', this.wrapperCreators.getElementsByClassName('getElementsByClassName'));
        overrideFunction(docProto, 'getElementsByTagName', this.wrapperCreators.getElementsByTagName('getElementsByTagName'));
        overrideFunction(docProto, 'querySelector', this.wrapperCreators.querySelector('querySelector', 'querySelectorAll'));
        overrideFunction(docProto, 'querySelectorAll', this.wrapperCreators.querySelectorAll('querySelectorAll'));
    }

    _overrideElementMethods (window) {
        const elementProto = window.Element.prototype;
        const bodyProto    = window.HTMLBodyElement.prototype;
        const headProto    = window.HTMLHeadElement.prototype;

        overrideFunction(elementProto, 'getElementsByTagName', this.wrapperCreators.getElementsByTagName('elementGetElementsByTagName'));

        overrideFunction(bodyProto, 'getElementsByClassName', this.wrapperCreators.getElementsByClassName('elementGetElementsByClassName'));
        overrideFunction(bodyProto, 'querySelector', this.wrapperCreators.querySelector('elementQuerySelector', 'elementQuerySelectorAll'));
        overrideFunction(bodyProto, 'querySelectorAll', this.wrapperCreators.querySelectorAll('elementQuerySelectorAll'));

        overrideFunction(headProto, 'getElementsByClassName', bodyProto.getElementsByClassName);
        overrideFunction(headProto, 'querySelector', bodyProto.querySelector);
        overrideFunction(headProto, 'querySelectorAll', bodyProto.querySelectorAll);
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

    _restoreUIStyleSheets (head: HTMLHeadElement, uiStyleSheetsHtml: string) {
        if (!head || !uiStyleSheetsHtml)
            return;

        const parser = this.nativeMethods.createElement.call(this.document, 'div');

        nativeMethods.elementInnerHTMLSetter.call(parser, uiStyleSheetsHtml);

        const children = nativeMethods.elementChildrenGetter.call(parser);
        const length   = nativeMethods.htmlCollectionLengthGetter.call(children);

        for (let i = 0; i < length; i++) {
            const child = children[0];

            ShadowUI.markElementAsShadow(child);
            this.nativeMethods.removeChild.call(parser, child);
            this.nativeMethods.appendChild.call(head, child);
        }
    }

    _markElementsAsShadowInHead (head: HTMLHeadElement) {
        const children = nativeMethods.elementChildrenGetter.call(head);
        const length   = nativeMethods.htmlCollectionLengthGetter.call(children);

        for (let i = 0; i < length; i++) {
            const child = children[i];

            if (ShadowUI.containsShadowUIClassPostfix(child))
                ShadowUI.markElementAsShadow(child);
        }
    }

    getRoot () {
        // GH-2418
        if (isChrome && !ShadowUI.isShadowContainer(this.document.body))
            this._markShadowUIContainerAndCollections(this.document.body);

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

    attach (window: Window & typeof globalThis) {
        super.attach(window, window.document);

        this.markShadowUIContainers(this.document.head, this.document.body);
        this._overrideDocumentMethods(window, window.document);
        this._overrideElementMethods(window);

        // NOTE: document.head equals null after call 'document.open' function
        if (window.document.head)
            this._markElementsAsShadowInHead(window.document.head);

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

    getFirstElementChild (el: Element) {
        const children      = nativeMethods.elementChildrenGetter.call(el);
        const length        = nativeMethods.htmlCollectionLengthGetter.call(children);

        return this._filterNodeList(children, length)[0] || null;
    }

    getLastChild (el) {
        const childNodes    = nativeMethods.nodeChildNodesGetter.call(el);
        const length        = nativeMethods.nodeListLengthGetter.call(childNodes);
        const filteredNodes = this._filterNodeList(childNodes, length);
        const index         = childNodes === filteredNodes ? length - 1 : filteredNodes.length - 1;

        return index >= 0 ? filteredNodes[index] : null;
    }

    getLastElementChild (el: Element) {
        const children      = nativeMethods.elementChildrenGetter.call(el);
        const length        = nativeMethods.htmlCollectionLengthGetter.call(children);
        const filteredNodes = this._filterNodeList(children, length);
        const index         = children === filteredNodes ? length - 1 : filteredNodes.length - 1;

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

    static isShadowContainer (el) {
        return ShadowUI._hasFlag(el, IS_SHADOW_CONTAINER_FLAG);
    }

    static isShadowContainerCollection (collection) {
        return ShadowUI._hasFlag(collection, IS_SHADOW_CONTAINER_COLLECTION_FLAG);
    }

    static _isShadowUIChildListMutation (mutation: MutationRecord) {
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

    static _isShadowUIAttributeMutation (mutation: MutationRecord) {
        return domUtils.isShadowUIElement(mutation.target) || domUtils.isHammerheadAttr(mutation.attributeName);
    }

    static _isShadowUICharacterDataMutation (mutation: MutationRecord) {
        return domUtils.isShadowUIElement(mutation.target);
    }

    static isShadowUIMutation (mutation: MutationRecord) {
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

        for (let i = 0; i < length; i++)
            removeElement(selfRemovingScripts[i]);
    }

    // API
    getShadowUICollectionLength (collection, length: number) {
        let shadowUIElementCount = 0;

        for (let i = 0; i < length; i++) {
            if (domUtils.isShadowUIElement(collection[i]))
                shadowUIElementCount++;
        }

        if (shadowUIElementCount)
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

    insertBeforeRoot (newNodes: (string | Node)[]) {
        const rootEl          = this.getRoot();
        const rootParent      = this.nativeMethods.nodeParentNodeGetter.call(rootEl);
        const lastParentChild = this.nativeMethods.nodeLastChildGetter.call(rootParent);

        // GH-2418
        if (lastParentChild !== rootEl)
            nativeMethods.appendChild.call(rootParent, rootEl);

        if (newNodes.length > 1 || typeof newNodes[0] !== 'object') {
            const fragment = document.createDocumentFragment.call(this.document);

            for (let node of newNodes) {
                if (typeof node === 'string')
                    node = nativeMethods.createTextNode.call(this.document, node);

                nativeMethods.appendChild.call(fragment, node);
            }

            return nativeMethods.insertBefore.call(rootParent, fragment, rootEl);
        }

        return nativeMethods.insertBefore.call(rootParent, newNodes[0] as Node, rootEl);
    }

    static markElementAsShadow (el) {
        el[INTERNAL_PROPS.shadowUIElement] = true;
    }

    // GH-2009
    static markFormAsShadow (form: HTMLFormElement) {
        const formChildren = nativeMethods.elementChildrenGetter.call(form);

        ShadowUI._markAsShadowContainer(form);
        ShadowUI.markAsShadowContainerCollection(form.elements);
        ShadowUI.markAsShadowContainerCollection(formChildren);

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

    static markAsShadowContainerCollection (collection: HTMLCollection | HTMLFormControlsCollection) {
        nativeMethods.objectDefineProperty(collection, IS_SHADOW_CONTAINER_COLLECTION_FLAG, { value: true, configurable: true });
    }

    static containsShadowUIClassPostfix (element) {
        return typeof element.className === 'string' &&
               element.className.indexOf(SHADOW_UI_CLASS_NAME.postfix) !== -1;
    }
}
