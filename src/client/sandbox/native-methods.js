/*global Document, Window */
class NativeMethods {
    constructor (doc, win) {
        this.refreshDocumentMeths(doc);
        this.refreshElementMeths(doc, win);
        this.refreshWindowMeths(win);
    }

    refreshDocumentMeths (doc) {
        doc = doc || document;

        var docProto = doc.constructor.prototype;

        // Dom
        this.createDocumentFragment = doc.createDocumentFragment || docProto.createDocumentFragment;
        this.createElement          = doc.createElement || docProto.createElement;
        this.createElementNS        = doc.createElementNS || docProto.createElementNS;
        this.documentOpen           = doc.open || docProto.open;
        this.documentClose          = doc.close || docProto.close;
        this.documentWrite          = doc.write || docProto.write;
        this.documentWriteLn        = doc.writeln || docProto.writeln;
        this.elementFromPoint       = doc.elementFromPoint || docProto.elementFromPoint;
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

        var createElement = tagName => this.createElement.call(doc || document, tagName);
        var nativeElement = createElement('div');

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
        win                                   = win || window;
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
        this.postMessage         = win.postMessage || Window.prototype.postMessage;
        this.windowOpen          = win.open || Window.prototype.open;
        this.setTimeout          = win.setTimeout || Window.prototype.setTimeout;
        this.setInterval         = win.setInterval || Window.prototype.setInterval;
        this.clearTimeout        = win.clearTimeout || Window.prototype.clearTimeout;
        this.clearInterval       = win.clearInterval || Window.prototype.clearInterval;

        if (win.navigator.registerProtocolHandler)
            this.registerProtocolHandler = win.navigator.registerProtocolHandler;

        // XHR
        this.xmlHttpRequestAbort               = win.XMLHttpRequest.prototype.abort;
        this.xmlHttpRequestOpen                = win.XMLHttpRequest.prototype.open;
        this.xmlHttpRequestSend                = win.XMLHttpRequest.prototype.send;
        this.xmlHttpRequestAddEventListener    = win.XMLHttpRequest.prototype.addEventListener;
        this.xmlHttpRequestRemoveEventListener = win.XMLHttpRequest.prototype.removeEventListener;

        try {
            this.registerServiceWorker = win.navigator.serviceWorker.register;
        }
        catch (e) {
            this.registerServiceWorker = null;
        }

        this.createContextualFragment = win.Range.prototype.createContextualFragment;

        if (win.Performance) {
            var nativePerformance    = win.performance;
            var nativePerformanceNow = win.performance.now || win.Performance.prototype.now;

            if (nativePerformanceNow)
                this.performanceNow = (...args) => nativePerformanceNow.apply(nativePerformance, args);
        }

        // Fetch
        this.fetch   = win.fetch;
        this.Request = win.Request;
        this.Headers = win.Headers;

        // Event
        this.windowAddEventListener    = win.addEventListener || Window.prototype.addEventListener;
        this.windowRemoveEventListener = win.removeEventListener || Window.prototype.removeEventListener;
        this.WindowPointerEvent        = win.PointerEvent || Window.prototype.PointerEvent;
        this.WindowMSPointerEvent      = win.MSPointerEvent || Window.prototype.MSPointerEvent;

        // Canvas
        this.canvasContextDrawImage = win.CanvasRenderingContext2D.prototype.drawImage;

        // FormData
        if (win.FormData)
            this.formDataAppend = win.FormData.prototype.append;

        // DateTime
        this.date    = win.Date;
        this.dateNow = win.Date.now;

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
        this.FontFace         = win.FontFace;
        this.StorageEvent     = win.StorageEvent;
        this.MutationObserver = win.MutationObserver;
        this.EventSource      = win.EventSource;
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
