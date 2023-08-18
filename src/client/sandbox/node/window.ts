/*global navigator*/
import SandboxBase from '../base';
import ShadowUI from '../shadow-ui';
import nativeMethods from '../native-methods';
import EventSimulator from '../event/simulator';
import { processScript } from '../../../processing/script';
import styleProcessor from '../../../processing/style';
import * as destLocation from '../../utils/destination-location';
import { cleanUpHtml, processHtml } from '../../utils/html';
import {
    parseUrl,
    getProxyUrl,
    parseProxyUrl,
    convertToProxyUrl,
    stringifyResourceType,
    resolveUrlAsDest,
    getDestinationUrl,
    getScope,
} from '../../utils/url';

import {
    isFirefox,
    isChrome,
    isAndroid,
} from '../../utils/browser';

import {
    isCrossDomainWindows,
    isImgElement,
    isBlob,
    isWebSocket,
    isWindow,
    isPerformanceNavigationTiming,
    isTextEditableElementAndEditingAllowed,
    isShadowUIElement,
    isScriptElement,
    isStyleElement,
    findDocument,
    isBodyElement,
    isHtmlElement,
    isTitleElement,
    getFrameElement,
    isIframeWindow,
} from '../../utils/dom';

import { isFunction, isPrimitiveType } from '../../utils/types';
import INTERNAL_ATTRS from '../../../processing/dom/internal-attributes';
import INTERNAL_PROPS from '../../../processing/dom/internal-properties';
import constructorIsCalledWithoutNewKeyword from '../../utils/constructor-is-called-without-new-keyword';
import INSTRUCTION from '../../../processing/script/instruction';
import Promise from 'pinkie';
import getMimeType from '../../utils/get-mime-type';
import {
    overrideDescriptor,
    overrideFunction,
    overrideConstructor,
} from '../../utils/overriding';
import { HASH_RE, isValidUrl } from '../../../utils/url';
import UploadSandbox from '../upload';
import { getAnchorProperty, setAnchorProperty } from '../code-instrumentation/properties/anchor';
import CodeInstrumentation from '../code-instrumentation';
import { XLINK_NAMESPACE } from '../../../processing/dom/namespaces';
import urlResolver from '../../utils/url-resolver';
import { remove as removeProcessingHeader } from '../../../processing/script/header';
import DOMMutationTracker from './live-node-list/dom-mutation-tracker';
import { getAttributes } from './attributes';
import { replaceProxiedUrlsInStack } from '../../../utils/stack-processing';
import NodeSandbox from './index';
import EventSandbox from '../event';
import NodeMutation from './mutation';
import MessageSandbox from '../event/message';
import Listeners from '../event/listeners';
import ElementEditingWatcher from '../event/element-editing-watcher';
import ChildWindowSandbox from '../child-window';
import settings from '../../settings';
import DefaultTarget from '../child-window/default-target';
import { getNativeQuerySelectorAll } from '../../utils/query-selector';
import DocumentTitleStorageInitializer from './document/title-storage-initializer';
import { SET_SERVICE_WORKER_SETTINGS } from '../../worker/set-settings-command';
import getCorrectedTargetForSinglePageMode from '../../utils/get-corrected-target-for-single-page-mode';

type BlobProcessingSettings = {
    sessionId: string;
    windowId: string;
    origin: string;
};

const INSTRUCTION_VALUES = (() => {
    const values = [];
    const keys   = nativeMethods.objectKeys(INSTRUCTION);

    for (const key of keys)
        values.push(INSTRUCTION[key]);

    return values;
})();

const HTTP_PROTOCOL_RE = /^http/i;

const ALLOWED_SERVICE_WORKER_PROTOCOLS  = ['https:', 'wss:', 'file:'];
const ALLOWED_SERVICE_WORKER_HOST_NAMES = ['localhost', '127.0.0.1'];
const JAVASCRIPT_MIME_TYPES             = ['text/javascript', 'application/javascript', 'application/x-javascript'];

// NOTE: SVGAnimatedString prototype does not have a way to access the appropriate svg element.
// This is why we use this property to store svg element for which animVal and baseVal properties were set.
// It allows us to change the href-hammerhead-stored-value when it needs.
const CONTEXT_SVG_IMAGE_ELEMENT = 'hammerhead|context-svg-image-element';

const SANDBOX_DOM_TOKEN_LIST           = 'hammerhead|sandbox-dom-token-list';
const SANDBOX_DOM_TOKEN_LIST_OWNER     = 'hammerhead|sandbox-dom-token-list-owner';
const SANDBOX_DOM_TOKEN_LIST_UPDATE_FN = 'hammerhead|sandbox-dom-token-list-update';

const IS_PROXY_OBJECT_INTERNAL_PROP_NAME  = 'hammerhead|is-proxy-object|internal-prop-name';
const IS_PROXY_OBJECT_INTERNAL_PROP_VALUE = 'hammerhead|is-proxy-object|internal-prop-value';

const PROXY_HANDLER_FLAG = 'hammerhead|proxy-handler-flag';

const NO_STACK_TRACE_AVAILABLE_MESSAGE        = 'No stack trace available';
const DEFAULT_UNHANDLED_REJECTION_REASON_NAME = 'Error';

const TRACKED_EVENTS = ['error', 'unhandledrejection', 'hashchange'];

export default class WindowSandbox extends SandboxBase {
    nodeSandbox: NodeSandbox;
    messageSandbox: MessageSandbox;
    listenersSandbox: Listeners;
    elementEditingWatcher: ElementEditingWatcher;
    eventSimulator: EventSimulator;
    uploadSandbox: UploadSandbox;
    shadowUI: ShadowUI;
    nodeMutation: NodeMutation;

    UNCAUGHT_JS_ERROR_EVENT = 'hammerhead|event|uncaught-js-error';
    UNHANDLED_REJECTION_EVENT = 'hammerhead|event|unhandled-rejection';
    HASH_CHANGE_EVENT = 'hammerhead|event|hashchange-event';

    SANDBOX_DOM_TOKEN_LIST_UPDATE_FN: any;

    constructor (nodeSandbox: NodeSandbox,
        eventSandbox: EventSandbox,
        uploadSandbox: UploadSandbox,
        nodeMutation: NodeMutation,
        private readonly _childWindowSandbox: ChildWindowSandbox,
        private readonly _documentTitleStorageInitializer?: DocumentTitleStorageInitializer) {
        super();

        this.nodeSandbox           = nodeSandbox;
        this.messageSandbox        = eventSandbox.message;
        this.listenersSandbox      = eventSandbox.listeners;
        this.elementEditingWatcher = eventSandbox.elementEditingWatcher;
        this.eventSimulator        = eventSandbox.eventSimulator;
        this.uploadSandbox         = uploadSandbox;
        this.shadowUI              = nodeSandbox.shadowUI;
        this.nodeMutation          = nodeMutation;

        this.SANDBOX_DOM_TOKEN_LIST_UPDATE_FN = SANDBOX_DOM_TOKEN_LIST_UPDATE_FN;
    }

    static isProxyObject (obj: any): boolean {
        try {
            return obj[IS_PROXY_OBJECT_INTERNAL_PROP_NAME] === IS_PROXY_OBJECT_INTERNAL_PROP_VALUE;
        }
        catch (e) {
            return false;
        }
    }

    handleEvent (event) {
        if (event.defaultPrevented)
            return;

        if (event.type === 'unhandledrejection')
            this.raiseUncaughtJsErrorEvent(this.UNHANDLED_REJECTION_EVENT, event, this.window);
        else if (event.type === 'error') {
            if (event.message.indexOf('NS_ERROR_NOT_INITIALIZED') !== -1)
                event.preventDefault();
            else
                this.raiseUncaughtJsErrorEvent(this.UNCAUGHT_JS_ERROR_EVENT, event, window);
        }
        else if (event.type === 'hashchange')
            this.emit(this.HASH_CHANGE_EVENT);
    }

    private raiseUncaughtJsErrorEvent (type: string, event: ErrorEvent | PromiseRejectionEvent, window: Window): void {
        if (isCrossDomainWindows(window, window.top))
            return;

        const sendToTopWindow = isIframeWindow(window);
        const pageUrl         = destLocation.get();
        let msg               = null;
        let stack             = null;

        if (type === this.UNHANDLED_REJECTION_EVENT) {
            msg   = WindowSandbox.formatUnhandledRejectionReason((event as PromiseRejectionEvent).reason);
            stack = (event as PromiseRejectionEvent).reason && (event as PromiseRejectionEvent).reason.stack;
        }
        else if (type === this.UNCAUGHT_JS_ERROR_EVENT) {
            msg   = (event as ErrorEvent).error ? (event as ErrorEvent).error.message : (event as ErrorEvent).message;
            stack = (event as ErrorEvent).error && (event as ErrorEvent).error.stack;
        }

        stack = WindowSandbox.prepareStack(msg, stack);
        stack = replaceProxiedUrlsInStack(stack);

        if (sendToTopWindow) {
            this.emit(type, { msg, pageUrl, stack, inIframe: true });
            this.messageSandbox.sendServiceMsg({ msg, pageUrl, stack, cmd: type }, window.top);
        }
        else
            this.emit(type, { msg, pageUrl, stack });
    }

