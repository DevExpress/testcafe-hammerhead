/*global Document, Window */
const NATIVE_CODE_RE = /\[native code]/;

class NativeMethods {
    isStoragePropsLocatedInProto: boolean;
    createDocumentFragment: Document['createDocumentFragment'];
    createElement: Document['createElement'];
    createElementNS: Document['createElementNS'];
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
    getElementById: any;
    getElementsByClassName: any;
    getElementsByName: any;
    getElementsByTagName: any;
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
    documentScriptsPropOwnerName: string;
    documentReferrerGetter: any;
    documentStyleSheetsGetter: any;
    documentActiveElementGetter: any;
    documentScriptsGetter: any;
    documentCookieGetter: any;
    documentCookieSetter: any;
    documentDocumentURIGetter: any;
    appendChild: any;
    replaceChild: any;
    cloneNode: any;
    elementGetElementsByClassName: any;
    elementGetElementsByTagName: any;
    elementQuerySelector: any;
    elementQuerySelectorAll: any;
    getAttribute: any;
    getAttributeNS: any;
    insertAdjacentHTML: any;
    insertBefore: any;
    insertCell: any;
    insertTableRow: any;
    insertTBodyRow: any;
    removeAttribute: any;
    removeAttributeNS: any;
    removeChild: any;
    setAttribute: any;
    setAttributeNS: any;
    hasAttribute: any;
    hasAttributeNS: any;
    hasAttributes: any;
    anchorToString: any;
    matches: any;
    closest: any;
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
    xhrAbort: any;
    xhrOpen: any;
    xhrSend: any;
    xhrAddEventListener: any;
    xhrRemoveEventListener: any;
    xhrGetResponseHeader: any;
    xhrGetAllResponseHeaders: any;
    xhrSetRequestHeader: any;
    xhrOverrideMimeType: any;
    xhrDispatchEvent: any;
    registerServiceWorker: any;
    getRegistrationServiceWorker: any;
    createContextualFragment: any;
    performanceNow: any;
    fetch: any;
    Request: any;
    Headers: any;
    headersSet: any;
    headersEntries: any;
    headersForEach: any;
    windowAddEventListener: any;
    windowRemoveEventListener: any;
    WindowPointerEvent: any;
    WindowMSPointerEvent: any;
    WindowTouch: any;
    WindowTouchEvent: any;
    WindowKeyboardEvent: any;
    WindowFocusEvent: any;
    WindowTextEvent: any;
    WindowInputEvent: any;
    WindowMouseEvent: any;
    windowOriginGetter: () => string;
    canvasContextDrawImage: any;
    formDataAppend: FormData['append'];
    date: DateConstructor;
    dateNow: DateConstructor['now'];
    math: any;
    mathRandom: any;
    objectToString: any;
    objectAssign: any;
    objectKeys: any;
    objectDefineProperty: any;
    objectDefineProperties: any;
    objectCreate: any;
    objectIsExtensible: any;
    objectIsFrozen: any;
    objectGetOwnPropertyDescriptor: any;
    objectHasOwnProperty: any;
    objectGetOwnPropertyNames: any;
    objectGetPrototypeOf: any;
    objectGetOwnPropertySymbols: ObjectConstructor['getOwnPropertySymbols'];
    arraySlice: any;
    arrayConcat: any;
    arrayFilter: any;
    arrayMap: any;
    arrayJoin: any;
    arraySplice: any;
    arrayForEach: any;
    DOMParserParseFromString: any;
    arrayBufferIsView: any;
    elementHTMLPropOwnerName: string;
    objectDataSetter: any;
    inputTypeSetter: any;
    inputValueSetter: any;
    inputRequiredSetter: any;
    textAreaValueSetter: any;
    imageSrcSetter: any;
    scriptSrcSetter: any;
    embedSrcSetter: any;
    sourceSrcSetter: any;
    mediaSrcSetter: any;
    inputSrcSetter: any;
    frameSrcSetter: any;
    iframeSrcSetter: any;
    anchorHrefSetter: any;
    linkHrefSetter: any;
    linkRelSetter: any;
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
    isEventPropsLocatedInProto: boolean;
    winOnBeforeUnloadSetter: any;
    winOnPageHideSetter: any;
    winOnMessageSetter: any;
    winOnErrorSetter: any;
    winOnUnhandledRejectionSetter: any;
    winOnHashChangeSetter: any;
    webSocketUrlGetter: any;
    elementClassListPropOwnerName: string;
    elementClassListGetter: any;
    messageEventOriginGetter: any;
    htmlCollectionLengthGetter: any;
    nodeListLengthGetter: any;
    nodeParentNodeGetter: any;
    elementChildElementCountGetter: any;
    inputFilesGetter: any;
    styleSheetHrefGetter: any;
    xhrStatusGetter: any;
    objectDataGetter: any;
    inputTypeGetter: any;
    inputValueGetter: any;
    inputRequiredGetter: any;
    textAreaValueGetter: any;
    imageSrcGetter: any;
    scriptSrcGetter: any;
    embedSrcGetter: any;
    sourceSrcGetter: any;
    mediaSrcGetter: any;
    inputSrcGetter: any;
    frameSrcGetter: any;
    iframeSrcGetter: any;
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
    cssStyleSheetHrefGetter: any;
    nodeBaseURIGetter: any;
    elementAttributesPropOwnerName: string;
    elementAttributesGetter: any;
    performanceEntryNameGetter: any;
    messageEventDataGetter: any;
    htmlManifestGetter: any;
    htmlManifestSetter: any;
    responseStatusGetter: any;
    responseTypeGetter: any;
    responseUrlGetter: any;
    promiseThen: any;
    promiseReject: any;
    xhrResponseURLGetter: any;
    winLocalStorageGetter: any;
    winSessionStorageGetter: any;
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
    windowClass: any;
    documentClass: any;
    locationClass: any;
    elementClass: any;
    svgElementClass: any;
    Worker: typeof Worker;
    MessageChannel: typeof MessageChannel;
    ArrayBuffer: any;
    Uint8Array: typeof Uint8Array;
    Uint16Array: typeof Uint16Array;
    Uint32Array: typeof Uint32Array;
    DataView: any;
    Blob: any;
    XMLHttpRequest: any;
    Image: any;
    Function: any;
    functionToString: any;
    FontFace: any;
    StorageEvent: any;
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

