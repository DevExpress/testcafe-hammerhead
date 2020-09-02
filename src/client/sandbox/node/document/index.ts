import SandboxBase from '../../base';
import IframeSandbox from '../../iframe';
import nativeMethods from '../../native-methods';
import domProcessor from '../../../dom-processor';
import * as urlUtils from '../../../utils/url';
import settings from '../../../settings';
import { isIE } from '../../../utils/browser';
import { isIframeWithoutSrc, getFrameElement, isImgElement, isShadowUIElement } from '../../../utils/dom';
import DocumentWriter from './writer';
import ShadowUI from './../../shadow-ui';
import INTERNAL_PROPS from '../../../../processing/dom/internal-properties';
import LocationAccessorsInstrumentation from '../../code-instrumentation/location';
import { overrideDescriptor, createOverriddenDescriptor } from '../../../utils/property-overriding';
import NodeSandbox from '../index';
import DocumentTitleStorage from './title-storage';
import { getDestinationUrl } from '../../../utils/url';

export default class DocumentSandbox extends SandboxBase {
    documentWriter: DocumentWriter;

    constructor (private readonly _nodeSandbox: NodeSandbox,
        private readonly _shadowUI: ShadowUI,
        private readonly _cookieSandbox,
        private readonly _documentTitleStorage: DocumentTitleStorage) {

        super();

        this.documentWriter = null;
    }

    static forceProxySrcForImageIfNecessary (element) {
        if (isImgElement(element) && settings.get().forceProxySrcForImage)
            element[INTERNAL_PROPS.forceProxySrcForImage] = true;
    }

