import INTERNAL_PROPS from '../../processing/dom/internal-properties';
import SandboxBase from './base';
import settings from '../settings';
import domProcessor from '../dom-processor';
import { isShadowUIElement, isCrossDomainIframe, isElementInDocument, isIframeWithoutSrc } from '../utils/dom';
import { isFirefox, isWebKit } from '../utils/browser';
import { isSupportedProtocol } from '../utils/url';
import { isPageHtml } from '../utils/html';

const IFRAME_WINDOW_INITED = 'hammerhead|iframe-window-inited';

export default class IframeSandbox extends SandboxBase {
    constructor (nodeMutation, cookieSandbox) {
        super();

        this.RUN_TASK_SCRIPT               = 'hammerhead|event|run-task-script';
        this.EVAL_HAMMERHEAD_SCRIPT        = 'hammerhead|event|eval-hammerhead-script';
        this.EVAL_EXTERNAL_SCRIPT          = 'hammerhead|event|eval-external-script';
        this.IFRAME_DOCUMENT_CREATED_EVENT = 'hammerhead|event|iframe-document-created';

        this.cookieSandbox = cookieSandbox;

        this.on(this.RUN_TASK_SCRIPT, this.iframeReadyToInitHandler);
        nodeMutation.on(nodeMutation.IFRAME_ADDED_TO_DOM_EVENT, e => this.processIframe(e.iframe));

        this.iframeNativeMethodsBackup = null;
    }

    _shouldSaveIframeNativeMethods (iframe) {
        if (!isWebKit)
            return false;

        var iframeSrc = this.nativeMethods.getAttribute.call(iframe, 'src');

        if (!domProcessor.JAVASCRIPT_PROTOCOL_REG_EX.test(iframeSrc))
            return false;

        var iframeSrcValueWithoutProtocol = iframeSrc.replace(domProcessor.JAVASCRIPT_PROTOCOL_REG_EX, '');
        var matches                       = iframeSrcValueWithoutProtocol.match(domProcessor.HTML_STRING_REG_EX);

        if (!matches)
            return false;

        var html = matches[2];

        return isPageHtml(html);
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
        var iframeNativeMethods = iframe.contentWindow[INTERNAL_PROPS.iframeNativeMethods];

        if (iframeNativeMethods) {
            iframeNativeMethods.restoreDocumentMeths(iframe.contentDocument, iframe.contentWindow);
            delete iframe.contentWindow[INTERNAL_PROPS.iframeNativeMethods];
        }
    }

    _raiseReadyToInitEvent (iframe) {
        if (isIframeWithoutSrc(iframe)) {
            var iframeInitialized       = IframeSandbox.isIframeInitialized(iframe);
            var iframeWindowInitialized = iframe.contentWindow[IFRAME_WINDOW_INITED];

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
                iframe.contentWindow[IFRAME_WINDOW_INITED] = true;

                // NOTE: Raise this internal event to eval the Hammerhead code script.
                this.emit(this.EVAL_HAMMERHEAD_SCRIPT, { iframe });

                // NOTE: Raise this event to eval external code script.
                this.emit(this.EVAL_EXTERNAL_SCRIPT, { iframe });

                // NOTE: Raise this event to eval the "task" script and to call the Hammerhead initialization method
                // and external script initialization code.
                this.emit(this.RUN_TASK_SCRIPT, { iframe });

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
        var isFFIframeUninitialized = isFirefox && iframe.contentWindow.document.readyState === 'uninitialized';

        return !isFFIframeUninitialized && !!iframe.contentDocument.documentElement;
    }

    static isWindowInited (window) {
        return window[IFRAME_WINDOW_INITED];
    }

    iframeReadyToInitHandler (e) {
        // NOTE: We are using String.replace in order to avoid adding Mustache scripts on the client side.
        // If it is needed elsewhere in a certain place, we should consider using Mustache.
        var taskScriptTemplate       = settings.get().iframeTaskScriptTemplate;
        var escapeStringPatterns     = str => str.replace(/\$/g, '$$$$');
        var cookie                   = JSON.stringify(this.cookieSandbox.getCookie());
        var referer                  = settings.get().referer || this.window.location.toString();
        var iframeTaskScriptTemplate = JSON.stringify(taskScriptTemplate);
        var taskScript               = taskScriptTemplate
            .replace('{{{cookie}}}', escapeStringPatterns(cookie))
            .replace('{{{referer}}}', escapeStringPatterns(referer))
            .replace('{{{iframeTaskScriptTemplate}}}', escapeStringPatterns(iframeTaskScriptTemplate));

        e.iframe.contentWindow.eval.call(e.iframe.contentWindow, taskScript);
    }

    onIframeBeganToRun (iframe) {
        this._raiseReadyToInitEvent(iframe);
    }

    processIframe (el) {
        if (isShadowUIElement(el))
            return;

        var src = this.nativeMethods.getAttribute.call(el, 'src');

        if (!src || !isSupportedProtocol(src)) {
            if (el.contentWindow) {
                this._raiseReadyToInitEvent(el);

                var readyHandler = () => {
                    if (el.contentWindow)
                        this._raiseReadyToInitEvent(el);
                };

                this.nativeMethods.addEventListener.call(el, 'load', readyHandler);

                if (isFirefox)
                    this.nativeMethods.documentAddEventListener.call(el.contentDocument, 'ready', readyHandler);
            }
            else {
                var handler = () => {
                    if (isCrossDomainIframe(el))
                        this.nativeMethods.removeEventListener.call(el, 'load', handler);
                    else
                        this._raiseReadyToInitEvent(el);
                };

                if (isElementInDocument(el))
                    this._raiseReadyToInitEvent(el);

                this.nativeMethods.addEventListener.call(el, 'load', handler);
            }
        }
        else {
            if (isElementInDocument(el))
                this._raiseReadyToInitEvent(el);

            this.nativeMethods.addEventListener.call(el, 'load', () => this._raiseReadyToInitEvent(el));
        }

        if (!isWebKit && el.contentDocument) {
            this.nativeMethods.documentAddEventListener.call(el.contentDocument, 'DOMContentLoaded', () => {
                this._raiseReadyToInitEvent(el);
            });
        }
    }
}