    constructor (doc?: Document, win?: Window) {
        win = win || window;

        this.refreshDocumentMeths(doc, win);
        this.refreshElementMeths(doc, win);
        this.refreshWindowMeths(win);
    }

    static _getDocumentPropOwnerName (docPrototype, propName: string) {
        return docPrototype.hasOwnProperty(propName) ? 'Document' : 'HTMLDocument';
    }

    getStoragesPropsOwner (win: Window) {
        // @ts-ignore
        return this.isStoragePropsLocatedInProto ? win.Window.prototype : win;
    }

    refreshDocumentMeths (doc: Document, win: Window) {
        doc = doc || document;
        win = win || window;

        // @ts-ignore
        const docPrototype = win.Document.prototype;

        // Dom
        this.createDocumentFragment = docPrototype.createDocumentFragment;
        this.createElement          = docPrototype.createElement;
        this.createElementNS        = docPrototype.createElementNS;

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
        this.caretPositionFromPoint = docPrototype.caretPositionFromPoint;
        this.getElementById         = docPrototype.getElementById;
        this.getElementsByClassName = docPrototype.getElementsByClassName;
        this.getElementsByName      = docPrototype.getElementsByName;

        this.getElementsByTagName = docPrototype.getElementsByTagName;
        this.querySelector        = docPrototype.querySelector;
        this.querySelectorAll     = docPrototype.querySelectorAll;

        // @ts-ignore
        this.createHTMLDocument = win.DOMImplementation.prototype.createHTMLDocument;

        // @ts-ignore
        if (doc.registerElement)
            this.registerElement = docPrototype.registerElement;

        // Event
        this.documentAddEventListener    = docPrototype.addEventListener;
        this.documentRemoveEventListener = docPrototype.removeEventListener;
        this.documentCreateEvent         = docPrototype.createEvent;
        this.documentCreateTouch         = docPrototype.createTouch;
        this.documentCreateTouchList     = docPrototype.createTouchList;

        // getters/setters
        this.documentCookiePropOwnerName  = NativeMethods._getDocumentPropOwnerName(docPrototype, 'cookie');
        this.documentScriptsPropOwnerName = NativeMethods._getDocumentPropOwnerName(docPrototype, 'scripts');

        // @ts-ignore
        const documentCookieDescriptor = win.Object.getOwnPropertyDescriptor(win[this.documentCookiePropOwnerName].prototype, 'cookie');

        // TODO: remove this condition after the GH-1649 fix
        if (!this.isNativeCode(documentCookieDescriptor.get) ||
            !this.isNativeCode(documentCookieDescriptor.get.toString)) {
            try {
                const parentNativeMethods = win.parent['%hammerhead%'].nativeMethods;

                documentCookieDescriptor.get = parentNativeMethods.documentCookieGetter;
                documentCookieDescriptor.set = parentNativeMethods.documentCookieSetter;
            }
            // eslint-disable-next-line no-empty
            catch (e) {
            }
        }

        // @ts-ignore
        this.documentReferrerGetter      = win.Object.getOwnPropertyDescriptor(docPrototype, 'referrer').get;
        // @ts-ignore
        this.documentStyleSheetsGetter   = win.Object.getOwnPropertyDescriptor(docPrototype, 'styleSheets').get;
        // @ts-ignore
        this.documentActiveElementGetter = win.Object.getOwnPropertyDescriptor(docPrototype, 'activeElement').get;
        // @ts-ignore
        this.documentScriptsGetter       = win.Object.getOwnPropertyDescriptor(win[this.documentScriptsPropOwnerName].prototype, 'scripts').get;
        this.documentCookieGetter        = documentCookieDescriptor.get;
        this.documentCookieSetter        = documentCookieDescriptor.set;

        // @ts-ignore
        const documentDocumentURIDescriptor = win.Object.getOwnPropertyDescriptor(docPrototype, 'documentURI');

        if (documentDocumentURIDescriptor)
            this.documentDocumentURIGetter = documentDocumentURIDescriptor.get;
    }

