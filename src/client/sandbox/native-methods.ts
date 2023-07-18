/*global Document, Window */
import globalContextInfo from '../utils/global-context-info';
import { isNativeFunction } from '../utils/overriding';

const NATIVE_CODE_RE = /\[native code]/;

class NativeMethods {
    createDocumentFragment: Document['createDocumentFragment'];
    createElement: Document['createElement'];
    createElementNS: Document['createElementNS'];
    createTextNode: Document['createTextNode'];
    documentOpenPropOwnerName: string;
    documentClosePropOwnerName: string;
    documentWritePropOwnerName: string;
    documentWriteLnPropOwnerName: string;
    documentOpen: Document['open'];
    documentClose: Document['close'];
    documentWrite: Document['write'];
    documentWriteLn: Document['writeln'];
    elementFromPoint: Document['elementFromPoint'];
    caretRangeFromPoint: any;
    caretPositionFromPoint: any;
    getElementById: Document['getElementById'];
    getElementsByClassName: Document['getElementsByClassName'];
    getElementsByName: Document['getElementsByName'];
    getElementsByTagName: Document['getElementsByTagName'];
    querySelector: any;
    querySelectorAll: any;
    createHTMLDocument: any;
    registerElement: any;
    documentAddEventListener: any;
    documentRemoveEventListener: any;
    documentCreateEvent: any;
    documentCreateTouch: any;
    documentCreateTouchList: any;
    documentCookiePropOwnerName: string;
    documentReferrerGetter: any;
    documentStyleSheetsGetter: any;
    documentActiveElementGetter: any;
    documentCookieGetter: any;
    documentCookieSetter: any;
    documentDocumentURIGetter: any;
    documentTitleGetter: any;
    documentTitleSetter: any;
    appendChild: Node['appendChild'];
    attachShadow: Element['attachShadow'];
    append: Element['append'];
    prepend: Element['prepend'];
    after: Element['after'];
    insertAdjacentElement: Element['insertAdjacentElement'];
    insertAdjacentHTML: Element['insertAdjacentHTML'];
    insertAdjacentText: Element['insertAdjacentText'];
    replaceChild: any;
    cloneNode: any;
    elementGetElementsByClassName: any;
    elementGetElementsByTagName: Function;
    elementQuerySelector: any;
    elementQuerySelectorAll: any;
    getAttribute: any;
    getAttributeNS: any;
    getAttributeNode: any;
    getAttributeNodeNS: any;
    insertBefore: Node['insertBefore'];
    insertCell: any;
    insertTableRow: any;
    insertTBodyRow: any;
    importScripts: (...urls: string[]) => void
    removeAttribute: any;
    removeAttributeNS: any;
    removeAttributeNode: any;
    removeChild: Node['removeChild'];
    remove: Element['remove'];
    elementReplaceWith: Element['replaceWith'];
    setAttribute: any;
    setAttributeNS: any;
    hasAttribute: any;
    hasAttributeNS: any;
    hasAttributes: any;
    anchorToString: any;
    matches: any;
    closest: any;
    appendData: any;
    addEventListener: any;
    removeEventListener: any;
    blur: any;
    click: any;
    dispatchEvent: any;
    focus: any;
    select: any;
    setSelectionRange: any;
    textAreaSetSelectionRange: any;
    svgFocus: any;
    svgBlur: any;
    htmlElementStylePropOwnerName: string;
    htmlElementStyleGetter: any;
    htmlElementStyleSetter: any;
    styleCssTextGetter: any;
    styleCssTextSetter: any;
    eval: any;
    formSubmit: any;
    documentFragmentQuerySelector: any;
    documentFragmentQuerySelectorAll: any;
    preventDefault: any;
    historyPushState: any;
    historyReplaceState: any;
    windowDispatchEvent: any;
    postMessage: any;
    windowOpen: Window['open'];
    setTimeout: Window['setTimeout'];
    setInterval: Window['setInterval'];
    clearTimeout: Window['clearTimeout'];
    clearInterval: Window['clearInterval'];
    registerProtocolHandler: any;
    sendBeacon: any;
    xhrAbort: XMLHttpRequest['abort'];
    xhrOpen: XMLHttpRequest['open'];
    xhrSend: XMLHttpRequest['send'];
    xhrAddEventListener: any;
    xhrRemoveEventListener: any;
    xhrGetResponseHeader: XMLHttpRequest['getResponseHeader'];
    xhrGetAllResponseHeaders: XMLHttpRequest['getAllResponseHeaders'];
    xhrSetRequestHeader: XMLHttpRequest['setRequestHeader'];
    xhrOverrideMimeType: any;
    xhrDispatchEvent: any;
    registerServiceWorker: any;
    getRegistrationServiceWorker: any;
    createContextualFragment: any;
    performanceNow: any;
    fetch: Window['fetch'];
    Request: typeof Request;
    requestUrlGetter: (this: Request) => Request['url'];
    requestReferrerGetter: (this: Request) => Request['referrer'];
    Headers: typeof Headers;
    headersSet: Headers['set'];
    headersGet: Headers['get'];
    headersDelete: Headers['delete'];
    headersEntries: Headers['entries'];
    headersForEach: Headers['forEach'];
    headersValues: Headers['values'];
    windowAddEventListener: any;
    windowRemoveEventListener: any;
    WindowPointerEvent: any;
    WindowMSPointerEvent: any;
    WindowTouch: any;
    WindowTouchEvent: any;
    WindowKeyboardEvent: any;
    WindowFocusEvent: any;
    WindowTextEvent: any;
    WindowInputEvent: typeof InputEvent;
    WindowMouseEvent: any;
    windowOriginGetter: (this: Window) => string;
    windowOriginSetter: (this: Window, value: string) => void;
    canvasContextDrawImage: any;
    formDataAppend: FormData['append'];
    date: DateConstructor;
    dateNow: DateConstructor['now'];
    math: any;
    mathRandom: any;
    // eslint-disable-next-line @typescript-eslint/ban-types
    objectToString: Object['toString'];
    objectAssign: ObjectConstructor['assign'];
    objectKeys: ObjectConstructor['keys'];
    objectDefineProperty: ObjectConstructor['defineProperty'];
    objectDefineProperties: ObjectConstructor['defineProperties'];
    objectCreate: ObjectConstructor['create'];
    objectIsExtensible: ObjectConstructor['isExtensible'];
    objectIsFrozen: ObjectConstructor['isFrozen'];
    objectGetOwnPropertyDescriptor: ObjectConstructor['getOwnPropertyDescriptor'];
    objectHasOwnProperty: ObjectConstructor['hasOwnProperty'];
    objectGetOwnPropertyNames: ObjectConstructor['getOwnPropertyNames'];
    objectGetPrototypeOf: ObjectConstructor['getPrototypeOf'];
    objectSetPrototypeOf: ObjectConstructor['setPrototypeOf'];
    objectGetOwnPropertySymbols: ObjectConstructor['getOwnPropertySymbols'];
    arraySlice: any;
    arrayConcat: any;
    arrayFilter: any;
    arrayFind: any;
    arrayMap: any;
    arrayJoin: any;
    arraySplice: any;
    arrayUnshift: any;
    arrayForEach: any;
    arrayIndexOf: any;
    arraySome: any;
    arrayEvery: any;
    arrayReverse: any;
    arrayReduce: any;
    arrayFrom: any;
    isArray: ArrayConstructor['isArray']
    DOMParserParseFromString: any;
    arrayBufferIsView: any;
    objectDataSetter: any;
    inputTypeSetter: any;
    inputValueSetter: any;
    inputDisabledSetter: any;
    inputRequiredSetter: any;
    textAreaValueSetter: any;
    imageSrcSetter: any;
    imageSrcsetSetter: any;
    scriptSrcSetter: any;
    embedSrcSetter: any;
    sourceSrcSetter: any;
    mediaSrcSetter: any;
    inputSrcSetter: any;
    frameSrcSetter: any;
    iframeSrcSetter: any;
    iframeSrcdocSetter: (this: HTMLIFrameElement, val: HTMLIFrameElement['srcdoc']) => void;
    anchorHrefSetter: any;
    linkHrefSetter: any;
    linkRelSetter: any;
    linkAsSetter: any;
    areaHrefSetter: any;
    baseHrefSetter: any;
    anchorHostSetter: any;
    anchorHostnameSetter: any;
    anchorPathnameSetter: any;
    anchorPortSetter: any;
    anchorProtocolSetter: any;
    anchorSearchSetter: any;
    anchorTargetSetter: any;
    formTargetSetter: any;
    areaTargetSetter: any;
    baseTargetSetter: any;
    inputFormTargetSetter: any;
    buttonFormTargetSetter: any;
    svgAnimStrBaseValSetter: any;
    inputAutocompleteSetter: any;
    formActionSetter: any;
    inputFormActionSetter: any;
    buttonFormActionSetter: any;
    iframeSandboxSetter: any;
    htmlElementOnloadSetter: any;
    nodeTextContentSetter: any;
    htmlElementInnerTextSetter: any;
    scriptTextSetter: any;
    anchorTextSetter: any;
    elementInnerHTMLSetter: any;
    elementOuterHTMLSetter: any;
    scriptIntegritySetter: any;
    linkIntegritySetter: any;
    winOnBeforeUnloadSetter: any;
    winOnUnloadSetter: any;
    winOnPageHideSetter: any;
    winOnMessageSetter: any;
    winOnErrorSetter: any;
    winOnUnhandledRejectionSetter: any;
    winOnHashChangeSetter: any;
    webSocketUrlGetter: any;
    elementClassListGetter: any;
    messageEventOriginGetter: any;
    htmlCollectionLengthGetter: (this: HTMLCollection) => HTMLCollection['length'];
    nodeListLengthGetter: (this: NodeListOf<ChildNode>) => NodeListOf<ChildNode>['length'];
    nodeParentNodeGetter: (this: Node) => Node['parentNode'];
    nodeChildNodesGetter: (this: Node) => Node['childNodes'];
    elementChildrenGetter: (this: Element) => Element['children'];
    elementChildElementCountGetter: any;
    inputFilesGetter: any;
    styleSheetHrefGetter: any;
    objectDataGetter: any;
    inputTypeGetter: any;
    inputValueGetter: any;
    inputDisabledGetter: any;
    inputRequiredGetter: any;
    textAreaValueGetter: any;
    imageSrcGetter: any;
    imageSrcsetGetter: any;
    scriptSrcGetter: any;
    embedSrcGetter: any;
    sourceSrcGetter: any;
    mediaSrcGetter: any;
    inputSrcGetter: any;
    frameSrcGetter: any;
    iframeSrcGetter: any;
    iframeSrcdocGetter: (this: HTMLIFrameElement) => HTMLIFrameElement['srcdoc'];
    anchorHrefGetter: any;
    linkHrefGetter: any;
    linkRelGetter: any;
    areaHrefGetter: any;
    baseHrefGetter: any;
    anchorHostGetter: any;
    anchorHostnameGetter: any;
    anchorPathnameGetter: any;
    anchorPortGetter: any;
    anchorProtocolGetter: any;
    anchorSearchGetter: any;
    anchorTargetGetter: any;
    formTargetGetter: any;
    areaTargetGetter: any;
    baseTargetGetter: any;
    inputFormTargetGetter: any;
    buttonFormTargetGetter: any;
    svgImageHrefGetter: any;
    svgAnimStrAnimValGetter: any;
    svgAnimStrBaseValGetter: any;
    inputAutocompleteGetter: any;
    formActionGetter: any;
    inputFormActionGetter: any;
    buttonFormActionGetter: any;
    iframeSandboxGetter: any;
    contentWindowGetter: any;
    contentDocumentGetter: any;
    frameContentWindowGetter: any;
    nodeTextContentGetter: any;
    htmlElementInnerTextGetter: any;
    scriptTextGetter: any;
    anchorTextGetter: any;
    elementInnerHTMLGetter: any;
    elementOuterHTMLGetter: any;
    nodeFirstChildGetter: any;
    nodeLastChildGetter: any;
    nodeNextSiblingGetter: any;
    nodePrevSiblingGetter: any;
    elementFirstElementChildGetter: any;
    elementLastElementChildGetter: any;
    elementNextElementSiblingGetter: any;
    elementPrevElementSiblingGetter: any;
    scriptIntegrityGetter: any;
    linkIntegrityGetter: any;
    anchorOriginGetter: any;
    nodeBaseURIGetter: any;
    elementAttributesGetter: any;
    performanceEntryNameGetter: any;
    messageEventDataGetter: (this: MessageEvent) => MessageEvent['data'];
    htmlManifestGetter: any;
    htmlManifestSetter: any;
    titleElementTextGetter: Function;
    titleElementTextSetter: Function;
    metaHttpEquivGetter: () => HTMLMetaElement['httpEquiv'];
    metaHttpEquivSetter: (this: HTMLMetaElement, value: HTMLMetaElement['httpEquiv']) => void;
    responseStatusGetter: any;
    responseTypeGetter: any;
    responseUrlGetter: any;
    promiseThen: any;
    promiseReject: any;
    xhrResponseURLGetter: any;
    winLocalStorageGetter: (this: Window) => Storage;
    winSessionStorageGetter: (this: Window) => Storage;
    mutationRecordNextSiblingGetter: any;
    mutationRecordPrevSiblingGetter: any;
    styleGetPropertyValue: any;
    styleSetProperty: any;
    styleRemoveProperty: any;
    styleInsertRule: any;
    console: any;
    consoleMeths: any;
    tokenListAdd: any;
    tokenListRemove: any;
    tokenListReplace: any;
    tokenListSupports: any;
    tokenListToggle: any;
    tokenListContains: any;
    tokenListValueSetter: (value: string) => void;
    windowClass: any;
    documentClass: any;
    locationClass: any;
    elementClass: any;
    svgElementClass: any;
    Worker: typeof Worker;
    MessageChannel: typeof MessageChannel;
    Array: typeof Array;
    ArrayBuffer: any;
    Uint8Array: typeof Uint8Array;
    Uint16Array: typeof Uint16Array;
    Uint32Array: typeof Uint32Array;
    DataView: any;
    Blob: typeof Blob;
    File: any;
    XMLHttpRequest: typeof XMLHttpRequest;
    Image: any;
    Function: any;
    Error: any;
    functionToString: Function;
    functionBind: Function;
    FontFace: any;
    StorageEvent: typeof StorageEvent;
    MutationObserver: any;
    EventSource: any;
    Proxy: any;
    WebSocket: any;
    HTMLCollection: any;
    NodeList: any;
    Node: any;
    DataTransfer: any;
    DataTransferItemList: any;
    DataTransferItem: any;
    FileList: any;
    createScript: any;
    runInDebugContext: any;
    runInContext: any;
    runInNewContext: any;
    runInThisContext: any;
    scrollTo: any;
    crypto: Crypto;
    cryptoGetRandomValues: Function;
    URL: typeof URL;
    storageGetItem: Storage['getItem'];
    storageSetItem: Storage['setItem'];
    storageRemoveItem: Storage['removeItem'];
    storageClear: Storage['clear'];
    storageKey: Storage['key'];
    storageLengthGetter: (this: Storage) => Storage['length'];
    eventTargetGetter: (this: Event) => Event['target'];

