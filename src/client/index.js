/*eslint-disable no-native-reassign*/
import Sandbox from './sandbox';
import settings from './settings';
import transport from './transport';
import jsProcessor from '../processing/js/index';
import * as browserUtils from './utils/browser';
import * as domUtils from './utils/dom';
import * as eventUtils from './utils/event';
import * as typeUtils from './utils/types';
import * as JSON from './json';
import * as positionUtils from './utils/position';
import * as styleUtils from './utils/style';
/*eslint-enable no-native-reassign*/

class Hammerhead {
    constructor () {
        this.sandbox = new Sandbox();

        this.EVENTS = {
            beforeBeforeUnload: this.sandbox.event.unload.BEFORE_BEFORE_UNLOAD_EVENT,
            beforeUnload:       this.sandbox.event.unload.BEFORE_UNLOAD_EVENT,
            upload:             this.sandbox.event.unload.UNLOAD_EVENT,
            bodyCreated:        this.sandbox.node.BODY_CREATED_EVENT,
            documentCleaned:    this.sandbox.node.DOCUMENT_CLEANED_EVENT,
            uncaughtJsError:    this.sandbox.node.win.UNCAUGHT_JS_ERROR_EVENT,
            startFileUploading: this.sandbox.upload.START_FILE_UPLOADING_EVENT,
            endFileUploading:   this.sandbox.upload.END_FILE_UPLOADING_EVENT,
            iframeReadyToInit:  this.sandbox.iframe.IFRAME_READY_TO_INIT_EVENT,
            xhrCompleted:       this.sandbox.xhr.XHR_COMPLETED_EVENT,
            xhrError:           this.sandbox.xhr.XHR_ERROR_EVENT,
            xhrSend:            this.sandbox.xhr.XHR_SEND_EVENT
        };

        // Methods
        this.getOriginElementAttributes = this.sandbox.codeInstrumentation.getAttributesProperty;
        this.upload                     = this.sandbox.upload.upload;
        this.get                        = require;

        // Modules
        this.JSON           = JSON;
        this.JSProcessor    = jsProcessor;
        this.Transport      = transport;
        this.MessageSandbox = this.sandbox.message;
        this.NativeMethods  = this.sandbox.nativeMethods;
        this.ShadowUI       = this.sandbox.shadowUI;
        this.EventSandbox   = {
            Listeners:             this.sandbox.event.listeners,
            FocusBlur:             this.sandbox.event.focusBlur,
            ElementEditingWatcher: this.sandbox.event.elementEditingWatcher,
            EventSimulator:        this.sandbox.event.eventSimulator,
            Selection:             this.sandbox.event.selection
        };
        this.Util           = {
            Browser:  browserUtils,
            DOM:      domUtils,
            Event:    eventUtils,
            Position: positionUtils,
            Style:    styleUtils,
            Types:    typeUtils
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
                return this.sandbox.node;

            case this.EVENTS.uncaughtJsError:
                return this.sandbox.node.win;

            case this.EVENTS.startFileUploading:
            case this.EVENTS.endFileUploading:
                return this.sandbox.upload;

            case this.EVENTS.iframeReadyToInit:
                return this.sandbox.iframe;

            case this.EVENTS.xhrCompleted:
            case this.EVENTS.xhrError:
            case this.EVENTS.xhrSend:
                return this.sandbox.xhr;

            default:
                return null;
        }
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

    start (initSettings, win) {
        if (initSettings)
            settings.set(initSettings);

        this.sandbox.attach(win || window);
    }
}

var hammerhead = new Hammerhead();

window.Hammerhead = hammerhead;

export default hammerhead;
