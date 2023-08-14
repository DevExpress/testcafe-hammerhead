import Promise from 'pinkie';
import Sandbox from './sandbox';
import EventEmitter from './utils/event-emitter';
import XhrSandbox from './sandbox/xhr';
import StyleSandbox from './sandbox/style';
import ElectronSandbox from './sandbox/electron';
import ShadowUISandbox from './sandbox/shadow-ui';
import UploadSandbox from './sandbox/upload';
import ChildWindowSandbox from './sandbox/child-window';
import defaultTarget from './sandbox/child-window/default-target';
import * as hiddenInfoUtils from './sandbox/upload/hidden-info';
import UploadInfoManager from './sandbox/upload/info-manager';
import FileListWrapper from './sandbox/upload/file-list-wrapper';
import domMutationTracker from './sandbox/node/live-node-list/dom-mutation-tracker';
import * as sandboxBackupUtils from './sandbox/backup';
import StorageWrapper from './sandbox/storages/wrapper';
import EventListeners from './sandbox/event/listeners';
import * as listeningContextUtils from './sandbox/event/listening-context';
import CodeInstrumentation from './sandbox/code-instrumentation';
import LocationInstrumentation from './sandbox/code-instrumentation/location';
import LocationWrapper from './sandbox/code-instrumentation/location/wrapper';
import settings from './settings';
import Transport from './transport';
import * as browserUtils from './utils/browser';
import * as destLocationUtils from './utils/destination-location';
import * as domUtils from './utils/dom';
import * as eventUtils from './utils/event';
import * as typeUtils from './utils/types';
import * as positionUtils from './utils/position';
import * as styleUtils from './utils/style';
import * as overridingUtils from './utils/overriding';
import * as cookieUtils from './utils/cookie';
import getMimeType from './utils/get-mime-type';
import urlResolver from './utils/url-resolver';
import trim from '../utils/string-trim';
import * as sharedCookieUtils from '../utils/cookie';
import * as sharedUrlUtils from '../utils/url';
import * as sharedHeadersUtils from '../utils/headers';
import * as sharedStackProcessingUtils from '../utils/stack-processing';
import sharedSelfRemovingScripts from '../utils/self-removing-scripts';
import * as json from '../utils/json';
import * as urlUtils from './utils/url';
import * as featureDetection from './utils/feature-detection';
import * as htmlUtils from './utils/html';
import nativeMethods from './sandbox/native-methods';
import * as scriptProcessingUtils from '../processing/script';
import * as headerProcessingUtils from '../processing/script/header';
import * as instrumentationProcessingUtils from '../processing/script/instrumented';
import SCRIPT_PROCESSING_INSTRUCTIONS from '../processing/script/instruction';
import styleProcessor from '../processing/style';
import DomProcessor from '../processing/dom';
import extend from './utils/extend';
import INTERNAL_PROPS from '../processing/dom/internal-properties';
import INTERNAL_ATTRIBUTES from '../processing/dom/internal-attributes';
import SHADOW_UI_CLASS_NAME from '../shadow-ui/class-name';
import SESSION_COMMAND from '../session/command';
import PageNavigationWatch from './page-navigation-watch';
import domProcessor from './dom-processor';
import { HammerheadInitSettings } from '../typings/client';
import { Dictionary } from '../typings/common';
import removeInjectedScript from './utils/remove-injected-script';


class Hammerhead {
    win: Window & typeof globalThis;
    sandbox: Sandbox;
    pageNavigationWatch: PageNavigationWatch;
    EVENTS: Dictionary<string>;
    PROCESSING_INSTRUCTIONS: Dictionary<any>;
    SHADOW_UI_CLASS_NAME: Dictionary<string>;
    SESSION_COMMAND: Dictionary<string>;
    EventEmitter: any;
    doUpload: Function;
    createNativeXHR: Function;
    processScript: Function;
    get: Function;
    Promise: any;
    json: typeof json;
    transport: Transport;
    nativeMethods: any;
    shadowUI: ShadowUISandbox;
    storages: any;
    eventSandbox: Dictionary<any>;
    utils: Dictionary<any>;
    sharedUtils: Dictionary<any>;
    settings: typeof settings;
    sandboxes: Dictionary<any>;
    sandboxUtils: Dictionary<any>;
    processors: Dictionary<any>;

    constructor () {
        this.win                 = null;
        this.transport           = new Transport();
        this.sandbox             = new Sandbox(this.transport);
        this.pageNavigationWatch = new PageNavigationWatch(this.sandbox.event, this.sandbox.codeInstrumentation,
            this.sandbox.node.element, this.sandbox.childWindow);

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
            windowOpened:            this.sandbox.childWindow.WINDOW_OPENED_EVENT,
            beforeWindowOpened:      this.sandbox.childWindow.BEFORE_WINDOW_OPENED_EVENT,
        };

        this.PROCESSING_INSTRUCTIONS = {
            dom: {
                script:              SCRIPT_PROCESSING_INSTRUCTIONS,
                internal_attributes: INTERNAL_ATTRIBUTES, // eslint-disable-line camelcase
                internal_props:      INTERNAL_PROPS, // eslint-disable-line camelcase
            },
        };

