import INTERNAL_PROPS from '../../processing/dom/internal-properties';
import SandboxBase from './base';
import settings from '../settings';
import { isShadowUIElement, isCrossDomainIframe, isElementInDocument } from '../utils/dom';
import { isFirefox, isWebKit } from '../utils/browser';
import { isSupportedProtocol } from '../utils/url';
import { isIframeWithoutSrc } from '../utils/dom';

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
        nodeMutation.on(nodeMutation.IFRAME_ADDED_TO_DOM_EVENT, e => this.iframeAddedToDom(e.iframe));
    }

    _raiseReadyToInitEvent (iframe) {
        if (isIframeWithoutSrc(iframe)) {
            var iframeInitialized       = IframeSandbox.isIframeInitialized(iframe);
            var iframeWindowInitialized = iframe.contentWindow[IFRAME_WINDOW_INITED];

            if (iframeInitialized && !iframeWindowInitialized) {
                // NOTE: Ok, the iframe is fully loaded now, but Hammerhead is not injected.
                iframe.contentWindow[IFRAME_WINDOW_INITED] = true;

                // NOTE: Restore native document methods for the iframe's document if it overrided earlier
                var iframeNativeMethods = iframe.contentWindow[INTERNAL_PROPS.iframeNativeMethods];

                if (iframeNativeMethods) {
                    iframeNativeMethods.restoreDocumentMeths(iframe.contentDocument, iframe.contentWindow);
                    delete iframe.contentWindow[INTERNAL_PROPS.iframeNativeMethods];
                }

                // NOTE: Raise this internal event to eval the Hammerhead code script.
                this.emit(this.EVAL_HAMMERHEAD_SCRIPT, { iframe });

                // NOTE: Raise this event to eval external code script.
                this.emit(this.EVAL_EXTERNAL_SCRIPT, { iframe });

                // NOTE: Raise this event to eval the "task" script and to call the Hammerhead initialization method
                // and external script initialization code.
                this.emit(this.RUN_TASK_SCRIPT, { iframe });

                iframe.contentWindow[INTERNAL_PROPS.overrideDomMethodName]();
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
        var taskScriptTemplate = settings.get().iframeTaskScriptTemplate;
        var taskScript         = taskScriptTemplate
            .replace('{{{cookie}}}', JSON.stringify(this.cookieSandbox.getCookie()))
            .replace('{{{referer}}}', settings.get().referer || this.window.location.toString())
            .replace('{{{iframeTaskScriptTemplate}}}', JSON.stringify(taskScriptTemplate));

        e.iframe.contentWindow.eval.apply(e.iframe.contentWindow, [taskScript]);
    }

    iframeAddedToDom (el) {
        this.overrideIframe(el);

        if (!isShadowUIElement(el)) {
            this._raiseReadyToInitEvent(el);

            if (!isWebKit && el.contentDocument) {
                this.nativeMethods.documentAddEventListener.call(el.contentDocument, 'DOMContentLoaded', () => {
                    this._raiseReadyToInitEvent(el);
                });
            }
        }
    }

    onIframeBeganToRun (iframe) {
        this._raiseReadyToInitEvent(iframe);
    }

    overrideIframe (el) {
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
                    if (!isShadowUIElement(el)) {
                        if (isCrossDomainIframe(el))
                            this.nativeMethods.removeEventListener.call(el, 'load', handler);
                        else
                            this._raiseReadyToInitEvent(el);
                    }
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
    }
}
