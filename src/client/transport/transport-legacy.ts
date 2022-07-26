import TransportBase from './transport-base';
import { ServiceMessage } from '../../typings/proxy';
import MessageSandbox from '../sandbox/event/message';
import Promise from 'pinkie';
import settings from '../settings';
import XhrSandbox from '../sandbox/xhr';
import { isWebKit, isFirefox } from '../utils/browser';
import { parse, stringify } from '../../utils/json';
import noop from '../utils/noop';
import createUnresolvablePromise from '../utils/create-unresolvable-promise';

export default class TransportLegacy extends TransportBase {
    private readonly _msgQueue: any;

    constructor () {
        super();

        this._msgQueue = {};
    }

    _performRequest (msg, callback): void {
        msg.sessionId = settings.get().sessionId;

        if (this._shouldAddReferer)
            msg.referer = settings.get().referer;

        const sendMsg = (forced?: boolean) => {
            this._activeServiceMsgCount++;

            const isAsyncRequest = !forced;
            const transport      = this;
            let request          = XhrSandbox.createNativeXHR();

            const msgCallback = function () {
                // NOTE: The 500 status code is returned by server when an error occurred into service message handler
                if (this.status === 500 && this.responseText) {
                    msg.disableResending = true;
                    errorHandler.call(this); // eslint-disable-line no-use-before-define

                    return;
                }

                transport._activeServiceMsgCount--;

                const response = this.responseText && parse(this.responseText);

                request = null;

                callback(null, response);
            };

            const errorHandler = function () {
                if (msg.disableResending) {
                    transport._activeServiceMsgCount--;

                    let errorMsg = `XHR request failed with ${request.status} status code.`;

                    if (this.responseText)
                        errorMsg += `\nError message: ${this.responseText}`;

                    callback(new Error(errorMsg));

                    return;
                }

                if (isWebKit || isFirefox) {
                    TransportBase._storeMessage(msg);
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

            request.send(stringify(msg));
        };

        TransportBase._removeMessageFromStore(msg.cmd);
        sendMsg();
    }

    public queuedAsyncServiceMsg (msg: ServiceMessage): Promise<any> {
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

    public asyncServiceMsg (msg: ServiceMessage): Promise<any> {
        return new Promise((resolve, reject) => {
            this._performRequest(msg, (err, data) => {
                if (!err)
                    resolve(data);
                else if (msg.allowRejecting)
                    reject(err);
            });
        });
    }

    public start (messageSandbox: MessageSandbox): void {
        // NOTE: There is no special logic here.
    }
}