    private static formatUnhandledRejectionReason (reason: any): string {
        if (!isPrimitiveType(reason)) {
            if (reason instanceof (nativeMethods.Error as any)) {
                const name = reason.name || DEFAULT_UNHANDLED_REJECTION_REASON_NAME;

                return `${name}: ${reason.message}`;
            }

            return nativeMethods.objectToString.call(reason);
        }

        return String(reason);
    }

    private static prepareStack (msg: string, stack: string): string {
        // NOTE: Firefox does not include an error message in a stack trace (unlike other browsers)
        // It is possible to get a stack trace for unhandled Promise rejections only if Promise is rejected with the 'Error' instance value.
        // This is why we should convert the stack to a common format.
        if (!stack || stack.indexOf(msg) === -1) {
            stack = stack || `    ${NO_STACK_TRACE_AVAILABLE_MESSAGE}`;

            return `${msg}\n${stack}`;
        }

        return stack;
    }

    attach (window): void {
        super.attach(window);

        nativeMethods.arrayForEach.call(TRACKED_EVENTS, (event: string) => {
            this.reattachHandler(event);
        });

        this.initElementListening();

        this.overrideEventPropDescriptor('error', nativeMethods.winOnErrorSetter);
        this.overrideEventPropDescriptor('hashchange', nativeMethods.winOnHashChangeSetter);

        if (nativeMethods.winOnUnhandledRejectionSetter)
            this.overrideEventPropDescriptor('unhandledrejection', nativeMethods.winOnUnhandledRejectionSetter);

        this.addMessageSandBoxListeners();

        if (window.EventTarget)
            this.overrideListenerMethodsInEventTarget();

        this.overrideFilesInHTMLInputElement();

        if (window.MutationObserver)
            this.overrideMutationObserverInWindow();

        this.overrideLengthInHTMLCollection();
        this.overrideLengthInNodeList();
        this.overrideChildElementCountInElement();

        if (window.DOMParser)
            this.overrideParseFromStringInDOMParser();

        this.overrideFirstChildInNode();
        this.overrideFirstElementChildInElement();
        this.overrideLastChildInNode();
        this.overrideLastElementChildInElement();
        this.overrideNextSiblingInNode();
        this.overridePreviousSiblingInNode();
        this.overrideNextElementSiblingInElement();
        this.overridePreviousElementSiblingInElement();
        this.overrideInnerHTMLInElement(settings.nativeAutomation);
        this.overrideOuterHTMLInElement();
        this.overrideInnerTextInHTMLElement(settings.nativeAutomation);
        this.overrideAttributesInElement();
        this.overrideNextSiblingInMutationRecord();
        this.overridePreviousSiblingInMutationRecord();
        this.overrideValueInHTMLInputElement();
        this.overrideOpenInWindow();

        if (settings.nativeAutomation)
            return;

        if (this._documentTitleStorageInitializer)
            this.overrideTextInHTMLTitleElement();

        this.overrideDrawImageInCanvasRenderingContext2D();

        if (nativeMethods.objectAssign)
            this.overrideAssignInObject();

        if (window.FontFace)
            this.overrideFontFaceInWindow();

        if (window.Worker)
            this.overrideWorkerInWindow();

        if (window.Blob)
            this.overrideBlobInWindow();

        this.overrideFileInWindow();

        if (window.EventSource)
            this.overrideEventSourceInWindow();

        if (window.Proxy)
            this.overrideProxyInWindow();

        if (nativeMethods.registerServiceWorker)
            this.overrideRegisterInServiceWorker();

        if (nativeMethods.getRegistrationServiceWorker)
            this.overrideGetRegistrationInServiceWorker();

        if (window.Range.prototype.createContextualFragment)
            this.overrideCreateContextualFragmentInRange();

        this.overrideImageInWindow();

        this.overrideFunctionInWindow();

        this.overrideToStringInFunction();

        if (isFunction(window.history.pushState) && isFunction(window.history.replaceState)) {
            this.overrideMethodInHistory('pushState', nativeMethods.historyPushState);
            this.overrideMethodInHistory('replaceState', nativeMethods.historyReplaceState);
        }

        if (nativeMethods.sendBeacon)
            this.overrideSendBeaconInNavigator();

        if (window.navigator.registerProtocolHandler)
            this.overrideRegisterProtocolHandlerInNavigator();

        if (window.FormData)
            this.overrideAppendInFormData();

        if (window.WebSocket) {
            this.overrideWebSocketInWindow();

            if (nativeMethods.webSocketUrlGetter)
                this.overrideUrlInWebSocket();
        }

        this.overrideOriginInMessageEvent();

        if (nativeMethods.performanceEntryNameGetter)
            this.overrideNameInPerformanceEntry();

        // NOTE: HTMLInputElement raises the `change` event on `disabled` only in Chrome
        if (isChrome)
            this.overrideDisabledInHTMLInputElement();

        this.overrideRequiredInHTMLInputElement();

        this.overrideValueInHTMLTextAreaElement();

        this.overrideUrlAttrDescriptors('data', [window.HTMLObjectElement]);

        this.overrideUrlAttrDescriptors('src', [
            window.HTMLImageElement,
            window.HTMLScriptElement,
            window.HTMLEmbedElement,
            window.HTMLSourceElement,
            window.HTMLMediaElement,
            window.HTMLInputElement,
            window.HTMLFrameElement,
            window.HTMLIFrameElement,
        ]);

        this.overrideUrlAttrDescriptors('action', [window.HTMLFormElement]);

        this.overrideUrlAttrDescriptors('formAction', [
            window.HTMLInputElement,
            window.HTMLButtonElement,
        ]);

        this.overrideUrlAttrDescriptors('href', [
            window.HTMLAnchorElement,
            window.HTMLLinkElement,
            window.HTMLAreaElement,
            window.HTMLBaseElement,
        ]);

        if (nativeMethods.htmlManifestGetter)
            this.overrideUrlAttrDescriptors('manifest', [window.HTMLHtmlElement]);

        this.overrideAttrDescriptorsInElement('target', [
            window.HTMLAnchorElement,
            window.HTMLFormElement,
            window.HTMLAreaElement,
            window.HTMLBaseElement,
        ]);

        this.overrideAttrDescriptorsInElement('formTarget', [
            window.HTMLInputElement,
            window.HTMLButtonElement,
        ]);

        this.overrideAttrDescriptorsInElement('autocomplete', [window.HTMLInputElement]);
        this.overrideAttrDescriptorsInElement('httpEquiv', [window.HTMLMetaElement]);
        this.overrideAttrDescriptorsInElement('integrity', [window.HTMLScriptElement]);
        this.overrideAttrDescriptorsInElement('integrity', [window.HTMLLinkElement]);
        this.overrideAttrDescriptorsInElement('rel', [window.HTMLLinkElement]);

        if (nativeMethods.linkAsSetter)
            this.overrideAttrDescriptorsInElement('as', [window.HTMLLinkElement]);

        this.overrideTypeInHTMLInputElement();

        this.overrideSandboxInHTMLIFrameElement();

        if (nativeMethods.iframeSrcdocGetter)
            this.overrideSrcdocInHTMLIFrameElement();

        this.overrideUrlPropInHTMLAnchorElement('port', nativeMethods.anchorPortGetter, nativeMethods.anchorPortSetter);
        this.overrideUrlPropInHTMLAnchorElement('host', nativeMethods.anchorHostGetter, nativeMethods.anchorHostSetter);
        this.overrideUrlPropInHTMLAnchorElement('hostname', nativeMethods.anchorHostnameGetter, nativeMethods.anchorHostnameSetter);
        this.overrideUrlPropInHTMLAnchorElement('pathname', nativeMethods.anchorPathnameGetter, nativeMethods.anchorPathnameSetter);
        this.overrideUrlPropInHTMLAnchorElement('protocol', nativeMethods.anchorProtocolGetter, nativeMethods.anchorProtocolSetter);
        this.overrideUrlPropInHTMLAnchorElement('search', nativeMethods.anchorSearchGetter, nativeMethods.anchorSearchSetter);

        this.overrideHrefInSVGImageElement();
        this.overrideBaseValInSVGAnimatedString();
        this.overrideAnimValInSVGAnimatedString();

        if (nativeMethods.anchorOriginGetter)
            this.overrideOriginInHTMLAnchorElement();

        this.overrideHrefInStyleSheet();

        if (nativeMethods.nodeBaseURIGetter)
            this.overrideBaseURIInNode();

        this.overrideTextInHTMLScriptElement();
        this.overrideTextInHTMLAnchorElement();
        this.overrideTextContentInNode();
        this.overrideMethodInDOMTokenList('add', nativeMethods.tokenListAdd);
        this.overrideMethodInDOMTokenList('remove', nativeMethods.tokenListRemove);
        this.overrideMethodInDOMTokenList('toggle', nativeMethods.tokenListToggle);

        if (nativeMethods.tokenListReplace)
            this.overrideMethodInDOMTokenList('replace', nativeMethods.tokenListReplace);

        if (nativeMethods.tokenListSupports)
            this.overrideSupportsInDOMTokenList();

        if (nativeMethods.tokenListValueSetter)
            this.overrideValueInDOMTokenList();

        this.overrideCreateHTMLDocumentInDOMImplementation();

        if (nativeMethods.windowOriginGetter)
            this.overrideOriginInWindow();
    }

