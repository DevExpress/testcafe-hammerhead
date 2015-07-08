/*eslint-disable no-native-reassign*/
import * as JSON from './json';
import NativeMethods from './sandboxes/native-methods';
import ServiceCommands from '../service-msg-cmd';
import * as Browser from './util/browser';
import * as Service from './util/service';
import Settings from './settings';

/*eslint-enable no-native-reassign*/

//Const
var SWITCH_BACK_TO_ASYNC_XHR_DELAY    = 2000;
var SERVICE_MESSAGES_WAITING_INTERVAL = 50;
var MSG_RECEIVED                      = 'received';

//Globals
var eventEmitter                 = new Service.EventEmitter();
var msgQueue                     = {};
var useAsyncXhr                  = true;
var activeServiceMessagesCounter = 0;
var Transport                    = {};

//NOTE: if we are unloading we should switch to sync XHR to be sure that we will not lost any service msgs
window.addEventListener('beforeunload', function () {
    useAsyncXhr = false;

    //NOTE: if unloading was canceled switch back to async XHR
    NativeMethods.setTimeout.call(window, function () {
        useAsyncXhr = true;
    }, SWITCH_BACK_TO_ASYNC_XHR_DELAY);
}, true);

Transport.sendNextQueuedMsg = function (queueId) {
    var queueItem = msgQueue[queueId][0];

    Transport.asyncServiceMsg(queueItem.msg, function (res) {
        if (queueItem.callback)
            queueItem.callback(res);

        msgQueue[queueId].shift();

        eventEmitter.emit(MSG_RECEIVED, {});

        if (msgQueue[queueId].length)
            Transport.sendNextQueuedMsg(queueId);
    });
};

function storeMessage (msg) {
    var storedMessages = getStoredMessages();

    storedMessages.push(msg);

    window.localStorage.setItem(Settings.get().JOB_UID, JSON.stringify(storedMessages));
}

function getStoredMessages () {
    var storedMessagesStr = window.localStorage.getItem(Settings.get().JOB_UID);

    return storedMessagesStr ? JSON.parse(storedMessagesStr) : [];
}

function removeMessageFromStore (cmd) {
    var messages = getStoredMessages();

    for (var i = 0; i < messages.length; i++) {
        if (messages[i].cmd === cmd) {
            messages.splice(i, 1);

            break;
        }
    }

    window.localStorage.setItem(Settings.get().JOB_UID, JSON.stringify(messages));
}

function createXMLHttpRequest (async) {
    var xhr = new NativeMethods.XMLHttpRequest();

    xhr.open('POST', Settings.get().SERVICE_MSG_URL, async);
    xhr.setRequestHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

    return xhr;
}

function cookieMsgInProgress () {
    return msgQueue[ServiceCommands.SET_COOKIE] && !!msgQueue[ServiceCommands.SET_COOKIE].length;
}

Transport.waitCookieMsg = function (callback) {
    /*eslint-disable indent*/
    if (cookieMsgInProgress()) {
        var handler = function () {
            if (!cookieMsgInProgress()) {
                eventEmitter.off(MSG_RECEIVED, handler);

                callback();
            }
        };

        eventEmitter.on(MSG_RECEIVED, handler);
    }
    else
        callback();
    /*eslint-enable indent*/
};

//NOTE: use sync method for most important things only
Transport.syncServiceMsg = function (msg, callback) {
    var storedSync = useAsyncXhr;

    useAsyncXhr = false;

    Transport.asyncServiceMsg(msg, function (res) {
        useAsyncXhr = storedSync;
        callback(res);
    });
};

Transport.waitForServiceMessagesCompleted = function (callback, timeout) {
    if (!activeServiceMessagesCounter) {
        callback();
        return;
    }

    var intervalId = null;
    var timeoutId  = window.setTimeout(function () {
        window.clearInterval(intervalId);
        callback();
    }, timeout);

    intervalId = window.setInterval(function () {
        if (!activeServiceMessagesCounter) {
            window.clearInterval(intervalId);
            window.clearTimeout(timeoutId);
            callback();
        }
    }, SERVICE_MESSAGES_WAITING_INTERVAL);
};

Transport.asyncServiceMsg = function (msg, callback) {
    msg.jobUid        = Settings.get().JOB_UID;
    msg.jobOwnerToken = Settings.get().JOB_OWNER_TOKEN;

    if (isIFrameWithoutSrc)
        msg.referer = Settings.get().REFERER;

    var sendMsg = function (forced) {
        activeServiceMessagesCounter++;

        var requestIsAsync = useAsyncXhr;

        if (forced)
            requestIsAsync = false;

        var request      = createXMLHttpRequest(requestIsAsync);
        var msgCallback  = function () {
            activeServiceMessagesCounter--;

            if (callback)
                callback(this.responseText && JSON.parse(this.responseText));
        };
        var errorHandler = function () {
            /*eslint-disable indent*/
            if (Browser.isWebKit) {
                storeMessage(msg);
                msgCallback();
            }
            else
                sendMsg(true);
            /*eslint-enable indent*/
        };

        if (forced)
            request.addEventListener('readystatechange', function () {
                if (this.readyState !== 4)
                    return;

                msgCallback();
            });
        else if (Browser.isIE9) {
            //aborted ajax request in IE9 not raise error, abort or timeout events
            //also getting status code raise error c00c023f
            request.addEventListener('readystatechange', function () {
                if (this.readyState !== 4)
                    return;

                var status = 0;

                try {
                    status = this.status;
                }
                catch (e) {
                    errorHandler();
                }

                if (status === 200)
                    msgCallback.call(this);
            });
        }
        else {
            request.addEventListener('load', msgCallback);
            request.addEventListener('abort', errorHandler);
            request.addEventListener('error', errorHandler);
            request.addEventListener('timeout', errorHandler);
        }

        request.send(JSON.stringify(msg));
    };

    removeMessageFromStore(msg.cmd);
    sendMsg();
};

/*eslint-disable no-loop-func*/
function asyncForeach (arr, iterator, callback) {
    var completed = 0;

    for (var i = 0; i < arr.length; i++) {
        iterator(arr[i], function (err) {
            if (err) {
                callback(err);
                callback = function () {
                };
            }
            else {
                completed++;

                if (completed === arr.length)
                    callback();
            }
        });
    }
}
/*eslint-enable no-loop-func*/

Transport.batchUpdate = function (updateCallback) {
    var storedMessages = getStoredMessages();

    /*eslint-disable indent*/
    if (storedMessages.length) {
        window.localStorage.removeItem(Settings.get().JOB_UID);

        asyncForeach(storedMessages, Transport.queuedAsyncServiceMsg, updateCallback);
    }
    else
        updateCallback();
    /*eslint-enable indent*/
};

Transport.queuedAsyncServiceMsg = function (msg, callback) {
    if (!msgQueue[msg.cmd])
        msgQueue[msg.cmd] = [];

    msgQueue[msg.cmd].push({
        msg:      msg,
        callback: callback
    });

    //NOTE: if we don't have pending msgs except this one then send it immediately
    if (msgQueue[msg.cmd].length === 1)
        Transport.sendNextQueuedMsg(msg.cmd);
};

export default Transport;
