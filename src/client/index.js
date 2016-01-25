import Promise from 'pinkie';
import Sandbox from './sandbox';
import CodeInstrumentation from './sandbox/code-instrumentation';
import EventEmitter from './utils/event-emitter';
import settings from './settings';
import transport from './transport';
/*eslint-disable no-native-reassign*/
import * as JSON from './json';
/*eslint-enable no-native-reassign*/
import * as browserUtils from './utils/browser';
import * as domUtils from './utils/dom';
import * as eventUtils from './utils/event';
import * as typeUtils from './utils/types';
import * as positionUtils from './utils/position';
import * as styleUtils from './utils/style';
import trim from '../utils/string-trim';
import { getProxyUrl } from './utils/url';
import isJQueryObj from './utils/is-jquery-object';
import extend from './utils/extend';

class Hammerhead {
    constructor () {
        this.win     = null;
        this.sandbox = new Sandbox();

        this.EVENTS = {
            beforeBeforeUnload: this.sandbox.event.unload.BEFORE_BEFORE_UNLOAD_EVENT,
            beforeUnload:       this.sandbox.event.unload.BEFORE_UNLOAD_EVENT,
            upload:             this.sandbox.event.unload.UNLOAD_EVENT,
            bodyCreated:        this.sandbox.node.mutation.BODY_CREATED_EVENT,
            documentCleaned:    this.sandbox.node.mutation.DOCUMENT_CLEANED_EVENT,
            uncaughtJsError:    this.sandbox.node.win.UNCAUGHT_JS_ERROR_EVENT,
            startFileUploading: this.sandbox.upload.START_FILE_UPLOADING_EVENT,
            endFileUploading:   this.sandbox.upload.END_FILE_UPLOADING_EVENT,
            evalIframeScript:   this.sandbox.iframe.EVAL_EXTERNAL_SCRIPT,
            xhrCompleted:       this.sandbox.xhr.XHR_COMPLETED_EVENT,
            xhrError:           this.sandbox.xhr.XHR_ERROR_EVENT,
            xhrSend:            this.sandbox.xhr.XHR_SEND_EVENT
        };

        this.EventEmitter = EventEmitter;

        // Methods
        this.getOriginElementAttributes = CodeInstrumentation.getAttributesProperty;
        this.doUpload                   = (input, filePaths) => this.sandbox.upload.doUpload(input, filePaths);

        // NOTE: We should provide a function to retrieve modules, because hammerhead will be bundled into a single
        // file and we will not have access to the internal modules by default.
        this.get = require;

        // Modules
        this.Promise       = Promise;
        this.json          = JSON;
        this.transport     = transport;
        this.nativeMethods = this.sandbox.nativeMethods;
        this.shadowUI      = this.sandbox.shadowUI;

        this.eventSandbox = {
            listeners:             this.sandbox.event.listeners,
            hover:                 this.sandbox.event.hover,
            focusBlur:             this.sandbox.event.focusBlur,
            elementEditingWatcher: this.sandbox.event.elementEditingWatcher,
            eventSimulator:        this.sandbox.event.eventSimulator,
            selection:             this.sandbox.event.selection,
            message:               this.sandbox.event.message
        };

        this.utils = {
            browser:     browserUtils,
            dom:         domUtils,
            event:       eventUtils,
            position:    positionUtils,
            style:       styleUtils,
            types:       typeUtils,
            trim:        trim,
            isJQueryObj: isJQueryObj,
            extend:      extend
        };
    }

    _getEventOwner (evtName) {
        switch (evtName) {
            case this.EVENTS.beforeUnload:
            case this.EVENTS.beforeBeforeUnload:
            case this.EVENTS.upload:
                return this.sandbox.event.unload;

            case this.EVENTS.bodyCreated:
            case this.EVENTS.documentCleaned:
                return this.sandbox.node.mutation;

            case this.EVENTS.uncaughtJsError:
                return this.sandbox.node.win;

            case this.EVENTS.startFileUploading:
            case this.EVENTS.endFileUploading:
                return this.sandbox.upload;

            case this.EVENTS.evalIframeScript:
                return this.sandbox.iframe;

            case this.EVENTS.xhrCompleted:
            case this.EVENTS.xhrError:
            case this.EVENTS.xhrSend:
                return this.sandbox.xhr;

            default:
                return null;
        }
    }

    static _cleanLocalStorageServiceData (sessionId, window) {
        window.localStorage.removeItem(sessionId);
    }

    on (evtName, handler) {
        var eventOwner = this._getEventOwner(evtName);

        if (eventOwner)
            eventOwner.on(evtName, handler);
    }

    off (evtName, handler) {
        var eventOwner = this._getEventOwner(evtName);

        if (eventOwner)
            eventOwner.off(evtName, handler);
    }

    navigateTo (url) {
        this.win.location = getProxyUrl(url);
    }


    start (initSettings, win) {
        this.win = win || window;

        if (initSettings) {
            settings.set(initSettings);

            if (initSettings.isFirstPageLoad)
                Hammerhead._cleanLocalStorageServiceData(initSettings.sessionId, this.win);
        }

        this.sandbox.attach(this.win);
    }
}

var hammerhead = new Hammerhead();

Object.defineProperty(window, '%hammerhead%', {
    enumerable:   false,
    configurable: false,
    writable:     false,
    value:        hammerhead
});

export default hammerhead;