    private initElementListening () {
        this.listenersSandbox.initElementListening(this.window, TRACKED_EVENTS);
        this.listenersSandbox.on(this.listenersSandbox.EVENT_LISTENER_ATTACHED_EVENT, e => {
            if (e.el !== this.window)
                return;

            if (TRACKED_EVENTS.indexOf(e.eventType) !== -1)
                this.reattachHandler(e.eventType);
        });
    }

    private reattachHandler (eventName: string): void {
        const nativeAddEventListener    = nativeMethods.addEventListener;
        const nativeRemoveEventListener = nativeMethods.removeEventListener;

        nativeRemoveEventListener.call(this.window, eventName, this);
        nativeAddEventListener.call(this.window, eventName, this);
    }

    private addMessageSandBoxListeners () {
        const messageSandbox = this.messageSandbox;
        const windowSandbox  = this;

        messageSandbox.on(messageSandbox.SERVICE_MSG_RECEIVED_EVENT, e => {
            const { msg, pageUrl, stack, cmd } = e.message;

            if (cmd === this.UNCAUGHT_JS_ERROR_EVENT || cmd === this.UNHANDLED_REJECTION_EVENT)
                windowSandbox.emit(cmd, { msg, pageUrl, stack });
        });
    }

    private overrideEventPropDescriptor (eventName: string, nativePropSetter): void {
        const windowSandbox   = this;

        //@ts-ignore
        overrideDescriptor(this.window, 'on' + eventName, {
            getter: null,
            setter: handler => {
                nativePropSetter.call(windowSandbox.window, handler);

                this.listenersSandbox.emit(this.listenersSandbox.EVENT_LISTENER_ATTACHED_EVENT, {
                    el:        windowSandbox.window,
                    listener:  handler,
                    eventType: eventName,
                });
            },
        });
    }

    private overrideDrawImageInCanvasRenderingContext2D () {
        const windowSandbox = this;

        overrideFunction(this.window.CanvasRenderingContext2D.prototype, 'drawImage', function (this: CanvasRenderingContext2D, ...args) {
            let image = args[0];

            if (isImgElement(image) && !image[INTERNAL_PROPS.forceProxySrcForImage]) {
                const src = nativeMethods.imageSrcGetter.call(image);

                if (destLocation.sameOriginCheck(location.toString(), src)) {
                    image = nativeMethods.createElement.call(windowSandbox.window.document, 'img');

                    nativeMethods.imageSrcSetter.call(image, getProxyUrl(src));

                    args[0] = image;

                    if (!image.complete) {
                        nativeMethods.addEventListener.call(image, 'load',
                            () => nativeMethods.canvasContextDrawImage.apply(this, args));
                    }
                }
            }

            return nativeMethods.canvasContextDrawImage.apply(this, args);
        });
    }

    private overrideAssignInObject () {
        const windowSandbox = this;

        overrideFunction(this.window.Object, 'assign', function (this: ObjectConstructor, target: object, ...sources: any[]) {
            let args         = [target] as [object, ...any[]];
            const targetType = typeof target;

            if (target && (targetType === 'object' || targetType === 'function') && sources.length) {
                for (const source of sources) {
                    const sourceType = typeof source;

                    if (!source || sourceType !== 'object' && sourceType !== 'function') {
                        nativeMethods.objectAssign.call(this, target, source);
                        continue;
                    }

                    const sourceSymbols = nativeMethods.objectGetOwnPropertySymbols.call(windowSandbox.window.Object, source);
                    const sourceKeys    = nativeMethods.arrayConcat.call(
                        nativeMethods.objectKeys.call(windowSandbox.window.Object, source),
                        sourceSymbols
                    );

                    for (const key of sourceKeys)
                        windowSandbox.window[INSTRUCTION.setProperty](target, key, source[key]);
                }
            }
            else
                args = nativeMethods.arrayConcat.call(args, sources);

            return nativeMethods.objectAssign.apply(this, args);
        });
    }

    private overrideOpenInWindow () {
        const windowSandbox  = this;

        overrideFunction(this.window, 'open', function (...args: [string?, string?, string?, boolean?]) {
            args[0] = windowSandbox.getWindowOpenUrl(args[0]);
            args[1] = windowSandbox.getWindowOpenTarget(args[1]);

            return windowSandbox._childWindowSandbox.handleWindowOpen(windowSandbox.window, args);
        });
    }

    private getWindowOpenTarget (originTarget: string): string {
        if (originTarget)
            return getCorrectedTargetForSinglePageMode(String(originTarget));

        return settings.get().allowMultipleWindows ? DefaultTarget.windowOpen : '_self';
    }

    private getWindowOpenUrl (originUrl: string): string {
        if (settings.nativeAutomation)
            return originUrl;

        return getProxyUrl(originUrl);
    }

    private overrideFontFaceInWindow () {
        overrideConstructor(this.window, 'FontFace', (family, source, descriptors) => {
            source = styleProcessor.process(source, convertToProxyUrl);

            return new nativeMethods.FontFace(family, source, descriptors);
        });
    }

    private overrideWorkerInWindow () {
        overrideConstructor(this.window, 'Worker', function WorkerWrapper (this: Worker, ...args: [string | URL, WorkerOptions?]) {
            const isCalledWithoutNewKeyword = constructorIsCalledWithoutNewKeyword(this, WorkerWrapper);

            if (arguments.length === 0)
                // @ts-ignore
                return isCalledWithoutNewKeyword ? nativeMethods.Worker() : new nativeMethods.Worker();

            if (isCalledWithoutNewKeyword)
                return nativeMethods.Worker.apply(this, args);

            let scriptURL = args[0];

            if (typeof scriptURL !== 'string')
                scriptURL = String(scriptURL);

            scriptURL = getProxyUrl(scriptURL, { resourceType: stringifyResourceType({ isScript: true }) });

            const worker = arguments.length === 1
                ? new nativeMethods.Worker(scriptURL)
                : new nativeMethods.Worker(scriptURL, args[1]);

            return worker;
        }, true);
    }

    private overrideBlobInWindow () {
        overrideConstructor(this.window, 'Blob', function (array, opts) {
            if (arguments.length === 0)
                return new nativeMethods.Blob();

            if (WindowSandbox.isProcessableBlob(array, opts))
                array = [processScript(array.join(''), true, false, convertToProxyUrl, void 0, settings.nativeAutomation, WindowSandbox.getBlobProcessingSettings())];

            return new nativeMethods.Blob(array, opts);
        });
    }

    private overrideFileInWindow () {
        overrideConstructor(this.window, 'File', function (array, fileName, opts) {
            if (arguments.length === 0)
                return new nativeMethods.File();

            if (WindowSandbox.isProcessableBlob(array, opts))
                array = [processScript(array.join(''), true, false, convertToProxyUrl, void 0, settings.nativeAutomation, WindowSandbox.getBlobProcessingSettings())];

            return new nativeMethods.File(array, fileName, opts);
        });
    }

    private static isProcessableBlob (array, opts): boolean {
        const type = opts && opts.type && opts.type.toString().toLowerCase() || getMimeType(array);

        // NOTE: If we cannot identify the content type of data, we're trying to process it as a script
        // (in the case of the "Array<string | number | boolean>" blob parts array: GH-2115).
        // Unfortunately, we do not have the ability to exactly identify a script. That's why we make such
        // an assumption. We cannot solve this problem at the Worker level either, because the operation of
        // creating a new Blob instance is asynchronous. (GH-231)
        return (!type || JAVASCRIPT_MIME_TYPES.indexOf(type) !== -1) && WindowSandbox.isProcessableBlobParts(array);
    }

