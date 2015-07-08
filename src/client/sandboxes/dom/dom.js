import { isIE, isWebKit, isMozilla } from '../../util/browser';
import * as Document from './document';
import { getTopSameDomainWindow } from '../../util/dom';
import * as DomAccessorWrappers from '../dom-accessor-wrappers';
import * as Element from './element';
import * as EventSandbox from '../event/event';
import IFrameSandbox from '../iframe';
import * as Listeners from '../event/listeners';
import * as MessageSandbox from '../message';
import NativeMethods from '../native-methods';
import * as Service from '../../util/service';
import * as ShadowUI from '../shadow-ui';
import Const from '../../../const';
import * as UploadSandbox from '../upload/upload';
import * as Window from './window';
import * as XhrSandbox from '../xhr';

// Consts
export const BODY_CREATED = 'bodyCreated';

const BODY_CONTENT_CHANGED = 'bodyContentChanged';
const DOCUMENT_CLEANED     = 'documentCleaned';

const IFRAME_DOM_SANDBOXES_STORE = 'dom_sandboxes_store_5d9138e9';

var eventEmitter = new Service.EventEmitter();

export var on  = eventEmitter.on.bind(eventEmitter);
export var off = eventEmitter.off.bind(eventEmitter);

function onBodyCreated () {
    Listeners.initDocumentBodyListening(document);

    eventEmitter.emit(BODY_CREATED, {
        body: document.body
    });
}

IFrameSandbox.on(IFrameSandbox.IFRAME_READY_TO_INIT_INTERNAL, function (e) {
    // Eval Hammerhead code script
    initHammerheadClient(e.iframe.contentWindow, true);
});

IFrameSandbox.on(IFrameSandbox.IFRAME_DOCUMENT_CREATED, function (e) {
    // Override only document (In fact, we only need 'write' and 'writeln' methods)
    Document.override(e.iframe.contentWindow, e.iframe.contentDocument, overrideDomMethods);
});

IFrameSandbox.on(IFrameSandbox.IFRAME_DOCUMENT_RECREATED, function (e) {
    // We should informs iframe DomSandbox so that it restore communication with the recreated document
    rebindDomSandboxToIframe(e.iframe);
});

function overrideElement (el) {
    if (el[Const.DOM_SANDBOX_PROCESSED_CONTEXT] !== window) {
        el[Const.DOM_SANDBOX_PROCESSED_CONTEXT] = window;

        Element.override(el);
        EventSandbox.overrideElement(el, true);
        ShadowUI.overrideElement(el, true);
    }
}

export var raiseBodyCreatedEvent = onBodyCreated;

export function rebind (iframe) {
    // Assign exists DomSandbox to cleared document
    onDocumentCleaned(iframe.contentWindow, iframe.contentDocument);
}

export function rebindDomSandboxToIframe (iframe) {
    if (iframe) {
        var topSameDomainWindow = getTopSameDomainWindow(window);
        var domSandboxesStore   = topSameDomainWindow[IFRAME_DOM_SANDBOXES_STORE];

        // Find iframe DomSandbox
        for (var i = 0; i < domSandboxesStore.length; i++) {
            if (domSandboxesStore[i].iframe === iframe) {
                // Inform the DomSandbox so that it restore communication with the recreated document
                domSandboxesStore[i].domSandbox.rebind(iframe);

                return;
            }
        }

        // If the iframe DomSandbox is not found, this means that iframe not initialized,
        // in this case we should inject Hammerhead

        // Hack: IE10 clean up overrided methods after document.write calling
        NativeMethods.restoreNativeDocumentMeth(iframe.contentDocument);

        // DomSandbox for this iframe not found (iframe not yet initialized).
        // Inform the IFrameSandbox about it, and it inject Hammerhead
        IFrameSandbox.onIframeBeganToRun(iframe);
    }
}

export function overrideDomMethods (el, doc) {
    if (!el) {
        doc = doc || document;

        EventSandbox.overrideElement(doc);

        if (doc.documentElement)
            overrideDomMethods(doc.documentElement);
    }
    else if (el.querySelectorAll) { //OPTIMIZATION: use querySelectorAll to iterate over descendant nodes
        overrideElement(el);

        var children = el.querySelectorAll('*');

        for (var i = 0; i < children.length; i++)
            overrideElement(children[i]);
    }

    //NOTE: if querySelectorAll is not available fallback to recursive algorithm
    else if (el.nodeType === 1 || el.nodeType === 11) {
        overrideElement(el);

        var cnLength = el.childNodes.length;

        if (cnLength) {
            for (var j = 0; j < cnLength; j++)
                overrideDomMethods(el.childNodes[j]);
        }
    }
}

