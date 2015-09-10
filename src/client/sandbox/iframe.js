import SandboxBase from './base';
import NativeMethods from './native-methods';
import Settings from '../settings';
import * as DOM from '../utils/dom';
import { syncServiceMsg } from '../transport';
import { isMozilla, isIE, isWebKit } from '../utils/browser';
import { DOM_SANDBOX_OVERRIDE_DOM_METHOD_NAME } from '../../const';
import { GET_IFRAME_TASK_SCRIPT as GET_IFRAME_TASK_SCRIPT_CMD } from '../../service-msg-cmd';
import { isSupportedProtocol, isIframeWithoutSrc } from '../utils/url';

export default class IframeSandbox extends SandboxBase {
    constructor (sandbox) {
        super(sandbox);

        this.IFRAME_READY_TO_INIT          = 'iframeReadyToInit';
        this.IFRAME_READY_TO_INIT_INTERNAL = 'iframeReadyToInitInternal';
        this.IFRAME_DOCUMENT_CREATED       = 'iframeDocumentCreated';
        this.IFRAME_DOCUMENT_RECREATED     = 'iframeDocumentRecreated';

        this.IFRAME_WINDOW_INITED = 'hh_iwi_5d9138e9';

        this.on(this.IFRAME_READY_TO_INIT, this.iframeReadyToInitHandler);
    }

    _raiseReadyToInitEvent (iframe) {
        if (isIframeWithoutSrc(iframe)) {
            var iframeInitialized       = this.isIframeInitialized(iframe);
            var iframeWindowInitialized = iframe.contentWindow[this.IFRAME_WINDOW_INITED];

            if (iframeInitialized && !iframeWindowInitialized) {
                // Ok, iframe fully loaded now, but Hammerhead not injected
                iframe.contentWindow[this.IFRAME_WINDOW_INITED] = true;

                // Rise this internal event to eval Hammerhead code script
                this._emit(this.IFRAME_READY_TO_INIT_INTERNAL, {
                    iframe: iframe
                });

                // Rise this event to eval "task" script and to call Hammerhead initialization method after
                this._emit(this.IFRAME_READY_TO_INIT, {
                    iframe: iframe
                });

                iframe.contentWindow[DOM_SANDBOX_OVERRIDE_DOM_METHOD_NAME]();
            }
            else if (!iframeInitialized) {
                // Even if iframe is not loaded (iframe.contentDocument.documentElement not exist) we should still
                // override document.write method, without Hammerhead initializing. This method can be called
                // before iframe fully loading, we are obliged to override it now
                if (iframe.contentDocument.write.toString() === NativeMethods.documentWrite.toString()) {
                    this._emit(this.IFRAME_DOCUMENT_CREATED, {
                        iframe: iframe
                    });
                }
            }
            /*eslint-disable no-empty */
            else if (iframeWindowInitialized && (isMozilla || isIE)) {
                // IE recreates iframe document after document.write calling.
                // FireFox recreates iframe document during loading
//                if (iframe.contentDocument.write.toString() === NativeMethods.documentWrite.toString()) {
//                    eventEmitter.emit(IFRAME_DOCUMENT_RECREATED, {
//                        iframe: iframe
//                    });
//                }
            }
            /*eslint-enable no-empty */
        }
    }

    isIframeInitialized (iframe) {
        var isFFIframeUninitialized = isMozilla && iframe.contentWindow.document.readyState === 'uninitialized';

        return !isFFIframeUninitialized && !!iframe.contentDocument.documentElement;
    }

    isWindowInited (window) {
        return window[this.IFRAME_WINDOW_INITED];
    }

    iframeReadyToInitHandler (e) {
        // Get and evaluate iframe task script
        var msg = {
            cmd:     GET_IFRAME_TASK_SCRIPT_CMD,
            referer: Settings.get().REFERER || this.window.location.toString()
        };

        syncServiceMsg(msg, function (iFrameTaskScript) {
            e.iframe.contentWindow.eval.apply(e.iframe.contentWindow, [iFrameTaskScript]);
        });
    }

    iframeAddedToDom (el) {
        if (!DOM.isShadowUIElement(el)) {
            this._raiseReadyToInitEvent(el);

            if (!isWebKit && el.contentDocument) {
                NativeMethods.documentAddEventListener.call(el.contentDocument, 'DOMContentLoaded', () => {
                    this._raiseReadyToInitEvent(el);
                });
            }
        }
    }

    onIframeBeganToRun (iframe) {
        this._raiseReadyToInitEvent(iframe);
    }

    overrideIframe (el) {
        if (DOM.isShadowUIElement(el))
            return;

        var src = NativeMethods.getAttribute.call(el, 'src');

        if (!src || !isSupportedProtocol(src)) {
            if (el.contentWindow) {
                this._raiseReadyToInitEvent(el);

                var readyHandler = () => {
                    if (el.contentWindow)
                        this._raiseReadyToInitEvent(el);
                };

                NativeMethods.addEventListener.call(el, 'load', readyHandler);

                if (isMozilla)
                    NativeMethods.documentAddEventListener.call(el.contentDocument, 'ready', readyHandler);
            }
            else {
                var handler = () => {
                    if (!DOM.isShadowUIElement(el)) {
                        if (DOM.isCrossDomainIframe(el))
                            NativeMethods.removeEventListener.call(el, 'load', handler);
                        else
                            this._raiseReadyToInitEvent(el);
                    }
                };

                if (DOM.isElementInDocument(el))
                    this._raiseReadyToInitEvent(el);

                NativeMethods.addEventListener.call(el, 'load', handler);
            }
        }
        else {
            if (DOM.isElementInDocument(el))
                this._raiseReadyToInitEvent(el);

            NativeMethods.addEventListener.call(el, 'load', () => this._raiseReadyToInitEvent(el));
        }
    }
}