    constructor (doc?: Document, win?: Window & typeof globalThis) {
        win = win || globalContextInfo.global;

        this.refreshWindowMeths(win, globalContextInfo.isInWorker);
        this.refreshWorkerMeths(win);

        if (globalContextInfo.isInWorker)
            return;

        this.refreshDocumentMeths(doc, win);
        this.refreshElementMeths(doc, win);
    }

    static _getDocumentPropOwnerName (docPrototype, propName: string) {
        return docPrototype.hasOwnProperty(propName) ? 'Document' : 'HTMLDocument'; // eslint-disable-line no-prototype-builtins
    }

    refreshWorkerMeths (scope: any /* WorkerGlobalScope */) {
        this.importScripts = scope.importScripts;
    }

    refreshDocumentMeths (doc: Document, win: Window & typeof globalThis) {
        doc = doc || document;
        win = win || window as Window & typeof globalThis;

        const docPrototype = win.Document.prototype;

        // Dom
        this.createDocumentFragment = docPrototype.createDocumentFragment;
        this.createElement          = docPrototype.createElement;
        this.createElementNS        = docPrototype.createElementNS;
        this.createTextNode         = docPrototype.createTextNode;

        this.documentOpenPropOwnerName    = NativeMethods._getDocumentPropOwnerName(docPrototype, 'open');
        this.documentClosePropOwnerName   = NativeMethods._getDocumentPropOwnerName(docPrototype, 'close');
        this.documentWritePropOwnerName   = NativeMethods._getDocumentPropOwnerName(docPrototype, 'write');
        this.documentWriteLnPropOwnerName = NativeMethods._getDocumentPropOwnerName(docPrototype, 'writeln');

        this.documentOpen    = win[this.documentOpenPropOwnerName].prototype.open;
        this.documentClose   = win[this.documentClosePropOwnerName].prototype.close;
        this.documentWrite   = win[this.documentWritePropOwnerName].prototype.write;
        this.documentWriteLn = win[this.documentWriteLnPropOwnerName].prototype.writeln;

        this.elementFromPoint       = docPrototype.elementFromPoint;
        this.caretRangeFromPoint    = docPrototype.caretRangeFromPoint;
        // @ts-ignore Experimental method in Firefox
        this.caretPositionFromPoint = docPrototype.caretPositionFromPoint;
        this.getElementById         = docPrototype.getElementById;
        this.getElementsByClassName = docPrototype.getElementsByClassName;
        this.getElementsByName      = docPrototype.getElementsByName;

        this.getElementsByTagName = docPrototype.getElementsByTagName;
        this.querySelector        = docPrototype.querySelector;
        this.querySelectorAll     = docPrototype.querySelectorAll;

        this.createHTMLDocument = win.DOMImplementation.prototype.createHTMLDocument;

        // @ts-ignore
        if (doc.registerElement) {
            // @ts-ignore
            this.registerElement = docPrototype.registerElement;
        }

        // Event
        this.documentAddEventListener    = docPrototype.addEventListener;
        this.documentRemoveEventListener = docPrototype.removeEventListener;

        this.documentCreateEvent     = docPrototype.createEvent;
        // @ts-ignore Deprecated
        this.documentCreateTouch     = docPrototype.createTouch;
        // @ts-ignore Deprecated
        this.documentCreateTouchList = docPrototype.createTouchList;

        // getters/setters
        this.documentCookiePropOwnerName = NativeMethods._getDocumentPropOwnerName(docPrototype, 'cookie');

        const documentCookieDescriptor = win.Object.getOwnPropertyDescriptor(win[this.documentCookiePropOwnerName].prototype, 'cookie');

        // TODO: remove this condition after the GH-1649 fix
        if (!this.isNativeCode(documentCookieDescriptor.get) ||
            !this.isNativeCode(documentCookieDescriptor.get.toString)) {
            try {
                const parentNativeMethods = win.parent['%hammerhead%'].nativeMethods;

                documentCookieDescriptor.get = parentNativeMethods.documentCookieGetter;
                documentCookieDescriptor.set = parentNativeMethods.documentCookieSetter;
            }
            catch {} // eslint-disable-line no-empty
        }

        this.documentReferrerGetter      = win.Object.getOwnPropertyDescriptor(docPrototype, 'referrer').get;
        this.documentStyleSheetsGetter   = win.Object.getOwnPropertyDescriptor(docPrototype, 'styleSheets').get;
        this.documentActiveElementGetter = win.Object.getOwnPropertyDescriptor(docPrototype, 'activeElement').get;
        this.documentCookieGetter        = documentCookieDescriptor.get;
        this.documentCookieSetter        = documentCookieDescriptor.set;

        const documentDocumentURIDescriptor = win.Object.getOwnPropertyDescriptor(docPrototype, 'documentURI');

        if (documentDocumentURIDescriptor)
            this.documentDocumentURIGetter = documentDocumentURIDescriptor.get;

        const documentTitleDescriptor = win.Object.getOwnPropertyDescriptor(docPrototype, 'title');

        this.documentTitleGetter = documentTitleDescriptor.get;
        this.documentTitleSetter = documentTitleDescriptor.set;
    }