    private static isProcessableBlobParts (parts: any[]): boolean {
        let hasStringItem = false;

        for (const item of parts) {
            if (!hasStringItem && typeof item === 'string') {
                hasStringItem = true;

                continue;
            }

            if (typeof item !== 'string' && typeof item !== 'number' && typeof item !== 'boolean')
                return false;
        }

        return hasStringItem;
    }

    private static getBlobProcessingSettings (): BlobProcessingSettings {
        return {
            sessionId: settings.get().sessionId,
            windowId:  settings.get().windowId,
            origin:    destLocation.getOriginHeader(),
        };
    }

    private overrideEventSourceInWindow () {
        overrideConstructor(this.window, 'EventSource', function (url, opts) {
            if (arguments.length) {
                const proxyUrl = getProxyUrl(url, { resourceType: stringifyResourceType({ isEventSource: true }) });

                if (arguments.length === 1)
                    return new nativeMethods.EventSource(proxyUrl);

                return new nativeMethods.EventSource(proxyUrl, opts);
            }

            return new nativeMethods.EventSource();
        });

        //@ts-ignore
        this.window.EventSource.CONNECTING = nativeMethods.EventSource.CONNECTING;
        //@ts-ignore
        this.window.EventSource.OPEN = nativeMethods.EventSource.OPEN;
        //@ts-ignore
        this.window.EventSource.CLOSED = nativeMethods.EventSource.CLOSED;
    }

    private overrideMutationObserverInWindow () {
        overrideConstructor(this.window, 'MutationObserver', callback => {
            const wrapper = function (this: MutationObserver, mutations: MutationRecord[]) {
                const result = [];

                for (const mutation of mutations) {
                    if (!ShadowUI.isShadowUIMutation(mutation))
                        result.push(mutation);
                }

                if (result.length)
                    callback.call(this, result, this);
            };

            return new nativeMethods.MutationObserver(wrapper);
        });

        //@ts-ignore
        if (this.window.WebKitMutationObserver)
            //@ts-ignore
            this.window.WebKitMutationObserver = this.window.MutationObserver;
    }

    private overrideProxyInWindow () {
        const windowSandbox = this;

        overrideConstructor(this.window, 'Proxy', function (target, handler) {
            if (handler.get && !handler.get[PROXY_HANDLER_FLAG]) {
                const storedGet = handler.get;

                handler.get = function (getterTarget, name, receiver) {
                    if (name === IS_PROXY_OBJECT_INTERNAL_PROP_NAME)
                        return IS_PROXY_OBJECT_INTERNAL_PROP_VALUE;
                    else if (INSTRUCTION_VALUES.indexOf(name) > -1)
                        return windowSandbox.window[name];

                    const result = storedGet.call(this, getterTarget, name, receiver);

                    if (name === 'eval' && result[CodeInstrumentation.WRAPPED_EVAL_FN])
                        return result[CodeInstrumentation.WRAPPED_EVAL_FN];

                    return result;
                };

                nativeMethods.objectDefineProperty(handler.get, PROXY_HANDLER_FLAG, { value: true, enumerable: false });
            }

            return new nativeMethods.Proxy(target, handler);
        });

        this.window.Proxy.revocable = nativeMethods.Proxy.revocable;
    }

    private overrideRegisterInServiceWorker () {
        const windowSandbox = this;

        overrideFunction(this.window.navigator.serviceWorker, 'register', (...args) => {
            const [url, opts] = args;

            if (typeof url === 'string') {
                if (WindowSandbox.isSecureOrigin(url)) {
                    // NOTE: We cannot create an instance of the DOMException in the Android 6.0 browsers.
                    // The 'TypeError: Illegal constructor' error is raised if we try to call the constructor.
                    return Promise.reject(isAndroid
                        ? new Error('Only secure origins are allowed.')
                        : new DOMException('Only secure origins are allowed.', 'SecurityError'));
                }

                args[0] = getProxyUrl(url, { resourceType: stringifyResourceType({ isServiceWorker: true }) });
            }

            args[1] = { scope: '/' };

            return nativeMethods.registerServiceWorker.apply(windowSandbox.window.navigator.serviceWorker, args)
                .then(reg => new Promise(function (resolve, reject) {
                    const parsedProxyUrl = parseProxyUrl(args[0]);
                    const serviceWorker  = reg.installing;

                    if (!serviceWorker) {
                        resolve(reg);

                        return;
                    }

                    const channel = new nativeMethods.MessageChannel();

                    serviceWorker.postMessage({
                        cmd:          SET_SERVICE_WORKER_SETTINGS,
                        currentScope: getScope(url),
                        optsScope:    getScope(opts && opts.scope),
                        protocol:     parsedProxyUrl.destResourceInfo.protocol, // eslint-disable-line no-restricted-properties
                        host:         parsedProxyUrl.destResourceInfo.host, // eslint-disable-line no-restricted-properties
                    }, [channel.port1]);

                    channel.port2.onmessage = (e) => {
                        const data = nativeMethods.messageEventDataGetter.call(e);

                        if (data.error)
                            reject(new Error(data.error));
                        else
                            resolve(reg);
                    };
                }));
        });
    }


    private static isSecureOrigin (url: string): boolean {
        // NOTE: https://www.chromium.org/Home/chromium-security/prefer-secure-origins-for-powerful-new-features
        const parsedUrl = parseUrl(resolveUrlAsDest(url));

        /*eslint-disable no-restricted-properties*/
        return ALLOWED_SERVICE_WORKER_PROTOCOLS.indexOf(parsedUrl.protocol) === -1 &&
               ALLOWED_SERVICE_WORKER_HOST_NAMES.indexOf(parsedUrl.hostname) === -1;
        /*eslint-enable no-restricted-properties*/
    }

    private overrideGetRegistrationInServiceWorker () {
        const windowSandbox = this;

        overrideFunction(this.window.navigator.serviceWorker, 'getRegistration', (...args) => {
            if (typeof args[0] === 'string')
                args[0] = '/';

            return nativeMethods.getRegistrationServiceWorker.apply(windowSandbox.window.navigator.serviceWorker, args);
        });
    }

    private overrideCreateContextualFragmentInRange () {
        const nodeSandbox = this.nodeSandbox;

        overrideFunction(this.window.Range.prototype, 'createContextualFragment', function (this: Range, ...args) {
            const tagString = args[0];

            if (typeof tagString === 'string') {
                args[0] = processHtml(tagString, {
                    processedContext: this.startContainer && this.startContainer[INTERNAL_PROPS.processedContext],
                });
            }

            const fragment = nativeMethods.createContextualFragment.apply(this, args);

            nodeSandbox.processNodes(fragment);

            return fragment;
        });
    }

    private overrideListenerMethodsInEventTarget () {
        const overriddenMethods = this.listenersSandbox.createOverriddenMethods();

        overrideFunction(this.window.EventTarget.prototype, 'addEventListener', overriddenMethods.addEventListener);
        overrideFunction(this.window.EventTarget.prototype, 'removeEventListener', overriddenMethods.removeEventListener);
    }

    private overrideImageInWindow () {
        const nodeSandbox = this.nodeSandbox;

        overrideConstructor(this.window, 'Image', function () {
            let image = null;

            if (!arguments.length)
                image = new nativeMethods.Image();
            else if (arguments.length === 1)
                image = new nativeMethods.Image(arguments[0]);
            else
                image = new nativeMethods.Image(arguments[0], arguments[1]);

            image[INTERNAL_PROPS.forceProxySrcForImage] = true;

            nodeSandbox.processNodes(image);

            return image;
        });
    }

    private overrideFunctionInWindow () {
        overrideConstructor(this.window, 'Function', function (this: Function, ...args) {
            const functionBodyArgIndex = args.length - 1;

            if (typeof args[functionBodyArgIndex] === 'string')
                args[functionBodyArgIndex] = processScript(args[functionBodyArgIndex], false, false, convertToProxyUrl);

            const fn = nativeMethods.Function.apply(this, args);

            WindowSandbox.patchFunctionPrototype(fn, this);

            return fn;
        }, true);
    }

    private static patchFunctionPrototype (fn: Function, ctx: any): void {
        if (!ctx || isFunction(ctx))
            return;

        const inheritorProto = nativeMethods.objectGetPrototypeOf(ctx);

        if (!inheritorProto)
            return;

        let fnProto = nativeMethods.objectGetPrototypeOf(inheritorProto);

        while (fnProto && fnProto !== nativeMethods.Function.prototype)
            fnProto = nativeMethods.objectGetPrototypeOf(fnProto);

        if (!fnProto)
            return;

        // NOTE: Warning: Changing the [[Prototype]] of an object is currently a very slow operation in every browser
        // and JavaScript engine. In addition, the effects of altering inheritance are subtle and far-flung, and are not
        // limited to the time spent in the Object.setPrototypeOf(...) statement, but may extend to any code that has
        // access to any object whose [[Prototype]] has been altered.
        // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/setPrototypeOf
        nativeMethods.objectSetPrototypeOf(fn, inheritorProto);
    }

