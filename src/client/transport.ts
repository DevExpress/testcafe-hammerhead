import nativeMethods from './sandbox/native-methods';
import settings from './settings';
import XhrSandbox from './sandbox/xhr';
// @ts-ignore
import { stringify as stringifyJSON, parse as parseJSON } from 'json-hammerhead';
import { isWebKit, isFirefox } from './utils/browser';
import createUnresolvablePromise from './utils/create-unresolvable-promise';
import noop from './utils/noop';
// @ts-ignore
import Promise from 'pinkie';
import { isIframeWithoutSrc, getFrameElement } from './utils/dom';

const SERVICE_MESSAGES_WAITING_INTERVAL: number = 50;

class Transport {
    msgQueue: any;
    activeServiceMessagesCounter: number;
    shouldAddRefferer: boolean;

    constructor () {
        this.msgQueue                     = {};
        this.activeServiceMessagesCounter = 0;
        this.shouldAddRefferer = Transport._shouldAddReferrer();
    }

    static _shouldAddReferrer (): boolean {
        const frameElement = getFrameElement(window);

        return frameElement && isIframeWithoutSrc(frameElement);
    }

    static _storeMessage (msg): void {
        const storedMessages = Transport._getStoredMessages();

        storedMessages.push(msg);

        nativeMethods.winLocalStorageGetter.call(window).setItem(settings.get().sessionId, stringifyJSON(storedMessages));
    }

    static _getStoredMessages (): Array<any> {
        const storedMessagesStr = nativeMethods.winLocalStorageGetter.call(window).getItem(settings.get().sessionId);

        return storedMessagesStr ? parseJSON(storedMessagesStr) : [];
    }

    static _removeMessageFromStore (cmd): void {
        const messages = Transport._getStoredMessages();

        for (let i = 0; i < messages.length; i++) {
            if (messages[i].cmd === cmd) {
                messages.splice(i, 1);

                break;
            }
        }

        nativeMethods.winLocalStorageGetter.call(window).setItem(settings.get().sessionId, stringifyJSON(messages));
    }

    // TODO: Rewrite this using Promise after getting rid of syncServiceMsg.
    _performRequest (msg, callback): void {
        msg.sessionId = settings.get().sessionId;

        if (this.shouldAddRefferer)
            msg.referer = settings.get().referer;

        const sendMsg = (forced?: boolean) => {
            this.activeServiceMessagesCounter++;

            const isAsyncRequest = !forced;
            const transport      = this;
            let request          = XhrSandbox.createNativeXHR();

            const msgCallback = function () {
                // NOTE: The 500 status code is returned by server when an error occurred into service message handler
                if (nativeMethods.xhrStatusGetter.call(this) === 500 && this.responseText) {
                    msg.disableResending = true;
                    errorHandler.call(this); // eslint-disable-line no-use-before-define
                    return;
                }

                transport.activeServiceMessagesCounter--;

                const response = this.responseText && parseJSON(this.responseText);

                request = null;
                callback(null, response);
            };

            const errorHandler = function () {
                if (msg.disableResending) {
                    transport.activeServiceMessagesCounter--;

                    let errorMsg = `XHR request failed with ${request.status} status code.`;

                    if (this.responseText)
                        errorMsg += `\nError message: ${this.responseText}`;

                    callback(new Error(errorMsg));

                    return;
                }

                if (isWebKit || isFirefox) {
                    Transport._storeMessage(msg);
                    msgCallback.call(this);
                }
                else
                    sendMsg(true);
            };

            XhrSandbox.openNativeXhr(request, settings.get().serviceMsgUrl, isAsyncRequest);

            if (forced) {
                request.addEventListener('readystatechange', function () {
                    if (this.readyState !== 4)
                        return;

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

    waitForServiceMessagesCompleted (timeout: number): Promise<void> {
        return new Promise(resolve => {
            if (!this.activeServiceMessagesCounter) {
                resolve();
                return;
            }

            let intervalId  = null;
            const timeoutId = window.setTimeout(() => {
                nativeMethods.clearInterval.call(window, intervalId);
                resolve();
            }, timeout);

            intervalId = window.setInterval(() => {
                if (!this.activeServiceMessagesCounter) {
                    nativeMethods.clearInterval.call(window, intervalId);
                    nativeMethods.clearTimeout.call(window, timeoutId);
                    resolve();
                }
            }, SERVICE_MESSAGES_WAITING_INTERVAL);
        });
    }

    asyncServiceMsg (msg): Promise<any> {
        return new Promise((resolve, reject) => {
            this._performRequest(msg, (err, data) => {
                if (!err)
                    resolve(data);
                else if (msg.allowRejecting)
                    reject(err);
            });
        });
    }

    batchUpdate (): Promise<any> {
        const storedMessages = Transport._getStoredMessages();

        if (storedMessages.length) {
            const tasks = [];

            nativeMethods.winLocalStorageGetter.call(window).removeItem(settings.get().sessionId);

            for (const storedMessage of storedMessages)
                tasks.push(this.queuedAsyncServiceMsg(storedMessage));

            return Promise.all(tasks);
        }
        return Promise.resolve();
    }

    queuedAsyncServiceMsg (msg): Promise<any> {
        if (!this.msgQueue[msg.cmd])
            this.msgQueue[msg.cmd] = Promise.resolve();

        const isRejectingAllowed = msg.allowRejecting;

        msg.allowRejecting = true;

        this.msgQueue[msg.cmd] = this.msgQueue[msg.cmd]
            .catch(noop)
            .then(() => this.asyncServiceMsg(msg));

        return this.msgQueue[msg.cmd]
            .catch(err => {
                if (isRejectingAllowed)
                    return Promise.reject(err);

                return createUnresolvablePromise();
            });
    }
}

export default new Transport();
