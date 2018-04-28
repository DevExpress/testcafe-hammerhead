/*global Document, Window */
class NativeMethods {
    constructor (doc, win) {
        win = win || window;

        // NOTE: The 'localStorage' and 'sessionStorage' properties is located in window prototype only in IE11
        this.isStoragePropsLocatedInProto = win.Window.prototype.hasOwnProperty('localStorage');

        this.refreshDocumentMeths(doc, win);
        this.refreshElementMeths(doc, win);
        this.refreshWindowMeths(win);
    }

    static _getDocumentPropOwnerName (docPrototype, propName) {
        return docPrototype.hasOwnProperty(propName) ? 'Document' : 'HTMLDocument';
    }

    getStoragesPropsOwner (win) {
        return this.isStoragePropsLocatedInProto ? win.Window.prototype : win;
    }

    refreshDocumentMeths (doc, win) {
        doc = doc || document;
        win = win || window;

        const docProto = doc.constructor.prototype;

        // Dom
        this.createDocumentFragment = doc.createDocumentFragment || docProto.createDocumentFragment;
        this.createElement          = doc.createElement || docProto.createElement;
        this.createElementNS        = doc.createElementNS || docProto.createElementNS;
        this.documentOpen           = doc.open || docProto.open;
        this.documentClose          = doc.close || docProto.close;
        this.documentWrite          = doc.write || docProto.write;
        this.documentWriteLn        = doc.writeln || docProto.writeln;
        this.elementFromPoint       = doc.elementFromPoint || docProto.elementFromPoint;
        this.caretRangeFromPoint    = doc.caretRangeFromPoint || docProto.caretRangeFromPoint;
        this.caretPositionFromPoint = doc.caretPositionFromPoint || docProto.caretPositionFromPoint;
        this.getElementById         = doc.getElementById || docProto.getElementById;
        this.getElementsByClassName = doc.getElementsByClassName || docProto.getElementsByClassName;
        this.getElementsByName      = doc.getElementsByName || docProto.getElementsByName;

        this.getElementsByTagName = doc.getElementsByTagName || docProto.getElementsByTagName;
        this.querySelector        = doc.querySelector || docProto.querySelector;
        this.querySelectorAll     = doc.querySelectorAll || docProto.querySelectorAll;

        // Event
        this.documentAddEventListener    = doc.addEventListener || docProto.addEventListener;
        this.documentRemoveEventListener = doc.removeEventListener || docProto.removeEventListener;
        this.documentCreateEvent         = doc.createEvent || docProto.createEvent;
        this.documentCreateTouch         = doc.createTouch || docProto.createTouch;
        this.documentCreateTouchList     = doc.createTouchList || docProto.createTouchList;

        // getters/setters
        const docPrototype = win.Document.prototype;

        this.documentCookiePropOwnerName  = NativeMethods._getDocumentPropOwnerName(docPrototype, 'cookie');
        this.documentScriptsPropOwnerName = NativeMethods._getDocumentPropOwnerName(docPrototype, 'scripts');

        const documentCookieDescriptor = win.Object.getOwnPropertyDescriptor(win[this.documentCookiePropOwnerName].prototype, 'cookie');

        this.documentReferrerGetter      = win.Object.getOwnPropertyDescriptor(docPrototype, 'referrer').get;
        this.documentStyleSheetsGetter   = win.Object.getOwnPropertyDescriptor(docPrototype, 'styleSheets').get;
        this.documentActiveElementGetter = win.Object.getOwnPropertyDescriptor(docPrototype, 'activeElement').get;
        this.documentScriptsGetter       = win.Object.getOwnPropertyDescriptor(win[this.documentScriptsPropOwnerName].prototype, 'scripts').get;
        this.documentCookieGetter        = documentCookieDescriptor.get;
        this.documentCookieSetter        = documentCookieDescriptor.set;

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

        // Event
        this.addEventListener          = nativeElement.addEventListener;
        this.removeEventListener       = nativeElement.removeEventListener;
        this.blur                      = nativeElement.blur;
        this.click                     = nativeElement.click;
        this.dispatchEvent             = nativeElement.dispatchEvent;
        this.focus                     = nativeElement.focus;
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
            this.registerServiceWorker = win.navigator.serviceWorker.register;
        }
        catch (e) {
            this.registerServiceWorker = null;
        }