        this.SHADOW_UI_CLASS_NAME = SHADOW_UI_CLASS_NAME;
        this.SESSION_COMMAND      = SESSION_COMMAND;

        this.EventEmitter = EventEmitter;

        // Methods
        this.doUpload        = (input: HTMLInputElement, filePaths: string | string[]) => this.sandbox.upload.doUpload(input, filePaths);
        this.createNativeXHR = XhrSandbox.createNativeXHR;
        this.processScript   = scriptProcessingUtils.processScript;

        // Modules
        this.Promise       = Promise;
        this.json          = json;
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
            DragDataStore:         this.sandbox.event.DragDataStore,
        };

        const processingUtils = {
            script:          scriptProcessingUtils,
            header:          headerProcessingUtils,
            instrumentation: instrumentationProcessingUtils,
        };

        this.utils = {
            browser:              browserUtils,
            dom:                  domUtils,
            event:                eventUtils,
            position:             positionUtils,
            style:                styleUtils,
            types:                typeUtils,
            trim:                 trim,
            extend:               extend,
            html:                 htmlUtils,
            url:                  urlUtils,
            featureDetection:     featureDetection,
            destLocation:         destLocationUtils,
            overriding:           overridingUtils,
            cookie:               cookieUtils,
            getMimeType:          getMimeType,
            urlResolver:          urlResolver,
            processing:           processingUtils,
            removeInjectedScript: removeInjectedScript,
        };

        this.sharedUtils = {
            cookie:              sharedCookieUtils,
            url:                 sharedUrlUtils,
            headers:             sharedHeadersUtils,
            stackProcessing:     sharedStackProcessingUtils,
            selfRemovingScripts: sharedSelfRemovingScripts,
        };

        this.settings = settings;

        this.sandboxes = {
            XhrSandbox,
            StyleSandbox,
            ShadowUISandbox,
            ElectronSandbox,
            UploadSandbox,
            ChildWindowSandbox,
        };

        this.sandboxUtils = {
            hiddenInfo:       hiddenInfoUtils,
            listeningContext: listeningContextUtils,
            backup:           sandboxBackupUtils,
            domMutationTracker,
            defaultTarget,
            UploadInfoManager,
            FileListWrapper,
            EventListeners,
            StorageWrapper,
            CodeInstrumentation,
            LocationInstrumentation,
            LocationWrapper,
        };

        this.processors = {
            styleProcessor,
            domProcessor,
            DomProcessor,
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
            case this.EVENTS.beforeWindowOpened:
                return this.sandbox.childWindow;

            default:
                return null;
        }
    }

    static _cleanLocalStorageServiceData (sessionId: string, window: Window): void {
        const nativeLocalStorage = nativeMethods.winLocalStorageGetter.call(window);

        nativeMethods.storageRemoveItem.call(nativeLocalStorage, sessionId);
    }

    static _setNativeAutomationForComponents (value: boolean): void {
        const components = [
            domProcessor,
            urlResolver,
            styleProcessor,
        ] as any[];

        for (let i = 0; i < components.length; i++)
            components[i].nativeAutomation = value;
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
        const nativeAutomation = settings.nativeAutomation;
        const navigationUrl    = urlUtils.getNavigationUrl(url, this.win, nativeAutomation);

        if (!navigationUrl)
            return;

        // eslint-disable-next-line no-restricted-properties
        if (forceReload && this.win.location.href === navigationUrl)
            this.win.location.reload();
        else
            // @ts-ignore
            this.win.location = navigationUrl;

        if (forceReload) {
            this.sandbox.node.win.on(this.sandbox.node.win.HASH_CHANGE_EVENT, () => {
                this.win.location.reload();
            });
        }

        if (browserUtils.isSafari || browserUtils.isIOS)
            this.pageNavigationWatch.onNavigationTriggered(navigationUrl);
    }

    start (initSettings: HammerheadInitSettings, win: Window & typeof globalThis): void {
        this.win = win || window as Window & typeof globalThis;

        settings.set(initSettings);

        if (initSettings.isFirstPageLoad)
            Hammerhead._cleanLocalStorageServiceData(initSettings.sessionId, this.win);

        domProcessor.forceProxySrcForImage = initSettings.forceProxySrcForImage;
        domProcessor.allowMultipleWindows  = initSettings.allowMultipleWindows;

        Hammerhead._setNativeAutomationForComponents(initSettings.nativeAutomation);

        this.eventSandbox.message.attachWindow(this.win);
        this.transport.start(this.eventSandbox.message, !initSettings.nativeAutomation);
        this.sandbox.attach(this.win);
        this.pageNavigationWatch.start();
    }
}

const hammerhead = new Hammerhead();

// NOTE: The 'load' event is raised after calling document.close for a same-domain iframe
// So, we need to define the '%hammerhead%' variable as 'configurable' so that it can be redefined.
nativeMethods.objectDefineProperty(window, INTERNAL_PROPS.hammerhead, {
    value:        hammerhead,
    configurable: true,
});

export default hammerhead;
