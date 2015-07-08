import * as Browser from '../util/browser';
import * as DOM from '../util/dom';
import NativeMethods from './native-methods';
import Const from '../../const';
import * as Service from '../util/service';
import ServiceCommands from '../../service-msg-cmd';
import Settings from '../settings';
import Transport from '../transport';
import UrlUtil from '../util/url';

const IFRAME_READY_TO_INIT          = 'iframeReadyToInit';
const IFRAME_READY_TO_INIT_INTERNAL = 'iframeReadyToInitInternal';
const IFRAME_DOCUMENT_CREATED       = 'iframeDocumentCreated';
const IFRAME_DOCUMENT_RECREATED     = 'iframeDocumentRecreated';

const IFRAME_WINDOW_INITED = 'hh_iwi_5d9138e9';

var eventEmitter = new Service.EventEmitter();
var IFrameSandbox = {};

// For iframes without src only!
IFrameSandbox.IFRAME_READY_TO_INIT          = IFRAME_READY_TO_INIT;
IFrameSandbox.IFRAME_READY_TO_INIT_INTERNAL = IFRAME_READY_TO_INIT_INTERNAL;
IFrameSandbox.IFRAME_DOCUMENT_CREATED       = IFRAME_DOCUMENT_CREATED;
IFrameSandbox.IFRAME_DOCUMENT_RECREATED     = IFRAME_DOCUMENT_RECREATED;

IFrameSandbox.on  = eventEmitter.on.bind(eventEmitter);
IFrameSandbox.off = eventEmitter.off.bind(eventEmitter);

IFrameSandbox.isIframeInitialized = function (iframe) {
    var isFFIframeUninitialized = Browser.isMozilla && iframe.contentWindow.document.readyState === 'uninitialized';

    return !isFFIframeUninitialized && !!iframe.contentDocument.documentElement;
};

IFrameSandbox.isWindowInited = function (window) {
    return window[IFRAME_WINDOW_INITED];
};

IFrameSandbox.iframeReadyToInitHandler = function (e) {
    // Get and evaluate iframe task script
    var msg = {
        cmd:     ServiceCommands.GET_IFRAME_TASK_SCRIPT,
        referer: Settings.get().REFERER || window.location.toString()
    };

    Transport.syncServiceMsg(msg, function (iFrameTaskScript) {
        e.iframe.contentWindow.eval.apply(e.iframe.contentWindow, [iFrameTaskScript]);
    });
};

eventEmitter.on(IFrameSandbox.IFRAME_READY_TO_INIT, IFrameSandbox.iframeReadyToInitHandler);

function raiseReadyToInitEvent (iframe) {
    if (UrlUtil.isIframeWithoutSrc(iframe)) {
        var iframeInitialized       = IFrameSandbox.isIframeInitialized(iframe);
        var iframeWindowInitialized = iframe.contentWindow[IFRAME_WINDOW_INITED];

        if (iframeInitialized && !iframeWindowInitialized) {
            // Ok, iframe fully loaded now, but Hammerhead not injected
            iframe.contentWindow[IFRAME_WINDOW_INITED] = true;

            // Rise this internal event to eval Hammerhead code script
            eventEmitter.emit(IFrameSandbox.IFRAME_READY_TO_INIT_INTERNAL, {
                iframe: iframe
            });

            // Rise this event to eval "task" script and to call Hammerhead initialization method after
            eventEmitter.emit(IFrameSandbox.IFRAME_READY_TO_INIT, {
                iframe: iframe
            });

            iframe.contentWindow[Const.DOM_SANDBOX_OVERRIDE_DOM_METHOD_NAME]();
        }
        else if (!iframeInitialized) {
            // Even if iframe is not loaded (iframe.contentDocument.documentElement not exist) we should still
            // override document.write method, without Hammerhead initializing. This method can be called
            // before iframe fully loading, we are obliged to override it now
            if (iframe.contentDocument.write.toString() === NativeMethods.documentWrite.toString()) {
                eventEmitter.emit(IFrameSandbox.IFRAME_DOCUMENT_CREATED, {
                    iframe: iframe
                });
            }
        }
        /*eslint-disable no-empty */
        else if (iframeWindowInitialized && (Browser.isMozilla || Browser.isIE)) {
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

IFrameSandbox.iframeAddedToDom = function (el) {
    if (!DOM.isShadowUIElement(el)) {
        raiseReadyToInitEvent(el);

        if (!Browser.isWebKit && el.contentDocument) {
            NativeMethods.documentAddEventListener.call(el.contentDocument, 'DOMContentLoaded', function () {
                raiseReadyToInitEvent(el);
            });
        }
    }
};

IFrameSandbox.onIframeBeganToRun = function (iframe) {
    raiseReadyToInitEvent(iframe);
};

IFrameSandbox.overrideIframe = function (el) {
    if (DOM.isShadowUIElement(el))
        return;

    var src = NativeMethods.getAttribute.call(el, 'src');

    if (!src || !UrlUtil.isSupportedProtocol(src)) {
        if (el.contentWindow) {
            raiseReadyToInitEvent(el);

            var readyHandler = function () {
                if (el.contentWindow)
                    raiseReadyToInitEvent(el);
            };

            NativeMethods.addEventListener.call(el, 'load', readyHandler);

            if (Browser.isMozilla)
                NativeMethods.documentAddEventListener.call(el.contentDocument, 'ready', readyHandler);

        }
        else {
            var handler = function () {
                if (!DOM.isShadowUIElement(el)) {
                    if (DOM.isCrossDomainIframe(el))
                        NativeMethods.removeEventListener.call(el, 'load', handler);
                    else
                        raiseReadyToInitEvent(el);
                }
            };

            if (DOM.isElementInDocument(el))
                raiseReadyToInitEvent(el);

            NativeMethods.addEventListener.call(el, 'load', handler);
        }
    }
    else {
        if (DOM.isElementInDocument(el))
            raiseReadyToInitEvent(el);

        NativeMethods.addEventListener.call(el, 'load', function () {
            raiseReadyToInitEvent(el);
        });
    }
};

export default IFrameSandbox;
