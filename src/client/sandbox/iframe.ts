import INTERNAL_PROPS from '../../processing/dom/internal-properties';
import SandboxBase from './base';
import settings from '../settings';
import nativeMethods from '../sandbox/native-methods';
import { isShadowUIElement, isIframeWithoutSrc, getTagName } from '../utils/dom';
import { isFirefox, isIE } from '../utils/browser';
// @ts-ignore
import * as JSON from 'json-hammerhead';
/*eslint-disable no-unused-vars*/
import NodeMutation from './node/mutation';
import CookieSandbox from './cookie';
/*eslint-enable no-unused-vars*/

const IFRAME_WINDOW_INITED = 'hammerhead|iframe-window-inited';

export default class IframeSandbox extends SandboxBase {
    RUN_TASK_SCRIPT_EVENT: string = 'hammerhead|event|run-task-script';
    EVAL_HAMMERHEAD_SCRIPT_EVENT: string = 'hammerhead|event|eval-hammerhead-script';
    EVAL_EXTERNAL_SCRIPT_EVENT: string = 'hammerhead|event|eval-external-script';
    IFRAME_DOCUMENT_CREATED_EVENT: string = 'hammerhead|event|iframe-document-created';

    constructor (private readonly _nodeMutation: NodeMutation, //eslint-disable-line no-unused-vars
                 private readonly _cookieSandbox: CookieSandbox) { //eslint-disable-line no-unused-vars
        super();

        this.on(this.RUN_TASK_SCRIPT_EVENT, this.iframeReadyToInitHandler);
        this._nodeMutation.on(this._nodeMutation.IFRAME_ADDED_TO_DOM_EVENT, (iframe: HTMLIFrameElement) => this.processIframe(iframe));
    }

    private _ensureIframeNativeMethodsForIE (iframe: HTMLIFrameElement) {
        // NOTE: Restore native document methods for the iframe's document if it overridden earlier (IE9, IE10 only)
        // https://github.com/DevExpress/testcafe-hammerhead/issues/279
        const contentWindow       = nativeMethods.contentWindowGetter.call(iframe);
        const contentDocument     = nativeMethods.contentDocumentGetter.call(iframe);
        const iframeNativeMethods = contentWindow[INTERNAL_PROPS.iframeNativeMethods];

        if (iframeNativeMethods) {
            iframeNativeMethods.restoreDocumentMeths(contentWindow, contentDocument);
            delete contentWindow[INTERNAL_PROPS.iframeNativeMethods];
        }
    }

    private _emitEvents (iframe: HTMLIFrameElement) {
        // NOTE: Raise this internal event to eval the Hammerhead code script.
        this.emit(this.EVAL_HAMMERHEAD_SCRIPT_EVENT, { iframe });

        // NOTE: Raise this event to eval external code script.
        this.emit(this.EVAL_EXTERNAL_SCRIPT_EVENT, { iframe });

        // NOTE: Raise this event to eval the "task" script and to call the Hammerhead initialization method
        // and external script initialization code.
        this.emit(this.RUN_TASK_SCRIPT_EVENT, iframe);
    }

    private _raiseReadyToInitEvent (iframe: HTMLIFrameElement) {
        if (!isIframeWithoutSrc(iframe))
            return;

        const contentWindow   = nativeMethods.contentWindowGetter.call(iframe);
        const contentDocument = nativeMethods.contentDocumentGetter.call(iframe);

        if (!IframeSandbox.isIframeInitialized(iframe)) {
            // NOTE: Even if iframe is not loaded (iframe.contentDocument.documentElement does not exist), we
            // still need to override the document.write method without initializing Hammerhead. This method can
            // be called before iframe is fully loaded, we should override it now.
            if (contentDocument.write.toString() === this.nativeMethods.documentWrite.toString())
                this.emit(this.IFRAME_DOCUMENT_CREATED_EVENT, { iframe });
        }
        else if (!contentWindow[IFRAME_WINDOW_INITED] && !contentWindow[INTERNAL_PROPS.hammerhead]) {
            this._ensureIframeNativeMethodsForIE(iframe);

            // NOTE: Ok, the iframe is fully loaded now, but Hammerhead is not injected.
            nativeMethods.objectDefineProperty(contentWindow, IFRAME_WINDOW_INITED, { value: true });

            this._emitEvents(iframe);

            contentWindow[INTERNAL_PROPS.processDomMethodName]();
        }
    }

    static isIframeInitialized (iframe: HTMLIFrameElement) {
        const contentWindow           = nativeMethods.contentWindowGetter.call(iframe);
        const contentDocument         = nativeMethods.contentDocumentGetter.call(iframe);
        const isFFIframeUninitialized = isFirefox && contentWindow.document.readyState === 'uninitialized';

        return !isFFIframeUninitialized && !!contentDocument.documentElement ||
               isIE && contentWindow[INTERNAL_PROPS.documentWasCleaned];
    }

    static isWindowInited (window: Window) {
        // @ts-ignore
        return window[IFRAME_WINDOW_INITED];
    }

    iframeReadyToInitHandler (iframe: HTMLIFrameElement) {
        // NOTE: We are using String.replace in order to avoid adding Mustache scripts on the client side.
        // If it is needed elsewhere in a certain place, we should consider using Mustache.
        const taskScriptTemplate       = settings.get().iframeTaskScriptTemplate;
        const escapeStringPatterns     = (str: string) => str.replace(/\$/g, '$$$$');
        const cookie                   = JSON.stringify(this._cookieSandbox.getCookie());
        const referer                  = settings.get().referer || this.window.location.toString();
        const iframeTaskScriptTemplate = JSON.stringify(taskScriptTemplate);
        const taskScript               = taskScriptTemplate
            .replace('{{{cookie}}}', escapeStringPatterns(cookie))
            .replace('{{{referer}}}', escapeStringPatterns(JSON.stringify(referer)))
            .replace('{{{iframeTaskScriptTemplate}}}', escapeStringPatterns(iframeTaskScriptTemplate));

        const contentWindow = nativeMethods.contentWindowGetter.call(iframe);

        contentWindow.eval.call(contentWindow, taskScript);
    }

    onIframeBeganToRun (iframe: HTMLIFrameElement) {
        this._raiseReadyToInitEvent(iframe);
    }

    processIframe (el: HTMLIFrameElement) {
        if (isShadowUIElement(el))
            return;

        const tagName = getTagName(el);

        if (tagName === 'iframe' && nativeMethods.contentWindowGetter.call(el) ||
            tagName === 'frame' && nativeMethods.frameContentWindowGetter.call(el))
            this._raiseReadyToInitEvent(el);

        // NOTE: This handler exists for iframes without the src attribute. In some the browsers (e.g. Chrome)
        // the load event is triggering immediately after an iframe added to DOM. In other browsers,
        // the _raiseReadyToInitEvent function is calling in our function wrapper after an iframe added to DOM.
        this.nativeMethods.addEventListener.call(el, 'load', () => this._raiseReadyToInitEvent(el));
    }
}