    refreshElementMeths (doc, win) {
        win = win || window;

        const createElement = tagName => this.createElement.call(doc || document, tagName);
        const nativeElement = createElement('div');

        // Dom
        this.appendChild                   = nativeElement.appendChild;
        this.replaceChild                  = nativeElement.replaceChild;
        this.cloneNode                     = nativeElement.cloneNode;
        this.elementGetElementsByClassName = nativeElement.getElementsByClassName;
        this.elementGetElementsByTagName   = nativeElement.getElementsByTagName;
        this.elementQuerySelector          = nativeElement.querySelector;
        this.elementQuerySelectorAll       = nativeElement.querySelectorAll;
        this.getAttribute                  = nativeElement.getAttribute;
        this.getAttributeNS                = nativeElement.getAttributeNS;
        this.insertAdjacentHTML            = nativeElement.insertAdjacentHTML;
        this.insertBefore                  = nativeElement.insertBefore;
        this.insertCell                    = createElement('tr').insertCell;
        this.insertTableRow                = createElement('table').insertRow;
        this.insertTBodyRow                = createElement('tbody').insertRow;
        this.removeAttribute               = nativeElement.removeAttribute;
        this.removeAttributeNS             = nativeElement.removeAttributeNS;
        this.removeChild                   = nativeElement.removeChild;
        this.setAttribute                  = nativeElement.setAttribute;
        this.setAttributeNS                = nativeElement.setAttributeNS;
        this.hasAttribute                  = nativeElement.hasAttribute;
        this.hasAttributeNS                = nativeElement.hasAttributeNS;
        this.hasAttributes                 = nativeElement.hasAttributes;
        this.anchorToString                = win.HTMLAnchorElement.prototype.toString;
        this.matches                       = nativeElement.matches || nativeElement.msMatchesSelector;
        this.closest                       = nativeElement.closest;

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
        this.addEventListener          = nativeElement.addEventListener;
        this.removeEventListener       = nativeElement.removeEventListener;
        this.blur                      = nativeElement.blur;
        this.click                     = nativeElement.click;
        this.dispatchEvent             = nativeElement.dispatchEvent;
        this.focus                     = nativeElement.focus;
        // @ts-ignore
        this.select                    = window.TextRange ? createElement('body').createTextRange().select : null;
        this.setSelectionRange         = createElement('input').setSelectionRange;
        this.textAreaSetSelectionRange = createElement('textarea').setSelectionRange;

        this.svgFocus = win.SVGElement ? win.SVGElement.prototype.focus : this.focus;
        this.svgBlur  = win.SVGElement ? win.SVGElement.prototype.blur : this.blur;

        // Style
        // NOTE: The 'style' descriptor is located in the Element.prototype in the Safari on IOS
        this.htmlElementStylePropOwnerName = win.Element.prototype.hasOwnProperty('style') ? 'Element' : 'HTMLElement';

        const htmlElementStyleDescriptor = win.Object.getOwnPropertyDescriptor(win[this.htmlElementStylePropOwnerName].prototype, 'style');

        this.htmlElementStyleGetter = htmlElementStyleDescriptor.get;

        // NOTE: IE does not allow to set a style property
        if (htmlElementStyleDescriptor.set)
            this.htmlElementStyleSetter = htmlElementStyleDescriptor.set;

        const styleCssTextDescriptor = win.Object.getOwnPropertyDescriptor(win.CSSStyleDeclaration.prototype, 'cssText');

        this.styleCssTextGetter = styleCssTextDescriptor.get;
        this.styleCssTextSetter = styleCssTextDescriptor.set;
    }