    private overrideToStringInFunction () {
        overrideFunction(nativeMethods.Function.prototype, 'toString', function (this: Function) {
            if (nativeMethods.objectHasOwnProperty.call(this, INTERNAL_PROPS.nativeStrRepresentation))
                return this[INTERNAL_PROPS.nativeStrRepresentation];

            return nativeMethods.functionToString.call(this);
        });
    }

    private overrideMethodInHistory (name, nativeMethod) {
        overrideFunction(this.window.history, name, function (this: History, ...args) {
            const url = args[2];

            if (args.length > 2 && (url !== null && url !== void 0))
                args[2] = getProxyUrl(url);

            return nativeMethod.apply(this, args);
        });
    }

    private overrideSendBeaconInNavigator () {
        overrideFunction(this.window.Navigator.prototype, 'sendBeacon', function (this: Navigator) {
            if (typeof arguments[0] === 'string')
                arguments[0] = getProxyUrl(arguments[0]);

            return nativeMethods.sendBeacon.apply(this, arguments);
        });
    }

    private overrideRegisterProtocolHandlerInNavigator () {
        overrideFunction(this.window.navigator, 'registerProtocolHandler', function (...args) {
            const urlIndex = 1;

            if (typeof args[urlIndex] === 'string') {
                // eslint-disable-next-line no-restricted-properties
                const destHostname = destLocation.getParsed().hostname;
                let isDestUrl      = false;

                if (isFirefox) {
                    const parsedUrl = parseUrl(args[urlIndex]);

                    // eslint-disable-next-line no-restricted-properties
                    isDestUrl = parsedUrl.hostname && destHostname === parsedUrl.hostname;
                }
                else
                    isDestUrl = destLocation.sameOriginCheck(destLocation.get(), args[urlIndex]);

                if (isDestUrl)
                    args[urlIndex] = getProxyUrl(args[urlIndex]);
            }

            return nativeMethods.registerProtocolHandler.apply(navigator, args);
        });
    }

    private overrideAppendInFormData () {
        overrideFunction(this.window.FormData.prototype, 'append', function (this: FormData, ...args: [string, string | Blob, string?]) {
            const [name, value] = args;

            // NOTE: We should not send our hidden input's value along with the file info,
            // because our input may have incorrect value if the input with the file has been removed from DOM.
            if (name === INTERNAL_ATTRS.uploadInfoHiddenInputName)
                return;

            // NOTE: If we append our file wrapper to FormData, we will lose the file name.
            // This happens because the file wrapper is an instance of Blob
            // and a browser thinks that Blob does not contain the "name" property.
            if (args.length === 2 && isBlob(value) && 'name' in value)
                args[2] = value['name'] as string;

            nativeMethods.formDataAppend.apply(this, args);
        });
    }

    private overrideWebSocketInWindow () {
        overrideConstructor(this.window, 'WebSocket', function (url, protocols) {
            if (arguments.length === 0)
                return new nativeMethods.WebSocket();

            const proxyUrl = getProxyUrl(url, { resourceType: stringifyResourceType({ isWebSocket: true }) });

            if (arguments.length === 1)
                return new nativeMethods.WebSocket(proxyUrl);
            else if (arguments.length === 2)
                return new nativeMethods.WebSocket(proxyUrl, protocols);

            return new nativeMethods.WebSocket(proxyUrl, protocols, arguments[2]);
        });

        //@ts-ignore
        this.window.WebSocket.CONNECTING = nativeMethods.WebSocket.CONNECTING;
        //@ts-ignore
        this.window.WebSocket.OPEN = nativeMethods.WebSocket.OPEN;
        //@ts-ignore
        this.window.WebSocket.CLOSING = nativeMethods.WebSocket.CLOSING;
        //@ts-ignore
        this.window.WebSocket.CLOSED = nativeMethods.WebSocket.CLOSED;
    }

    private overrideUrlInWebSocket () {
        overrideDescriptor(this.window.WebSocket.prototype, 'url', {
            getter: function () {
                const url       = nativeMethods.webSocketUrlGetter.call(this);
                const parsedUrl = parseProxyUrl(url);

                if (parsedUrl && parsedUrl.destUrl)
                    return parsedUrl.destUrl.replace(HTTP_PROTOCOL_RE, 'ws');

                return url;
            },
        });
    }

    private overrideOriginInMessageEvent () {
        overrideDescriptor(this.window.MessageEvent.prototype, 'origin', {
            getter: function (this: MessageEvent) {
                const target = nativeMethods.eventTargetGetter.call(this);
                const origin = nativeMethods.messageEventOriginGetter.call(this);

                if (isWebSocket(target)) {
                    const parsedUrl = parseUrl(target.url);

                    if (parsedUrl)
                        // eslint-disable-next-line no-restricted-properties
                        return parsedUrl.protocol + '//' + parsedUrl.host;
                }
                else if (isWindow(target)) {
                    const data = nativeMethods.messageEventDataGetter.call(this);

                    if (data)
                        return data.originUrl;
                }

                return origin;
            },
        });
    }

    private overrideLengthInHTMLCollection () {
        const windowSandbox = this;

        overrideDescriptor(this.window.HTMLCollection.prototype, 'length', {
            getter: function () {
                const length = nativeMethods.htmlCollectionLengthGetter.call(this);

                if (ShadowUI.isShadowContainerCollection(this))
                    return windowSandbox.shadowUI.getShadowUICollectionLength(this, length);

                return length;
            },
        });
    }

    private overrideLengthInNodeList () {
        const windowSandbox = this;

        overrideDescriptor(this.window.NodeList.prototype, 'length', {
            getter: function () {
                const length = nativeMethods.nodeListLengthGetter.call(this);

                if (ShadowUI.isShadowContainerCollection(this))
                    return windowSandbox.shadowUI.getShadowUICollectionLength(this, length);

                return length;
            },
        });
    }

    private overrideChildElementCountInElement () {
        const windowSandbox = this;

        overrideDescriptor(this.window.Element.prototype, 'childElementCount', {
            getter: function (this: Element) {
                if (ShadowUI.isShadowContainer(this)) {
                    const children = nativeMethods.elementChildrenGetter.call(this);
                    const length   = nativeMethods.htmlCollectionLengthGetter.call(children);

                    return windowSandbox.shadowUI.getShadowUICollectionLength(children, length);
                }

                return nativeMethods.elementChildElementCountGetter.call(this);
            },
        });

    }

    private overrideNameInPerformanceEntry () {
        overrideDescriptor(this.window.PerformanceEntry.prototype, 'name', {
            getter: function () {
                const name = nativeMethods.performanceEntryNameGetter.call(this);

                if (isPerformanceNavigationTiming(this)) {
                    const parsedProxyUrl = parseProxyUrl(name);

                    if (parsedProxyUrl)
                        return parsedProxyUrl.destUrl;
                }

                return name;
            },
        });
    }

    private overrideFilesInHTMLInputElement () {
        overrideDescriptor(this.window.HTMLInputElement.prototype, 'files', {
            getter: function (this: HTMLInputElement) {
                if (this.type.toLowerCase() === 'file')
                    return UploadSandbox.getFiles(this);

                return nativeMethods.inputFilesGetter.call(this);
            },
        });
    }

    private overrideValueInHTMLInputElement () {
        const windowSandbox = this;

        overrideDescriptor(this.window.HTMLInputElement.prototype, 'value', {
            getter: function (this: HTMLInputElement) {
                if (this.type.toLowerCase() === 'file')
                    return UploadSandbox.getUploadElementValue(this);

                return nativeMethods.inputValueGetter.call(this);
            },
            setter: function (this: HTMLInputElement, value) { // eslint-disable-line consistent-return
                if (this.type.toLowerCase() === 'file') {
                    windowSandbox.uploadSandbox.setUploadElementValue(this, value);

                    return;
                }

                nativeMethods.inputValueSetter.call(this, value);

                const valueChanged = value !== nativeMethods.inputValueGetter.call(this);

                if (valueChanged && !isShadowUIElement(this) && isTextEditableElementAndEditingAllowed(this))
                    windowSandbox.elementEditingWatcher.restartWatchingElementEditing(this);
            },
        });
    }

    private overrideDisabledInHTMLInputElement () {
        const windowSandbox = this;

        overrideDescriptor(this.window.HTMLInputElement.prototype, 'disabled', {
            getter: null,
            setter: function (this: HTMLInputElement, value) {
                if (nativeMethods.documentActiveElementGetter.call(document) === this) {
                    const savedValue   = windowSandbox.elementEditingWatcher.getElementSavedValue(this);
                    const currentValue = nativeMethods.inputValueGetter.call(this);

                    if (windowSandbox.elementEditingWatcher.isEditingObserved(this) && currentValue !== savedValue)
                        windowSandbox.eventSimulator.change(this);

                    windowSandbox.elementEditingWatcher.stopWatching(this);
                }

                nativeMethods.inputDisabledSetter.call(this, value);
            },
        });
    }

