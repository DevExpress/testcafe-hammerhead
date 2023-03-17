import SandboxBase from '../../base';
import IframeSandbox from '../../iframe';
import nativeMethods from '../../native-methods';
import domProcessor from '../../../dom-processor';
import settings from '../../../settings';
import { isIE } from '../../../utils/browser';

import {
    isIframeWithoutSrc,
    getFrameElement,
    isImgElement,
    isShadowUIElement,
} from '../../../utils/dom';

import DocumentWriter from './writer';
import ShadowUI from './../../shadow-ui';
import INTERNAL_PROPS from '../../../../processing/dom/internal-properties';
import LocationAccessorsInstrumentation from '../../code-instrumentation/location';

import {
    overrideDescriptor,
    createOverriddenDescriptor,
    overrideFunction,
} from '../../../utils/overriding';

import NodeSandbox from '../index';

import {
    getDestinationUrl,
    isSpecialPage,
    convertToProxyUrl,
    getCrossDomainProxyOrigin,
} from '../../../utils/url';

import { getReferrer } from '../../../utils/destination-location';
import DocumentTitleStorageInitializer from './title-storage-initializer';
import CookieSandbox from '../../cookie';

export default class DocumentSandbox extends SandboxBase {
    writers = new Map<Document, DocumentWriter>();

    constructor (private readonly _nodeSandbox: NodeSandbox,
        private readonly _shadowUI: ShadowUI,
        private readonly _cookieSandbox: CookieSandbox,
        private readonly _iframeSandbox: IframeSandbox,
        private readonly _documentTitleStorageInitializer?: DocumentTitleStorageInitializer) {

        super();
    }

    static forceProxySrcForImageIfNecessary (element: Element): void {
        if (settings.get().proxyless)
            return;

        if (isImgElement(element) && settings.get().forceProxySrcForImage)
            element[INTERNAL_PROPS.forceProxySrcForImage] = true;
    }

    private static _isDocumentInDesignMode (doc: HTMLDocument): boolean {
        return doc.designMode === 'on';
    }

    private _isUninitializedIframeWithoutSrc (win: Window): boolean {
        const frameElement = getFrameElement(win);

        return win !== win.top && frameElement && isIframeWithoutSrc(frameElement) &&
               !IframeSandbox.isIframeInitialized(frameElement as HTMLIFrameElement);
    }

    private _beforeDocumentCleaned () {
        this._nodeSandbox.mutation.onBeforeDocumentCleaned(this.document);
    }

    private _onDocumentClosed () {
        this._nodeSandbox.mutation.onDocumentClosed(this.document);
    }

    private static _shouldEmitDocumentCleanedEvents (doc) {
        if (isIE) {
            if (doc.readyState !== 'loading')
                return true;

            const window = doc.defaultView;

            if (window[INTERNAL_PROPS.documentWasCleaned])
                return false;

            const iframe = window && getFrameElement(window);

            return iframe && isIframeWithoutSrc(iframe);
        }

        return doc.readyState !== 'loading' && doc.readyState !== 'uninitialized';
    }

    private _performDocumentWrite (doc: Document, args, ln?: boolean) {
        const shouldEmitEvents = DocumentSandbox._shouldEmitDocumentCleanedEvents(this.document);

        if (shouldEmitEvents)
            this._beforeDocumentCleaned();

        const result = this.writers.get(doc).write(args, ln, shouldEmitEvents);

        // NOTE: B234357
        if (!shouldEmitEvents)
            this._nodeSandbox.processNodes(null, this.document);

        return result;
    }

    private static _definePropertyDescriptor (owner, childOfOwner, prop, overriddenDescriptor) {
        // NOTE: The 'URL', 'domain' and 'referrer' properties are non configurable in IE and Edge
        if (!overriddenDescriptor.configurable) {
            // NOTE: property doesn't redefined yet
            if (!childOfOwner.hasOwnProperty(prop)) // eslint-disable-line no-prototype-builtins
                nativeMethods.objectDefineProperty(childOfOwner, prop, overriddenDescriptor);
        }
        else
            nativeMethods.objectDefineProperty(owner, prop, overriddenDescriptor);
    }

    iframeDocumentOpen (window, document, args) {
        const iframe = window.frameElement;
        const result = nativeMethods.documentOpen.apply(document, args);

        nativeMethods.objectDefineProperty(window, INTERNAL_PROPS.documentWasCleaned, { value: true, configurable: true });
        this._nodeSandbox.iframeSandbox.onIframeBeganToRun(iframe);

        return result;
    }