    refreshWindowMeths (win) {
        win = win || window;

        const winProto = win.constructor.prototype;

        // Dom
        this.eval                             = win.eval;
        this.formSubmit                       = win.HTMLFormElement.prototype.submit;
        this.documentFragmentQuerySelector    = win.DocumentFragment.prototype.querySelector;
        this.documentFragmentQuerySelectorAll = win.DocumentFragment.prototype.querySelectorAll;
        this.preventDefault                   = win.Event.prototype.preventDefault;

        this.historyPushState    = win.history.pushState;
        this.historyReplaceState = win.history.replaceState;
        this.windowDispatchEvent = win.dispatchEvent;
        this.postMessage         = win.postMessage || winProto.postMessage;
        this.windowOpen          = win.open || winProto.open;
        this.setTimeout          = win.setTimeout || winProto.setTimeout;
        this.setInterval         = win.setInterval || winProto.setInterval;
        this.clearTimeout        = win.clearTimeout || winProto.clearTimeout;
        this.clearInterval       = win.clearInterval || winProto.clearInterval;

        if (win.navigator.registerProtocolHandler)
            this.registerProtocolHandler = win.navigator.registerProtocolHandler;

        if (win.navigator.sendBeacon)
            this.sendBeacon = win.navigator.sendBeacon;

        // XHR
        this.xhrAbort                 = win.XMLHttpRequest.prototype.abort;
        this.xhrOpen                  = win.XMLHttpRequest.prototype.open;
        this.xhrSend                  = win.XMLHttpRequest.prototype.send;
        this.xhrAddEventListener      = win.XMLHttpRequest.prototype.addEventListener;
        this.xhrRemoveEventListener   = win.XMLHttpRequest.prototype.removeEventListener;
        this.xhrGetResponseHeader     = win.XMLHttpRequest.prototype.getResponseHeader;
        this.xhrGetAllResponseHeaders = win.XMLHttpRequest.prototype.getAllResponseHeaders;
        this.xhrSetRequestHeader      = win.XMLHttpRequest.prototype.setRequestHeader;
        this.xhrOverrideMimeType      = win.XMLHttpRequest.prototype.overrideMimeType;
        this.xhrDispatchEvent         = win.XMLHttpRequest.prototype.dispatchEvent;

        try {
            this.registerServiceWorker        = win.navigator.serviceWorker.register;
            this.getRegistrationServiceWorker = win.navigator.serviceWorker.getRegistration;
        }
        catch (e) {
            this.registerServiceWorker        = null;
            this.getRegistrationServiceWorker = null;
        }

        this.createContextualFragment = win.Range.prototype.createContextualFragment;

        const nativePerformance    = win.performance;
        const nativePerformanceNow = win.performance.now || win.Performance.prototype.now;

        this.performanceNow = (...args) => nativePerformanceNow.apply(nativePerformance, args);

        // Fetch
        this.fetch   = win.fetch;
        this.Request = win.Request;

        if (win.Headers) {
            this.Headers        = win.Headers;
            this.headersSet     = win.Headers.prototype.set;
            this.headersEntries = win.Headers.prototype.entries;
            this.headersForEach = win.Headers.prototype.forEach;
        }

        // Event
        this.windowAddEventListener    = win.addEventListener || winProto.addEventListener;
        this.windowRemoveEventListener = win.removeEventListener || winProto.removeEventListener;
        this.WindowPointerEvent        = win.PointerEvent || winProto.PointerEvent;
        this.WindowMSPointerEvent      = win.MSPointerEvent || winProto.MSPointerEvent;
        this.WindowTouch               = win.Touch || winProto.Touch;
        this.WindowTouchEvent          = win.TouchEvent || winProto.TouchEvent;
        this.WindowKeyboardEvent       = win.KeyboardEvent || winProto.KeyboardEvent;
        this.WindowFocusEvent          = win.FocusEvent || winProto.FocusEvent;
        this.WindowTextEvent           = win.TextEvent || winProto.TextEvent;
        this.WindowInputEvent          = win.InputEvent || winProto.InputEvent;
        this.WindowMouseEvent          = win.MouseEvent || winProto.MouseEvent;

        this.canvasContextDrawImage = win.CanvasRenderingContext2D.prototype.drawImage;

        // FormData
        this.formDataAppend = win.FormData.prototype.append;

        // DateTime
        this.date    = win.Date;
        this.dateNow = win.Date.now;

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
        this.objectGetOwnPropertySymbols    = win.Object.getOwnPropertySymbols;

        // Array
        this.arraySlice   = win.Array.prototype.slice;
        this.arrayConcat  = win.Array.prototype.concat;
        this.arrayFilter  = win.Array.prototype.filter;
        this.arrayMap     = win.Array.prototype.map;
        this.arrayJoin    = win.Array.prototype.join;
        this.arraySplice  = win.Array.prototype.splice;
        this.arrayForEach = win.Array.prototype.forEach;

        this.DOMParserParseFromString = win.DOMParser.prototype.parseFromString;

        this.arrayBufferIsView = win.ArrayBuffer.prototype.constructor.isView;

        const objectDataDescriptor           = win.Object.getOwnPropertyDescriptor(win.HTMLObjectElement.prototype, 'data');
        const inputTypeDescriptor            = win.Object.getOwnPropertyDescriptor(win.HTMLInputElement.prototype, 'type');
        const inputValueDescriptor           = win.Object.getOwnPropertyDescriptor(win.HTMLInputElement.prototype, 'value');
        const inputRequiredDescriptor        = win.Object.getOwnPropertyDescriptor(win.HTMLInputElement.prototype, 'required');
        const textAreaValueDescriptor        = win.Object.getOwnPropertyDescriptor(win.HTMLTextAreaElement.prototype, 'value');
        const imageSrcDescriptor             = win.Object.getOwnPropertyDescriptor(win.HTMLImageElement.prototype, 'src');
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
        const iframeSandboxDescriptor        = win.Object.getOwnPropertyDescriptor(win.HTMLIFrameElement.prototype, 'sandbox');
        const windowOriginDescriptor         = win.Object.getOwnPropertyDescriptor(win, 'origin');

        if (windowOriginDescriptor)
            this.windowOriginGetter = windowOriginDescriptor.get;

        // NOTE: Html properties is located in HTMLElement prototype in IE11 only
        this.elementHTMLPropOwnerName = win.Element.prototype.hasOwnProperty('innerHTML') ? 'Element' : 'HTMLElement';

        const elementInnerHTMLDescriptor = win.Object.getOwnPropertyDescriptor(win[this.elementHTMLPropOwnerName].prototype, 'innerHTML');
        const elementOuterHTMLDescriptor = win.Object.getOwnPropertyDescriptor(win[this.elementHTMLPropOwnerName].prototype, 'outerHTML');

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
        this.htmlElementOnloadSetter = win.Object.getOwnPropertyDescriptor(win.HTMLElement.prototype, 'onload').set;

        this.nodeTextContentSetter      = nodeTextContentDescriptor.set;
        this.htmlElementInnerTextSetter = htmlElementInnerTextDescriptor.set;
        this.scriptTextSetter           = scriptTextDescriptor.set;
        this.anchorTextSetter           = anchorTextDescriptor.set;
        this.elementInnerHTMLSetter     = elementInnerHTMLDescriptor.set;
        this.elementOuterHTMLSetter     = elementOuterHTMLDescriptor.set;

        // NOTE: Some browsers (for example, Edge, Internet Explorer 11, Safari) don't support the 'integrity' property.
        if (scriptIntegrityDescriptor && linkIntegrityDescriptor) {
            this.scriptIntegritySetter = scriptIntegrityDescriptor.set;
            this.linkIntegritySetter   = linkIntegrityDescriptor.set;
        }

        // NOTE: Event properties is located in window prototype only in IE11
        this.isEventPropsLocatedInProto = win.Window.prototype.hasOwnProperty('onerror');

        const eventPropsOwner = this.isEventPropsLocatedInProto ? win.Window.prototype : win;

        this.winOnBeforeUnloadSetter = win.Object.getOwnPropertyDescriptor(eventPropsOwner, 'onbeforeunload').set;
        this.winOnPageHideSetter     = win.Object.getOwnPropertyDescriptor(eventPropsOwner, 'onpagehide').set;
        this.winOnMessageSetter      = win.Object.getOwnPropertyDescriptor(eventPropsOwner, 'onmessage').set;
        this.winOnErrorSetter        = win.Object.getOwnPropertyDescriptor(eventPropsOwner, 'onerror').set;
        this.winOnHashChangeSetter   = win.Object.getOwnPropertyDescriptor(eventPropsOwner, 'onhashchange').set;

        const winOnUnhandledRejectionDescriptor = win.Object.getOwnPropertyDescriptor(eventPropsOwner, 'onunhandledrejection');

        if (winOnUnhandledRejectionDescriptor)
            this.winOnUnhandledRejectionSetter = winOnUnhandledRejectionDescriptor.set;

        // Getters
        if (win.WebSocket) {
            const urlPropDescriptor = win.Object.getOwnPropertyDescriptor(win.WebSocket.prototype, 'url');

            if (urlPropDescriptor && urlPropDescriptor.get && urlPropDescriptor.configurable)
                this.webSocketUrlGetter = urlPropDescriptor.get;
        }

        // NOTE: the classList property is located in HTMLElement prototype in IE11
        this.elementClassListPropOwnerName = win.Element.prototype.hasOwnProperty('classList') ? 'Element' : 'HTMLElement';

        this.elementClassListGetter = win.Object.getOwnPropertyDescriptor(win[this.elementClassListPropOwnerName].prototype, 'classList').get;

        this.messageEventOriginGetter       = win.Object.getOwnPropertyDescriptor(win.MessageEvent.prototype, 'origin').get;
        this.htmlCollectionLengthGetter     = win.Object.getOwnPropertyDescriptor(win.HTMLCollection.prototype, 'length').get;
        this.nodeListLengthGetter           = win.Object.getOwnPropertyDescriptor(win.NodeList.prototype, 'length').get;
        this.elementChildElementCountGetter = win.Object.getOwnPropertyDescriptor(win.Element.prototype, 'childElementCount').get;
        this.inputFilesGetter               = win.Object.getOwnPropertyDescriptor(win.HTMLInputElement.prototype, 'files').get;
        this.styleSheetHrefGetter           = win.Object.getOwnPropertyDescriptor(win.StyleSheet.prototype, 'href').get;
        this.xhrStatusGetter                = win.Object.getOwnPropertyDescriptor(win.XMLHttpRequest.prototype, 'status').get;
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
        this.elementFirstElementChildGetter  = win.Object.getOwnPropertyDescriptor(win.Element.prototype, 'firstElementChild').get;
        this.elementLastElementChildGetter   = win.Object.getOwnPropertyDescriptor(win.Element.prototype, 'lastElementChild').get;
        this.elementNextElementSiblingGetter = win.Object.getOwnPropertyDescriptor(win.Element.prototype, 'nextElementSibling').get;
        this.elementPrevElementSiblingGetter = win.Object.getOwnPropertyDescriptor(win.Element.prototype, 'previousElementSibling').get;

        const anchorOriginDescriptor = win.Object.getOwnPropertyDescriptor(win.HTMLAnchorElement.prototype, 'origin');

        // NOTE: Some browsers (for example, Edge, Internet Explorer 11, Safari) don't support the 'integrity' property.
        if (scriptIntegrityDescriptor && linkIntegrityDescriptor) {
            this.scriptIntegrityGetter = scriptIntegrityDescriptor.get;
            this.linkIntegrityGetter   = linkIntegrityDescriptor.get;
        }

        // NOTE: IE and Edge don't support origin property
        if (anchorOriginDescriptor)
            this.anchorOriginGetter = anchorOriginDescriptor.get;

        const cssStyleSheetHrefDescriptor = win.Object.getOwnPropertyDescriptor(win.CSSStyleSheet.prototype, 'href');

        // NOTE: IE11 doesn't support the 'href' property
        if (cssStyleSheetHrefDescriptor)
            this.cssStyleSheetHrefGetter = cssStyleSheetHrefDescriptor.get;

        const nodeBaseURIDescriptor = win.Object.getOwnPropertyDescriptor(win.Node.prototype, 'baseURI');

        // NOTE: IE11 doesn't support the 'baseURI' property
        if (nodeBaseURIDescriptor)
            this.nodeBaseURIGetter = nodeBaseURIDescriptor.get;

        // NOTE: The 'attributes' property is located in Node prototype in IE11 only
        this.elementAttributesPropOwnerName = win.Element.prototype.hasOwnProperty('attributes') ? 'Element' : 'Node';

        this.elementAttributesGetter = win.Object.getOwnPropertyDescriptor(win[this.elementAttributesPropOwnerName].prototype, 'attributes').get;

        // NOTE: At present we proxy only the PerformanceNavigationTiming.
        // Another types of the PerformanceEntry will be fixed later
        // https://developer.mozilla.org/en-US/docs/Web/API/PerformanceEntry
        if (win.PerformanceNavigationTiming)
            this.performanceEntryNameGetter = win.Object.getOwnPropertyDescriptor(win.PerformanceEntry.prototype, 'name').get;

        const dataPropDescriptor = win.Object.getOwnPropertyDescriptor(win.MessageEvent.prototype, 'data');

        // NOTE: This condition is used for the Android 6.0 browser
        if (dataPropDescriptor)
            this.messageEventDataGetter = dataPropDescriptor.get;

        const htmlManifestDescriptor = win.Object.getOwnPropertyDescriptor(win.HTMLHtmlElement.prototype, 'manifest');

        // NOTE: Only the Safari browser supports the 'manifest' property
        if (htmlManifestDescriptor) {
            this.htmlManifestGetter = htmlManifestDescriptor.get;
            this.htmlManifestSetter = htmlManifestDescriptor.set;
        }

        if (win.fetch) {
            this.responseStatusGetter = win.Object.getOwnPropertyDescriptor(win.Response.prototype, 'status').get;
            this.responseTypeGetter   = win.Object.getOwnPropertyDescriptor(win.Response.prototype, 'type').get;
            this.responseUrlGetter    = win.Object.getOwnPropertyDescriptor(win.Response.prototype, 'url').get;
        }

        if (win.Promise) {
            this.promiseThen   = win.Promise.prototype.then;
            this.promiseReject = win.Promise.reject;
        }

        const xhrResponseURLDescriptor = win.Object.getOwnPropertyDescriptor(win.XMLHttpRequest.prototype, 'responseURL');

        // NOTE: IE doesn't support the 'responseURL' property
        if (xhrResponseURLDescriptor)
            this.xhrResponseURLGetter = xhrResponseURLDescriptor.get;

        // NOTE: The 'localStorage' and 'sessionStorage' properties is located in window prototype only in IE11
        this.isStoragePropsLocatedInProto = win.Window.prototype.hasOwnProperty('localStorage');

        const storagesPropsOwner = this.getStoragesPropsOwner(win);

        this.winLocalStorageGetter   = win.Object.getOwnPropertyDescriptor(storagesPropsOwner, 'localStorage').get;
        this.winSessionStorageGetter = win.Object.getOwnPropertyDescriptor(storagesPropsOwner, 'sessionStorage').get;

        // MutationRecord
        this.mutationRecordNextSiblingGetter = win.Object.getOwnPropertyDescriptor(win.MutationRecord.prototype, 'nextSibling').get;
        this.mutationRecordPrevSiblingGetter = win.Object.getOwnPropertyDescriptor(win.MutationRecord.prototype, 'previousSibling').get;

        // Stylesheets
        this.styleGetPropertyValue = win.CSSStyleDeclaration.prototype.getPropertyValue;
        this.styleSetProperty      = win.CSSStyleDeclaration.prototype.setProperty;
        this.styleRemoveProperty   = win.CSSStyleDeclaration.prototype.removeProperty;
        this.styleInsertRule       = win.CSSStyleSheet.prototype.insertRule;

        // Console
        this.console = win.console;

        if (this.console) {
            this.consoleMeths = {
                log:   win.console.log,
                warn:  win.console.warn,
                error: win.console.error,
                info:  win.console.info
            };
        }

        // DOMTokenList
        this.tokenListAdd      = win.DOMTokenList.prototype.add;
        this.tokenListRemove   = win.DOMTokenList.prototype.remove;
        this.tokenListReplace  = win.DOMTokenList.prototype.replace;
        this.tokenListSupports = win.DOMTokenList.prototype.supports;
        this.tokenListToggle   = win.DOMTokenList.prototype.toggle;
        this.tokenListContains = win.DOMTokenList.prototype.contains;

        this.scrollTo = win.scrollTo;

        this.crypto                = win.crypto || win.msCrypto;
        this.cryptoGetRandomValues = this.crypto.getRandomValues;

        this.refreshClasses(win);
    }

