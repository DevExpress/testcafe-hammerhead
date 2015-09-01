/*global Document, Window */
class NativeMethods {
    constructor () {
        this.refreshDocumentMeths();
        this.refreshElementMeths();
        this.refreshWindowMeths();
    }

    refreshDocumentMeths (doc) {
        doc = doc || document;

        // Dom
        this.createDocumentFragment = doc.createDocumentFragment || Document.prototype.createDocumentFragment;
        this.createElement          = doc.createElement || Document.prototype.createElement;
        this.createElementNS        = doc.createElementNS || Document.prototype.createElementNS;
        this.documentOpen           = doc.open || Document.prototype.open;
        this.documentClose          = doc.close || Document.prototype.close;
        this.documentWrite          = doc.write || Document.prototype.write;
        this.documentWriteLn        = doc.writeln || Document.prototype.writeln;
        this.elementFromPoint       = doc.elementFromPoint || Document.prototype.elementFromPoint;
        this.getElementById         = doc.getElementById || Document.prototype.getElementById;
        this.getElementsByClassName = doc.getElementsByClassName || Document.prototype.getElementsByClassName;
        this.getElementsByName      = doc.getElementsByName || Document.prototype.getElementsByName;

        this.getElementsByTagName = doc.getElementsByTagName || Document.prototype.getElementsByTagName;
        this.querySelector        = doc.querySelector || Document.prototype.querySelector;
        this.querySelectorAll     = doc.querySelectorAll || Document.prototype.querySelectorAll;

        // Event
        this.documentAddEventListener    = doc.addEventListener || Document.prototype.addEventListener;
        this.documentRemoveEventListener = doc.removeEventListener || Document.prototype.removeEventListener;
    }

    refreshElementMeths (doc) {
        var createElement = (tagName) => this.createElement.call(doc || document, tagName);
        var nativeElement = createElement('div');

        // Dom
        this.appendChild                   = nativeElement.appendChild;
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
    }

    refreshWindowMeths (win) {
        win = win || window;
        // Dom
        this.eval                    = win.eval;
        this.EventSource             = win.EventSource;
        this.formSubmit              = win.HTMLFormElement.prototype.submit;
        this.historyPushState        = win.history ? win.history.pushState : null;
        this.historyReplaceState     = win.history ? win.history.replaceState : null;
        this.Image                   = win.Image;
        this.MutationObserver        = win.MutationObserver;
        this.postMessage             = win.postMessage || Window.prototype.postMessage;
        this.windowOpen              = win.open || Window.prototype.open;
        this.Worker                  = win.Worker;
        this.Blob                    = win.Blob;
        this.setTimeout              = win.setTimeout || Window.prototype.setTimeout;
        this.setInterval             = win.setInterval || Window.prototype.setInterval;
        this.XMLHttpRequest          = win.XMLHttpRequest;
        this.registerProtocolHandler = win.navigator.registerProtocolHandler;
        this.registerServiceWorker   = win.navigator &&
                                       win.navigator.serviceWorker ? win.navigator.serviceWorker.register : null;

        // Event
        this.windowAddEventListener    = win.addEventListener || Window.prototype.addEventListener;
        this.windowRemoveEventListener = win.removeEventListener || Window.prototype.removeEventListener;

        // Canvas
        this.canvasContextDrawImage = win.CanvasRenderingContext2D.prototype.drawImage;

        //DateTime
        this.date    = win.Date;
        this.dateNow = win.Date.now;

        this.refreshClasses(win);
    }

    refreshClasses (win) {
        var mock = () => null;

        this.windowClass   = win.Window || mock;
        this.documentClass = win.Document || mock;
        this.locationClass = win.Location || mock;
        this.styleClass    = win.CSSStyleDeclaration || win.CSS2Properties || win.MSStyleCSSProperties || mock;
    }

    restoreNativeDocumentMeth (document) {
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