        this.createContextualFragment = win.Range.prototype.createContextualFragment;

        const nativePerformance    = win.performance;
        const nativePerformanceNow = win.performance.now || win.Performance.prototype.now;

        this.performanceNow = (...args) => nativePerformanceNow.apply(nativePerformance, args);

        // Fetch
        this.fetch   = win.fetch;
        this.Request = win.Request;
        this.Headers = win.Headers;

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


        this.canvasContextDrawImage = win.CanvasRenderingContext2D.prototype.drawImage;
        this.formDataAppend         = win.FormData.prototype.append;

        // DateTime
        this.date    = win.Date;
        this.dateNow = win.Date.now;

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

        this.DOMParserParseFromString = win.DOMParser.prototype.parseFromString;

        const objectDataDescriptor           = win.Object.getOwnPropertyDescriptor(win.HTMLObjectElement.prototype, 'data');
        const inputValueDescriptor           = win.Object.getOwnPropertyDescriptor(win.HTMLInputElement.prototype, 'value');
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

        // NOTE: Html properties is located in HTMLElement prototype in IE11 only
        this.elementHTMLPropOwnerName = win.Element.prototype.hasOwnProperty('innerHTML') ? 'Element' : 'HTMLElement';

        const elementInnerHTMLDescriptor = win.Object.getOwnPropertyDescriptor(win[this.elementHTMLPropOwnerName].prototype, 'innerHTML');
        const elementOuterHTMLDescriptor = win.Object.getOwnPropertyDescriptor(win[this.elementHTMLPropOwnerName].prototype, 'outerHTML');

        // Setters
        this.objectDataSetter        = objectDataDescriptor.set;
        this.inputValueSetter        = inputValueDescriptor.set;
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
        this.svgAnimStrBaseValSetter = svgAnimStrBaseValDescriptor.set;
        this.inputAutocompleteSetter = inputAutocompleteDescriptor.set;
        this.formActionSetter        = formActionDescriptor.set;
        this.inputFormActionSetter   = inputFormActionDescriptor.set;
        this.buttonFormActionSetter  = buttonFormActionDescriptor.set;

        this.nodeTextContentSetter      = nodeTextContentDescriptor.set;
        this.htmlElementInnerTextSetter = htmlElementInnerTextDescriptor.set;
        this.scriptTextSetter           = scriptTextDescriptor.set;
        this.anchorTextSetter           = anchorTextDescriptor.set;
        this.elementInnerHTMLSetter     = elementInnerHTMLDescriptor.set;
        this.elementOuterHTMLSetter     = elementOuterHTMLDescriptor.set;

        // NOTE: Some browsers have no 'integrity' property in HTMLScriptElement
        if (scriptIntegrityDescriptor)
            this.scriptIntegritySetter = scriptIntegrityDescriptor.set;

        // NOTE: Some browsers have no 'integrity' property in HTMLLinkElement
        if (linkIntegrityDescriptor)
            this.linkIntegritySetter = linkIntegrityDescriptor.set;

        // NOTE: Event properties is located in window prototype only in IE11
        this.isEventPropsLocatedInProto = win.Window.prototype.hasOwnProperty('onerror');

        const eventPropsOwner = this.isEventPropsLocatedInProto ? win.Window.prototype : win;

        this.winOnBeforeUnloadSetter = win.Object.getOwnPropertyDescriptor(eventPropsOwner, 'onbeforeunload').set;
        this.winOnPageHideSetter     = win.Object.getOwnPropertyDescriptor(eventPropsOwner, 'onpagehide').set;
        this.winOnMessageSetter      = win.Object.getOwnPropertyDescriptor(eventPropsOwner, 'onmessage').set;
        this.winOnErrorSetter        = win.Object.getOwnPropertyDescriptor(eventPropsOwner, 'onerror').set;