    private static _isDocumentInDesignMode (doc) {
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

    private _performDocumentWrite (args, ln?: boolean) {
        const shouldEmitEvents = DocumentSandbox._shouldEmitDocumentCleanedEvents(this.document);

        if (shouldEmitEvents)
            this._beforeDocumentCleaned();

        const result = this.documentWriter.write(args, ln, shouldEmitEvents);

        // NOTE: B234357
        if (!shouldEmitEvents)
            this._nodeSandbox.processNodes(null, this.document);

        return result;
    }

    private _needToUpdateDocumentWriter (window, document): boolean {
        try {
            return !this.documentWriter || this.window !== window || this.document !== document;
        }
        catch (e) {
            return true;
        }
    }

    private static _definePropertyDescriptor (owner, childOfOwner, prop, overriddenDescriptor) {
        // NOTE: The 'URL', 'domain' and 'referrer' properties are non configurable in IE and Edge
        if (!overriddenDescriptor.configurable) {
            // NOTE: property doesn't redefined yet
            if (!childOfOwner.hasOwnProperty(prop))
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

    private static _ensureDocumentMethodOverride (document, overridenMethods, methodName) {
        if (document[methodName] !== overridenMethods[methodName])
            document[methodName] = overridenMethods[methodName];
    }

    attach (window, document) {
        if (this._needToUpdateDocumentWriter(window, document)) {
            this.documentWriter = new DocumentWriter(window, document);

            this._nodeSandbox.mutation.on(this._nodeSandbox.mutation.BEFORE_DOCUMENT_CLEANED_EVENT, () => {
                this.documentWriter = new DocumentWriter(window, document);
            });
        }

        super.attach(window, document);

        const documentSandbox = this;
        const docPrototype    = window.Document.prototype;

        const overridenMethods = {
            open: function (...args) {
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
                    : window.Object.defineProperty;

                objectDefinePropertyFn(window, INTERNAL_PROPS.documentWasCleaned, { value: true, configurable: true });

                if (!isUninitializedIframe)
                    documentSandbox._nodeSandbox.mutation.onDocumentCleaned(window, this);
                else
                // NOTE: If iframe initialization is in progress, we need to override the document.write and document.open
                // methods once again, because they were cleaned after the native document.open method call.
                    documentSandbox.attach(window, this);

                return result;
            },

            close: function (...args) {
                // NOTE: IE11 raise the "load" event only when the document.close method is called. We need to
                // restore the overriden document.open and document.write methods before Hammerhead injection, if the
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
            },

            write: function () {
                return documentSandbox._performDocumentWrite(arguments);
            },

            writeln: function () {
                return documentSandbox._performDocumentWrite(arguments, true);
            }
        };

        window[nativeMethods.documentOpenPropOwnerName].prototype.open       = overridenMethods.open;
        window[nativeMethods.documentClosePropOwnerName].prototype.close     = overridenMethods.close;
        window[nativeMethods.documentWritePropOwnerName].prototype.write     = overridenMethods.write;
        window[nativeMethods.documentWriteLnPropOwnerName].prototype.writeln = overridenMethods.writeln;

        DocumentSandbox._ensureDocumentMethodOverride(document, overridenMethods, 'open');
        DocumentSandbox._ensureDocumentMethodOverride(document, overridenMethods, 'close');
        DocumentSandbox._ensureDocumentMethodOverride(document, overridenMethods, 'write');
        DocumentSandbox._ensureDocumentMethodOverride(document, overridenMethods, 'writeln');

        if (document.open !== overridenMethods.open)
            document.open = overridenMethods.open;

        docPrototype.createElement = function (...args) {
            const el = nativeMethods.createElement.apply(this, args);

            DocumentSandbox.forceProxySrcForImageIfNecessary(el);
            domProcessor.processElement(el, urlUtils.convertToProxyUrl);
            documentSandbox._nodeSandbox.processNodes(el);

            return el;
        };

        docPrototype.createElementNS = function (...args) {
            const el = nativeMethods.createElementNS.apply(this, args);

            DocumentSandbox.forceProxySrcForImageIfNecessary(el);
            domProcessor.processElement(el, urlUtils.convertToProxyUrl);
            documentSandbox._nodeSandbox.processNodes(el);

            return el;
        };

        docPrototype.createDocumentFragment = function (...args) {
            const fragment = nativeMethods.createDocumentFragment.apply(this, args);

            documentSandbox._nodeSandbox.processNodes(fragment);

            return fragment;
        };

        const htmlDocPrototype = window.HTMLDocument.prototype;
        let storedDomain       = '';

        if (nativeMethods.documentDocumentURIGetter) {
            overrideDescriptor(docPrototype, 'documentURI', {
                getter: function () {
                    return getDestinationUrl(nativeMethods.documentDocumentURIGetter.call(this));
                }
            });
        }

        const referrerOverriddenDescriptor = createOverriddenDescriptor(docPrototype, 'referrer', {
            getter: function () {
                return getDestinationUrl(nativeMethods.documentReferrerGetter.call(this));
            }
        });

        DocumentSandbox._definePropertyDescriptor(docPrototype, htmlDocPrototype, 'referrer', referrerOverriddenDescriptor);

        const urlOverriddenDescriptor = createOverriddenDescriptor(docPrototype, 'URL', {
            getter: function () {
                // eslint-disable-next-line no-restricted-properties
                return LocationAccessorsInstrumentation.getLocationWrapper(this).href;
            }
        });

        DocumentSandbox._definePropertyDescriptor(docPrototype, htmlDocPrototype, 'URL', urlOverriddenDescriptor);

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
            }
        });

        DocumentSandbox._definePropertyDescriptor(domainPropertyOwner, htmlDocPrototype, 'domain', domainOverriddenDescriptor);

        overrideDescriptor(docPrototype, 'styleSheets', {
            getter: function () {
                const styleSheets = nativeMethods.documentStyleSheetsGetter.call(this);

                return documentSandbox._shadowUI._filterStyleSheetList(styleSheets, styleSheets.length);
            }
        });

        const documentCookiePropOwnerPrototype = window[nativeMethods.documentCookiePropOwnerName].prototype;

        overrideDescriptor(documentCookiePropOwnerPrototype, 'cookie', {
            getter: () => documentSandbox._cookieSandbox.getCookie(),
            setter: value => documentSandbox._cookieSandbox.setCookie(String(value))
        });

        overrideDescriptor(docPrototype, 'activeElement', {
            getter: function () {
                const activeElement = nativeMethods.documentActiveElementGetter.call(this);

                if (activeElement && isShadowUIElement(activeElement))
                    return documentSandbox._shadowUI.getLastActiveElement() || this.body;

                return activeElement;
            }
        });

        const documentScriptsPropOwnerPrototype = window[nativeMethods.documentScriptsPropOwnerName].prototype;

        overrideDescriptor(documentScriptsPropOwnerPrototype, 'scripts', {
            getter: function () {
                const scripts = nativeMethods.documentScriptsGetter.call(this);
                const length  = nativeMethods.htmlCollectionLengthGetter.call(scripts);

                return documentSandbox._shadowUI._filterNodeList(scripts, length);
            }
        });

        overrideDescriptor(docPrototype, 'title', {
            getter: function () {
                return documentSandbox._documentTitleStorage.getTitle();
            } ,
            setter: function (value) {
                documentSandbox._documentTitleStorage.setTitle(value);
            }
        });
    }
}
