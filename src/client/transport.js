/*eslint-disable no-native-reassign*/
import EventEmitter from './utils/event-emitter';
import COMMAND from '../session/command';
import nativeMethods from './sandbox/native-methods';
import settings from './settings';
import { stringify as stringifyJSON, parse as parseJSON } from './json';
import { isWebKit, isIE9 } from './utils/browser';
import { Promise } from 'es6-promise';

/*eslint-enable no-native-reassign*/

class Transport extends EventEmitter {
    constructor () {
        super();

        this.SWITCH_BACK_TO_ASYNC_XHR_DELAY    = 2000;
        this.SERVICE_MESSAGES_WAITING_INTERVAL = 50;
        this.MSG_RECEIVED_EVENT                = 'hammerhead|event|message-received';

        this.msgQueue                     = {};
        this.useAsyncXhr                  = true;
        this.activeServiceMessagesCounter = 0;

        //NOTE: if we are unloading we should switch to sync XHR to be sure that we will not lost any service msgs
        window.addEventListener('beforeunload', () => {
            this.useAsyncXhr = false;

            //NOTE: if unloading was canceled switch back to async XHR
            nativeMethods.setTimeout.call(window, () => this.useAsyncXhr = true, this.SWITCH_BACK_TO_ASYNC_XHR_DELAY);
        }, true);
    }

    static _createXMLHttpRequest (async) {
        var xhr = new nativeMethods.XMLHttpRequest();

        xhr.open('POST', settings.get().serviceMsgUrl, async);
        xhr.setRequestHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

        return xhr;
    }

    static _storeMessage (msg) {
        var storedMessages = Transport._getStoredMessages();

        storedMessages.push(msg);

        window.localStorage.setItem(settings.get().sessionId, stringifyJSON(storedMessages));
    }

    static _getStoredMessages () {
        var storedMessagesStr = window.localStorage.getItem(settings.get().sessionId);

        return storedMessagesStr ? parseJSON(storedMessagesStr) : [];
    }

    static _removeMessageFromStore (cmd) {
        var messages = Transport._getStoredMessages();

        for (var i = 0; i < messages.length; i++) {
            if (messages[i].cmd === cmd) {
                messages.splice(i, 1);

                break;
            }
        }

        window.localStorage.setItem(settings.get().sessionId, stringifyJSON(messages));
    }

    _cookieMsgInProgress () {
        return this.msgQueue[COMMAND.setCookie] && !!this.msgQueue[COMMAND.setCookie].length;
    }

    sendNextQueuedMsg (queueId) {
        var queueItem = this.msgQueue[queueId][0];

        this.asyncServiceMsg(queueItem.msg)
            .then(res => {
                if (queueItem.callback)
                    queueItem.callback(res);

                this.msgQueue[queueId].shift();

                this.emit(this.MSG_RECEIVED_EVENT, {});

                if (this.msgQueue[queueId].length)
                    this.sendNextQueuedMsg(queueId);
            });
    }

    waitCookieMsg () {
        return new Promise(resolve => {
            if (this._cookieMsgInProgress()) {
                var handler = () => {
                    if (!this._cookieMsgInProgress()) {
                        this.off(this.MSG_RECEIVED_EVENT, handler);

                        resolve();
                    }
                };

                this.on(this.MSG_RECEIVED_EVENT, handler);
            }
            else
                resolve();
        });
    }

    //NOTE: use sync method for most important things only
    syncServiceMsg (msg, callback) {
        var storedSync = this.useAsyncXhr;

        this.useAsyncXhr = false;

        this.performRequest(msg, res => {
            this.useAsyncXhr = storedSync;
            callback(res);
        });
    }

    waitForServiceMessagesCompleted (timeout) {
        return new Promise(resolve => {
            if (!this.activeServiceMessagesCounter) {
                resolve();
                return;
            }

            var intervalId = null;
            var timeoutId  = window.setTimeout(() => {
                window.clearInterval(intervalId);
                resolve();
            }, timeout);

            intervalId = window.setInterval(() => {
                if (!this.activeServiceMessagesCounter) {
                    window.clearInterval(intervalId);
                    window.clearTimeout(timeoutId);
                    resolve();
                }
            }, this.SERVICE_MESSAGES_WAITING_INTERVAL);
        });
    }

    //TODO: rewrite this using Promise after getting rid of syncServiceMsg
    performRequest (msg, callback) {
        msg.sessionId = settings.get().sessionId;

        if (isIFrameWithoutSrc)
            msg.referer = settings.get().referer;

        var sendMsg = forced => {
            this.activeServiceMessagesCounter++;

            var requestIsAsync = this.useAsyncXhr;

            if (forced)
                requestIsAsync = false;

            var transport    = this;
            var request      = Transport._createXMLHttpRequest(requestIsAsync);
            var msgCallback  = function () {
                transport.activeServiceMessagesCounter--;

                callback(this.responseText && parseJSON(this.responseText));
            };
            var errorHandler = function () {
                if (isWebKit) {
                    Transport._storeMessage(msg);
                    msgCallback();
                }
                else
                    sendMsg(true);
            };

            if (forced) {
                request.addEventListener('readystatechange', function () {
                    if (this.readyState !== 4)
                        return;

                    msgCallback();
                });
            }
            else if (isIE9) {
                // Aborted ajax requests do not raise the error, abort or timeout events in IE9.
                // Getting a status code raises the c00c023f error.
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

            request.send(stringifyJSON(msg));
        };

        Transport._removeMessageFromStore(msg.cmd);
        sendMsg();
    }

    asyncServiceMsg (msg) {
        return new Promise(resolve => {
            this.performRequest(msg, data => resolve(data));
        });
    }

    batchUpdate () {
        var storedMessages = Transport._getStoredMessages();

        if (storedMessages.length) {
            window.localStorage.removeItem(settings.get().sessionId);

            var tasks = storedMessages.map(item => this.queuedAsyncServiceMsg(item));

            return Promise.all(tasks);
        }
        return Promise.resolve();
    }

    queuedAsyncServiceMsg (msg) {
        return new Promise(resolve => {
            if (!this.msgQueue[msg.cmd])
                this.msgQueue[msg.cmd] = [];

            this.msgQueue[msg.cmd].push({
                msg:      msg,
                callback: resolve
            });

            //NOTE: if we don't have pending msgs except this one then send it immediately
            if (this.msgQueue[msg.cmd].length === 1)
                this.sendNextQueuedMsg(msg.cmd);
        });
    }
}

export default new Transport();
