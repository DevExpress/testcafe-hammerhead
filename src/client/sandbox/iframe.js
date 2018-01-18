import INTERNAL_PROPS from '../../processing/dom/internal-properties';
import SandboxBase from './base';
import settings from '../settings';
import nativeMethods from '../sandbox/native-methods';
import { isJsProtocol } from '../../processing/dom';
import { isShadowUIElement, isCrossDomainIframe, isElementInDocument, isIframeWithoutSrc } from '../utils/dom';
import { isFirefox, isWebKit } from '../utils/browser';
import { isSupportedProtocol } from '../utils/url';
import * as JSON from '../json';

const IFRAME_WINDOW_INITED = 'hammerhead|iframe-window-inited';

export default class IframeSandbox extends SandboxBase {
    constructor (nodeMutation, cookieSandbox) {
        super();

        this.RUN_TASK_SCRIPT_EVENT         = 'hammerhead|event|run-task-script';
        this.EVAL_HAMMERHEAD_SCRIPT_EVENT  = 'hammerhead|event|eval-hammerhead-script';
        this.EVAL_EXTERNAL_SCRIPT_EVENT    = 'hammerhead|event|eval-external-script';
        this.IFRAME_DOCUMENT_CREATED_EVENT = 'hammerhead|event|iframe-document-created';

        this.cookieSandbox = cookieSandbox;

        this.on(this.RUN_TASK_SCRIPT_EVENT, this.iframeReadyToInitHandler);
        nodeMutation.on(nodeMutation.IFRAME_ADDED_TO_DOM_EVENT, e => this.processIframe(e.iframe));

        this.iframeNativeMethodsBackup = null;
    }

    _shouldSaveIframeNativeMethods (iframe) {
        if (!isWebKit)
            return false;

        const iframeSrc = this.nativeMethods.getAttribute.call(iframe, 'src');

        return isJsProtocol(iframeSrc);
    }

    _ensureIframeNativeMethodsForChrome (iframe) {
        if (!this.iframeNativeMethodsBackup && this._shouldSaveIframeNativeMethods(iframe))
            this.iframeNativeMethodsBackup = new this.nativeMethods.constructor(iframe.contentDocument, iframe.contentWindow);
        else if (this.iframeNativeMethodsBackup) {
            this.iframeNativeMethodsBackup.restoreDocumentMeths(iframe.contentDocument, iframe.contentWindow);
            this.iframeNativeMethodsBackup = null;
        }
    }

    _ensureIframeNativeMethodsForIE (iframe) {
        const iframeNativeMethods = iframe.contentWindow[INTERNAL_PROPS.iframeNativeMethods];

        if (iframeNativeMethods) {
            iframeNativeMethods.restoreDocumentMeths(iframe.contentDocument, iframe.contentWindow);
            delete iframe.contentWindow[INTERNAL_PROPS.iframeNativeMethods];
        }
    }

    tryToInitAsIframeWithoutSrc ({ iframe, force }) {
        if (force || isIframeWithoutSrc(iframe)) {
            const iframeInitialized       = IframeSandbox.isIframeInitialized(iframe);
            const iframeWindowInitialized = iframe.contentWindow[IFRAME_WINDOW_INITED];

            if (iframeInitialized && !iframeWindowInitialized) {
                // NOTE: In Chrome, iframe with javascript protocol src raises the load event twice.
                // As a result, when the second load event is raised, we write the overridden methods to the native methods.
                // So, we need to save the native methods when the first load event is raised.
                // https://code.google.com/p/chromium/issues/detail?id=578812
                this._ensureIframeNativeMethodsForChrome(iframe);

                // NOTE: Restore native document methods for the iframe's document if it overrided earlier (IE9, IE10 only)
                // https://github.com/DevExpress/testcafe-hammerhead/issues/279
                this._ensureIframeNativeMethodsForIE(iframe);

                // NOTE: Ok, the iframe is fully loaded now, but Hammerhead is not injected.
                nativeMethods.objectDefineProperty.call(this.window.Object, iframe.contentWindow, IFRAME_WINDOW_INITED, { value: true });

                // NOTE: Raise this internal event to eval the Hammerhead code script.
                this.emit(this.EVAL_HAMMERHEAD_SCRIPT_EVENT, { iframe });

                // NOTE: Raise this event to eval external code script.
                this.emit(this.EVAL_EXTERNAL_SCRIPT_EVENT, { iframe });

                // NOTE: Raise this event to eval the "task" script and to call the Hammerhead initialization method
                // and external script initialization code.
                this.emit(this.RUN_TASK_SCRIPT_EVENT, { iframe });

                iframe.contentWindow[INTERNAL_PROPS.processDomMethodName]();
            }
            else if (!iframeInitialized) {
                // NOTE: Even if iframe is not loaded (iframe.contentDocument.documentElement does not exist), we
                // still need to override the document.write method without initializing Hammerhead. This method can
                // be called before iframe is fully loaded, we should override it now.
                if (iframe.contentDocument.write.toString() === this.nativeMethods.documentWrite.toString())
                    this.emit(this.IFRAME_DOCUMENT_CREATED_EVENT, { iframe });
            }
        }
    }