    private overrideRequiredInHTMLInputElement () {
        const windowSandbox = this;

        overrideDescriptor(this.window.HTMLInputElement.prototype, 'required', {
            getter: function (this: HTMLInputElement) {
                return windowSandbox.nodeSandbox.element.getAttributeCore(this, ['required']) !== null;
            },
            setter: function (this: HTMLInputElement, value) {
                if (this.type.toLowerCase() !== 'file')
                    nativeMethods.inputRequiredSetter.call(this, value);
                else if (value)
                    windowSandbox.nodeSandbox.element.setAttributeCore(this, ['required', '']);
                else
                    windowSandbox.nodeSandbox.element.removeAttributeCore(this, ['required']);
            },
        });
    }

    private overrideValueInHTMLTextAreaElement () {
        const windowSandbox = this;

        overrideDescriptor(this.window.HTMLTextAreaElement.prototype, 'value', {
            getter: null,
            setter: function (this: HTMLTextAreaElement, value) {
                nativeMethods.textAreaValueSetter.call(this, value);

                if (!isShadowUIElement(this) && isTextEditableElementAndEditingAllowed(this))
                    windowSandbox.elementEditingWatcher.restartWatchingElementEditing(this);
            },
        });
    }

    private overrideUrlAttrDescriptors (attr, elementConstructors): void {
        const windowSandbox = this;

        for (const constructor of elementConstructors) {
            overrideDescriptor(constructor.prototype, attr, {
                getter: function (this: HTMLElement) {
                    return WindowSandbox.getUrlAttr(this, attr);
                },
                setter: function (this: HTMLElement, value) {
                    windowSandbox.nodeSandbox.element.setAttributeCore(this, [attr, value]);
                },
            });
        }
    }

    private static getUrlAttr (el: HTMLElement, attr: string): string {
        const attrValue       = nativeMethods.getAttribute.call(el, attr);
        const currentDocument = el.ownerDocument || document;

        if (attrValue === '')
            return urlResolver.resolve('', currentDocument);

        else if (attrValue === null)
            return '';

        else if (HASH_RE.test(attrValue))
            return urlResolver.resolve(attrValue, currentDocument);

        else if (!isValidUrl(attrValue))
            return urlResolver.resolve(attrValue, currentDocument);

        return resolveUrlAsDest(attrValue, attr === 'srcset');
    }

    private overrideAttrDescriptorsInElement (attr, elementConstructors): void {
        const windowSandbox = this;

        for (const constructor of elementConstructors) {
            overrideDescriptor(constructor.prototype, attr, {
                getter: function (this: HTMLElement) {
                    return windowSandbox.nodeSandbox.element.getAttributeCore(this, [attr]) || '';
                },
                setter: function (this: HTMLElement, value) {
                    windowSandbox.nodeSandbox.element.setAttributeCore(this, [attr, value]);
                },
            });
        }
    }

    private overrideTypeInHTMLInputElement () {
        const windowSandbox = this;

        overrideDescriptor(this.window.HTMLInputElement.prototype, 'type', {
            getter: null,
            setter: function (this: HTMLInputElement, value) {
                windowSandbox.nodeSandbox.element.setAttributeCore(this, ['type', value]);
            },
        });
    }

    private overrideSandboxInHTMLIFrameElement () {
        const windowSandbox = this;

        overrideDescriptor(this.window.HTMLIFrameElement.prototype, 'sandbox', {
            getter: function (this: HTMLIFrameElement) {
                let domTokenList = this[SANDBOX_DOM_TOKEN_LIST];

                if (!domTokenList) {
                    const span = nativeMethods.createElement.call(document, 'span');

                    domTokenList   = nativeMethods.elementClassListGetter.call(span);
                    span.className = windowSandbox.nodeSandbox.element.getAttributeCore(this, ['sandbox']) || '';

                    nativeMethods.objectDefineProperty(domTokenList, SANDBOX_DOM_TOKEN_LIST_OWNER, { value: this });
                    nativeMethods.objectDefineProperty(this, SANDBOX_DOM_TOKEN_LIST, { value: domTokenList });
                    nativeMethods.objectDefineProperty(this, SANDBOX_DOM_TOKEN_LIST_UPDATE_FN, {
                        value: function (value) {
                            span.className = value;
                        },
                    });
                }

                return domTokenList;
            },
            setter: function (this: HTMLIFrameElement, value) {
                windowSandbox.nodeSandbox.element.setAttributeCore(this, ['sandbox', value]);

                if (this[SANDBOX_DOM_TOKEN_LIST_UPDATE_FN])
                    this[SANDBOX_DOM_TOKEN_LIST_UPDATE_FN](windowSandbox.nodeSandbox.element.getAttributeCore(this, ['sandbox']) || '');
            },
        });
    }

    private overrideSrcdocInHTMLIFrameElement () {
        const windowSandbox = this;

        overrideDescriptor(this.window.HTMLIFrameElement.prototype, 'srcdoc', {
            getter: function (this: HTMLIFrameElement) {
                return windowSandbox.nodeSandbox.element.getAttributeCore(this, ['srcdoc']) || '';
            },
            setter: function (this: HTMLIFrameElement, value) {
                windowSandbox.nodeSandbox.element.setAttributeCore(this, ['srcdoc', value]);
            },
        });
    }

    private overrideUrlPropInHTMLAnchorElement (prop, nativePropGetter, nativePropSetter): void {
        overrideDescriptor(this.window.HTMLAnchorElement.prototype, prop, {
            getter: function (this: HTMLElement) {
                return getAnchorProperty(this, nativePropGetter);
            },
            setter: function (this: HTMLElement, value) {
                setAnchorProperty(this, nativePropSetter, value);
            },
        });
    }

    private overrideHrefInSVGImageElement () {
        overrideDescriptor(this.window.SVGImageElement.prototype, 'href', {
            getter: function () {
                const imageHref = nativeMethods.svgImageHrefGetter.call(this);

                if (!imageHref[CONTEXT_SVG_IMAGE_ELEMENT]) {
                    nativeMethods.objectDefineProperty(imageHref, CONTEXT_SVG_IMAGE_ELEMENT, {
                        value:        this,
                        configurable: true,
                    });
                }

                return imageHref;
            },
        });
    }

    private overrideBaseValInSVGAnimatedString () {
        const windowSandbox = this;

        overrideDescriptor(this.window.SVGAnimatedString.prototype, 'baseVal', {
            getter: function () {
                let baseVal = nativeMethods.svgAnimStrBaseValGetter.call(this);

                if (this[CONTEXT_SVG_IMAGE_ELEMENT])
                    baseVal = getDestinationUrl(baseVal);

                return baseVal;
            },
            setter: function (value) {
                const contextSVGImageElement = this[CONTEXT_SVG_IMAGE_ELEMENT];

                if (contextSVGImageElement) {
                    const hasXlinkHrefAttr = nativeMethods.hasAttributeNS.call(contextSVGImageElement, XLINK_NAMESPACE, 'href');

                    windowSandbox.nodeSandbox.element.setAttributeCore(contextSVGImageElement, [hasXlinkHrefAttr ? 'xlink:href' : 'href', value]);
                    value = getProxyUrl(value);
                }

                nativeMethods.svgAnimStrBaseValSetter.call(this, value);
            },
        });
    }

    private overrideAnimValInSVGAnimatedString () {
        overrideDescriptor(this.window.SVGAnimatedString.prototype, 'animVal', {
            getter: function () {
                const animVal = nativeMethods.svgAnimStrAnimValGetter.call(this);

                if (this[CONTEXT_SVG_IMAGE_ELEMENT])
                    return getDestinationUrl(animVal);

                return animVal;
            },
        });
    }

    private overrideOriginInHTMLAnchorElement () {
        overrideDescriptor(this.window.HTMLAnchorElement.prototype, 'origin', {
            getter: function (this: HTMLAnchorElement) {
                return getAnchorProperty(this, nativeMethods.anchorOriginGetter);
            },
        });
    }

    private overrideHrefInStyleSheet () {
        overrideDescriptor(this.window.StyleSheet.prototype, 'href', {
            getter: function () {
                return getDestinationUrl(nativeMethods.styleSheetHrefGetter.call(this));
            },
        });
    }

    private overrideBaseURIInNode () {
        overrideDescriptor(this.window.Node.prototype, 'baseURI', {
            getter: function () {
                return getDestinationUrl(nativeMethods.nodeBaseURIGetter.call(this));
            },
        });
    }