        const winOnUnhandledRejectionDescriptor = win.Object.getOwnPropertyDescriptor(eventPropsOwner, 'onunhandledrejection');

        if (winOnUnhandledRejectionDescriptor)
            this.winOnUnhandledRejectionSetter = winOnUnhandledRejectionDescriptor.set;

        // Getters
        if (win.WebSocket) {
            const urlPropDescriptor = win.Object.getOwnPropertyDescriptor(win.WebSocket.prototype, 'url');

            if (urlPropDescriptor && urlPropDescriptor.get && urlPropDescriptor.configurable)
                this.webSocketUrlGetter = urlPropDescriptor.get;
        }

        this.messageEventOriginGetter       = win.Object.getOwnPropertyDescriptor(win.MessageEvent.prototype, 'origin').get;
        this.htmlCollectionLengthGetter     = win.Object.getOwnPropertyDescriptor(win.HTMLCollection.prototype, 'length').get;
        this.nodeListLengthGetter           = win.Object.getOwnPropertyDescriptor(win.NodeList.prototype, 'length').get;
        this.elementChildElementCountGetter = win.Object.getOwnPropertyDescriptor(win.Element.prototype, 'childElementCount').get;
        this.inputFilesGetter               = win.Object.getOwnPropertyDescriptor(win.HTMLInputElement.prototype, 'files').get;
        this.styleSheetHrefGetter           = win.Object.getOwnPropertyDescriptor(win.StyleSheet.prototype, 'href').get;
        this.xhrStatusGetter                = win.Object.getOwnPropertyDescriptor(win.XMLHttpRequest.prototype, 'status').get;
        this.objectDataGetter               = objectDataDescriptor.get;
        this.inputValueGetter               = inputValueDescriptor.get;
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
        this.svgImageHrefGetter             = svgImageHrefDescriptor.get;
        this.svgAnimStrAnimValGetter        = svgAnimStrAnimValDescriptor.get;
        this.svgAnimStrBaseValGetter        = svgAnimStrBaseValDescriptor.get;
        this.inputAutocompleteGetter        = inputAutocompleteDescriptor.get;
        this.formActionGetter               = formActionDescriptor.get;
        this.inputFormActionGetter          = inputFormActionDescriptor.get;
        this.buttonFormActionGetter         = buttonFormActionDescriptor.get;

        this.nodeTextContentGetter      = nodeTextContentDescriptor.get;
        this.htmlElementInnerTextGetter = htmlElementInnerTextDescriptor.get;
        this.scriptTextGetter           = scriptTextDescriptor.get;
        this.anchorTextGetter           = anchorTextDescriptor.get;
        this.elementInnerHTMLGetter     = elementInnerHTMLDescriptor.get;
        this.elementOuterHTMLGetter     = elementOuterHTMLDescriptor.get;

        this.nodeFirstChildGetter            = win.Object.getOwnPropertyDescriptor(win.Node.prototype, 'firstChild').get;
        this.nodeLastChildGetter             = win.Object.getOwnPropertyDescriptor(win.Node.prototype, 'lastChild').get;
        this.nodeNextSiblingGetter           = win.Object.getOwnPropertyDescriptor(win.Node.prototype, 'nextSibling').get;
        this.elementFirstElementChildGetter  = win.Object.getOwnPropertyDescriptor(win.Element.prototype, 'firstElementChild').get;
        this.elementLastElementChildGetter   = win.Object.getOwnPropertyDescriptor(win.Element.prototype, 'lastElementChild').get;
        this.elementNextElementSiblingGetter = win.Object.getOwnPropertyDescriptor(win.Element.prototype, 'nextElementSibling').get;

        const anchorOriginDescriptor = win.Object.getOwnPropertyDescriptor(win.HTMLAnchorElement.prototype, 'origin');

