import INTERNAL_PROPS from '../../processing/dom/internal-properties';
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
import TimersSandbox from './timers';
import UnloadSandbox from './event/unload';
import UploadSandbox from './upload';
import XhrSandbox from './xhr';
import FetchSandbox from './fetch';
import StorageSandbox from './storages';
import ElectronSandbox from './electron';
import ConsoleSandbox from './console';
import { isIE, isWebKit, isElectron } from '../utils/browser';
import { create as createSandboxBackup, get as getSandboxBackup } from './backup';
import urlResolver from '../utils/url-resolver';
import * as windowStorage from './windows-storage';

export default class Sandbox extends SandboxBase {
    constructor () {
        super();

        createSandboxBackup(window, this);
        windowStorage.add(window);

        const listeners             = new Listeners();
        const nodeMutation          = new NodeMutation();
        const unloadSandbox         = new UnloadSandbox(listeners);
        const messageSandbox        = new MessageSandbox(listeners, unloadSandbox);
        const eventSimulator        = new EventSimulator();
        const elementEditingWatcher = new ElementEditingWatcher(eventSimulator);
        const timersSandbox         = new TimersSandbox();

        // API
        this.storageSandbox      = new StorageSandbox(listeners, unloadSandbox, eventSimulator);
        this.cookie              = new CookieSandbox();
        this.xhr                 = new XhrSandbox(this.cookie);
        this.fetch               = new FetchSandbox();
        this.iframe              = new IframeSandbox(nodeMutation, this.cookie);
        this.shadowUI            = new ShadowUI(nodeMutation, messageSandbox, this.iframe);
        this.upload              = new UploadSandbox(listeners, eventSimulator, this.shadowUI);
        this.event               = new EventSandbox(listeners, eventSimulator, elementEditingWatcher, unloadSandbox, messageSandbox, this.shadowUI, timersSandbox);
        this.codeInstrumentation = new CodeInstrumentation(nodeMutation, this.event, this.cookie, this.upload, this.shadowUI, this.storageSandbox);
        this.node                = new NodeSandbox(nodeMutation, this.iframe, this.event, this.upload, this.shadowUI);
        this.console             = new ConsoleSandbox(messageSandbox);

        if (isElectron)
            this.electron = new ElectronSandbox();

        this.windowStorage = windowStorage;
    }

    // NOTE: In some cases, IE raises the "Can't execute code from a freed script" exception,
    // so that we cannot use a sandbox created earlier and we have to create a new one.
    static _canUseSandbox (sandbox) {
        try {
            sandbox.off();
        }
        catch (e) {
            return false;
        }

        return true;
    }

    _refreshNativeMethods (window, document) {
        const tryToExecuteCode = func => {
            try {
                return func();
            }
            catch (e) {
                return true;
            }
        };

        const needToUpdateNativeDomMeths = tryToExecuteCode(
            () => !document.createElement ||
                  this.nativeMethods.createElement.toString() === document.createElement.toString()
        );

        const needToUpdateNativeElementMeths = tryToExecuteCode(() => {
            const nativeElement = this.nativeMethods.createElement.call(document, 'div');

            return nativeElement.getAttribute.toString() === this.nativeMethods.getAttribute.toString();
        });

        const needToUpdateNativeWindowMeths = tryToExecuteCode(() => {
            this.nativeMethods.setTimeout.call(window, () => void 0, 0);

            return window.XMLHttpRequest.prototype.open.toString() === this.nativeMethods.xhrOpen.toString();
        });

        // NOTE: T173709
        if (needToUpdateNativeDomMeths)
            this.nativeMethods.refreshDocumentMeths(document);

        if (needToUpdateNativeElementMeths)
            this.nativeMethods.refreshElementMeths(document);

        // NOTE: T239109
        if (needToUpdateNativeWindowMeths)
            this.nativeMethods.refreshWindowMeths(window);
    }