    private overrideParseFromStringInDOMParser () {
        overrideFunction(this.window.DOMParser.prototype, 'parseFromString', function (this: DOMParser, ...args) {
            const str  = args[0];
            const type = args[1];
            let processedHtml;

            if (args.length > 1 && typeof str === 'string' && type === 'text/html') {
                processedHtml = processHtml(str);
                args[0]       = processedHtml;
            }

            const document = nativeMethods.DOMParserParseFromString.apply(this, args);

            if (processedHtml)
                ShadowUI.removeSelfRemovingScripts(document);

            return document;
        });
    }

    private overrideFirstChildInNode () {
        const windowSandbox = this;

        overrideDescriptor(this.window.Node.prototype, 'firstChild', {
            getter: function () {
                if (ShadowUI.isShadowContainer(this))
                    return windowSandbox.shadowUI.getFirstChild(this);

                return nativeMethods.nodeFirstChildGetter.call(this);
            },
        });
    }

    private overrideFirstElementChildInElement () {
        const windowSandbox = this;

        overrideDescriptor(this.window.Element.prototype, 'firstElementChild', {
            getter: function () {
                if (ShadowUI.isShadowContainer(this))
                    return windowSandbox.shadowUI.getFirstElementChild(this);

                return nativeMethods.elementFirstElementChildGetter.call(this);
            },
        });
    }

    private overrideLastChildInNode () {
        const windowSandbox = this;

        overrideDescriptor(this.window.Node.prototype, 'lastChild', {
            getter: function () {
                if (ShadowUI.isShadowContainer(this))
                    return windowSandbox.shadowUI.getLastChild(this);

                return nativeMethods.nodeLastChildGetter.call(this);
            },
        });
    }

    private overrideLastElementChildInElement () {
        const windowSandbox = this;

        overrideDescriptor(this.window.Element.prototype, 'lastElementChild', {
            getter: function () {
                if (ShadowUI.isShadowContainer(this))
                    return windowSandbox.shadowUI.getLastElementChild(this);

                return nativeMethods.elementLastElementChildGetter.call(this);
            },
        });
    }

    private overrideNextSiblingInNode () {
        const windowSandbox = this;

        overrideDescriptor(this.window.Node.prototype, 'nextSibling', {
            getter: function () {
                return windowSandbox.shadowUI.getNextSibling(this);
            },
        });
    }

    private overridePreviousSiblingInNode () {
        const windowSandbox = this;

        overrideDescriptor(this.window.Node.prototype, 'previousSibling', {
            getter: function () {
                return windowSandbox.shadowUI.getPrevSibling(this);
            },
        });
    }

    private overrideNextElementSiblingInElement () {
        const windowSandbox = this;

        overrideDescriptor(this.window.Element.prototype, 'nextElementSibling', {
            getter: function () {
                return windowSandbox.shadowUI.getNextElementSibling(this);
            },
        });
    }

    private overridePreviousElementSiblingInElement () {
        const windowSandbox = this;

        overrideDescriptor(this.window.Element.prototype, 'previousElementSibling', {
            getter: function () {
                return windowSandbox.shadowUI.getPrevElementSibling(this);
            },
        });
    }

    private overrideInnerHTMLInElement (nativeAutomation: boolean) {
        const windowSandbox = this;

        overrideDescriptor(this.window.Element.prototype, 'innerHTML', {
            getter: function (this: HTMLElement) {
                if (!nativeAutomation && windowSandbox._documentTitleStorageInitializer && isTitleElement(this))
                    return windowSandbox._documentTitleStorageInitializer.storage.getTitleElementPropertyValue(this);

                const innerHTML = nativeMethods.elementInnerHTMLGetter.call(this);

                if (isScriptElement(this))
                    return removeProcessingHeader(innerHTML);
                else if (isStyleElement(this))
                    return styleProcessor.cleanUp(innerHTML, parseProxyUrl);

                return cleanUpHtml(innerHTML);
            },
            setter: function (this: HTMLElement, value) {
                if (windowSandbox._documentTitleStorageInitializer && isTitleElement(this)) {
                    windowSandbox._documentTitleStorageInitializer.storage.setTitleElementPropertyValue(this, value);

                    return;
                }

                const el         = this;
                const isStyleEl  = isStyleElement(el);
                const isScriptEl = isScriptElement(el);

                let processedValue = value !== null && value !== void 0 ? String(value) : value;

                if (processedValue) {
                    if (isStyleEl)
                        processedValue = styleProcessor.process(processedValue, getProxyUrl, true);
                    else if (isScriptEl)
                        processedValue = processScript(processedValue, true, false, convertToProxyUrl, void 0, settings.nativeAutomation);
                    else {
                        processedValue = processHtml(processedValue, {
                            parentTag:        el.tagName,
                            processedContext: el[INTERNAL_PROPS.processedContext],
                        });
                    }
                }

                if (!isStyleEl && !isScriptEl)
                    DOMMutationTracker.onChildrenChanged(el);

                nativeMethods.elementInnerHTMLSetter.call(el, processedValue);
                windowSandbox.setSandboxedTextForTitleElements(el);

                if (isStyleEl || isScriptEl)
                    return;

                DOMMutationTracker.onChildrenChanged(el);

                if (windowSandbox.document.body === el) {
                    const shadowUIRoot = windowSandbox.shadowUI.getRoot();

                    windowSandbox.shadowUI.markShadowUIContainers(windowSandbox.document.head, el);
                    ShadowUI.markElementAndChildrenAsShadow(shadowUIRoot);
                }

                else if (isShadowUIElement(el))
                    ShadowUI.markElementAndChildrenAsShadow(el);

                const parentDocument = findDocument(el);
                const parentWindow   = parentDocument ? parentDocument.defaultView : null;

                // NOTE: For the iframe with an empty src.
                if (parentWindow && parentWindow !== windowSandbox.window &&
                    parentWindow[INTERNAL_PROPS.processDomMethodName])
                    parentWindow[INTERNAL_PROPS.processDomMethodName](el, parentDocument);
                else if (windowSandbox.window[INTERNAL_PROPS.processDomMethodName])
                    windowSandbox.window[INTERNAL_PROPS.processDomMethodName](el);

                // NOTE: Fix for B239138 - unroll.me 'Cannot read property 'document' of null' error raised
                // during recording. There was an issue when the document.body was replaced, so we need to
                // reattach UI to a new body manually.

                // NOTE: This check is required because jQuery calls the set innerHTML method for an element
                // in an unavailable window.
                if (windowSandbox.window.self) {
                    // NOTE: Use timeout, so that changes take effect.
                    if (isHtmlElement(el) || isBodyElement(el))
                        nativeMethods.setTimeout.call(windowSandbox.window, () => windowSandbox.nodeMutation.onBodyContentChanged(el), 0);
                }
            },
        });
    }

    private overrideOuterHTMLInElement () {
        const windowSandbox = this;

        overrideDescriptor(this.window.Element.prototype, 'outerHTML', {
            getter: function () {
                const outerHTML = nativeMethods.elementOuterHTMLGetter.call(this);

                return cleanUpHtml(outerHTML);
            },
            setter: function (value) {
                const el       = this;
                const parentEl = nativeMethods.nodeParentNodeGetter.call(el);

                DOMMutationTracker.onElementChanged(el);

                if (parentEl && value !== null && value !== void 0) {
                    const parentDocument = findDocument(parentEl);
                    const parentWindow   = parentDocument ? parentDocument.defaultView : null;

                    nativeMethods.elementOuterHTMLSetter.call(el, processHtml(String(value), {
                        parentTag:        parentEl && parentEl['tagName'],
                        processedContext: el[INTERNAL_PROPS.processedContext],
                    }));

                    windowSandbox.setSandboxedTextForTitleElements(parentEl);
                    DOMMutationTracker.onChildrenChanged(parentEl);

                    // NOTE: For the iframe with an empty src.
                    if (parentWindow && parentWindow !== windowSandbox.window &&
                        parentWindow[INTERNAL_PROPS.processDomMethodName])
                        parentWindow[INTERNAL_PROPS.processDomMethodName](parentEl, parentDocument);
                    else if (windowSandbox.window[INTERNAL_PROPS.processDomMethodName])
                        windowSandbox.window[INTERNAL_PROPS.processDomMethodName](parentEl);

                    // NOTE: This check is required for an element in an unavailable window.
                    // NOTE: Use timeout, so that changes take effect.
                    if (windowSandbox.window.self && isBodyElement(el))
                        nativeMethods.setTimeout.call(windowSandbox.window, () => windowSandbox.shadowUI.onBodyElementMutation(), 0);
                }
                else
                    nativeMethods.elementOuterHTMLSetter.call(el, value);
            },
        });
    }

