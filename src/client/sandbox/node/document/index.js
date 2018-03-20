import SandboxBase from '../../base';
import IframeSandbox from '../../iframe';
import nativeMethods from '../../native-methods';
import domProcessor from '../../../dom-processor';
import * as urlUtils from '../../../utils/url';
import { isIE, isFirefox } from '../../../utils/browser';
import { isIframeWithoutSrc, getFrameElement, isShadowUIElement } from '../../../utils/dom';
import DocumentWriter from './writer';
import ShadowUI from './../../shadow-ui';
import INTERNAL_PROPS from '../../../../processing/dom/internal-properties';
import LocationAccessorsInstrumentation from '../../code-instrumentation/location';
import { overrideDescriptor, createOverriddenDescriptor } from '../../../utils/property-overriding';

export default class DocumentSandbox extends SandboxBase {
    constructor (nodeSandbox, shadowUI, cookieSandbox) {
        super();

        this.nodeSandbox    = nodeSandbox;
        this.documentWriter = null;
        this.shadowUI       = shadowUI;
        this.cookieSandbox  = cookieSandbox;
    }

    _isUninitializedIframeWithoutSrc (win) {
        const frameElement = getFrameElement(win);

        return win !== win.top && frameElement && isIframeWithoutSrc(frameElement) &&
               !IframeSandbox.isIframeInitialized(frameElement);
    }

    _beforeDocumentCleaned () {
        this.nodeSandbox.mutation.onBeforeDocumentCleaned({ document: this.document });
    }

    _onDocumentClosed () {
        this.nodeSandbox.mutation.onDocumentClosed({ document: this.document });
    }

    static _shouldEmitDocumentCleanedEvents (doc) {
        return doc.readyState !== 'loading' && doc.readyState !== 'uninitialized';
    }

    _overridedDocumentWrite (args, ln) {
        const shouldEmitEvents = DocumentSandbox._shouldEmitDocumentCleanedEvents(this.document);

        if (shouldEmitEvents)
            this._beforeDocumentCleaned();

        const result = this.documentWriter.write(args, ln, shouldEmitEvents);

        // NOTE: B234357
        if (!shouldEmitEvents)
            this.nodeSandbox.processNodes(null, this.document);

        return result;
    }

    _needToUpdateDocumentWriter (window, document) {
        try {
            return !this.documentWriter || this.window !== window || this.document !== document;
        }
        catch (e) {
            return true;
        }
    }

    static _definePropertyDescriptor (owner, childOfOwner, prop, overriddenDescriptor) {
        // NOTE: The 'URL', 'domain' and 'referrer' properties are non configurable in IE and Edge
        if (!overriddenDescriptor.configurable) {
            // NOTE: property doesn't redefined yet
            if (!childOfOwner.hasOwnProperty(prop))
                nativeMethods.objectDefineProperty.call(window.Object, childOfOwner, prop, overriddenDescriptor);
        }
        else
            nativeMethods.objectDefineProperty.call(window.Object, owner, prop, overriddenDescriptor);
    }

