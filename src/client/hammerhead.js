/*eslint-disable no-native-reassign*/
import * as Browser from './util/browser';
import * as DOM from './util/dom';
import { getAttributesProperty } from './sandboxes/dom-accessor-wrappers';
import * as DOMSandbox from './sandboxes/dom/dom';
import * as ElementEditingWatcher from './sandboxes/event/element-editing-watcher';
import * as Event from './util/event';
import * as EventSimulator from './sandboxes/event/simulator';
import * as FocusBlur from './sandboxes/event/focus-blur';
import * as IFrameSandbox from './sandboxes/iframe';
import * as InfoManager from './sandboxes/upload/info-manager';
import * as JSON from './json';
import JSProcessor from '../processing/js/index';
import * as Listeners from './sandboxes/event/listeners';
import * as MessageSandbox from './sandboxes/message';
import NativeMethods from './sandboxes/native-methods';
import * as Position from './util/position';
import * as Selection from './sandboxes/event/selection';
import * as Service from './util/service';
import * as ShadowUI from './sandboxes/shadow-ui';
import * as Style from './util/style';
import * as Transport from './transport';
import * as Unload from './sandboxes/event/unload';
import * as UploadSandbox from './sandboxes/upload/upload';
import * as Window from './sandboxes/dom/window';
import * as XhrSandbox from './sandboxes/xhr';
/*eslint-enable no-native-reassign*/

// Events
export const BEFORE_BEFORE_UNLOAD_EVENT = Unload.BEFORE_BEFORE_UNLOAD_EVENT;
export const BEFORE_UNLOAD_EVENT        = Unload.BEFORE_UNLOAD_EVENT;
export const BODY_CREATED               = DOMSandbox.BODY_CREATED;
export const DOCUMENT_CLEANED           = DOMSandbox.DOCUMENT_CLEANED;
export const FILE_UPLOADING_EVENT       = UploadSandbox.FILE_UPLOADING_EVENT;
export const IFRAME_READY_TO_INIT       = IFrameSandbox.IFRAME_READY_TO_INIT;
export const UNCAUGHT_JS_ERROR          = Window.UNCAUGHT_JS_ERROR;
export const UNLOAD_EVENT               = Unload.UNLOAD_EVENT;
export const XHR_COMPLETED              = XhrSandbox.XHR_COMPLETED;
export const XHR_ERROR                  = XhrSandbox.XHR_ERROR;
export const XHR_SEND                   = XhrSandbox.XHR_SEND;

var getEventOwner = function (evtName) {
    switch (evtName) {
        case Unload.BEFORE_UNLOAD_EVENT:
        case Unload.BEFORE_BEFORE_UNLOAD_EVENT:
        case Unload.UNLOAD_EVENT:
            return Unload;

        case DOMSandbox.BODY_CREATED:
        case DOMSandbox.DOCUMENT_CLEANED:
            return DOMSandbox;

        case Window.UNCAUGHT_JS_ERROR:
            return Window;

        case UploadSandbox.FILE_UPLOADING_EVENT:
            return UploadSandbox;

        case IFrameSandbox.IFRAME_READY_TO_INIT:
            return IFrameSandbox;

        case XhrSandbox.XHR_COMPLETED:
        case XhrSandbox.XHR_ERROR:
        case XhrSandbox.XHR_SEND:
            return XhrSandbox;

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
export var getOriginElementAttributes = getAttributesProperty;
export var upload                     = UploadSandbox.upload;

// Private members
export var _raiseBodyCreatedEvent    = DOMSandbox.raiseBodyCreatedEvent;
export var _rebindDomSandboxToIframe = DOMSandbox.rebindDomSandboxToIframe;
export var _UploadManager            = InfoManager;

var exports = module.exports;

// Modules
exports.JSON           = JSON;
exports.JSProcessor    = JSProcessor;
exports.MessageSandbox = MessageSandbox;
exports.NativeMethods  = NativeMethods;
exports.ShadowUI       = ShadowUI;
exports.Transport      = Transport;
exports.Util           = {
    Browser:  Browser,
    DOM:      DOM,
    Event:    Event,
    Position: Position,
    Service:  Service,
    Style:    Style
};
exports.EventSandbox   = {
    Listeners:             Listeners,
    FocusBlur:             FocusBlur,
    ElementEditingWatcher: ElementEditingWatcher,
    EventSimulator:        EventSimulator,
    Selection:             Selection
};

exports.init = function () {
    DOMSandbox.init(window, document);
};

exports.get = require;

window.Hammerhead = exports;