    static isIframeInitialized (iframe) {
        const isFFIframeUninitialized = isFirefox && iframe.contentWindow.document.readyState === 'uninitialized';

        return !isFFIframeUninitialized && !!iframe.contentDocument.documentElement;
    }

    static isWindowInited (window) {
        return window[IFRAME_WINDOW_INITED];
    }

    iframeReadyToInitHandler (e) {
        // NOTE: We are using String.replace in order to avoid adding Mustache scripts on the client side.
        // If it is needed elsewhere in a certain place, we should consider using Mustache.
        const taskScriptTemplate       = settings.get().iframeTaskScriptTemplate;
        const escapeStringPatterns     = str => str.replace(/\$/g, '$$$$');
        const cookie                   = JSON.stringify(this.cookieSandbox.getCookie());
        const referer                  = settings.get().referer || this.window.location.toString();
        const iframeTaskScriptTemplate = JSON.stringify(taskScriptTemplate);
        const taskScript               = taskScriptTemplate
            .replace('{{{cookie}}}', escapeStringPatterns(cookie))
            .replace('{{{referer}}}', escapeStringPatterns(referer))
            .replace('{{{iframeTaskScriptTemplate}}}', escapeStringPatterns(iframeTaskScriptTemplate));

        e.iframe.contentWindow.eval.call(e.iframe.contentWindow, taskScript);
    }

    processIframe (el) {
        if (isShadowUIElement(el))
            return;

        const src = this.nativeMethods.getAttribute.call(el, 'src');

        if (!src || !isSupportedProtocol(src)) {
            if (el.contentWindow) {
                this.tryToInitAsIframeWithoutSrc({ iframe: el });

                const readyHandler = () => {
                    if (el.contentWindow)
                        this.tryToInitAsIframeWithoutSrc({ iframe: el });
                };

                this.nativeMethods.addEventListener.call(el, 'load', readyHandler);

                if (isFirefox)
                    this.nativeMethods.documentAddEventListener.call(el.contentDocument, 'ready', readyHandler);
            }
            else {
                const handler = () => {
                    if (isCrossDomainIframe(el))
                        this.nativeMethods.removeEventListener.call(el, 'load', handler);
                    else
                        this.tryToInitAsIframeWithoutSrc({ iframe: el });
                };

                if (isElementInDocument(el))
                    this.tryToInitAsIframeWithoutSrc({ iframe: el });

                this.nativeMethods.addEventListener.call(el, 'load', handler);
            }
        }
        else {
            if (isElementInDocument(el))
                this.tryToInitAsIframeWithoutSrc({ iframe: el });

            this.nativeMethods.addEventListener.call(el, 'load', () => this.tryToInitAsIframeWithoutSrc({ iframe: el }));
        }

        if (!isWebKit && el.contentDocument) {
            this.nativeMethods.documentAddEventListener.call(el.contentDocument, 'DOMContentLoaded', () => {
                this.tryToInitAsIframeWithoutSrc({ iframe: el });
            });
        }
    }
}
