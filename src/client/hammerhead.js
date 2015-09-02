/*eslint-disable no-native-reassign*/
import * as Browser from './utils/browser';
import * as DOM from './utils/dom';
import * as Event from './utils/event';
import * as Types from './utils/types';
import * as JSON from './json';
import * as Position from './utils/position';
import * as Style from './utils/style';
import * as Transport from './transport';
import JSProcessor from '../processing/js/index';
import Sandbox from './sandbox';
/*eslint-enable no-native-reassign*/

var sandbox = new Sandbox();

var eventSandbox  = sandbox.event;
var nodeSandbox   = sandbox.node;
var uploadSandbox = sandbox.upload;
var iframeSandbox = sandbox.iframe;
var xhrSandbox    = sandbox.xhr;

// Events
export const BEFORE_BEFORE_UNLOAD_EVENT = eventSandbox.unload.BEFORE_BEFORE_UNLOAD_EVENT;
export const BEFORE_UNLOAD_EVENT        = eventSandbox.unload.BEFORE_UNLOAD_EVENT;
export const UNLOAD_EVENT               = eventSandbox.unload.UNLOAD_EVENT;
export const BODY_CREATED               = nodeSandbox.BODY_CREATED;
export const DOCUMENT_CLEANED           = nodeSandbox.DOCUMENT_CLEANED;
export const UNCAUGHT_JS_ERROR          = nodeSandbox.win.UNCAUGHT_JS_ERROR;
export const START_FILE_UPLOADING_EVENT = uploadSandbox.START_FILE_UPLOADING_EVENT;
export const END_FILE_UPLOADING_EVENT   = uploadSandbox.END_FILE_UPLOADING_EVENT;
export const IFRAME_READY_TO_INIT       = iframeSandbox.IFRAME_READY_TO_INIT;
export const XHR_COMPLETED              = xhrSandbox.XHR_COMPLETED;
export const XHR_ERROR                  = xhrSandbox.XHR_ERROR;
export const XHR_SEND                   = xhrSandbox.XHR_SEND;

var getEventOwner = function (evtName) {
    switch (evtName) {
        case eventSandbox.unload.BEFORE_UNLOAD_EVENT:
        case eventSandbox.unload.BEFORE_BEFORE_UNLOAD_EVENT:
        case eventSandbox.unload.UNLOAD_EVENT:
            return eventSandbox.unload;

        case nodeSandbox.BODY_CREATED:
        case nodeSandbox.DOCUMENT_CLEANED:
            return nodeSandbox;

        case nodeSandbox.win.UNCAUGHT_JS_ERROR:
            return nodeSandbox.win;

        case uploadSandbox.START_FILE_UPLOADING_EVENT:
        case uploadSandbox.END_FILE_UPLOADING_EVENT:
            return uploadSandbox;

        case iframeSandbox.IFRAME_READY_TO_INIT:
            return iframeSandbox;

        case xhrSandbox.XHR_COMPLETED:
        case xhrSandbox.XHR_ERROR:
        case xhrSandbox.XHR_SEND:
            return xhrSandbox;

        default:
            return null;
    }
};

export function on (evtName, handler) {
    var eventOwner = getEventOwner(evtName);

    if (eventOwner)
        eventOwner.on(evtName, handler);
}

export function off (evtName, handler) {
    var eventOwner = getEventOwner(evtName);

    if (eventOwner)
        eventOwner.off(evtName, handler);
}

// Methods
export var getOriginElementAttributes = sandbox.codeInstrumentation.getAttributesProperty;
export var upload                     = uploadSandbox.upload;

// Modules
export { JSON, JSProcessor, Transport };
export var MessageSandbox = sandbox.message;

export var NativeMethods = sandbox.nativeMethods;
export var ShadowUI      = sandbox.shadowUI;

export var Util = {
    Browser:  Browser,
    DOM:      DOM,
    Event:    Event,
    Position: Position,
    Style:    Style,
    Types:    Types
};

export var EventSandbox = {
    Listeners:             eventSandbox.listeners,
    FocusBlur:             eventSandbox.focusBlur,
    ElementEditingWatcher: eventSandbox.elementEditingWatcher,
    EventSimulator:        eventSandbox.eventSimulator,
    Selection:             eventSandbox.selection
};

export function init () {
    sandbox.attach(window);
}

export var get     = require;
export var sandbox = sandbox;

window.Hammerhead = exports;