function onDocumentCleaned (window, document) {
    if (isIE) {
        var needToUpdateNativeDomMeths     = false;
        var needToUpdateNativeElementMeths = false;
        var needToUpdateNativeWindowMeths  = false;

        try {
            needToUpdateNativeDomMeths = !document.createElement ||
                                         NativeMethods.createElement.toString() ===
                                         document.createElement.toString();
        }
        catch (e) {
            needToUpdateNativeDomMeths = true;
        }

        try {
            var nativeElement = NativeMethods.createElement.call(document, 'div');

            needToUpdateNativeElementMeths = nativeElement.getAttribute.toString() ===
                                             NativeMethods.getAttribute.toString();
        }
        catch (e) {
            needToUpdateNativeElementMeths = true;
        }

        try {
            NativeMethods.setTimeout.call(window, function () {
            }, 0);

            needToUpdateNativeWindowMeths = window.XMLHttpRequest.toString() ===
                                            NativeMethods.XMLHttpRequest.toString();
        }
        catch (e) {
            needToUpdateNativeWindowMeths = true;
        }

        // T173709
        if (needToUpdateNativeDomMeths)
            NativeMethods.refreshDocumentMeths(document);

        if (needToUpdateNativeElementMeths)
            NativeMethods.refreshElementMeths(document);

        // T239109
        if (needToUpdateNativeWindowMeths)
            NativeMethods.refreshWindowMeths(window);
    }

    EventSandbox.initDocumentListening();

    if (isWebKit)
        Listeners.restartElementListening(window);

    ShadowUI.init(window, document);
    DomAccessorWrappers.init(window, document); // T182337

    eventEmitter.emit(DOCUMENT_CLEANED, {
        document:           document,
        isIFrameWithoutSrc: isIFrameWithoutSrc
    });

    Document.override(window, document, overrideDomMethods);
}

//NOTE: DOM sandbox hides evidence of the content proxying from page-native script. Proxy replaces URLs for
//resources. Our goal is to make native script think that all resources are fetched from origin resource not
//from proxy and also provide proxying for dynamicly created elements.
export function init (window, document) {
    updateSandboxStore(window);

    ShadowUI.init(window, document);
    EventSandbox.init(window, document);
    XhrSandbox.init(window, document);
    MessageSandbox.init(window, document);
    UploadSandbox.init(window, document);
    DomAccessorWrappers.init(window, document);

    DomAccessorWrappers.on(DomAccessorWrappers.BODY_CONTENT_CHANGED, function (el) {
        var elContextWindow = el[Const.DOM_SANDBOX_PROCESSED_CONTEXT];

        /*eslint-disable indent */
        if (elContextWindow !== window) {
            MessageSandbox.sendServiceMsg({
                cmd: BODY_CONTENT_CHANGED
            }, elContextWindow);
        }
        else
            ShadowUI.onBodyContentChanged();
        /*eslint-enable indent */
    });

    window[Const.DOM_SANDBOX_OVERRIDE_DOM_METHOD_NAME] = overrideDomMethods;

    // NOTE: Iframe loses its contentWindow after reinserting in the DOM (in the FF).
    if (isMozilla) {
        Element.on(Element.IFRAME_ADDED, function (e) {
            IFrameSandbox.overrideIframe(e.iframe);
        });
    }

    // NOTE: in some browsers (for example Firefox) 'window.document' are different objects when iframe is created
    // just now and on document ready event. Therefore we should update 'document' object to override its methods (Q527555).
    document.addEventListener('DOMContentLoaded', function () {
        overrideDomMethods(null, document);
    }, false);

    Document.on(Document.DOCUMENT_CLEANED, function (e) {
        onDocumentCleaned(e.window, e.document);
    });

    Document.override(window, document, overrideDomMethods);
    Window.init(window);
    Window.override(window, overrideDomMethods);
    Element.init(window, overrideDomMethods);

    MessageSandbox.on(MessageSandbox.SERVICE_MSG_RECEIVED, function (e) {
        var message = e.message;

        if (message.cmd === BODY_CONTENT_CHANGED)
            ShadowUI.onBodyContentChanged();
    });
}

function updateSandboxStore (window) {
    var topSameDomainWindow = getTopSameDomainWindow(window);

    /*eslint-disable indent */
    if (isIFrameWithoutSrc) {
        topSameDomainWindow[IFRAME_DOM_SANDBOXES_STORE].push({
            iframe:     window.frameElement,
            domSandbox: module.exports
        });
    }
    else if (window === topSameDomainWindow)
        window[IFRAME_DOM_SANDBOXES_STORE] = [];
    /*eslint-enable indent */
}
