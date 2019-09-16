/* eslint-disable no-unused-vars */
import { ServiceMessage } from '../typings/proxy';
/* eslint-enable no-unused-vars */
import nativeMethods from './sandbox/native-methods';
import settings from './settings';
// @ts-ignore
import json from 'json-hammerhead';
// import { isWebKit, isFirefox } from './utils/browser';
//import { isIframeWithoutSrc, getFrameElement } from './utils/dom';
import createUnresolvablePromise from './utils/create-unresolvable-promise';
import noop from './utils/noop';
// @ts-ignore
import Promise from 'pinkie';
import IntegerIdGenerator from './utils/integer-id-generator';

const SERVICE_MESSAGES_WAITING_INTERVAL: number = 50;
const RECONNECTION_TIMEOUT = 200;

export default class Transport {
    private readonly _messageIdGenerator: IntegerIdGenerator = new IntegerIdGenerator();
    private readonly _msgQueue: { [command: string]: Promise<any> } = {};
    private _pendingMessages: Array<string> = [];
    private _isConnected: boolean = false;
    private _socket: WebSocket|null;
    private _callbacks: Map<number, { resolve: Function, reject: Function }> = new Map();

    constructor () {
    }

    private _onMessage (e: MessageEvent) {
        const answer = json.parse(e.data);
        const callbacks = this._callbacks.get(answer.id);

        if (callbacks) {
            if (answer.err)
                callbacks.reject(answer.err);
            else
                callbacks.resolve(answer.result);

            this._callbacks.delete(answer.id);
        }
    }

    private _onConnectionOpen () {
        this._isConnected = true;

        for (const msg of this._pendingMessages)
            this._socket.send(msg);
    }

    private _onConnectionClose (e: CloseEvent) {
        this._isConnected = false;
        this._socket = null;

        if (!e.wasClean)
            nativeMethods.setTimeout.call(window, () => this.createConnection(), RECONNECTION_TIMEOUT);
    }

    private _sendMessage (msg: ServiceMessage): Promise<any> {
        msg.sessionId = settings.get().sessionId;
        msg.id        = this._messageIdGenerator.increment();

        return new Promise((resolve, reject) => {
            this._callbacks.set(msg.id, { resolve, reject });

            const msgStr = json.stringify(msg);

            if (this._isConnected)
                this._socket.send(msgStr);
            else
                this._pendingMessages.push(msgStr);
        });

        //     const errorHandler = function () {
        //         if (msg.disableResending) {
        //             transport.activeServiceMessagesCounter--;
        //
        //             let errorMsg = `XHR request failed with ${request.status} status code.`;
        //
        //             if (this.responseText)
        //                 errorMsg += `\nError message: ${this.responseText}`;
        //
        //             callback(new Error(errorMsg));
        //
        //             return;
        //         }
        //
        //         if (isWebKit || isFirefox) {
        //             Transport._storeMessage(msg);
        //             msgCallback.call(this);
        //         }
        //         else
        //             sendMsg(true);
        //     };
        // };
        //
        // Transport._removeMessageFromStore(msg.cmd);
        // sendMsg();
    }

    createConnection () {
        if (window !== window.top)
            return;

        // @ts-ignore
        let pre = window.errorLog;

        if (!pre) {
            // @ts-ignore
            window.errorLog = pre = nativeMethods.createElement.call(document, 'pre');

            pre.id = 'error-log';
            pre.style.position = 'fixed';
            pre.style.backgroundColor = 'red';
            pre.style.color = 'white';
            pre.style.width = '600px';
            pre.style.right = '0';
            pre.style.top = '0';
            pre.style.height = '600px';

            setTimeout(() => {
                document.body.appendChild(pre);
            }, 1000);
        }

        // eslint-disable-next-line no-restricted-properties
        const socket: WebSocket = new nativeMethods.WebSocket(settings.get().serviceMsgUrl);

        pre.appendChild(document.createTextNode(settings.get().serviceMsgUrl + '\n'));

        socket.addEventListener('error', (e: Event) => {
            pre.appendChild(document.createTextNode('error' + '\n'));
            // @ts-ignore
            pre.appendChild(document.createTextNode(e.message + '\n'));

            nativeMethods.consoleMeths.error.call(console, e);
        });
        socket.addEventListener('open', () => {
            pre.appendChild(document.createTextNode('open\n'));

            this._onConnectionOpen();
        });
        socket.addEventListener('message', (e: MessageEvent) => this._onMessage(e));
        socket.addEventListener('close', (e: CloseEvent) => {
            pre.appendChild(document.createTextNode('close' + '\n'));
            // @ts-ignore
            pre.appendChild(document.createTextNode((e.wasClean ? 'Connection closed clean' : 'Connection error') + '\n' + 'Code: ' + e.code + ' reason: ' + e.reason + '\n'));

            this._onConnectionClose(e);
        });

        this._socket = socket;
    }