    attach (window, document, partialInitializationForNotLoadedIframe = false) {
        if (!this.writers.size)
            super.attach(window, document);

        if (!this.writers.has(document)) {
            this.writers.set(document, new DocumentWriter(window, document));

            this._nodeSandbox.mutation.on(this._nodeSandbox.mutation.BEFORE_DOCUMENT_CLEANED_EVENT, () => {
                this.writers.set(document, new DocumentWriter(window, document));
            });
        }

        const documentSandbox  = this;
        const docPrototype     = window.Document.prototype;
        const htmlDocPrototype = window.HTMLDocument.prototype;

        this.overrideCreateElement(docPrototype, documentSandbox);
        this.overrideCreateElementNS(docPrototype, documentSandbox);
        this.overrideCreateDocumentFragment(docPrototype, documentSandbox);

        this.overrideStyleSheets(docPrototype, documentSandbox);

        this.overrideActiveElement(docPrototype, documentSandbox);

        if (this._documentTitleStorageInitializer && !partialInitializationForNotLoadedIframe)
            this.overrideTitle(docPrototype, documentSandbox);

        if (this.proxyless)
            return;

        this.overrideOpen(window, document, documentSandbox);
        this.overrideClose(window, document, documentSandbox);
        this.overrideWrite(window, document, documentSandbox);
        this.overrideWriteln(window, document, documentSandbox);

        if (nativeMethods.documentDocumentURIGetter)
            this.overrideDocumentURI(docPrototype);

        this.overrideReferrer(docPrototype, htmlDocPrototype);
        this.overrideURL(docPrototype, htmlDocPrototype);
        this.overrideDomain(window, docPrototype, htmlDocPrototype);
        this.overrideCookie(window, documentSandbox);
    }

    private overrideOpen (window: Window, document: Document, documentSandbox: this) {
        function open (this: Document, ...args: [string?, string?, string?, boolean?]) {
            const isUninitializedIframe = documentSandbox._isUninitializedIframeWithoutSrc(window);

            if (!isUninitializedIframe)
                documentSandbox._beforeDocumentCleaned();

            if (isIE)
                return window.parent[INTERNAL_PROPS.hammerhead].sandbox.node.doc.iframeDocumentOpen(window, this, args);

            const result = nativeMethods.documentOpen.apply(this, args);

            // NOTE: Chrome does not remove the "%hammerhead%" property from window
            // after document.open call
            const objectDefinePropertyFn = window[INTERNAL_PROPS.hammerhead]
                ? window[INTERNAL_PROPS.hammerhead].nativeMethods.objectDefineProperty
                //@ts-ignore
                : window.Object.defineProperty;

            objectDefinePropertyFn(window, INTERNAL_PROPS.documentWasCleaned, { value: true, configurable: true });

            if (!isUninitializedIframe)
                documentSandbox._nodeSandbox.mutation.onDocumentCleaned(window, this);
            else {
                const iframe = getFrameElement(window);

                if (iframe)
                    documentSandbox._iframeSandbox.processIframe(iframe);
            }

            return result;
        }

        overrideFunction(window[nativeMethods.documentOpenPropOwnerName].prototype, 'open', open);
        overrideFunction(document, 'open', open);
    }

    private overrideClose (window: Window, document: Document, documentSandbox: this) {
        function close (this: Document, ...args: []) {
            // NOTE: IE11 raise the "load" event only when the document.close method is called. We need to
            // restore the overridden document.open and document.write methods before Hammerhead injection, if the
            // window is not initialized.
            if (isIE && !IframeSandbox.isWindowInited(window))
                nativeMethods.restoreDocumentMeths(window, this);

            // NOTE: IE doesn't run scripts in iframe if iframe.documentContent.designMode equals 'on' (GH-871)
            if (DocumentSandbox._isDocumentInDesignMode(this))
                ShadowUI.removeSelfRemovingScripts(this);

            const result = nativeMethods.documentClose.apply(this, args);

            if (!documentSandbox._isUninitializedIframeWithoutSrc(window))
                documentSandbox._onDocumentClosed();

            const iframe = getFrameElement(window);

            // NOTE: Firefox misses the Hammerhead instance after the iframe.contentDocument.close function calling (GH-1821)
            if (iframe)
                documentSandbox._nodeSandbox.iframeSandbox.onIframeBeganToRun(iframe as HTMLIFrameElement);

            return result;
        }

        overrideFunction(window[nativeMethods.documentClosePropOwnerName].prototype, 'close', close);
        overrideFunction(document, 'close', close);
    }

    private overrideWrite (window: Window, document: Document, documentSandbox: this) {
        function write () {
            return documentSandbox._performDocumentWrite(this, arguments);
        }

        overrideFunction(window[nativeMethods.documentWritePropOwnerName].prototype, 'write', write);
        overrideFunction(document, 'write', write);
    }

    private overrideWriteln (window: Window, document: Document, documentSandbox: this) {
        function writeln () {
            return documentSandbox._performDocumentWrite(this, arguments, true);
        }

        overrideFunction(window[nativeMethods.documentWriteLnPropOwnerName].prototype, 'writeln', writeln);
        overrideFunction(document, 'writeln', writeln);
    }

