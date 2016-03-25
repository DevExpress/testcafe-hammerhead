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
        win = win || window;
        // Dom
        this.eval                             = win.eval;
        this.EventSource                      = win.EventSource;
        this.formSubmit                       = win.HTMLFormElement.prototype.submit;
        this.documentFragmentQuerySelector    = win.DocumentFragment.prototype.querySelector;
        this.documentFragmentQuerySelectorAll = win.DocumentFragment.prototype.querySelectorAll;
        this.historyPushState                 = win.history ? win.history.pushState : null;
        this.historyReplaceState              = win.history ? win.history.replaceState : null;
        this.Image                            = win.Image;
        this.FontFace                         = win.FontFace;
        this.StorageEvent                     = win.StorageEvent;
        this.MutationObserver                 = win.MutationObserver;
        this.windowDispatchEvent              = win.dispatchEvent;
        this.postMessage                      = win.postMessage || Window.prototype.postMessage;
        this.windowOpen                       = win.open || Window.prototype.open;
        this.Worker                           = win.Worker;
        this.Blob                             = win.Blob;
        this.setTimeout                       = win.setTimeout || Window.prototype.setTimeout;
        this.setInterval                      = win.setInterval || Window.prototype.setInterval;
        this.registerProtocolHandler          = win.navigator.registerProtocolHandler;

        // XHR
        this.XMLHttpRequest                    = win.XMLHttpRequest;
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

        // Event
        this.windowAddEventListener    = win.addEventListener || Window.prototype.addEventListener;
        this.windowRemoveEventListener = win.removeEventListener || Window.prototype.removeEventListener;

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
        var mock = () => null;

        this.windowClass     = win.Window || mock;
        this.documentClass   = win.Document || mock;
        this.locationClass   = win.Location || mock;
        this.styleClass      = win.CSSStyleDeclaration || win.CSS2Properties || win.MSStyleCSSProperties || mock;
        this.elementClass    = win.Element || mock;
        this.svgElementClass = win.SVGElement || mock;
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
    }
}

export default new NativeMethods();