    refreshClasses (win) {
        this.windowClass      = win.Window;
        this.documentClass    = win.Document;
        this.locationClass    = win.Location;
        this.elementClass     = win.Element;
        this.svgElementClass  = win.SVGElement;
        this.Worker           = win.Worker;
        this.MessageChannel   = win.MessageChannel;
        this.ArrayBuffer      = win.ArrayBuffer;
        this.Uint8Array       = win.Uint8Array;
        this.Uint16Array      = win.Uint16Array;
        this.Uint32Array      = win.Uint32Array;
        this.DataView         = win.DataView;
        this.Blob             = win.Blob;
        this.XMLHttpRequest   = win.XMLHttpRequest;
        this.Image            = win.Image;
        this.Function         = win.Function;
        this.functionToString = win.Function.toString;
        this.FontFace         = win.FontFace;
        this.StorageEvent     = win.StorageEvent;
        this.MutationObserver = win.MutationObserver;
        this.EventSource      = win.EventSource;
        this.Proxy            = win.Proxy;
        this.WebSocket        = win.WebSocket;
        this.HTMLCollection   = win.HTMLCollection;
        this.NodeList         = win.NodeList;
        this.Node             = win.Node;

        if (win.Proxy)
            this.Proxy = win.Proxy;

        if (win.DataTransfer)
            this.DataTransfer = win.DataTransfer;

        if (win.DataTransferItemList)
            this.DataTransferItemList = win.DataTransferItemList;

        if (win.DataTransferItem)
            this.DataTransferItem = win.DataTransferItem;

        if (win.FileList)
            this.FileList = win.FileList;
    }