    private overrideCreateElement (docPrototype: Document, documentSandbox: this) {
        overrideFunction(docPrototype, 'createElement', function (this: Document, ...args: [string, ElementCreationOptions?]) {
            const el = nativeMethods.createElement.apply(this, args);

            DocumentSandbox.forceProxySrcForImageIfNecessary(el);
            domProcessor.processElement(el, convertToProxyUrl);
            documentSandbox._nodeSandbox.processNodes(el);

            return el;
        });
    }

    private overrideCreateElementNS (docPrototype: Document, documentSandbox: this) {
        overrideFunction(docPrototype, 'createElementNS', function (this: Document, ...args: [string, string, (string | ElementCreationOptions)?]) {
            const el = nativeMethods.createElementNS.apply(this, args);

            DocumentSandbox.forceProxySrcForImageIfNecessary(el);
            domProcessor.processElement(el, convertToProxyUrl);
            documentSandbox._nodeSandbox.processNodes(el);

            return el;
        });
    }

    private overrideCreateDocumentFragment (docPrototype: Document, documentSandbox: this) {
        overrideFunction(docPrototype, 'createDocumentFragment', function (this: Document, ...args: []) {
            const fragment = nativeMethods.createDocumentFragment.apply(this, args);

            documentSandbox._nodeSandbox.processNodes(fragment);

            return fragment;
        });
    }

    private overrideDocumentURI (docPrototype: Document) {
        overrideDescriptor(docPrototype, 'documentURI', {
            getter: function () {
                return getDestinationUrl(nativeMethods.documentDocumentURIGetter.call(this));
            },
        });
    }

    private overrideReferrer (docPrototype: Document, htmlDocPrototype: Document) {
        const referrerOverriddenDescriptor = createOverriddenDescriptor(docPrototype, 'referrer', {
            getter: function () {
                const referrer = getDestinationUrl(nativeMethods.documentReferrerGetter.call(this));

                if (referrer === getCrossDomainProxyOrigin() + '/')
                    return getReferrer();

                return isSpecialPage(referrer) ? '' : referrer;
            },
        });

        DocumentSandbox._definePropertyDescriptor(docPrototype, htmlDocPrototype, 'referrer', referrerOverriddenDescriptor);
    }

    private overrideURL (docPrototype: Document, htmlDocPrototype: Document) {
        const urlOverriddenDescriptor = createOverriddenDescriptor(docPrototype, 'URL', {
            getter: function () {
                // eslint-disable-next-line no-restricted-properties
                return LocationAccessorsInstrumentation.getLocationWrapper(this).href;
            },
        });

        DocumentSandbox._definePropertyDescriptor(docPrototype, htmlDocPrototype, 'URL', urlOverriddenDescriptor);
    }

    private overrideDomain (window: Window, docPrototype: Document, htmlDocPrototype: Document) {
        let storedDomain          = '';
        const domainPropertyOwner = nativeMethods.objectHasOwnProperty.call(docPrototype, 'domain')
            ? docPrototype
            : htmlDocPrototype;

        const domainOverriddenDescriptor = createOverriddenDescriptor(domainPropertyOwner, 'domain', {
            getter: () => {
                // eslint-disable-next-line no-restricted-properties
                return storedDomain || LocationAccessorsInstrumentation.getLocationWrapper(window).hostname;
            },
            setter: value => {
                storedDomain = value;
            },
        });

        DocumentSandbox._definePropertyDescriptor(domainPropertyOwner, htmlDocPrototype, 'domain', domainOverriddenDescriptor);
    }

    private overrideStyleSheets (docPrototype: Document, documentSandbox: this) {
        overrideDescriptor(docPrototype, 'styleSheets', {
            getter: function () {
                const styleSheets = nativeMethods.documentStyleSheetsGetter.call(this);

                return documentSandbox._shadowUI._filterStyleSheetList(styleSheets, styleSheets.length);
            },
        });
    }

    private overrideCookie (window: Window, documentSandbox: this) {
        const documentCookiePropOwnerPrototype = window[nativeMethods.documentCookiePropOwnerName].prototype;

        overrideDescriptor(documentCookiePropOwnerPrototype, 'cookie', {
            getter: () => documentSandbox._cookieSandbox.getCookie(),
            setter: value => documentSandbox._cookieSandbox.setCookie(String(value)),
        });
    }

    private overrideActiveElement (docPrototype: Document, documentSandbox: this) {
        overrideDescriptor(docPrototype, 'activeElement', {
            getter: function (this: Document) {
                const activeElement = nativeMethods.documentActiveElementGetter.call(this);

                if (activeElement && isShadowUIElement(activeElement))
                    return documentSandbox._shadowUI.getLastActiveElement() || this.body;

                return activeElement;
            },
        });
    }

    private overrideTitle (docPrototype: Document, documentSandbox: this) {
        overrideDescriptor(docPrototype, 'title', {
            getter: function () {
                return documentSandbox._documentTitleStorageInitializer.storage.getTitle();
            },
            setter: function (value) {
                documentSandbox._documentTitleStorageInitializer.storage.setTitle(value);
            },
        });
    }
}
