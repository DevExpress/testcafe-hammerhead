import INTERNAL_PROPS from '../../processing/dom/internal-properties';
import SandboxBase from './base';
import settings from '../settings';
import nativeMethods from '../sandbox/native-methods';
import DomProcessor from '../../processing/dom';
import {
    isShadowUIElement,
    isIframeWithoutSrc,
    isIframeElement,
    isFrameElement,
    isIframeWithSrcdoc,
} from '../utils/dom';

import {
    isFirefox,
    isWebKit,
} from '../utils/browser';

import NodeMutation from './node/mutation';
import CookieSandbox from './cookie';
import { isNativeFunction } from '../utils/overriding';
import { stringify as stringifyJSON } from '../../utils/json';

const IFRAME_WINDOW_INITED = 'hammerhead|iframe-window-inited';

export default class IframeSandbox extends SandboxBase {
    RUN_TASK_SCRIPT_EVENT = 'hammerhead|event|run-task-script';
    EVAL_HAMMERHEAD_SCRIPT_EVENT = 'hammerhead|event|eval-hammerhead-script';
    EVAL_EXTERNAL_SCRIPT_EVENT = 'hammerhead|event|eval-external-script';
    IFRAME_DOCUMENT_CREATED_EVENT = 'hammerhead|event|iframe-document-created';

    iframeNativeMethodsBackup: any;

    constructor (private readonly _nodeMutation: NodeMutation,
        private readonly _cookieSandbox: CookieSandbox) {

        super();

        this.on(this.RUN_TASK_SCRIPT_EVENT, this.iframeReadyToInitHandler);
        this._nodeMutation.on(this._nodeMutation.IFRAME_ADDED_TO_DOM_EVENT, (iframe: HTMLIFrameElement) => this.processIframe(iframe));

        this.iframeNativeMethodsBackup = null;
    }

    private _shouldSaveIframeNativeMethods (iframe: HTMLIFrameElement | HTMLFrameElement): boolean {
        if (!isWebKit)
            return false;

        const iframeSrc = this.nativeMethods.getAttribute.call(iframe, 'src');

        return DomProcessor.isJsProtocol(iframeSrc);
    }

    private _ensureIframeNativeMethodsForChrome (iframe: HTMLIFrameElement | HTMLFrameElement): void {
        const contentWindow   = nativeMethods.contentWindowGetter.call(iframe);
        const contentDocument = nativeMethods.contentDocumentGetter.call(iframe);

        if (this.iframeNativeMethodsBackup) {
            this.iframeNativeMethodsBackup.restoreDocumentMeths(contentWindow, contentDocument);
            this.iframeNativeMethodsBackup = null;
        }
        else if (this._shouldSaveIframeNativeMethods(iframe))
            // @ts-ignore
            this.iframeNativeMethodsBackup = new this.nativeMethods.constructor(contentDocument, contentWindow);
    }

    private _ensureIframeNativeMethodsForFirefox (iframe: HTMLIFrameElement | HTMLFrameElement): void {
        const contentWindow       = nativeMethods.contentWindowGetter.call(iframe);
        const contentDocument     = nativeMethods.contentDocumentGetter.call(iframe);
        const iframeNativeMethods = contentWindow[INTERNAL_PROPS.iframeNativeMethods];

        if (iframeNativeMethods) {
            iframeNativeMethods.restoreDocumentMeths(contentWindow, contentDocument);
            delete contentWindow[INTERNAL_PROPS.iframeNativeMethods];
        }
    }

    private _ensureIframeNativeMethods (iframe: HTMLIFrameElement | HTMLFrameElement): void {
        // NOTE: In Chrome, iframe with javascript protocol src raises the load event twice.
        // As a result, when the second load event is raised, we write the overridden methods to the native methods.
        // So, we need to save the native methods when the first load event is raised.
        // https://code.google.com/p/chromium/issues/detail?id=578812
        this._ensureIframeNativeMethodsForChrome(iframe);

        // NOTE: Restore native document methods for the iframe's document if it overrided earlier
        this._ensureIframeNativeMethodsForFirefox(iframe);
    }