    refreshElementMeths (doc, win: Window & typeof globalThis) {
        win = win || window as Window & typeof globalThis;

        const createElement = (tagName => this.createElement.call(doc || document, tagName)) as Document['createElement'];
        const nativeElement = createElement('div');

        const createTextNode = data => this.createTextNode.call(doc || document, data);
        const textNode       = createTextNode('text');

        // Dom
        this.appendChild                   = win.Node.prototype.appendChild;
        this.append                        = win.Element.prototype.append;
        this.prepend                       = win.Element.prototype.prepend;
        this.after                         = win.Element.prototype.after;
        this.attachShadow                  = win.Element.prototype.attachShadow;
        this.replaceChild                  = nativeElement.replaceChild;
        this.cloneNode                     = nativeElement.cloneNode;
        this.elementGetElementsByClassName = nativeElement.getElementsByClassName;
        this.elementGetElementsByTagName   = nativeElement.getElementsByTagName;
        this.elementQuerySelector          = nativeElement.querySelector;
        this.elementQuerySelectorAll       = nativeElement.querySelectorAll;
        this.getAttribute                  = nativeElement.getAttribute;
        this.getAttributeNS                = nativeElement.getAttributeNS;
        this.getAttributeNode              = nativeElement.getAttributeNode;
        this.getAttributeNodeNS            = nativeElement.getAttributeNodeNS;
        this.insertBefore                  = nativeElement.insertBefore;
        this.insertCell                    = createElement('tr').insertCell;
        this.insertTableRow                = createElement('table').insertRow;
        this.insertTBodyRow                = createElement('tbody').insertRow;
        this.removeAttribute               = nativeElement.removeAttribute;
        this.removeAttributeNS             = nativeElement.removeAttributeNS;
        this.removeAttributeNode           = nativeElement.removeAttributeNode;
        this.removeChild                   = win.Node.prototype.removeChild;
        this.remove                        = win.Element.prototype.remove;
        this.elementReplaceWith            = win.Element.prototype.replaceWith;
        this.setAttribute                  = nativeElement.setAttribute;
        this.setAttributeNS                = nativeElement.setAttributeNS;
        this.hasAttribute                  = nativeElement.hasAttribute;
        this.hasAttributeNS                = nativeElement.hasAttributeNS;
        this.hasAttributes                 = nativeElement.hasAttributes;
        this.anchorToString                = win.HTMLAnchorElement.prototype.toString;
        this.matches                       = nativeElement.matches;
        this.closest                       = nativeElement.closest;

        this.insertAdjacentElement      = win.Element.prototype.insertAdjacentElement;
        this.insertAdjacentHTML         = win.Element.prototype.insertAdjacentHTML;
        this.insertAdjacentText         = win.Element.prototype.insertAdjacentText;

        // Text node
        this.appendData = textNode.appendData;

        // TODO: remove this condition after the GH-1649 fix
        if (!this.isNativeCode(this.elementGetElementsByTagName)) {
            try {
                const parentNativeMethods = win.parent['%hammerhead%'].nativeMethods;

                this.elementGetElementsByTagName = parentNativeMethods.elementGetElementsByTagName;
            }
            // eslint-disable-next-line no-empty
            catch (e) {
            }
        }

        // Event
        this.addEventListener          = win.EventTarget.prototype.addEventListener;
        this.removeEventListener       = win.EventTarget.prototype.removeEventListener;
        this.dispatchEvent             = win.EventTarget.prototype.dispatchEvent;
        this.blur                      = nativeElement.blur;
        this.click                     = nativeElement.click;
        this.focus                     = nativeElement.focus;
        // @ts-ignore
        this.select                    = window.TextRange ? createElement('body').createTextRange().select : null;
        this.setSelectionRange         = createElement('input').setSelectionRange;
        this.textAreaSetSelectionRange = createElement('textarea').setSelectionRange;

        this.svgFocus = win.SVGElement ? win.SVGElement.prototype.focus : this.focus;
        this.svgBlur  = win.SVGElement ? win.SVGElement.prototype.blur : this.blur;

        // Style
        // NOTE: The 'style' descriptor is located in the Element.prototype in the Safari on IOS
        this.htmlElementStylePropOwnerName = win.Element.prototype.hasOwnProperty('style') ? 'Element' : 'HTMLElement'; // eslint-disable-line no-prototype-builtins

        const htmlElementStyleDescriptor = win.Object.getOwnPropertyDescriptor(win[this.htmlElementStylePropOwnerName].prototype, 'style');

        this.htmlElementStyleGetter = htmlElementStyleDescriptor.get;
        this.htmlElementStyleSetter = htmlElementStyleDescriptor.set;

        const styleCssTextDescriptor = win.Object.getOwnPropertyDescriptor(win.CSSStyleDeclaration.prototype, 'cssText');

        this.styleCssTextGetter = styleCssTextDescriptor.get;
        this.styleCssTextSetter = styleCssTextDescriptor.set;
    }