    attach (window, document) {
        if (this._needToUpdateDocumentWriter(window, document)) {
            this.documentWriter = new DocumentWriter(window, document);

            this.nodeSandbox.mutation.on(this.nodeSandbox.mutation.BEFORE_DOCUMENT_CLEANED_EVENT, () => {
                this.documentWriter = new DocumentWriter(window, document);
            });
        }

        super.attach(window, document);

        const documentSandbox = this;

        document.open = (...args) => {
            const isUninitializedIframe = this._isUninitializedIframeWithoutSrc(window);

            if (!isUninitializedIframe)
                this._beforeDocumentCleaned();

            const result = nativeMethods.documentOpen.apply(document, args);

            // NOTE: Chrome does not remove the "%hammerhead%" property from window
            // after document.open call
            const objectDefinePropertyFn = window[INTERNAL_PROPS.hammerhead]
                ? window[INTERNAL_PROPS.hammerhead].nativeMethods.objectDefineProperty
                : window.Object.defineProperty;

            objectDefinePropertyFn
                .call(window.Object, window, INTERNAL_PROPS.documentWasCleaned, { value: true, configurable: true });

            if (!isUninitializedIframe)
                this.nodeSandbox.mutation.onDocumentCleaned({ window, document });
            else
            // NOTE: If iframe initialization is in progress, we need to override the document.write and document.open
            // methods once again, because they were cleaned after the native document.open method call.
                this.attach(window, document);

            return result;
        };

        document.close = (...args) => {
            // NOTE: IE10 and IE9 raise the "load" event only when the document.close method is called. We need to
            // restore the overrided document.open and document.write methods before Hammerhead injection, if the
            // window is not initialized.
            if (isIE && !IframeSandbox.isWindowInited(window))
                nativeMethods.restoreDocumentMeths(document);

            // NOTE: IE doesn't run scripts in iframe if iframe.documentContent.designMode equals 'on' (GH-871)
            if (typeof document.designMode === 'string' && document.designMode.toLowerCase() === 'on')
                ShadowUI.removeSelfRemovingScripts(document);

            const result = nativeMethods.documentClose.apply(document, args);

            if (!this._isUninitializedIframeWithoutSrc(window))
                this._onDocumentClosed();

            return result;
        };

        document.createElement = (...args) => {
            const el = nativeMethods.createElement.apply(document, args);

            domProcessor.processElement(el, urlUtils.convertToProxyUrl);
            this.nodeSandbox.processNodes(el);

            return el;
        };

        document.createElementNS = (...args) => {
            const el = nativeMethods.createElementNS.apply(document, args);

            domProcessor.processElement(el, urlUtils.convertToProxyUrl);
            this.nodeSandbox.processNodes(el);

            return el;
        };

        document.write = function () {
            return documentSandbox._overridedDocumentWrite(arguments);
        };

        document.writeln = function () {
            return documentSandbox._overridedDocumentWrite(arguments, true);
        };

        document.createDocumentFragment = (...args) => {
            const fragment = nativeMethods.createDocumentFragment.apply(document, args);

            documentSandbox.nodeSandbox.processNodes(fragment);

            return fragment;
        };

        const docPrototype     = window.Document.prototype;
        const htmlDocPrototype = window.HTMLDocument.prototype;
        let storedDomain       = '';

        if (nativeMethods.documentDocumentURIGetter) {
            overrideDescriptor(docPrototype, 'documentURI', {
                getter: function () {
                    const documentURI    = nativeMethods.documentDocumentURIGetter.call(this);
                    const parsedProxyUrl = urlUtils.parseProxyUrl(documentURI);

                    return parsedProxyUrl ? parsedProxyUrl.destUrl : documentURI;
                }
            });
        }

        const referrerOverriddenDescriptor = createOverriddenDescriptor(docPrototype, 'referrer', {
            getter: function () {
                const referrer       = nativeMethods.documentReferrerGetter.call(this);
                const parsedProxyUrl = urlUtils.parseProxyUrl(referrer);

                return parsedProxyUrl ? parsedProxyUrl.destUrl : '';
            }
        });

        DocumentSandbox._definePropertyDescriptor(docPrototype, htmlDocPrototype, 'referrer', referrerOverriddenDescriptor);

        const urlOverriddenDescriptor = createOverriddenDescriptor(docPrototype, 'URL', {
            getter: function () {
                /*eslint-disable no-restricted-properties*/
                return LocationAccessorsInstrumentation.getLocationWrapper(this).href;
                /*eslint-enable no-restricted-properties*/
            }
        });

        DocumentSandbox._definePropertyDescriptor(docPrototype, htmlDocPrototype, 'URL', urlOverriddenDescriptor);

        const domainPropertyOwner        = isFirefox ? htmlDocPrototype : docPrototype;
        const domainOverriddenDescriptor = createOverriddenDescriptor(domainPropertyOwner, 'domain', {
            getter: () => {
                /*eslint-disable no-restricted-properties*/
                return storedDomain || LocationAccessorsInstrumentation.getLocationWrapper(window).hostname;
                /*eslint-enable no-restricted-properties*/
            },
            setter: value => {
                storedDomain = value;
            }
        });

        DocumentSandbox._definePropertyDescriptor(domainPropertyOwner, htmlDocPrototype, 'domain', domainOverriddenDescriptor);

        overrideDescriptor(docPrototype, 'styleSheets', {
            getter: function () {
                const styleSheets = nativeMethods.documentStyleSheetsGetter.call(this);

                return documentSandbox.shadowUI._filterStyleSheetList(styleSheets);
            }
        });

        const documentCookiePropOwnerPrototype = window[nativeMethods.documentCookiePropOwnerName].prototype;

        overrideDescriptor(documentCookiePropOwnerPrototype, 'cookie', {
            getter: () => documentSandbox.cookieSandbox.getCookie(),
            setter: function (value) {
                documentSandbox.cookieSandbox.setCookie(this, String(value), true);
            }
        });

        overrideDescriptor(docPrototype, 'activeElement', {
            getter: function () {
                const activeElement = nativeMethods.documentActiveElementGetter.call(this);

                if (activeElement && isShadowUIElement(activeElement))
                    return documentSandbox.shadowUI.getLastActiveElement() || this.body;

                return activeElement;
            }
        });

        const documentScriptsPropOwnerPrototype = window[nativeMethods.documentScriptsPropOwnerName].prototype;

        overrideDescriptor(documentScriptsPropOwnerPrototype, 'scripts', {
            getter: function () {
                const scripts = nativeMethods.documentScriptsGetter.call(this);

                return documentSandbox.shadowUI._filterNodeList(scripts);
            }
        });
    }
}