    private _emitEvents (iframe: HTMLIFrameElement | HTMLFrameElement): void {
        // NOTE: Raise this internal event to eval the Hammerhead code script.
        this.emit(this.EVAL_HAMMERHEAD_SCRIPT_EVENT, { iframe });

        // NOTE: Raise this event to eval external code script.
        this.emit(this.EVAL_EXTERNAL_SCRIPT_EVENT, { iframe });

        // NOTE: Raise this event to eval the "task" script and to call the Hammerhead initialization method
        // and external script initialization code.
        this.emit(this.RUN_TASK_SCRIPT_EVENT, iframe);
    }

    private _raiseReadyToInitEvent (iframe: HTMLIFrameElement | HTMLFrameElement): void {
        if (!isIframeWithoutSrc(iframe))
            return;

        const contentWindow   = nativeMethods.contentWindowGetter.call(iframe);
        const contentDocument = nativeMethods.contentDocumentGetter.call(iframe);

        if (!IframeSandbox.isIframeInitialized(iframe)) {
            // NOTE: Even if iframe is not loaded (iframe.contentDocument.documentElement does not exist), we
            // still need to override the document.write method without initializing Hammerhead. This method can
            // be called before iframe is fully loaded, we should override it now.
            if (isNativeFunction(contentDocument.write))
                this.emit(this.IFRAME_DOCUMENT_CREATED_EVENT, { iframe });
        }
        else if (!contentWindow[IFRAME_WINDOW_INITED] && !contentWindow[INTERNAL_PROPS.hammerhead]) {
            this._ensureIframeNativeMethods(iframe);

            // NOTE: Ok, the iframe is fully loaded now, but Hammerhead is not injected.
            nativeMethods.objectDefineProperty(contentWindow, IFRAME_WINDOW_INITED, { value: true });

            this._emitEvents(iframe);

            contentWindow[INTERNAL_PROPS.processDomMethodName]();
        }
    }

    static isIframeInitialized (iframe: HTMLIFrameElement | HTMLFrameElement): boolean {
        const contentWindow   = nativeMethods.contentWindowGetter.call(iframe);
        const contentDocument = nativeMethods.contentDocumentGetter.call(iframe);

        if (isFirefox)
            return contentDocument.readyState !== 'uninitialized';

        if (!contentWindow[INTERNAL_PROPS.documentWasCleaned] && isIframeWithSrcdoc(iframe))
            // eslint-disable-next-line no-restricted-properties
            return contentWindow.location.href === 'about:srcdoc';

        return true;
    }

    iframeReadyToInitHandler (iframe: HTMLIFrameElement | HTMLFrameElement): void {
        // NOTE: We are using String.replace in order to avoid adding Mustache scripts on the client side.
        // If it is needed elsewhere in a certain place, we should consider using Mustache.
        const taskScriptTemplate       = settings.get().iframeTaskScriptTemplate;
        const escapeStringPatterns     = (str: string) => str.replace(/\$/g, '$$$$');
        const cookie                   = stringifyJSON(this._cookieSandbox.getCookie());
        const referer                  = settings.get().referer || this.window.location.toString();
        const iframeTaskScriptTemplate = stringifyJSON(taskScriptTemplate);
        const taskScript               = taskScriptTemplate
            .replace('{{{cookie}}}', escapeStringPatterns(cookie))
            .replace('{{{referer}}}', escapeStringPatterns(stringifyJSON(referer)))
            .replace('{{{iframeTaskScriptTemplate}}}', escapeStringPatterns(iframeTaskScriptTemplate));

        const contentWindow = nativeMethods.contentWindowGetter.call(iframe);

        contentWindow.eval.call(contentWindow, taskScript);
    }

    onIframeBeganToRun (iframe: HTMLIFrameElement | HTMLFrameElement): void {
        this._raiseReadyToInitEvent(iframe);
    }

    processIframe (el: HTMLIFrameElement | HTMLFrameElement): void {
        if (isShadowUIElement(el))
            return;

        if (isIframeElement(el) && nativeMethods.contentWindowGetter.call(el) ||
            isFrameElement(el) && nativeMethods.frameContentWindowGetter.call(el))
            this._raiseReadyToInitEvent(el);

        // NOTE: This handler exists for iframes without the src attribute. In some the browsers (e.g. Chrome)
        // the load event is triggering immediately after an iframe added to DOM. In other browsers,
        // the _raiseReadyToInitEvent function is calling in our function wrapper after an iframe added to DOM.
        this.nativeMethods.addEventListener.call(el, 'load', () => this._raiseReadyToInitEvent(el));
    }
}