    _refreshGettersAndSetters (win, isInWorker = false) {
        win = win || window;

        const winOnBeforeUnloadDescriptor = win.Object.getOwnPropertyDescriptor(win, 'onbeforeunload');
        const winOnUnloadDescriptor       = win.Object.getOwnPropertyDescriptor(win, 'onunload');
        const winOnPageHideDescriptor     = win.Object.getOwnPropertyDescriptor(win, 'onpagehide');
        const winOnMessageDescriptor      = win.Object.getOwnPropertyDescriptor(win, 'onmessage');
        const winOnErrorDescriptor        = win.Object.getOwnPropertyDescriptor(win, 'onerror');
        const winOnHashChangeDescriptor   = win.Object.getOwnPropertyDescriptor(win, 'onhashchange');

        this.winOnBeforeUnloadSetter = winOnBeforeUnloadDescriptor && winOnBeforeUnloadDescriptor.set;
        this.winOnUnloadSetter       = winOnUnloadDescriptor && winOnUnloadDescriptor.set;
        this.winOnPageHideSetter     = winOnPageHideDescriptor && winOnPageHideDescriptor.set;
        this.winOnMessageSetter      = winOnMessageDescriptor && winOnMessageDescriptor.set;
        this.winOnErrorSetter        = winOnErrorDescriptor && winOnErrorDescriptor.set;
        this.winOnHashChangeSetter   = winOnHashChangeDescriptor && winOnHashChangeDescriptor.set;

        const winOnUnhandledRejectionDescriptor = win.Object.getOwnPropertyDescriptor(win, 'onunhandledrejection');

        if (winOnUnhandledRejectionDescriptor)
            this.winOnUnhandledRejectionSetter = winOnUnhandledRejectionDescriptor.set;

        // Getters
        if (win.WebSocket) {
            const urlPropDescriptor = win.Object.getOwnPropertyDescriptor(win.WebSocket.prototype, 'url');

            if (urlPropDescriptor && urlPropDescriptor.get && urlPropDescriptor.configurable)
                this.webSocketUrlGetter = urlPropDescriptor.get;
        }

        this.messageEventOriginGetter = win.Object.getOwnPropertyDescriptor(win.MessageEvent.prototype, 'origin').get;

        // NOTE: At present we proxy only the PerformanceNavigationTiming.
        // Another types of the PerformanceEntry will be fixed later
        // https://developer.mozilla.org/en-US/docs/Web/API/PerformanceEntry
        if (win.PerformanceNavigationTiming)
            this.performanceEntryNameGetter = win.Object.getOwnPropertyDescriptor(win.PerformanceEntry.prototype, 'name').get;

        const dataPropDescriptor = win.Object.getOwnPropertyDescriptor(win.MessageEvent.prototype, 'data');

        // NOTE: This condition is used for the Android 6.0 browser
        if (dataPropDescriptor)
            this.messageEventDataGetter = dataPropDescriptor.get;

        if (win.fetch) {
            this.responseStatusGetter  = win.Object.getOwnPropertyDescriptor(win.Response.prototype, 'status').get;
            this.responseTypeGetter    = win.Object.getOwnPropertyDescriptor(win.Response.prototype, 'type').get;
            this.responseUrlGetter     = win.Object.getOwnPropertyDescriptor(win.Response.prototype, 'url').get;
            this.requestUrlGetter      = win.Object.getOwnPropertyDescriptor(win.Request.prototype, 'url').get;
            this.requestReferrerGetter = win.Object.getOwnPropertyDescriptor(win.Request.prototype, 'referrer').get;
        }

        if (win.XMLHttpRequest)
            this.xhrResponseURLGetter = win.Object.getOwnPropertyDescriptor(win.XMLHttpRequest.prototype, 'responseURL').get;

        if (win.Window) {
            this.winLocalStorageGetter   = win.Object.getOwnPropertyDescriptor(win, 'localStorage').get;
            this.winSessionStorageGetter = win.Object.getOwnPropertyDescriptor(win, 'sessionStorage').get;
        }

        if (isInWorker)
            return;

        this.storageGetItem      = win.Storage.prototype.getItem;
        this.storageSetItem      = win.Storage.prototype.setItem;
        this.storageRemoveItem   = win.Storage.prototype.removeItem;
        this.storageClear        = win.Storage.prototype.clear;
        this.storageKey          = win.Storage.prototype.key;
        this.storageLengthGetter = win.Object.getOwnPropertyDescriptor(win.Storage.prototype, 'length');

        const objectDataDescriptor           = win.Object.getOwnPropertyDescriptor(win.HTMLObjectElement.prototype, 'data');
        const inputTypeDescriptor            = win.Object.getOwnPropertyDescriptor(win.HTMLInputElement.prototype, 'type');
        const inputValueDescriptor           = win.Object.getOwnPropertyDescriptor(win.HTMLInputElement.prototype, 'value');
        const inputDisabledDescriptor        = win.Object.getOwnPropertyDescriptor(win.HTMLInputElement.prototype, 'disabled');
        const inputRequiredDescriptor        = win.Object.getOwnPropertyDescriptor(win.HTMLInputElement.prototype, 'required');
        const textAreaValueDescriptor        = win.Object.getOwnPropertyDescriptor(win.HTMLTextAreaElement.prototype, 'value');
        const imageSrcDescriptor             = win.Object.getOwnPropertyDescriptor(win.HTMLImageElement.prototype, 'src');
        const imageSrcsetDescriptor          = win.Object.getOwnPropertyDescriptor(win.HTMLImageElement.prototype, 'srcset');
        const scriptSrcDescriptor            = win.Object.getOwnPropertyDescriptor(win.HTMLScriptElement.prototype, 'src');
        const scriptIntegrityDescriptor      = win.Object.getOwnPropertyDescriptor(win.HTMLScriptElement.prototype, 'integrity');
        const embedSrcDescriptor             = win.Object.getOwnPropertyDescriptor(win.HTMLEmbedElement.prototype, 'src');
        const sourceSrcDescriptor            = win.Object.getOwnPropertyDescriptor(win.HTMLSourceElement.prototype, 'src');
        const mediaSrcDescriptor             = win.Object.getOwnPropertyDescriptor(win.HTMLMediaElement.prototype, 'src');
        const inputSrcDescriptor             = win.Object.getOwnPropertyDescriptor(win.HTMLInputElement.prototype, 'src');
        const frameSrcDescriptor             = win.Object.getOwnPropertyDescriptor(win.HTMLFrameElement.prototype, 'src');
        const iframeSrcDescriptor            = win.Object.getOwnPropertyDescriptor(win.HTMLIFrameElement.prototype, 'src');
        const anchorHrefDescriptor           = win.Object.getOwnPropertyDescriptor(win.HTMLAnchorElement.prototype, 'href');
        const linkHrefDescriptor             = win.Object.getOwnPropertyDescriptor(win.HTMLLinkElement.prototype, 'href');
        const linkIntegrityDescriptor        = win.Object.getOwnPropertyDescriptor(win.HTMLLinkElement.prototype, 'integrity');
        const linkRelDescriptor              = win.Object.getOwnPropertyDescriptor(win.HTMLLinkElement.prototype, 'rel');
        const linkAsDescriptor               = win.Object.getOwnPropertyDescriptor(win.HTMLLinkElement.prototype, 'as');
        const areaHrefDescriptor             = win.Object.getOwnPropertyDescriptor(win.HTMLAreaElement.prototype, 'href');
        const baseHrefDescriptor             = win.Object.getOwnPropertyDescriptor(win.HTMLBaseElement.prototype, 'href');
        const anchorHostDescriptor           = win.Object.getOwnPropertyDescriptor(win.HTMLAnchorElement.prototype, 'host');
        const anchorHostnameDescriptor       = win.Object.getOwnPropertyDescriptor(win.HTMLAnchorElement.prototype, 'hostname');
        const anchorPathnameDescriptor       = win.Object.getOwnPropertyDescriptor(win.HTMLAnchorElement.prototype, 'pathname');
        const anchorPortDescriptor           = win.Object.getOwnPropertyDescriptor(win.HTMLAnchorElement.prototype, 'port');
        const anchorProtocolDescriptor       = win.Object.getOwnPropertyDescriptor(win.HTMLAnchorElement.prototype, 'protocol');
        const anchorSearchDescriptor         = win.Object.getOwnPropertyDescriptor(win.HTMLAnchorElement.prototype, 'search');
        const anchorTargetDescriptor         = win.Object.getOwnPropertyDescriptor(win.HTMLAnchorElement.prototype, 'target');
        const formTargetDescriptor           = win.Object.getOwnPropertyDescriptor(win.HTMLFormElement.prototype, 'target');
        const areaTargetDescriptor           = win.Object.getOwnPropertyDescriptor(win.HTMLAreaElement.prototype, 'target');
        const baseTargetDescriptor           = win.Object.getOwnPropertyDescriptor(win.HTMLBaseElement.prototype, 'target');
        const inputFormTargetDescriptor      = win.Object.getOwnPropertyDescriptor(win.HTMLInputElement.prototype, 'formTarget');
        const buttonFormTargetDescriptor     = win.Object.getOwnPropertyDescriptor(win.HTMLButtonElement.prototype, 'formTarget');
        const svgImageHrefDescriptor         = win.Object.getOwnPropertyDescriptor(win.SVGImageElement.prototype, 'href');
        const svgAnimStrAnimValDescriptor    = win.Object.getOwnPropertyDescriptor(win.SVGAnimatedString.prototype, 'animVal');
        const svgAnimStrBaseValDescriptor    = win.Object.getOwnPropertyDescriptor(win.SVGAnimatedString.prototype, 'baseVal');
        const inputAutocompleteDescriptor    = win.Object.getOwnPropertyDescriptor(win.HTMLInputElement.prototype, 'autocomplete');
        const formActionDescriptor           = win.Object.getOwnPropertyDescriptor(win.HTMLFormElement.prototype, 'action');
        const inputFormActionDescriptor      = win.Object.getOwnPropertyDescriptor(win.HTMLInputElement.prototype, 'formAction');
        const buttonFormActionDescriptor     = win.Object.getOwnPropertyDescriptor(win.HTMLButtonElement.prototype, 'formAction');
        const nodeTextContentDescriptor      = win.Object.getOwnPropertyDescriptor(win.Node.prototype, 'textContent');
        const htmlElementInnerTextDescriptor = win.Object.getOwnPropertyDescriptor(win.HTMLElement.prototype, 'innerText');
        const scriptTextDescriptor           = win.Object.getOwnPropertyDescriptor(win.HTMLScriptElement.prototype, 'text');
        const anchorTextDescriptor           = win.Object.getOwnPropertyDescriptor(win.HTMLAnchorElement.prototype, 'text');
        const titleElementTextDescriptor     = win.Object.getOwnPropertyDescriptor(win.HTMLTitleElement.prototype, 'text');
        const iframeSandboxDescriptor        = win.Object.getOwnPropertyDescriptor(win.HTMLIFrameElement.prototype, 'sandbox');
        const metaHttpEquivDescriptor        = win.Object.getOwnPropertyDescriptor(win.HTMLMetaElement.prototype, 'httpEquiv');
        const windowOriginDescriptor         = win.Object.getOwnPropertyDescriptor(win, 'origin');
        const iframeSrcdocDescriptor         = win.Object.getOwnPropertyDescriptor(win.HTMLIFrameElement.prototype, 'srcdoc');

        if (windowOriginDescriptor) {
            this.windowOriginGetter = windowOriginDescriptor.get;
            this.windowOriginSetter = windowOriginDescriptor.set;
        }

        this.inputDisabledSetter = inputDisabledDescriptor.set;
        this.inputDisabledGetter = inputDisabledDescriptor.get;

        const elementInnerHTMLDescriptor = win.Object.getOwnPropertyDescriptor(win.Element.prototype, 'innerHTML');
        const elementOuterHTMLDescriptor = win.Object.getOwnPropertyDescriptor(win.Element.prototype, 'outerHTML');

        // Setters
        this.objectDataSetter        = objectDataDescriptor.set;
        this.inputTypeSetter         = inputTypeDescriptor.set;
        this.inputValueSetter        = inputValueDescriptor.set;
        this.inputRequiredSetter     = inputRequiredDescriptor.set;
        this.textAreaValueSetter     = textAreaValueDescriptor.set;
        this.imageSrcSetter          = imageSrcDescriptor.set;
        this.scriptSrcSetter         = scriptSrcDescriptor.set;
        this.embedSrcSetter          = embedSrcDescriptor.set;
        this.sourceSrcSetter         = sourceSrcDescriptor.set;
        this.mediaSrcSetter          = mediaSrcDescriptor.set;
        this.inputSrcSetter          = inputSrcDescriptor.set;
        this.frameSrcSetter          = frameSrcDescriptor.set;
        this.iframeSrcSetter         = iframeSrcDescriptor.set;
        this.anchorHrefSetter        = anchorHrefDescriptor.set;
        this.linkHrefSetter          = linkHrefDescriptor.set;
        this.linkRelSetter           = linkRelDescriptor.set;
        this.linkAsSetter            = linkAsDescriptor && linkAsDescriptor.set;
        this.areaHrefSetter          = areaHrefDescriptor.set;
        this.baseHrefSetter          = baseHrefDescriptor.set;
        this.anchorHostSetter        = anchorHostDescriptor.set;
        this.anchorHostnameSetter    = anchorHostnameDescriptor.set;
        this.anchorPathnameSetter    = anchorPathnameDescriptor.set;
        this.anchorPortSetter        = anchorPortDescriptor.set;
        this.anchorProtocolSetter    = anchorProtocolDescriptor.set;
        this.anchorSearchSetter      = anchorSearchDescriptor.set;
        this.anchorTargetSetter      = anchorTargetDescriptor.set;
        this.formTargetSetter        = formTargetDescriptor.set;
        this.areaTargetSetter        = areaTargetDescriptor.set;
        this.baseTargetSetter        = baseTargetDescriptor.set;
        this.inputFormTargetSetter   = inputFormTargetDescriptor.set;
        this.buttonFormTargetSetter  = buttonFormTargetDescriptor.set;
        this.svgAnimStrBaseValSetter = svgAnimStrBaseValDescriptor.set;
        this.inputAutocompleteSetter = inputAutocompleteDescriptor.set;
        this.formActionSetter        = formActionDescriptor.set;
        this.inputFormActionSetter   = inputFormActionDescriptor.set;
        this.buttonFormActionSetter  = buttonFormActionDescriptor.set;
        this.iframeSandboxSetter     = iframeSandboxDescriptor.set;
        this.metaHttpEquivSetter     = metaHttpEquivDescriptor.set;
        this.htmlElementOnloadSetter = win.Object.getOwnPropertyDescriptor(win.HTMLElement.prototype, 'onload').set;

        this.nodeTextContentSetter      = nodeTextContentDescriptor.set;
        this.htmlElementInnerTextSetter = htmlElementInnerTextDescriptor.set;
        this.scriptTextSetter           = scriptTextDescriptor.set;
        this.anchorTextSetter           = anchorTextDescriptor.set;
        this.elementInnerHTMLSetter     = elementInnerHTMLDescriptor.set;
        this.elementOuterHTMLSetter     = elementOuterHTMLDescriptor.set;
        this.scriptIntegritySetter      = scriptIntegrityDescriptor.set;
        this.linkIntegritySetter        = linkIntegrityDescriptor.set;
        this.titleElementTextSetter     = titleElementTextDescriptor.set;

        this.elementClassListGetter         = win.Object.getOwnPropertyDescriptor(win.Element.prototype, 'classList').get;
        this.htmlCollectionLengthGetter     = win.Object.getOwnPropertyDescriptor(win.HTMLCollection.prototype, 'length').get;
        this.nodeListLengthGetter           = win.Object.getOwnPropertyDescriptor(win.NodeList.prototype, 'length').get;
        this.elementChildElementCountGetter = win.Object.getOwnPropertyDescriptor(win.Element.prototype, 'childElementCount').get;
        this.inputFilesGetter               = win.Object.getOwnPropertyDescriptor(win.HTMLInputElement.prototype, 'files').get;
        this.styleSheetHrefGetter           = win.Object.getOwnPropertyDescriptor(win.StyleSheet.prototype, 'href').get;
        this.objectDataGetter               = objectDataDescriptor.get;
        this.inputTypeGetter                = inputTypeDescriptor.get;
        this.inputValueGetter               = inputValueDescriptor.get;
        this.inputRequiredGetter            = inputRequiredDescriptor.get;
        this.textAreaValueGetter            = textAreaValueDescriptor.get;
        this.imageSrcGetter                 = imageSrcDescriptor.get;
        this.scriptSrcGetter                = scriptSrcDescriptor.get;
        this.embedSrcGetter                 = embedSrcDescriptor.get;
        this.sourceSrcGetter                = sourceSrcDescriptor.get;
        this.mediaSrcGetter                 = mediaSrcDescriptor.get;
        this.inputSrcGetter                 = inputSrcDescriptor.get;
        this.frameSrcGetter                 = frameSrcDescriptor.get;
        this.iframeSrcGetter                = iframeSrcDescriptor.get;
        this.anchorHrefGetter               = anchorHrefDescriptor.get;
        this.linkHrefGetter                 = linkHrefDescriptor.get;
        this.linkRelGetter                  = linkRelDescriptor.get;
        this.areaHrefGetter                 = areaHrefDescriptor.get;
        this.baseHrefGetter                 = baseHrefDescriptor.get;
        this.anchorHostGetter               = anchorHostDescriptor.get;
        this.anchorHostnameGetter           = anchorHostnameDescriptor.get;
        this.anchorPathnameGetter           = anchorPathnameDescriptor.get;
        this.anchorPortGetter               = anchorPortDescriptor.get;
        this.anchorProtocolGetter           = anchorProtocolDescriptor.get;
        this.anchorSearchGetter             = anchorSearchDescriptor.get;
        this.anchorTargetGetter             = anchorTargetDescriptor.get;
        this.formTargetGetter               = formTargetDescriptor.get;
        this.areaTargetGetter               = areaTargetDescriptor.get;
        this.baseTargetGetter               = baseTargetDescriptor.get;
        this.inputFormTargetGetter          = inputFormTargetDescriptor.get;
        this.buttonFormTargetGetter         = buttonFormTargetDescriptor.get;
        this.svgImageHrefGetter             = svgImageHrefDescriptor.get;
        this.svgAnimStrAnimValGetter        = svgAnimStrAnimValDescriptor.get;
        this.svgAnimStrBaseValGetter        = svgAnimStrBaseValDescriptor.get;
        this.inputAutocompleteGetter        = inputAutocompleteDescriptor.get;
        this.formActionGetter               = formActionDescriptor.get;
        this.inputFormActionGetter          = inputFormActionDescriptor.get;
        this.buttonFormActionGetter         = buttonFormActionDescriptor.get;
        this.iframeSandboxGetter            = iframeSandboxDescriptor.get;
        this.metaHttpEquivGetter            = metaHttpEquivDescriptor.get;
        this.contentWindowGetter            = win.Object.getOwnPropertyDescriptor(win.HTMLIFrameElement.prototype, 'contentWindow').get;
        this.contentDocumentGetter          = win.Object.getOwnPropertyDescriptor(win.HTMLIFrameElement.prototype, 'contentDocument').get;
        this.frameContentWindowGetter       = win.Object.getOwnPropertyDescriptor(win.HTMLFrameElement.prototype, 'contentWindow').get;

        this.nodeTextContentGetter      = nodeTextContentDescriptor.get;
        this.htmlElementInnerTextGetter = htmlElementInnerTextDescriptor.get;
        this.scriptTextGetter           = scriptTextDescriptor.get;
        this.anchorTextGetter           = anchorTextDescriptor.get;
        this.elementInnerHTMLGetter     = elementInnerHTMLDescriptor.get;
        this.elementOuterHTMLGetter     = elementOuterHTMLDescriptor.get;

        this.nodeFirstChildGetter            = win.Object.getOwnPropertyDescriptor(win.Node.prototype, 'firstChild').get;
        this.nodeLastChildGetter             = win.Object.getOwnPropertyDescriptor(win.Node.prototype, 'lastChild').get;
        this.nodeNextSiblingGetter           = win.Object.getOwnPropertyDescriptor(win.Node.prototype, 'nextSibling').get;
        this.nodePrevSiblingGetter           = win.Object.getOwnPropertyDescriptor(win.Node.prototype, 'previousSibling').get;
        this.nodeParentNodeGetter            = win.Object.getOwnPropertyDescriptor(win.Node.prototype, 'parentNode').get;
        this.nodeChildNodesGetter            = win.Object.getOwnPropertyDescriptor(win.Node.prototype, 'childNodes').get;
        this.elementFirstElementChildGetter  = win.Object.getOwnPropertyDescriptor(win.Element.prototype, 'firstElementChild').get;
        this.elementLastElementChildGetter   = win.Object.getOwnPropertyDescriptor(win.Element.prototype, 'lastElementChild').get;
        this.elementNextElementSiblingGetter = win.Object.getOwnPropertyDescriptor(win.Element.prototype, 'nextElementSibling').get;
        this.elementPrevElementSiblingGetter = win.Object.getOwnPropertyDescriptor(win.Element.prototype, 'previousElementSibling').get;

        this.scriptIntegrityGetter = scriptIntegrityDescriptor.get;
        this.linkIntegrityGetter   = linkIntegrityDescriptor.get;

        this.elementChildrenGetter = win.Object.getOwnPropertyDescriptor(win.Element.prototype, 'children').get;
        this.anchorOriginGetter    = win.Object.getOwnPropertyDescriptor(win.HTMLAnchorElement.prototype, 'origin').get;

        this.iframeSrcdocGetter = iframeSrcdocDescriptor.get;
        this.iframeSrcdocSetter = iframeSrcdocDescriptor.set;

        this.nodeBaseURIGetter       = win.Object.getOwnPropertyDescriptor(win.Node.prototype, 'baseURI').get;
        this.elementAttributesGetter = win.Object.getOwnPropertyDescriptor(win.Element.prototype, 'attributes').get;

        const htmlManifestDescriptor = win.Object.getOwnPropertyDescriptor(win.HTMLHtmlElement.prototype, 'manifest');

        // NOTE: Only the Safari browser supports the 'manifest' property
        if (htmlManifestDescriptor) {
            this.htmlManifestGetter = htmlManifestDescriptor.get;
            this.htmlManifestSetter = htmlManifestDescriptor.set;
        }

        this.imageSrcsetSetter = imageSrcsetDescriptor.set;
        this.imageSrcsetGetter = imageSrcsetDescriptor.get;

        this.titleElementTextGetter = titleElementTextDescriptor.get;

        // MutationRecord
        this.mutationRecordNextSiblingGetter = win.Object.getOwnPropertyDescriptor(win.MutationRecord.prototype, 'nextSibling').get;
        this.mutationRecordPrevSiblingGetter = win.Object.getOwnPropertyDescriptor(win.MutationRecord.prototype, 'previousSibling').get;
    }