    private setSandboxedTextForTitleElements (el: Node & ParentNode): void {
        if (isIframeWindow(this.window))
            return;

        const titleElements = getNativeQuerySelectorAll(el).call(el, 'title');

        for (const titleElement of titleElements) {
            // NOTE: SVGTitleElement can be here (GH-2364)
            if (!isTitleElement(titleElement))
                continue;

            const nativeText = nativeMethods.titleElementTextGetter.call(titleElement);

            this._documentTitleStorageInitializer.storage.setTitleElementPropertyValue(titleElement, nativeText);
        }
    }

    private overrideInnerTextInHTMLElement (nativeAutomation: boolean) {
        const windowSandbox = this;

        overrideDescriptor(this.window.HTMLElement.prototype, 'innerText', {
            getter: function (this: HTMLElement) {
                if (!nativeAutomation && windowSandbox._documentTitleStorageInitializer && isTitleElement(this))
                    return windowSandbox._documentTitleStorageInitializer.storage.getTitleElementPropertyValue(this);

                const textContent = nativeMethods.htmlElementInnerTextGetter.call(this);

                return WindowSandbox.removeProcessingInstructions(textContent);
            },
            setter: function (this: HTMLElement, value) {
                if (windowSandbox._documentTitleStorageInitializer && isTitleElement(this)) {
                    windowSandbox._documentTitleStorageInitializer.storage.setTitleElementPropertyValue(this, value);

                    return;
                }

                const processedValue = WindowSandbox.processTextPropValue(this, value);

                DOMMutationTracker.onChildrenChanged(this);

                nativeMethods.htmlElementInnerTextSetter.call(this, processedValue);
            },
        });
    }

    private overrideTextInHTMLScriptElement () {
        overrideDescriptor(this.window.HTMLScriptElement.prototype, 'text', {
            getter: function () {
                const text = nativeMethods.scriptTextGetter.call(this);

                return removeProcessingHeader(text);
            },
            setter: function (value) {
                const processedValue = value ? processScript(String(value), true, false, convertToProxyUrl, void 0, settings.nativeAutomation) : value;

                nativeMethods.scriptTextSetter.call(this, processedValue);
            },
        });
    }

    private overrideTextInHTMLAnchorElement () {
        overrideDescriptor(this.window.HTMLAnchorElement.prototype, 'text', {
            getter: function (this: HTMLAnchorElement) {
                const textContent = nativeMethods.anchorTextGetter.call(this);

                return WindowSandbox.removeProcessingInstructions(textContent);
            },
            setter: function (this: HTMLAnchorElement, value) {
                const processedValue = WindowSandbox.processTextPropValue(this, value);

                DOMMutationTracker.onChildrenChanged(this);

                nativeMethods.anchorTextSetter.call(this, processedValue);
            },
        });
    }

    private overrideTextContentInNode () {
        const windowSandbox = this;

        overrideDescriptor(this.window.Node.prototype, 'textContent', {
            getter: function (this: HTMLElement) {
                if (windowSandbox._documentTitleStorageInitializer && isTitleElement(this))
                    return windowSandbox._documentTitleStorageInitializer.storage.getTitleElementPropertyValue(this);

                const textContent = nativeMethods.nodeTextContentGetter.call(this);

                return WindowSandbox.removeProcessingInstructions(textContent);
            },
            setter: function (this: HTMLElement, value) {
                if (windowSandbox._documentTitleStorageInitializer && isTitleElement(this)) {
                    windowSandbox._documentTitleStorageInitializer.storage.setTitleElementPropertyValue(this, value);

                    return;
                }

                const processedValue = WindowSandbox.processTextPropValue(this, value);

                DOMMutationTracker.onChildrenChanged(this);

                nativeMethods.nodeTextContentSetter.call(this, processedValue);
            },
        });
    }

    private static removeProcessingInstructions (text: string): string {
        if (text) {
            text = removeProcessingHeader(text);

            return styleProcessor.cleanUp(text, parseProxyUrl);
        }

        return text;
    }

    private static processTextPropValue (el: HTMLElement, text: string): string {
        const processedText = text !== null && text !== void 0 ? String(text) : text;

        if (processedText) {
            if (isScriptElement(el))
                return processScript(processedText, true, false, convertToProxyUrl, void 0, settings.nativeAutomation);
            else if (isStyleElement(el))
                return styleProcessor.process(processedText, getProxyUrl, true);
        }

        return processedText;
    }

    private overrideAttributesInElement () {
        overrideDescriptor(this.window.Element.prototype, 'attributes', {
            getter: function () {
                return getAttributes(this);
            },
        });
    }

    private overrideMethodInDOMTokenList (name, nativeMethod) {
        const windowSandbox = this;

        overrideFunction(this.window.DOMTokenList.prototype, name, function (this: DOMTokenList) {
            const executionResult = nativeMethod.apply(this, arguments);
            const tokenListOwner  = this[SANDBOX_DOM_TOKEN_LIST_OWNER];

            if (tokenListOwner)
                windowSandbox.nodeSandbox.element.setAttributeCore(tokenListOwner, ['sandbox', this.toString()]);

            return executionResult;
        });
    }

    private overrideSupportsInDOMTokenList () {
        overrideFunction(this.window.DOMTokenList.prototype, 'supports', function (this: DOMTokenList) {
            if (this[SANDBOX_DOM_TOKEN_LIST_OWNER]) {
                const nativeTokenList = nativeMethods.iframeSandboxGetter.call(this[SANDBOX_DOM_TOKEN_LIST_OWNER]);

                return nativeMethods.tokenListSupports.apply(nativeTokenList, arguments);
            }

            return nativeMethods.tokenListSupports.apply(this, arguments);
        });
    }

    private overrideValueInDOMTokenList () {
        const windowSandbox = this;

        overrideDescriptor(this.window.DOMTokenList.prototype, 'value', {
            getter: null,
            setter: function (value) {
                const tokenListOwner = this[SANDBOX_DOM_TOKEN_LIST_OWNER];

                nativeMethods.tokenListValueSetter.call(this, value);

                if (tokenListOwner)
                    // eslint-disable-next-line no-restricted-properties
                    windowSandbox.nodeSandbox.element.setAttributeCore(tokenListOwner, ['sandbox', this.value]);
            },
        });
    }

    private overrideCreateHTMLDocumentInDOMImplementation () {
        overrideFunction(this.window.DOMImplementation.prototype, 'createHTMLDocument', function (this: DOMImplementation, ...args) {
            const doc = nativeMethods.createHTMLDocument.apply(this, args);

            urlResolver.init(doc);

            return doc;
        });
    }

    private overrideNextSiblingInMutationRecord () {
        const windowSandbox = this;

        overrideDescriptor(this.window.MutationRecord.prototype, 'nextSibling', {
            getter: function () {
                const originNextSibling = nativeMethods.mutationRecordNextSiblingGetter.call(this);

                return windowSandbox.shadowUI.getMutationRecordNextSibling(originNextSibling);
            },
        });
    }

    private overridePreviousSiblingInMutationRecord () {
        const windowSandbox = this;

        overrideDescriptor(this.window.MutationRecord.prototype, 'previousSibling', {
            getter: function () {
                const originPrevSibling = nativeMethods.mutationRecordPrevSiblingGetter.call(this);

                return windowSandbox.shadowUI.getMutationRecordPrevSibling(originPrevSibling);
            },
        });
    }

    private overrideOriginInWindow () {
        const windowSandbox = this;

        overrideDescriptor(this.window, 'origin', {
            getter: function (this: Window) {
                const proxyOrigin = nativeMethods.windowOriginGetter.call(this);

                if (!proxyOrigin || proxyOrigin === 'null')
                    return proxyOrigin;

                const frame = getFrameElement(windowSandbox.window);

                if (frame) {
                    const sandbox = windowSandbox.nodeSandbox.element.getAttributeCore(frame, ['sandbox']);

                    if (typeof sandbox === 'string' && sandbox.indexOf('allow-same-origin') === -1)
                        return 'null';
                }

                const parsedDestLocation = destLocation.getParsed();

                // eslint-disable-next-line no-restricted-properties
                if (parsedDestLocation && parsedDestLocation.protocol === 'file:')
                    return 'null';

                return destLocation.getOriginHeader();
            },

            setter: function (this: Window, value) {
                return nativeMethods.windowOriginSetter.call(this, value);
            },
        });
    }

    private overrideTextInHTMLTitleElement () {
        const windowSandbox = this;

        overrideDescriptor(this.window.HTMLTitleElement.prototype, 'text', {
            getter: function (this: HTMLTitleElement) {
                return windowSandbox._documentTitleStorageInitializer.storage.getTitleElementPropertyValue(this);
            },
            setter: function (this: HTMLTitleElement, value) {
                windowSandbox._documentTitleStorageInitializer.storage.setTitleElementPropertyValue(this, value);
            },
        });
    }
}