    waitForServiceMessagesCompleted (timeout: number): Promise<void> {
        return new Promise(resolve => {
            if (!this._callbacks.size) {
                resolve();
                return;
            }

            let intervalId  = null;
            const timeoutId = nativeMethods.setTimeout.call(window, () => {
                nativeMethods.clearInterval.call(window, intervalId);
                resolve();
            }, timeout);

            intervalId = window.setInterval(() => {
                if (this._callbacks.size)
                    return;

                nativeMethods.clearInterval.call(window, intervalId);
                nativeMethods.clearTimeout.call(window, timeoutId);
                resolve();
            }, SERVICE_MESSAGES_WAITING_INTERVAL);
        });
    }

    asyncServiceMsg (msg: ServiceMessage): Promise<any> {
        return this._sendMessage(msg)
            .catch(err => msg.allowRejecting && Promise.reject(err));
    }

    batchUpdate (): Promise<any> {
        const storedMessages = [];//Transport._getStoredMessages();

        if (storedMessages.length) {
            const tasks = [];

            nativeMethods.winLocalStorageGetter.call(window).removeItem(settings.get().sessionId);

            for (const storedMessage of storedMessages)
                tasks.push(this.queuedAsyncServiceMsg(storedMessage));

            return Promise.all(tasks);
        }
        return Promise.resolve();
    }

    queuedAsyncServiceMsg (msg: ServiceMessage): Promise<any> {
        if (!this._msgQueue[msg.cmd])
            this._msgQueue[msg.cmd] = Promise.resolve();

        const isRejectingAllowed = msg.allowRejecting;

        msg.allowRejecting = true;

        this._msgQueue[msg.cmd] = this._msgQueue[msg.cmd]
            .catch(noop)
            .then(() => this.asyncServiceMsg(msg));

        return this._msgQueue[msg.cmd]
            .catch(err => {
                if (isRejectingAllowed)
                    return Promise.reject(err);

                return createUnresolvablePromise();
            });
    }
}

// class Transport {
//     static _shouldAddReferrer (): boolean {
//         const frameElement = getFrameElement(window);
//
//         return frameElement && isIframeWithoutSrc(frameElement);
//     }
//
//     static _storeMessage (msg): void {
//         const storedMessages = Transport._getStoredMessages();
//
//         storedMessages.push(msg);
//
//         nativeMethods.winLocalStorageGetter.call(window).setItem(settings.get().sessionId, stringifyJSON(storedMessages));
//     }
//
//     static _getStoredMessages (): Array<any> {
//         const storedMessagesStr = nativeMethods.winLocalStorageGetter.call(window).getItem(settings.get().sessionId);
//
//         return storedMessagesStr ? parseJSON(storedMessagesStr) : [];
//     }
//
//     static _removeMessageFromStore (cmd): void {
//         const messages = Transport._getStoredMessages();
//
//         for (let i = 0; i < messages.length; i++) {
//             if (messages[i].cmd === cmd) {
//                 messages.splice(i, 1);
//
//                 break;
//             }
//         }
//
//         nativeMethods.winLocalStorageGetter.call(window).setItem(settings.get().sessionId, stringifyJSON(messages));
//     }
//
//     batchUpdate (): Promise<any> {
//         const storedMessages = Transport._getStoredMessages();
//
//         if (storedMessages.length) {
//             const tasks = [];
//
//             nativeMethods.winLocalStorageGetter.call(window).removeItem(settings.get().sessionId);
//
//             for (const storedMessage of storedMessages)
//                 tasks.push(this.queuedAsyncServiceMsg(storedMessage));
//
//             return Promise.all(tasks);
//         }
//         return Promise.resolve();
//     }
// }