    refreshWindowMeths (win, isInWorker = false) {
        win = win || window;

        const winProto = win.constructor.prototype;

        // Dom
        this.eval                             = win.eval;
        this.formSubmit                       = win.HTMLFormElement && win.HTMLFormElement.prototype.submit;
        this.documentFragmentQuerySelector    = win.DocumentFragment && win.DocumentFragment.prototype.querySelector;
        this.documentFragmentQuerySelectorAll = win.DocumentFragment && win.DocumentFragment.prototype.querySelectorAll;
        this.preventDefault                   = win.Event.prototype.preventDefault;

        this.historyPushState    = win.history && win.history.pushState;
        this.historyReplaceState = win.history && win.history.replaceState;
        this.postMessage         = win.postMessage || winProto.postMessage;
        this.windowOpen          = win.open || winProto.open;
        this.setTimeout          = win.setTimeout || winProto.setTimeout;
        this.setInterval         = win.setInterval || winProto.setInterval;
        this.clearTimeout        = win.clearTimeout || winProto.clearTimeout;
        this.clearInterval       = win.clearInterval || winProto.clearInterval;

        this.registerProtocolHandler = win.navigator.registerProtocolHandler;
        this.sendBeacon              = win.Navigator && win.Navigator.prototype.sendBeacon;

        if (win.XMLHttpRequest) {
            this.xhrAbort                 = win.XMLHttpRequest.prototype.abort;
            this.xhrOpen                  = win.XMLHttpRequest.prototype.open;
            this.xhrSend                  = win.XMLHttpRequest.prototype.send;
            this.xhrAddEventListener      = win.EventTarget.prototype.addEventListener;
            this.xhrRemoveEventListener   = win.EventTarget.prototype.removeEventListener;
            this.xhrDispatchEvent         = win.EventTarget.prototype.dispatchEvent;
            this.xhrGetResponseHeader     = win.XMLHttpRequest.prototype.getResponseHeader;
            this.xhrGetAllResponseHeaders = win.XMLHttpRequest.prototype.getAllResponseHeaders;
            this.xhrSetRequestHeader      = win.XMLHttpRequest.prototype.setRequestHeader;
            this.xhrOverrideMimeType      = win.XMLHttpRequest.prototype.overrideMimeType;
        }

        try {
            this.registerServiceWorker        = win.navigator.serviceWorker.register;
            this.getRegistrationServiceWorker = win.navigator.serviceWorker.getRegistration;
        }
        catch (e) {
            this.registerServiceWorker        = null;
            this.getRegistrationServiceWorker = null;
        }

        this.createContextualFragment = win.Range && win.Range.prototype.createContextualFragment;

        const nativePerformance = win.performance;

        if (nativePerformance) {
            // eslint-disable-next-line no-restricted-properties
            const nativePerformanceNow = win.performance.now || win.Performance.prototype.now;

            this.performanceNow = (...args) => nativePerformanceNow.apply(nativePerformance, args);
        }

        // Fetch
        this.fetch   = win.fetch;
        this.Request = win.Request;

        if (win.Headers) {
            this.Headers        = win.Headers;
            this.headersSet     = win.Headers.prototype.set;
            this.headersGet     = win.Headers.prototype.get;
            this.headersDelete  = win.Headers.prototype.delete;
            this.headersEntries = win.Headers.prototype.entries;
            this.headersForEach = win.Headers.prototype.forEach;
            this.headersValues  = win.Headers.prototype.values;
        }

        // Event
        this.windowAddEventListener    = win.addEventListener || winProto.addEventListener;
        this.windowRemoveEventListener = win.removeEventListener || winProto.removeEventListener;
        this.windowDispatchEvent       = win.dispatchEvent;

        this.WindowPointerEvent   = win.PointerEvent || winProto.PointerEvent;
        this.WindowMSPointerEvent = win.MSPointerEvent || winProto.MSPointerEvent;
        this.WindowTouch          = win.Touch || winProto.Touch;
        this.WindowTouchEvent     = win.TouchEvent || winProto.TouchEvent;
        this.WindowKeyboardEvent  = win.KeyboardEvent || winProto.KeyboardEvent;
        this.WindowFocusEvent     = win.FocusEvent || winProto.FocusEvent;
        this.WindowTextEvent      = win.TextEvent || winProto.TextEvent;
        this.WindowInputEvent     = win.InputEvent || winProto.InputEvent;
        this.WindowMouseEvent     = win.MouseEvent || winProto.MouseEvent;
        this.eventTargetGetter    = win.Object.getOwnPropertyDescriptor(win.Event.prototype, 'target').get;

        this.canvasContextDrawImage = win.CanvasRenderingContext2D && win.CanvasRenderingContext2D.prototype.drawImage;

        // FormData
        this.formDataAppend = win.FormData && win.FormData.prototype.append;

        // DateTime
        this.date    = win.Date;
        this.dateNow = win.Date.now; // eslint-disable-line no-restricted-properties

        // Math
        this.math       = win.Math;
        this.mathRandom = win.Math.random;

        // Object
        this.objectToString                 = win.Object.prototype.toString;
        this.objectAssign                   = win.Object.assign;
        this.objectKeys                     = win.Object.keys;
        this.objectDefineProperty           = win.Object.defineProperty;
        this.objectDefineProperties         = win.Object.defineProperties;
        this.objectCreate                   = win.Object.create;
        this.objectIsExtensible             = win.Object.isExtensible;
        this.objectIsFrozen                 = win.Object.isFrozen;
        this.objectGetOwnPropertyDescriptor = win.Object.getOwnPropertyDescriptor;
        this.objectHasOwnProperty           = win.Object.hasOwnProperty;
        this.objectGetOwnPropertyNames      = win.Object.getOwnPropertyNames;
        this.objectGetPrototypeOf           = win.Object.getPrototypeOf;
        this.objectSetPrototypeOf           = win.Object.setPrototypeOf;
        this.objectGetOwnPropertySymbols    = win.Object.getOwnPropertySymbols;

        // Array
        this.arraySlice   = win.Array.prototype.slice;
        this.arrayConcat  = win.Array.prototype.concat;
        this.arrayFilter  = win.Array.prototype.filter;
        this.arrayFind    = win.Array.prototype.find;
        this.arrayMap     = win.Array.prototype.map;
        this.arrayJoin    = win.Array.prototype.join;
        this.arraySplice  = win.Array.prototype.splice;
        this.arrayUnshift = win.Array.prototype.unshift;
        this.arrayForEach = win.Array.prototype.forEach;
        this.arrayIndexOf = win.Array.prototype.indexOf;
        this.arraySome    = win.Array.prototype.some;
        this.arrayEvery   = win.Array.prototype.every;
        this.arrayReverse = win.Array.prototype.reverse;
        this.arrayReduce  = win.Array.prototype.reduce;
        this.arrayFrom    = win.Array.from;
        this.isArray      = win.Array.isArray;

        this.DOMParserParseFromString = win.DOMParser && win.DOMParser.prototype.parseFromString;

        this.arrayBufferIsView = win.ArrayBuffer.prototype.constructor.isView;

        // NOTE: this section relates to getting properties from DOM classes
        if (!isInWorker) {
            // DOMTokenList
            this.tokenListAdd      = win.DOMTokenList.prototype.add;
            this.tokenListRemove   = win.DOMTokenList.prototype.remove;
            this.tokenListReplace  = win.DOMTokenList.prototype.replace;
            this.tokenListSupports = win.DOMTokenList.prototype.supports;
            this.tokenListToggle   = win.DOMTokenList.prototype.toggle;
            this.tokenListContains = win.DOMTokenList.prototype.contains;

            this.tokenListValueSetter = win.Object.getOwnPropertyDescriptor(win.DOMTokenList.prototype, 'value').set;

            // Stylesheets
            this.styleGetPropertyValue = win.CSSStyleDeclaration.prototype.getPropertyValue;
            this.styleSetProperty      = win.CSSStyleDeclaration.prototype.setProperty;
            this.styleRemoveProperty   = win.CSSStyleDeclaration.prototype.removeProperty;
            this.styleInsertRule       = win.CSSStyleSheet.prototype.insertRule;

            this.scrollTo = win.scrollTo;
        }

        if (win.Promise) {
            this.promiseThen   = win.Promise.prototype.then;
            this.promiseReject = win.Promise.reject;
        }

        // Console
        this.console = win.console;

        if (this.console) {
            this.consoleMeths = {
                log:   win.console.log,
                warn:  win.console.warn,
                error: win.console.error,
                info:  win.console.info,
            };
        }

        this.crypto                = win.crypto || win.msCrypto;
        this.cryptoGetRandomValues = this.crypto && this.crypto.getRandomValues;

        this.refreshClasses(win);
        this._refreshGettersAndSetters(win, isInWorker);
    }

