import SandboxBase from '../../base';
import IframeSandbox from '../../iframe';
import nativeMethods from '../../native-methods';
import domProcessor from '../../../dom-processor';
import settings from '../../../settings';

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
        if (settings.nativeAutomation)
            return;

        if (isImgElement(element) && settings.get().forceProxySrcForImage)
            element[INTERNAL_PROPS.forceProxySrcForImage] = true;
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

    attach (window, document, partialInitializationForNotLoadedIframe = false) {
        if (!this.writers.size)
            super.attach(window, document);

        if (!this.writers.has(document)) {
            this.writers.set(document, new DocumentWriter(window, document));

            this._nodeSandbox.mutation.on(this._nodeSandbox.mutation.BEFORE_DOCUMENT_CLEANED_EVENT, () => {
                this.writers.set(document, new DocumentWriter(window, document));
            });
        }

        this.overrideStyleSheets(window);
        this.overrideActiveElement(window);

        if (settings.nativeAutomation)
            return;

        if (this._documentTitleStorageInitializer && !partialInitializationForNotLoadedIframe)
            this.overrideTitle(window);

        this.overrideOpen(window, document);
        this.overrideClose(window, document);
        this.overrideWrite(window, document);
        this.overrideWriteln(window, document);
        this.overrideCreateElement(window);
        this.overrideCreateElementNS(window);
        this.overrideCreateDocumentFragment(window);

        if (nativeMethods.documentDocumentURIGetter)
            this.overrideDocumentURI(window);

        this.overrideReferrer(window);
        this.overrideURL(window);
        this.overrideDomain(window);
        this.overrideCookie(window);
    }

    private overrideOpen (window, document) {
        const documentSandbox = this;

        function open (this: Document, ...args: [string?, string?, string?, boolean?]) {
            const isUninitializedIframe = documentSandbox._isUninitializedIframeWithoutSrc(window);

            if (!isUninitializedIframe)
                documentSandbox._beforeDocumentCleaned();

            const result = nativeMethods.documentOpen.apply(this, args);

            // NOTE: Chrome does not remove the "%hammerhead%" property from window
            // after document.open call
            const objectDefinePropertyFn = window[INTERNAL_PROPS.hammerhead]
                ? window[INTERNAL_PROPS.hammerhead].nativeMethods.objectDefineProperty
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

    private overrideClose (window, document) {
        const documentSandbox = this;

        function close (this: Document, ...args: []) {
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

    private overrideWrite (window, document) {
        const documentSandbox = this;

        function write () {
            return documentSandbox._performDocumentWrite(this, arguments);
        }

        overrideFunction(window[nativeMethods.documentWritePropOwnerName].prototype, 'write', write);
        overrideFunction(document, 'write', write);
    }

    private overrideWriteln (window, document) {
        const documentSandbox = this;

        function writeln () {
            return documentSandbox._performDocumentWrite(this, arguments, true);
        }

        overrideFunction(window[nativeMethods.documentWriteLnPropOwnerName].prototype, 'writeln', writeln);
        overrideFunction(document, 'writeln', writeln);
    }

    private overrideCreateElement (window) {
        const documentSandbox = this;

        overrideFunction(window.Document.prototype, 'createElement', function (this: Document, ...args: [string, ElementCreationOptions?]) {
            const el = nativeMethods.createElement.apply(this, args);

            DocumentSandbox.forceProxySrcForImageIfNecessary(el);
            domProcessor.processElement(el, convertToProxyUrl);
            documentSandbox._nodeSandbox.processNodes(el);

            return el;
        });
    }

    private overrideCreateElementNS (window) {
        const documentSandbox = this;

        overrideFunction(window.Document.prototype, 'createElementNS', function (this: Document, ...args: [string, string, (string | ElementCreationOptions)?]) {
            const el = nativeMethods.createElementNS.apply(this, args);

            DocumentSandbox.forceProxySrcForImageIfNecessary(el);
            domProcessor.processElement(el, convertToProxyUrl);
            documentSandbox._nodeSandbox.processNodes(el);

            return el;
        });
    }

    private overrideCreateDocumentFragment (window) {
        const documentSandbox = this;

        overrideFunction(window.Document.prototype, 'createDocumentFragment', function (this: Document, ...args: []) {
            const fragment = nativeMethods.createDocumentFragment.apply(this, args);

            documentSandbox._nodeSandbox.processNodes(fragment);

            return fragment;
        });
    }

    private overrideDocumentURI (window) {
        overrideDescriptor(window.Document.prototype, 'documentURI', {
            getter: function () {
                return getDestinationUrl(nativeMethods.documentDocumentURIGetter.call(this));
            },
        });
    }

    private overrideReferrer (window) {
        const referrerOverriddenDescriptor = createOverriddenDescriptor(window.Document.prototype, 'referrer', {
            getter: function () {
                const referrer = getDestinationUrl(nativeMethods.documentReferrerGetter.call(this));

                if (referrer === getCrossDomainProxyOrigin() + '/')
                    return getReferrer();

                return isSpecialPage(referrer) ? '' : referrer;
            },
        });

        nativeMethods.objectDefineProperty(window.Document.prototype, 'referrer', referrerOverriddenDescriptor);
    }

    private overrideURL (window) {
        const urlOverriddenDescriptor = createOverriddenDescriptor(window.Document.prototype, 'URL', {
            getter: function () {
                // eslint-disable-next-line no-restricted-properties
                return LocationAccessorsInstrumentation.getLocationWrapper(this).href;
            },
        });

        nativeMethods.objectDefineProperty(window.Document.prototype, 'URL', urlOverriddenDescriptor);
    }

    private overrideDomain (window) {
        const docPrototype     = window.Document.prototype;
        const htmlDocPrototype = window.HTMLDocument.prototype;

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

        nativeMethods.objectDefineProperty(domainPropertyOwner, 'domain', domainOverriddenDescriptor);
    }

    private overrideStyleSheets (window) {
        const documentSandbox = this;

        overrideDescriptor(window.Document.prototype, 'styleSheets', {
            getter: function () {
                const styleSheets = nativeMethods.documentStyleSheetsGetter.call(this);

                return documentSandbox._shadowUI._filterStyleSheetList(styleSheets, styleSheets.length);
            },
        });
    }

    private overrideCookie (window) {
        const documentSandbox                  = this;
        const documentCookiePropOwnerPrototype = window[nativeMethods.documentCookiePropOwnerName].prototype;

        overrideDescriptor(documentCookiePropOwnerPrototype, 'cookie', {
            getter: () => documentSandbox._cookieSandbox.getCookie(),
            setter: value => documentSandbox._cookieSandbox.setCookie(String(value)),
        });
    }

    private overrideActiveElement (window) {
        const documentSandbox = this;

        overrideDescriptor(window.Document.prototype, 'activeElement', {
            getter: function (this: Document) {
                const activeElement = nativeMethods.documentActiveElementGetter.call(this);

                if (activeElement && isShadowUIElement(activeElement))
                    return documentSandbox._shadowUI.getLastActiveElement() || this.body;

                return activeElement;
            },
        });
    }

    private overrideTitle (window) {
        const documentSandbox = this;

        overrideDescriptor(window.Document.prototype, 'title', {
            getter: function () {
                return documentSandbox._documentTitleStorageInitializer.storage.getTitle();
            },
            setter: function (value) {
                documentSandbox._documentTitleStorageInitializer.storage.setTitle(value);
            },
        });
    }
}