    _restoreDocumentMethodsFromProto (document) {
        const docProto = document.constructor.prototype;

        document.createDocumentFragment = document.createDocumentFragment || docProto.createDocumentFragment;
        document.createElement          = document.createElement || docProto.createElement;
        document.createElementNS        = document.createElementNS || docProto.createElementNS;
        document.open                   = document.open || docProto.open;
        document.close                  = document.close || docProto.close;
        document.write                  = document.write || docProto.write;
        document.writeln                = document.writeln || docProto.writeln;
        document.elementFromPoint       = document.elementFromPoint || docProto.elementFromPoint;
        document.getElementById         = document.getElementById || docProto.getElementById;
        document.getElementsByClassName = document.getElementsByClassName || docProto.getElementsByClassName;
        document.getElementsByName      = document.getElementsByName || docProto.getElementsByName;
        document.getElementsByTagName   = document.getElementsByTagName || docProto.getElementsByTagName;
        document.querySelector          = document.querySelector || docProto.querySelector;
        document.querySelectorAll       = document.querySelectorAll || docProto.querySelectorAll;
        document.addEventListener       = document.addEventListener || docProto.addEventListener;
        document.removeEventListener    = document.removeEventListener || docProto.removeEventListener;
    }

    onIframeDocumentRecreated (iframe) {
        if (iframe) {
            // NOTE: Try to find an existing iframe sandbox.
            const sandbox = getSandboxBackup(iframe.contentWindow);

            if (sandbox && Sandbox._canUseSandbox(sandbox))
            // NOTE: Inform the sandbox so that it restores communication with the recreated document.
                sandbox.reattach(iframe.contentWindow, iframe.contentDocument);
            else {
                // NOTE: Remove saved native methods for iframe
                if (iframe.contentWindow[INTERNAL_PROPS.iframeNativeMethods])
                    delete iframe.contentWindow[INTERNAL_PROPS.iframeNativeMethods];

                // NOTE: If the iframe sandbox is not found, this means that iframe is not initialized.
                // In this case, we need to inject Hammerhead.

                // HACK: IE10 cleans up overridden methods after the document.write method call.
                this.nativeMethods.restoreDocumentMeths(iframe.contentDocument);

                // NOTE: A sandbox for this iframe is not found (iframe is not yet initialized).
                // Inform IFrameSandbox about this, and it injects Hammerhead.
                this.iframe.onIframeBeganToRun(iframe);
            }
        }
    }

    reattach (window, document) {
        // NOTE: Assign the existing sandbox to the cleared document.
        if (isIE || isWebKit)
            this._refreshNativeMethods(window, document);

        urlResolver.init(document);

        this.event.initDocumentListening();

        if (isWebKit && window.top === window)
            this.event.listeners.restartElementListening(window);

        this.shadowUI.attach(window);
        // NOTE: T182337
        this.codeInstrumentation.attach(window);
        this.node.doc.attach(window, document);
        this.console.attach(window);

        this._restoreDocumentMethodsFromProto(document);
    }

    attach (window) {
        super.attach(window);

        urlResolver.init(this.document);

        // NOTE: Eval Hammerhead code script.
        this.iframe.on(this.iframe.EVAL_HAMMERHEAD_SCRIPT_EVENT, e => initHammerheadClient(e.iframe.contentWindow, true));

        // NOTE: We need to reattach a sandbox to the recreated iframe document.
        this.node.mutation.on(this.node.mutation.DOCUMENT_CLEANED_EVENT, e => this.reattach(e.window, e.document));

        this.iframe.attach(window);
        this.xhr.attach(window);
        this.fetch.attach(window);
        this.storageSandbox.attach(window);
        this.codeInstrumentation.attach(window);
        this.shadowUI.attach(window);
        this.event.attach(window);
        this.node.attach(window);
        this.upload.attach(window);
        this.cookie.attach(window);
        this.console.attach(window);

        if (this.electron)
            this.electron.attach(window);
    }
}