    refreshClasses (win) {
        this.windowClass          = win.Window;
        this.documentClass        = win.Document;
        this.locationClass        = win.Location;
        this.elementClass         = win.Element;
        this.svgElementClass      = win.SVGElement;
        this.Worker               = win.Worker;
        this.MessageChannel       = win.MessageChannel;
        this.Array                = win.Array;
        this.ArrayBuffer          = win.ArrayBuffer;
        this.Uint8Array           = win.Uint8Array;
        this.Uint16Array          = win.Uint16Array;
        this.Uint32Array          = win.Uint32Array;
        this.DataView             = win.DataView;
        this.Blob                 = win.Blob;
        this.XMLHttpRequest       = win.XMLHttpRequest;
        this.Image                = win.Image;
        this.Function             = win.Function;
        this.functionToString     = win.Function.prototype.toString;
        this.functionBind         = win.Function.prototype.bind;
        this.Error                = win.Error;
        this.FontFace             = win.FontFace;
        this.StorageEvent         = win.StorageEvent;
        this.MutationObserver     = win.MutationObserver;
        this.EventSource          = win.EventSource;
        this.Proxy                = win.Proxy;
        this.WebSocket            = win.WebSocket;
        this.HTMLCollection       = win.HTMLCollection;
        this.NodeList             = win.NodeList;
        this.Node                 = win.Node;
        this.URL                  = win.URL;
        this.DataTransfer         = win.DataTransfer;
        this.DataTransferItemList = win.DataTransferItemList;
        this.DataTransferItem     = win.DataTransferItem;
        this.FileList             = win.FileList;
        this.File                 = win.File;
    }

