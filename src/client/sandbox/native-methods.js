class NativeMethods {
    constructor (doc, win) {
        this.refresh(doc, win);
    }

    _tryToExecuteCode (func) {
        try {
            return func();
        }
        catch (e) {
            return true;
        }
    }

    _needToUpdateDocumentMeths (doc) {
        return this._tryToExecuteCode(
            () => !doc.createElement ||
                  this.createElement.toString() === doc.createElement.toString()
        );
    }

    _needToUpdateElementMeths (doc) {
        return this._tryToExecuteCode(() => {
            var nativeElement = this.createElement.call(doc, 'div');

            return nativeElement.getAttribute.toString() === this.getAttribute.toString();
        });
    }

    _needToUpdateWindowMeths (wnd) {
        return this._tryToExecuteCode(() => {
            this.setTimeout.call(wnd, () => void 0, 0);

            return wnd.XMLHttpRequest.prototype.open.toString() === this.xmlHttpRequestOpen.toString();
        });
    }

    _refreshDocumentMeths (doc) {
        doc = doc || document;

        if (!this._needToUpdateDocumentMeths(doc))
            return;

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

    _refreshElementMeths (doc, win) {
        win = win || window;

        if (!this._needToUpdateElementMeths(doc))
            return;

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

    _refreshWindowMeths (win) {
        win = win || window;

        if (!this._needToUpdateWindowMeths(win))
            return;

        // Dom
        this.eval                             = win.eval;
        this.formSubmit                       = win.HTMLFormElement.prototype.submit;
        this.documentFragmentQuerySelector    = win.DocumentFragment.prototype.querySelector;
        this.documentFragmentQuerySelectorAll = win.DocumentFragment.prototype.querySelectorAll;

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

        // Canvas
        this.canvasContextDrawImage = win.CanvasRenderingContext2D.prototype.drawImage;

        // FormData
        if (win.FormData)
            this.formDataAppend = win.FormData.prototype.append;

        // DateTime
        this.date    = win.Date;
        this.dateNow = win.Date.now;

        this._refreshClasses(win);
    }

    _refreshClasses (win) {
        var mock = () => null;

        this.windowClass      = win.Window || mock;
        this.documentClass    = win.Document || mock;
        this.locationClass    = win.Location || mock;
        this.styleClass       = win.CSSStyleDeclaration || win.CSS2Properties || win.MSStyleCSSProperties || mock;
        this.styleSheetClass  = win.CSSStyleSheet || mock;
        this.elementClass     = win.Element || mock;
        this.svgElementClass  = win.SVGElement || mock;
        this.Worker           = win.Worker || mock;
        this.Blob             = win.Blob || mock;
        this.XMLHttpRequest   = win.XMLHttpRequest || mock;
        this.Image            = win.Image || mock;
        this.FontFace         = win.FontFace || mock;
        this.StorageEvent     = win.StorageEvent || mock;
        this.MutationObserver = win.MutationObserver || mock;
        this.EventSource      = win.EventSource || mock;
    }

    refresh (doc, win) {
        this._refreshDocumentMeths(doc);
        this._refreshElementMeths(doc, win);
        this._refreshWindowMeths(win);
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
