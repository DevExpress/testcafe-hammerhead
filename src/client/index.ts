import Promise from 'pinkie';
import Sandbox from './sandbox';
import EventEmitter from './utils/event-emitter';
import XhrSandbox from './sandbox/xhr';
import settings from './settings';
import Transport from './transport';
import * as JSON from 'json-hammerhead';
import * as browserUtils from './utils/browser';
import * as domUtils from './utils/dom';
import * as eventUtils from './utils/event';
import * as typeUtils from './utils/types';
import * as positionUtils from './utils/position';
import * as styleUtils from './utils/style';
import trim from '../utils/string-trim';
import * as urlUtils from './utils/url';
import * as featureDetection from './utils/feature-detection';
import * as htmlUtils from './utils/html';
import nativeMethods from './sandbox/native-methods';
import { processScript } from '../processing/script';
import {
    SCRIPT_PROCESSING_START_COMMENT,
    SCRIPT_PROCESSING_END_HEADER_COMMENT,
    SCRIPT_PROCESSING_END_COMMENT
} from '../processing/script/header';
import StyleProcessor from '../processing/style';
import extend from './utils/extend';
import INTERNAL_PROPS from '../processing/dom/internal-properties';
import PageNavigationWatch from './page-navigation-watch';
import domProcessor from './dom-processor';
import { HammerheadInitSettings } from '../typings/client';
import { Dictionary } from '../typings/common';
import ShadowUI from './sandbox/shadow-ui';

class Hammerhead {
    win: Window;
    sandbox: Sandbox;
    pageNavigationWatch: PageNavigationWatch;
    EVENTS: Dictionary<string>;
    PROCESSING_COMMENTS: Dictionary<string>;
    EventEmitter: any;
    doUpload: Function;
    createNativeXHR: Function;
    processScript: Function;
    get: Function;
    Promise: any;
    json: any;
    transport: Transport;
    nativeMethods: any;
    shadowUI: ShadowUI;
    storages: any;
    eventSandbox: Dictionary<any>;
    utils: Dictionary<any>;

    constructor () {
        this.win                 = null;
        this.transport           = new Transport();
        this.sandbox             = new Sandbox(this.transport);
        this.pageNavigationWatch = new PageNavigationWatch(this.sandbox.event, this.sandbox.codeInstrumentation,
            this.sandbox.node.element);

        this.EVENTS = {
            beforeFormSubmit:        this.sandbox.node.element.BEFORE_FORM_SUBMIT_EVENT,
            beforeBeforeUnload:      this.sandbox.event.unload.BEFORE_BEFORE_UNLOAD_EVENT,
            beforeUnload:            this.sandbox.event.unload.BEFORE_UNLOAD_EVENT,
            unload:                  this.sandbox.event.unload.UNLOAD_EVENT,
            bodyCreated:             this.sandbox.node.mutation.BODY_CREATED_EVENT,
            documentCleaned:         this.sandbox.node.mutation.DOCUMENT_CLEANED_EVENT,
            uncaughtJsError:         this.sandbox.node.win.UNCAUGHT_JS_ERROR_EVENT,
            unhandledRejection:      this.sandbox.node.win.UNHANDLED_REJECTION_EVENT,
            startFileUploading:      this.sandbox.upload.START_FILE_UPLOADING_EVENT,
            endFileUploading:        this.sandbox.upload.END_FILE_UPLOADING_EVENT,
            evalIframeScript:        this.sandbox.iframe.EVAL_EXTERNAL_SCRIPT_EVENT,
            xhrCompleted:            this.sandbox.xhr.XHR_COMPLETED_EVENT,
            xhrError:                this.sandbox.xhr.XHR_ERROR_EVENT,
            beforeXhrSend:           this.sandbox.xhr.BEFORE_XHR_SEND_EVENT,
            fetchSent:               this.sandbox.fetch.FETCH_REQUEST_SENT_EVENT,
            pageNavigationTriggered: this.pageNavigationWatch.PAGE_NAVIGATION_TRIGGERED_EVENT,
            scriptElementAdded:      this.sandbox.node.element.SCRIPT_ELEMENT_ADDED_EVENT,
            consoleMethCalled:       this.sandbox.console.CONSOLE_METH_CALLED_EVENT,
            windowOpened:            this.sandbox.childWindow.WINDOW_OPENED_EVENT
        };

        this.PROCESSING_COMMENTS = {
            stylesheetStart: StyleProcessor.STYLESHEET_PROCESSING_START_COMMENT,
            stylesheetEnd:   StyleProcessor.STYLESHEET_PROCESSING_END_COMMENT,
            scriptStart:     SCRIPT_PROCESSING_START_COMMENT,
            scriptEndHeader: SCRIPT_PROCESSING_END_HEADER_COMMENT,
            scriptEnd:       SCRIPT_PROCESSING_END_COMMENT
        };

        this.EventEmitter = EventEmitter;

        // Methods
        this.doUpload        = (input: HTMLInputElement, filePaths: string | string[]) => this.sandbox.upload.doUpload(input, filePaths);
        this.createNativeXHR = XhrSandbox.createNativeXHR;

        this.processScript = processScript;

        // NOTE: We should provide a function to retrieve modules, because hammerhead will be bundled into a single
        // file and we will not have access to the internal modules by default.
        // eslint-disable-next-line no-undef
        this.get = require;

        // Modules
        this.Promise       = Promise;
        this.json          = JSON;
        this.nativeMethods = this.sandbox.nativeMethods;
        this.shadowUI      = this.sandbox.shadowUI;
        this.storages      = this.sandbox.storageSandbox;

        this.eventSandbox = {
            listeners:             this.sandbox.event.listeners,
            hover:                 this.sandbox.event.hover,
            focusBlur:             this.sandbox.event.focusBlur,
            elementEditingWatcher: this.sandbox.event.elementEditingWatcher,
            eventSimulator:        this.sandbox.event.eventSimulator,
            selection:             this.sandbox.event.selection,
            message:               this.sandbox.event.message,
            timers:                this.sandbox.event.timers,
            DataTransfer:          this.sandbox.event.DataTransfer,
            DragDataStore:         this.sandbox.event.DragDataStore
        };

        this.utils = {
            browser:          browserUtils,
            dom:              domUtils,
            event:            eventUtils,
            position:         positionUtils,
            style:            styleUtils,
            types:            typeUtils,
            trim:             trim,
            extend:           extend,
            html:             htmlUtils,
            url:              urlUtils,
            featureDetection: featureDetection
        };
    }