        // NOTE: Some browsers have no 'integrity' property in HTMLScriptElement
        if (scriptIntegrityDescriptor)
            this.scriptIntegrityGetter = scriptIntegrityDescriptor.get;

        // NOTE: Some browsers have no 'integrity' property in HTMLLinkElement
        if (linkIntegrityDescriptor)
            this.linkIntegrityGetter = linkIntegrityDescriptor.get;

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

        const xhrResponseURLDescriptor = win.Object.getOwnPropertyDescriptor(win.XMLHttpRequest.prototype, 'responseURL');

        // NOTE: IE doesn't support the 'responseURL' property
        if (xhrResponseURLDescriptor)
            this.xhrResponseURLGetter = xhrResponseURLDescriptor.get;

        // NOTE: The 'localStorage' and 'sessionStorage' properties is located in window prototype only in IE11
        this.isStoragePropsLocatedInProto = win.Window.prototype.hasOwnProperty('localStorage');

        const storagesPropsOwner = this.getStoragesPropsOwner(win);

        this.winLocalStorageGetter   = win.Object.getOwnPropertyDescriptor(storagesPropsOwner, 'localStorage').get;
        this.winSessionStorageGetter = win.Object.getOwnPropertyDescriptor(storagesPropsOwner, 'sessionStorage').get;

        // Stylesheets
        this.styleGetPropertyValue = win.CSSStyleDeclaration.prototype.getPropertyValue;
        this.styleSetProperty      = win.CSSStyleDeclaration.prototype.setProperty;
        this.styleRemoveProperty   = win.CSSStyleDeclaration.prototype.removeProperty;

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

        this.refreshClasses(win);
    }

    refreshClasses (win) {
        this.windowClass      = win.Window;
        this.documentClass    = win.Document;
        this.locationClass    = win.Location;
        this.elementClass     = win.Element;
        this.svgElementClass  = win.SVGElement;
        this.Worker           = win.Worker;
        this.Blob             = win.Blob;
        this.XMLHttpRequest   = win.XMLHttpRequest;
        this.Image            = win.Image;
        this.Function         = win.Function;
        this.functionToString = win.Function.toString;
        this.FontFace         = win.FontFace;
        this.StorageEvent     = win.StorageEvent;
        this.MutationObserver = win.MutationObserver;
        this.EventSource      = win.EventSource;
        this.WebSocket        = win.WebSocket;

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

    refreshElectronMeths (vmModule) {
        if (this.createScript && this.createScript.toString() !== vmModule.createScript.toString())
            return false;

        this.createScript      = vmModule.createScript;
        this.runInDebugContext = vmModule.runInDebugContext;
        this.runInContext      = vmModule.runInContext;
        this.runInNewContext   = vmModule.runInNewContext;
        this.runInThisContext  = vmModule.runInThisContext;

        return true;
    }

    restoreDocumentMeths (document) {
        document.createDocumentFragment = this.createDocumentFragment;
        document.createElement          = this.createElement;
        document.createElementNS        = this.createElementNS;
        document.open                   = this.documentOpen;
        document.close                  = this.documentClose;
        document.write                  = this.documentWrite;
        document.writeln                = this.documentWriteLn;
        document.elementFromPoint       = this.elementFromPoint;
        document.caretRangeFromPoint    = this.caretRangeFromPoint;
        document.caretPositionFromPoint = this.caretPositionFromPoint;
        document.getElementById         = this.getElementById;
        document.getElementsByClassName = this.getElementsByClassName;
        document.getElementsByName      = this.getElementsByName;
        document.getElementsByTagName   = this.getElementsByTagName;
        document.querySelector          = this.querySelector;
        document.querySelectorAll       = this.querySelectorAll;

        // Event
        document.addEventListener    = this.documentAddEventListener;
        document.removeEventListener = this.documentRemoveEventListener;
        document.createEvent         = this.documentCreateEvent;
        document.createTouch         = this.documentCreateTouch;
        document.createTouchList     = this.documentCreateTouchList;
    }
}

export default new NativeMethods();
