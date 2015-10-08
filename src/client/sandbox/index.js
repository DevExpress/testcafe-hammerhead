import CodeInstrumentation from './code-instrumentation';
import CookieSandbox from './cookie';
import ElementEditingWatcher from './event/element-editing-watcher';
import EventSandbox from './event';
import EventSimulator from './event/simulator';
import IframeSandbox from './iframe';
import Listeners from './event/listeners';
import MessageSandbox from './event/message';
import NodeMutation from './node/mutation';
import NodeSandbox from './node';
import SandboxBase from './base';
import ShadowUI from './shadow-ui';
import UnloadSandbox from './event/unload';
import UploadSandbox from './upload';
import XhrSandbox from './xhr';
import { isIE, isWebKit } from '../utils/browser';
import { addSandboxToStorage, getSandboxFromStorage } from './storage';

export default class Sandbox extends SandboxBase {
    constructor () {
        super();

        addSandboxToStorage(window, this);

        var listeners             = new Listeners();
        var nodeMutation          = new NodeMutation();
        var unloadSandbox         = new UnloadSandbox(listeners);
        var messageSandbox        = new MessageSandbox(listeners);
        var eventSimulator        = new EventSimulator();
        var elementEditingWatcher = new ElementEditingWatcher(eventSimulator);

        // API
        this.iframe              = new IframeSandbox(nodeMutation);
        this.xhr                 = new XhrSandbox();
        this.cookie              = new CookieSandbox();
        this.shadowUI            = new ShadowUI(nodeMutation, messageSandbox, this.iframe);
        this.upload              = new UploadSandbox(listeners, eventSimulator, this.shadowUI);
        this.event               = new EventSandbox(listeners, eventSimulator, elementEditingWatcher, unloadSandbox, messageSandbox, this.shadowUI);
        this.codeInstrumentation = new CodeInstrumentation(nodeMutation, this.event, this.cookie, this.upload, this.shadowUI);
        this.node                = new NodeSandbox(nodeMutation, this.iframe, this.event, this.upload, this.shadowUI);
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
                  this.nativeMethods.createElement.toString() === document.createElement.toString()
        );

        var needToUpdateNativeElementMeths = tryToExecuteCode(() => {
            var nativeElement = this.nativeMethods.createElement.call(document, 'div');

            return nativeElement.getAttribute.toString() === this.nativeMethods.getAttribute.toString();
        });

        var needToUpdateNativeWindowMeths = tryToExecuteCode(() => {
            this.nativeMethods.setTimeout.call(window, () => void 0, 0);

            return window.XMLHttpRequest.toString() === this.nativeMethods.XMLHttpRequest.toString();
        });

        // T173709
        if (needToUpdateNativeDomMeths)
            this.nativeMethods.refreshDocumentMeths(document);

        if (needToUpdateNativeElementMeths)
            this.nativeMethods.refreshElementMeths(document);

        // T239109
        if (needToUpdateNativeWindowMeths)
            this.nativeMethods.refreshWindowMeths(window);
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
                this.nativeMethods.restoreNativeDocumentMeth(iframe.contentDocument);

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
        this.node.mutation.on(this.node.mutation.DOCUMENT_CLEANED_EVENT, e => this.reattach(e.window, e.document));

        this.iframe.attach(window);
        this.xhr.attach(window);
        this.codeInstrumentation.attach(window);
        this.shadowUI.attach(window);
        this.event.attach(window);
        this.node.attach(window);
        this.upload.attach(window);
        this.cookie.attach(window);
    }
}
