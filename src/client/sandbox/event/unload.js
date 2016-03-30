import SandboxBase from '../base';
import nativeMethods from '../native-methods';
import createPropertyDesc from '../../utils/create-property-desc.js';
import { isFirefox, isIE9, isIE10, isIOS } from '../../utils/browser';
import * as domUtils from '../../utils/dom';
import { SUPPORTED_PROTOCOL_RE } from '../../../utils/url';

export default class UnloadSandbox extends SandboxBase {
    constructor (listeners) {
        super();

        this.BEFORE_UNLOAD_EVENT        = 'hammerhead|event|before-unload';
        this.BEFORE_BEFORE_UNLOAD_EVENT = 'hammerhead|event|before-before-unload';
        this.UNLOAD_EVENT               = 'hammerhead|event|unload';

        this.listeners = listeners;

        this.isFakeIEBeforeUnloadEvent     = false;
        this.storedBeforeUnloadReturnValue = '';
        this.prevented                     = false;
        this.storedBeforeUnloadHandler     = null;

        // NOTE: the ios devices do not support beforeunload event
        // https://developer.apple.com/library/ios/documentation/AppleApplications/Reference/SafariWebContent/HandlingEvents/HandlingEvents.html#//apple_ref/doc/uid/TP40006511-SW5
        this.beforeUnloadEventName = isIOS ? 'pagehide' : 'beforeunload';
    }

    // NOTE: This handler has to be called after others.
    _emitBeforeUnloadEvent () {
        this.emit(this.BEFORE_UNLOAD_EVENT, {
            returnValue:   this.storedBeforeUnloadReturnValue,
            prevented:     this.prevented,
            isFakeIEEvent: this.isFakeIEBeforeUnloadEvent
        });

        this.isFakeIEBeforeUnloadEvent = false;
    }

    _onBeforeUnloadHandler (e, originListener) {
        // NOTE: Overriding the returnValue property to prevent a native dialog.
        Object.defineProperty(e, 'returnValue', createPropertyDesc({
            get: () => this.storedBeforeUnloadReturnValue,
            set: value => {
                // NOTE: In all browsers, if the property is set to any value, unload is prevented. In FireFox,
                // only if a value is set to an empty string, the unload operation is prevented.
                this.storedBeforeUnloadReturnValue = value;

                this.prevented = isFirefox ? value !== '' : true;
            }
        }));

        Object.defineProperty(e, 'preventDefault', createPropertyDesc({
            get: () => () => this.prevented = true,
            set: () => void 0
        }));

        var res = originListener(e);

        if (res !== void 0) {
            this.storedBeforeUnloadReturnValue = res;
            this.prevented                     = true;
        }
    }

    _onDocumentClick (e) {
        if (domUtils.isAnchorElement(e.target))
            this.isFakeIEBeforeUnloadEvent = !e.target.href || !SUPPORTED_PROTOCOL_RE.test(e.target.href);
    }

    _reattachBeforeUnloadListener () {
        // NOTE: reattach the Listener, it'll be the last in the queue.
        nativeMethods.windowRemoveEventListener.call(this.window, this.beforeUnloadEventName, this);
        nativeMethods.windowAddEventListener.call(this.window, this.beforeUnloadEventName, this);
    }

    attach (window) {
        super.attach(window);

        var document  = window.document;
        var listeners = this.listeners;

        listeners.setEventListenerWrapper(window, [this.beforeUnloadEventName], (e, listener) => this._onBeforeUnloadHandler(e, listener));
        listeners.addInternalEventListener(window, ['unload'], () => this.emit(this.UNLOAD_EVENT));

        if (isIE9 || isIE10)
            nativeMethods.addEventListener.call(document, 'click', this);

        nativeMethods.windowAddEventListener.call(window, this.beforeUnloadEventName, this);

        listeners.addInternalEventListener(window, [this.beforeUnloadEventName], () =>
                this.emit(this.BEFORE_BEFORE_UNLOAD_EVENT, {
                    isFakeIEEvent: this.isFakeIEBeforeUnloadEvent
                })
        );

        listeners.on(listeners.EVENT_LISTENER_ATTACHED_EVENT, e => {
            if (e.el === window && e.eventType === this.beforeUnloadEventName)
                this._reattachBeforeUnloadListener();
        });
    }

    setOnBeforeUnload (window, value) {
        if (typeof value === 'function') {

            this.storedBeforeUnloadHandler = value;

            window['on' + this.beforeUnloadEventName] = e => this._onBeforeUnloadHandler(e, value);

            this._reattachBeforeUnloadListener();
        }
        else {
            this.storedBeforeUnloadHandler            = null;
            window['on' + this.beforeUnloadEventName] = null;
        }
    }

    getOnBeforeUnload () {
        return this.storedBeforeUnloadHandler;
    }

    handleEvent (e) {
        if (e.type === this.beforeUnloadEventName)
            this._emitBeforeUnloadEvent();
        else if (e.type === 'click')
            this._onDocumentClick(e);
    }
}
