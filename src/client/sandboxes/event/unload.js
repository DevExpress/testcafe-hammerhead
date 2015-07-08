import * as Browser from '../../util/browser';
import * as Listeners from './listeners';
import NativeMethods from '../native-methods';
import * as Service from '../../util/service';

export const BEFORE_UNLOAD_EVENT        = 'beforeUnload';
export const BEFORE_BEFORE_UNLOAD_EVENT = 'beforeBeforeUnload';
export const UNLOAD_EVENT               = 'unload';

var isFakeIEBeforeUnloadEvent     = false;
var storedBeforeUnloadReturnValue = '';
var prevented                     = false;
var eventEmitter                  = new Service.EventEmitter();

//NOTE: this handler should be called after the others
function emitBeforeUnloadEvent () {
    eventEmitter.emit(BEFORE_UNLOAD_EVENT, {
        returnValue:   storedBeforeUnloadReturnValue,
        prevented:     prevented,
        isFakeIEEvent: isFakeIEBeforeUnloadEvent
    });

    isFakeIEBeforeUnloadEvent = false;
}

function onBeforeUnloadHandler (e, originListener) {
    //NOTE: overriding the returnValue property to prevent native dialog
    Object.defineProperty(e, 'returnValue', Service.createPropertyDesc({
        get: function () {
            return storedBeforeUnloadReturnValue;
        },
        set: function (value) {
            //NOTE: in all browsers if any value is set it leads to preventing unload. In Mozilla only if value
            // is an empty string it does not do it.
            storedBeforeUnloadReturnValue = value;

            prevented = Browser.isMozilla ? value !== '' : true;
        }
    }));

    Object.defineProperty(e, 'preventDefault', Service.createPropertyDesc({
        get: function () {
            return function () {
                prevented = true;
            };
        },
        set: function () {
        }
    }));

    var res = originListener(e);

    if (typeof res !== 'undefined') {
        storedBeforeUnloadReturnValue = res;
        prevented                     = true;
    }
}

export var on  = eventEmitter.on.bind(eventEmitter);
export var off = eventEmitter.off.bind(eventEmitter);

export function init (window, document) {
    Listeners.setEventListenerWrapper(window, ['beforeunload'], onBeforeUnloadHandler);

    Listeners.addInternalEventListener(window, ['unload'], function () {
        eventEmitter.emit(UNLOAD_EVENT);
    });

    NativeMethods.addEventListener.call(document, 'click', function (e) {
        var target = e.target || e.srcElement;

        if ((Browser.isIE9 || Browser.isIE10) && target.tagName && target.tagName.toLowerCase() === 'a') {
            var href = NativeMethods.getAttribute.call(target, 'href');

            isFakeIEBeforeUnloadEvent = /(^javascript:)|(^mailto:)|(^tel:)|(^#)/.test(href);
        }
    });

    NativeMethods.windowAddEventListener.call(window, 'beforeunload', emitBeforeUnloadEvent);

    Listeners.addInternalEventListener(window, ['beforeunload'], function () {
        eventEmitter.emit(BEFORE_BEFORE_UNLOAD_EVENT, {
            isFakeIEEvent: isFakeIEBeforeUnloadEvent
        });
    });

    Listeners.on(Listeners.EVENT_LISTENER_ATTACHED_EVENT, function (e) {
        if (e.el === window && e.eventType === 'beforeunload') {

            //NOTE: reattach listener and it'll be the last in the queue
            NativeMethods.windowRemoveEventListener.call(window, 'beforeunload', emitBeforeUnloadEvent);
            NativeMethods.windowAddEventListener.call(window, 'beforeunload', emitBeforeUnloadEvent);
        }
    });
}

var storedBeforeUnloadHandler = null;

export function setOnBeforeUnload (window, value) {
    if (typeof value === 'function') {

        storedBeforeUnloadHandler = value;

        window.onbeforeunload = function (e) {
            return onBeforeUnloadHandler(e, value);
        };

        //NOTE: reattach listener and it'll be the last in the queue
        NativeMethods.windowRemoveEventListener.call(window, 'beforeunload', emitBeforeUnloadEvent);
        NativeMethods.windowAddEventListener.call(window, 'beforeunload', emitBeforeUnloadEvent);
    }
    else {
        storedBeforeUnloadHandler = null;
        window.onbeforeunload          = null;
    }
}

export function getOnBeforeUnload () {
    return storedBeforeUnloadHandler;
}
