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
import StyleSandbox from './style';
import { isElectron } from '../utils/browser';
import { dispose as htmlUtilDispose } from '../utils/html';
import { dispose as anchorCodeInstumentationDispose } from './code-instrumentation/properties/anchor';
import { create as createSandboxBackup, get as getSandboxBackup } from './backup';
import urlResolver from '../utils/url-resolver';
import * as windowStorage from './windows-storage';
import nativeMethods from '../sandbox/native-methods';
import Transport from '../transport';
import ChildWindowSandbox from './child-window';

export default class Sandbox extends SandboxBase {
    cookie: CookieSandbox;
    storageSandbox: StorageSandbox;
    xhr: XhrSandbox;
    fetch: FetchSandbox;
    iframe: IframeSandbox;
    shadowUI: ShadowUI;
    upload: UploadSandbox;
    event: EventSandbox;
    node: NodeSandbox;
    codeInstrumentation: CodeInstrumentation;
    console: ConsoleSandbox;
    style: StyleSandbox;
    unload: UnloadSandbox;
    electron: ElectronSandbox;
    childWindow: ChildWindowSandbox;
    windowStorage: any;

    constructor (transport: Transport) {
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
        const childWindowSandbox    = new ChildWindowSandbox(messageSandbox, listeners);
        const cookieSandbox         = new CookieSandbox(messageSandbox, unloadSandbox, childWindowSandbox);

        // API
        this.cookie              = cookieSandbox; // eslint-disable-line no-restricted-properties
        this.childWindow         = childWindowSandbox;
        this.storageSandbox      = new StorageSandbox(listeners, unloadSandbox, eventSimulator);
        this.xhr                 = new XhrSandbox(cookieSandbox);
        this.fetch               = new FetchSandbox(cookieSandbox);
        this.iframe              = new IframeSandbox(nodeMutation, cookieSandbox);
        this.shadowUI            = new ShadowUI(nodeMutation, messageSandbox, this.iframe);
        this.upload              = new UploadSandbox(listeners, eventSimulator, transport);
        this.event               = new EventSandbox(listeners, eventSimulator, elementEditingWatcher, unloadSandbox, messageSandbox, this.shadowUI, timersSandbox);
        this.node                = new NodeSandbox(nodeMutation, this.iframe, this.event, this.upload, this.shadowUI, cookieSandbox, this.childWindow);
        this.codeInstrumentation = new CodeInstrumentation(this.event, messageSandbox);
        this.console             = new ConsoleSandbox(messageSandbox);
        this.style               = new StyleSandbox();
        this.unload              = unloadSandbox;

        if (isElectron)
            this.electron = new ElectronSandbox();

        this.windowStorage = windowStorage;
    }

    onIframeDocumentRecreated (iframe: HTMLFrameElement | HTMLIFrameElement): void {
        if (iframe) {
            const contentWindow   = nativeMethods.contentWindowGetter.call(iframe);
            const contentDocument = nativeMethods.contentDocumentGetter.call(iframe);

            // NOTE: Try to find an existing iframe sandbox.
            const sandbox = getSandboxBackup(contentWindow);

            if (sandbox) {
                if (!contentWindow[INTERNAL_PROPS.sandboxIsReattached] || sandbox.document !== contentDocument) {
                    // NOTE: Inform the sandbox so that it restores communication with the recreated document.
                    sandbox.reattach(contentWindow, contentDocument);
                }
            }
            else {
                // NOTE: Remove saved native methods for iframe
                if (contentWindow[INTERNAL_PROPS.iframeNativeMethods])
                    delete contentWindow[INTERNAL_PROPS.iframeNativeMethods];

                // NOTE: If the iframe sandbox is not found, this means that iframe is not initialized.
                // In this case, we need to inject Hammerhead.

                this.nativeMethods.restoreDocumentMeths(contentWindow, contentDocument);

                // NOTE: A sandbox for this iframe is not found (iframe is not yet initialized).
                // Inform IFrameSandbox about this, and it injects Hammerhead.
                this.iframe.onIframeBeganToRun(iframe);
            }
        }
    }

    reattach (window: Window & typeof globalThis, document: Document): void {
        nativeMethods.objectDefineProperty(window, INTERNAL_PROPS.sandboxIsReattached, { value: true, configurable: false });

        urlResolver.init(document);

        this.event.reattach(window);
        this.shadowUI.attach(window);
        // NOTE: T182337
        this.codeInstrumentation.attach(window);
        this.node.doc.attach(window, document);
        this.console.attach(window);
        this.childWindow.attach(window);
    }

    attach (window: Window & typeof globalThis): void {
        super.attach(window);

        nativeMethods.objectDefineProperty(window, INTERNAL_PROPS.sandboxIsReattached, { value: true, configurable: false });

        urlResolver.init(this.document);

        // NOTE: Eval Hammerhead code script.
        this.iframe.on(this.iframe.EVAL_HAMMERHEAD_SCRIPT_EVENT, e => {
            // @ts-ignore
            nativeMethods.contentWindowGetter.call(e.iframe).eval(`(${ initHammerheadClient.toString() })();//# sourceURL=hammerhead.js`);
        });

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
        this.cookie.attach(window); // eslint-disable-line no-restricted-properties
        this.console.attach(window);
        this.style.attach(window);
        this.childWindow.attach(window);

        if (this.electron)
            this.electron.attach(window);

        this.unload.on(this.unload.UNLOAD_EVENT, () => this.dispose());
    }

    private _removeInternalProperties (): void {
        const removeListeningElement = this.event.listeners.listeningCtx.removeListeningElement;

        removeListeningElement(this.window);
        removeListeningElement(this.document);

        const childNodes = nativeMethods.querySelectorAll.call(this.document, '*');
        const length     = nativeMethods.nodeListLengthGetter.call(childNodes);

        for (let i = 0; i < length; i++) {
            const childNode = childNodes[i];

            delete childNode[INTERNAL_PROPS.processedContext];
            removeListeningElement(childNode);
        }
    }

    dispose (): void {
        this.event.hover.dispose();
        this.event.focusBlur.dispose();
        htmlUtilDispose();
        anchorCodeInstumentationDispose();
        urlResolver.dispose(this.document);
        this.storageSandbox.dispose();
        this._removeInternalProperties();
    }
}
