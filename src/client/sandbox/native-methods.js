/*global Document, Window */
class NativeMethods {
    constructor (doc, win) {
        this.refreshDocumentMeths(doc);
        this.refreshElementMeths(doc, win);
        this.refreshWindowMeths(win);
    }

    refreshDocumentMeths (doc) {
        doc = doc || document;

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

        // Event
        this.addEventListener          = nativeElement.addEventListener;
        this.removeEventListener       = nativeElement.removeEventListener;
        this.blur                      = nativeElement.blur;
        this.click                     = nativeElement.click;
        this.dispatchEvent             = nativeElement.dispatchEvent;
        this.attachEvent               = nativeElement.attachEvent;
        this.detachEvent               = nativeElement.detachEvent;
        this.fireEvent                 = nativeElement.fireEvent;
        this.focus                     = nativeElement.focus;
        this.select                    = window.TextRange ? createElement('body').createTextRange().select : null;
        this.setSelectionRange         = createElement('input').setSelectionRange;
        this.textAreaSetSelectionRange = createElement('textarea').setSelectionRange;

        this.svgFocus = win.SVGElement ? win.SVGElement.prototype.focus : this.focus;
        this.svgBlur  = win.SVGElement ? win.SVGElement.prototype.blur : this.blur;
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

        if (win.history) {
            this.historyPushState    = win.history.pushState;
            this.historyReplaceState = win.history.replaceState;
        }

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

        if (win.Performance) {
            const nativePerformance    = win.performance;
            const nativePerformanceNow = win.performance.now || win.Performance.prototype.now;

            if (nativePerformanceNow)
                this.performanceNow = (...args) => nativePerformanceNow.apply(nativePerformance, args);
        }

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

        // Canvas
        this.canvasContextDrawImage = win.CanvasRenderingContext2D.prototype.drawImage;

        // FormData
        if (win.FormData)
            this.formDataAppend = win.FormData.prototype.append;

        // DateTime
        this.date    = win.Date;
        this.dateNow = win.Date.now;

        // Object
        this.objectToString         = win.Object.prototype.toString;
        this.objectAssign           = win.Object.assign;
        this.objectKeys             = win.Object.keys;
        this.objectDefineProperty   = win.Object.defineProperty;
        this.objectDefineProperties = win.Object.defineProperties;
        this.objectCreate           = win.Object.create;
        this.objectIsExtensible     = win.Object.isExtensible;
        this.objectIsFrozen         = win.Object.isFrozen;

        // DOMParser
        if (win.DOMParser)
            this.DOMParserParseFromString = win.DOMParser.prototype.parseFromString;

        // Setters
        const inputValueDescriptor    = win.Object.getOwnPropertyDescriptor(win.HTMLInputElement.prototype, 'value');
        const textAreaValueDescriptor = win.Object.getOwnPropertyDescriptor(win.HTMLTextAreaElement.prototype, 'value');

        if (inputValueDescriptor && typeof inputValueDescriptor.set === 'function')
            this.inputValueSetter = inputValueDescriptor.set;

        if (textAreaValueDescriptor && typeof textAreaValueDescriptor.set === 'function')
            this.textAreaValueSetter = textAreaValueDescriptor.set;

        // Stylesheets
        if (win.CSSStyleDeclaration) {
            this.CSSStyleDeclarationGetPropertyValue = win.CSSStyleDeclaration.prototype.getPropertyValue;
            this.CSSStyleDeclarationSetProperty      = win.CSSStyleDeclaration.prototype.setProperty;
            this.CSSStyleDeclarationRemoveProperty   = win.CSSStyleDeclaration.prototype.removeProperty;
        }

        if (win.MSStyleCSSProperties) {
            this.MSStyleCSSPropertiesGetPropertyValue = win.MSStyleCSSProperties.prototype.getPropertyValue;
            this.MSStyleCSSPropertiesSetProperty      = win.MSStyleCSSProperties.prototype.setProperty;
            this.MSStyleCSSPropertiesRemoveProperty   = win.MSStyleCSSProperties.prototype.removeProperty;
        }

        if (win.CSS2Property) {
            this.CSS2PropertyGetPropertyValue = win.CSS2Property.prototype.getPropertyValue;
            this.CSS2PropertySetProperty      = win.CSS2Property.prototype.setProperty;
            this.CSS2PropertyRemoveProperty   = win.CSS2Property.prototype.removeProperty;
        }

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
        this.styleClass       = win.CSSStyleDeclaration || win.CSS2Properties || win.MSStyleCSSProperties;
        this.styleSheetClass  = win.CSSStyleSheet;
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
