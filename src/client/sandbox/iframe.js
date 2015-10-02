import COMMAND from '../../session/command';
import SandboxBase from './base';
import settings from '../settings';
import { isShadowUIElement, isCrossDomainIframe, isElementInDocument } from '../utils/dom';
import { syncServiceMsg } from '../transport';
import { isFirefox, isWebKit } from '../utils/browser';
import { DOM_SANDBOX_OVERRIDE_DOM_METHOD_NAME } from '../../const';
import { isSupportedProtocol, isIframeWithoutSrc } from '../utils/url';

const IFRAME_WINDOW_INITED = 'hammerhead|iframe-window-inited';

export default class IframeSandbox extends SandboxBase {
    constructor (nodeMutation) {
        super();

        this.IFRAME_READY_TO_INIT_EVENT          = 'hammerhead|event|iframe-ready-to-init';
        this.IFRAME_READY_TO_INIT_INTERNAL_EVENT = 'hammerhead|event|iframe-ready-to-init-internal';
        this.IFRAME_DOCUMENT_CREATED_EVENT       = 'hammerhead|event|iframe-document-created';

        this.on(this.IFRAME_READY_TO_INIT_EVENT, this.iframeReadyToInitHandler);
        nodeMutation.on(nodeMutation.IFRAME_ADDED_TO_DOM_EVENT, e => this.iframeAddedToDom(e.iframe));
    }

    _raiseReadyToInitEvent (iframe) {
        if (isIframeWithoutSrc(iframe)) {
            var iframeInitialized       = IframeSandbox.isIframeInitialized(iframe);
            var iframeWindowInitialized = iframe.contentWindow[IFRAME_WINDOW_INITED];

            if (iframeInitialized && !iframeWindowInitialized) {
                // Ok, iframe fully loaded now, but Hammerhead not injected
                iframe.contentWindow[IFRAME_WINDOW_INITED] = true;

                // Rise this internal event to eval Hammerhead code script
                this.emit(this.IFRAME_READY_TO_INIT_INTERNAL_EVENT, {
                    iframe: iframe
                });

                // Rise this event to eval "task" script and to call Hammerhead initialization method after
                this.emit(this.IFRAME_READY_TO_INIT_EVENT, {
                    iframe: iframe
                });

                iframe.contentWindow[DOM_SANDBOX_OVERRIDE_DOM_METHOD_NAME]();
            }
            else if (!iframeInitialized) {
                // Even if iframe is not loaded (iframe.contentDocument.documentElement not exist) we should still
                // override document.write method, without Hammerhead initializing. This method can be called
                // before iframe fully loading, we are obliged to override it now
                if (iframe.contentDocument.write.toString() === this.nativeMethods.documentWrite.toString()) {
                    this.emit(this.IFRAME_DOCUMENT_CREATED_EVENT, {
                        iframe: iframe
                    });
                }
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
        // Get and evaluate iframe task script
        var msg = {
            cmd:     COMMAND.getIframeTaskScript,
            referer: settings.get().referer || this.window.location.toString()
        };

        syncServiceMsg(msg, function (iFrameTaskScript) {
            e.iframe.contentWindow.eval.apply(e.iframe.contentWindow, [iFrameTaskScript]);
        });
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