    refreshElectronMeths (vmModule): boolean {
        if (this.createScript && isNativeFunction(vmModule.createScript))
            return false;

        this.createScript      = vmModule.createScript;
        this.runInDebugContext = vmModule.runInDebugContext;
        this.runInContext      = vmModule.runInContext;
        this.runInNewContext   = vmModule.runInNewContext;
        this.runInThisContext  = vmModule.runInThisContext;

        return true;
    }

    static _ensureDocumentMethodRestore (document, prototype, methodName, savedNativeMethod) {
        prototype[methodName] = savedNativeMethod;

        if (document[methodName] !== prototype[methodName])
            document[methodName] = savedNativeMethod;
    }

    restoreDocumentMeths (window, document) {
        const docPrototype = window.Document.prototype;

        NativeMethods._ensureDocumentMethodRestore(document, docPrototype, 'createDocumentFragment', this.createDocumentFragment);
        NativeMethods._ensureDocumentMethodRestore(document, docPrototype, 'createElement', this.createElement);
        NativeMethods._ensureDocumentMethodRestore(document, docPrototype, 'createElementNS', this.createElementNS);
        NativeMethods._ensureDocumentMethodRestore(document, docPrototype, 'elementFromPoint', this.elementFromPoint);
        NativeMethods._ensureDocumentMethodRestore(document, docPrototype, 'caretRangeFromPoint', this.caretRangeFromPoint);
        NativeMethods._ensureDocumentMethodRestore(document, docPrototype, 'caretPositionFromPoint', this.caretPositionFromPoint);
        NativeMethods._ensureDocumentMethodRestore(document, docPrototype, 'getElementById', this.getElementById);
        NativeMethods._ensureDocumentMethodRestore(document, docPrototype, 'getElementsByClassName', this.getElementsByClassName);
        NativeMethods._ensureDocumentMethodRestore(document, docPrototype, 'getElementsByName', this.getElementsByName);
        NativeMethods._ensureDocumentMethodRestore(document, docPrototype, 'getElementsByTagName', this.getElementsByTagName);
        NativeMethods._ensureDocumentMethodRestore(document, docPrototype, 'querySelector', this.querySelector);
        NativeMethods._ensureDocumentMethodRestore(document, docPrototype, 'querySelectorAll', this.querySelectorAll);

        // Event
        NativeMethods._ensureDocumentMethodRestore(document, docPrototype, 'addEventListener', this.documentAddEventListener);
        NativeMethods._ensureDocumentMethodRestore(document, docPrototype, 'removeEventListener', this.documentRemoveEventListener);
        NativeMethods._ensureDocumentMethodRestore(document, docPrototype, 'createEvent', this.documentCreateEvent);
        NativeMethods._ensureDocumentMethodRestore(document, docPrototype, 'createTouch', this.documentCreateTouch);
        NativeMethods._ensureDocumentMethodRestore(document, docPrototype, 'createTouchList', this.documentCreateTouchList);

        NativeMethods._ensureDocumentMethodRestore(document, window[this.documentOpenPropOwnerName].prototype, 'open', this.documentOpen);
        NativeMethods._ensureDocumentMethodRestore(document, window[this.documentClosePropOwnerName].prototype, 'close', this.documentClose);
        NativeMethods._ensureDocumentMethodRestore(document, window[this.documentWritePropOwnerName].prototype, 'write', this.documentWrite);
        NativeMethods._ensureDocumentMethodRestore(document, window[this.documentWriteLnPropOwnerName].prototype, 'writeln', this.documentWriteLn);
    }

    isNativeCode (fn: Function): boolean {
        return NATIVE_CODE_RE.test(this.functionToString.call(fn));
    }
}

export default new NativeMethods();