    refreshElectronMeths (vmModule): boolean {
        if (this.createScript && this.createScript.toString() !== vmModule.createScript.toString())
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

    refreshIfNecessary (doc: Document, win: Window) {
        const tryToExecuteCode = (func: Function) => {
            try {
                return func();
            }
            catch (e) {
                return true;
            }
        };

        const needToRefreshDocumentMethods = tryToExecuteCode(
            () => !doc.createElement ||
                  this.createElement.toString() === document.createElement.toString()
        );

        const needToRefreshElementMethods = tryToExecuteCode(() => {
            const nativeElement = this.createElement.call(doc, 'div');

            return nativeElement.getAttribute.toString() === this.getAttribute.toString();
        });

        const needToRefreshWindowMethods = tryToExecuteCode(() => {
            this.setTimeout.call(win, () => void 0, 0);

            //@ts-ignore
            return win.XMLHttpRequest.prototype.open.toString() === this.xhrOpen.toString();
        });

        // NOTE: T173709
        if (needToRefreshDocumentMethods)
            this.refreshDocumentMeths(doc, win);

        if (needToRefreshElementMethods)
            this.refreshElementMeths(doc, win);

        // NOTE: T239109
        if (needToRefreshWindowMethods)
            this.refreshWindowMeths(win);
    }

    isNativeCode (fn: Function): boolean {
        return NATIVE_CODE_RE.test(fn.toString());
    }
}

export default new NativeMethods();
