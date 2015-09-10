import SandboxBase from './base';
import XhrSandbox from './xhr';
import NodeSandbox from './node';
import MessageSandbox from './message';
import UploadSandbox from './upload';
import ShadowUI from './shadow-ui';
import CookieSandbox from './cookie';
import IframeSandbox from './iframe';
import CodeInstrumentation from './code-instrumentation';
import EventSandbox from './event';
import nativeMethods from './native-methods';
import { isIE, isWebKit } from '../utils/browser';
import { addSandboxToStorage, getSandboxFromStorage } from './storage';

export default class Sandbox extends SandboxBase {
    constructor () {
        super(null);

        addSandboxToStorage(window, this);

        this.codeInstrumentation = new CodeInstrumentation(this);
        this.xhr                 = new XhrSandbox(this);
        this.shadowUI            = new ShadowUI(this);
        this.upload              = new UploadSandbox(this);
        this.cookie              = new CookieSandbox(this);
        this.iframe              = new IframeSandbox(this);
        this.message             = new MessageSandbox(this);
        this.event               = new EventSandbox(this);
        this.node                = new NodeSandbox(this);

        this.nativeMethods = nativeMethods;
    }

    _refreshNativeMethods (window, document) {
        var tryToExecuteCode = func => {
            try {
                return func();
            }
            catch (e) {
                return true;
            }
        };

        var needToUpdateNativeDomMeths = tryToExecuteCode(
            () => !document.createElement ||
                  nativeMethods.createElement.toString() === document.createElement.toString()
        );

        var needToUpdateNativeElementMeths = tryToExecuteCode(() => {
            var nativeElement = nativeMethods.createElement.call(document, 'div');

            return nativeElement.getAttribute.toString() === nativeMethods.getAttribute.toString();
        });

        var needToUpdateNativeWindowMeths = tryToExecuteCode(() => {
            nativeMethods.setTimeout.call(window, () => void 0, 0);

            return window.XMLHttpRequest.toString() === nativeMethods.XMLHttpRequest.toString();
        });

        // T173709
        if (needToUpdateNativeDomMeths)
            nativeMethods.refreshDocumentMeths(document);

        if (needToUpdateNativeElementMeths)
            nativeMethods.refreshElementMeths(document);

        // T239109
        if (needToUpdateNativeWindowMeths)
            nativeMethods.refreshWindowMeths(window);
    }

    onIframeDocumentRecreated (iframe) {
        if (iframe) {
            // Try to find existing iframe sandbox
            var sandbox = getSandboxFromStorage(iframe.contentWindow);

            if (sandbox)
                // Inform the sandbox so that it restore communication with the recreated document
                sandbox.reattach(iframe.contentWindow, iframe.contentDocument);
            else {
                // If the iframe sandbox is not found, this means that iframe not initialized,
                // in this case we should inject Hammerhead

                // Hack: IE10 clean up overrided methods after document.write calling
                nativeMethods.restoreNativeDocumentMeth(iframe.contentDocument);

                // Sandbox for this iframe not found (iframe not yet initialized).
                // Inform the IFrameSandbox about it, and it inject Hammerhead
                this.iframe.onIframeBeganToRun(iframe);
            }
        }
    }

    reattach (window, document) {
        // Assign exists sandbox to cleared document
        if (isIE)
            this._refreshNativeMethods(window, document);

        this.event.initDocumentListening();

        if (isWebKit)
            this.event.listeners.restartElementListening(window);

        this.shadowUI.attach(window);
        this.codeInstrumentation.attach(window); // T182337
        this.node.doc.attach(window, document);
    }

    attach (window) {
        super.attach(window);

        // Eval Hammerhead code script
        this.iframe.on(this.iframe.IFRAME_READY_TO_INIT_INTERNAL_EVENT, e => initHammerheadClient(e.iframe.contentWindow, true));

        // We should reattach sandbox to the recreated iframe document
        this.node.doc.on(this.node.doc.DOCUMENT_CLEANED_EVENT, e =>
                this.reattach(e.window, e.document)
        );

        this.iframe.attach(window);
        this.xhr.attach(window);
        this.codeInstrumentation.attach(window);
        this.shadowUI.attach(window);
        this.event.attach(window);
        this.node.attach(window);
        this.upload.attach(window);
        this.message.attach(window);
        this.cookie.attach(window);
    }
}