    _getEventOwner (evtName: string) {
        switch (evtName) {
            case this.EVENTS.pageNavigationTriggered:
                return this.pageNavigationWatch;

            case this.EVENTS.beforeUnload:
            case this.EVENTS.beforeBeforeUnload:
            case this.EVENTS.unload:
                return this.sandbox.event.unload;

            case this.EVENTS.bodyCreated:
            case this.EVENTS.documentCleaned:
                return this.sandbox.node.mutation;

            case this.EVENTS.uncaughtJsError:
            case this.EVENTS.unhandledRejection:
                return this.sandbox.node.win;

            case this.EVENTS.startFileUploading:
            case this.EVENTS.endFileUploading:
                return this.sandbox.upload;

            case this.EVENTS.evalIframeScript:
                return this.sandbox.iframe;

            case this.EVENTS.xhrCompleted:
            case this.EVENTS.xhrError:
            case this.EVENTS.beforeXhrSend:
                return this.sandbox.xhr;

            case this.EVENTS.beforeFormSubmit:
            case this.EVENTS.scriptElementAdded:
                return this.sandbox.node.element;

            case this.EVENTS.fetchSent:
                return this.sandbox.fetch;

            case this.EVENTS.consoleMethCalled:
                return this.sandbox.console;

            case this.EVENTS.windowOpened:
                return this.sandbox.childWindow;

            default:
                return null;
        }
    }

    static _cleanLocalStorageServiceData (sessionId: string, window: Window) {
        nativeMethods.winLocalStorageGetter.call(window).removeItem(sessionId);
    }

    on (evtName: string, handler: Function): void {
        const eventOwner = this._getEventOwner(evtName);

        if (eventOwner)
            eventOwner.on(evtName, handler);
    }

    off (evtName: string, handler: Function): void {
        const eventOwner = this._getEventOwner(evtName);

        if (eventOwner)
            eventOwner.off(evtName, handler);
    }

    navigateTo (url: string, forceReload: boolean): void {
        const navigationUrl = urlUtils.getNavigationUrl(url, this.win);

        if (!navigationUrl)
            return;

        // @ts-ignore
        this.win.location = navigationUrl;

        if (forceReload) {
            this.sandbox.node.win.on(this.sandbox.node.win.HASH_CHANGE_EVENT, () => {
                this.win.location.reload(true);
            });
        }
    }

    start (initSettings: HammerheadInitSettings | null, win: Window): void {
        this.win = win || window;

        if (initSettings) {
            settings.set(initSettings);

            if (initSettings.isFirstPageLoad)
                Hammerhead._cleanLocalStorageServiceData(initSettings.sessionId, this.win);

            domProcessor.forceProxySrcForImage = initSettings.forceProxySrcForImage;
            domProcessor.allowMultipleWindows  = initSettings.allowMultipleWindows;
        }

        this.transport.start(this.eventSandbox.message);
        this.sandbox.attach(this.win);
        this.pageNavigationWatch.start();
    }
}

const hammerhead = new Hammerhead();

// NOTE: The 'load' event is raised after calling document.close for a same-domain iframe
// So, we need to define the '%hammerhead%' variable as 'configurable' so that it can be redefined.
nativeMethods.objectDefineProperty(window, INTERNAL_PROPS.hammerhead, {
    value:        hammerhead,
    configurable: true
});

export default hammerhead;
