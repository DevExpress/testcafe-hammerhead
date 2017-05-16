import nativeMethods from '../../sandbox/native-methods';
import XhrSandbox from '../../sandbox/xhr';
import settings from '../../settings';
import { stringify as stringifyJSON } from '../../json';
import { isIE9 } from '../../utils/browser';

const SWITCH_BACK_TO_ASYNC_XHR_DELAY = 2000;

export default class ServerSync {
    constructor () {
        this.useAsyncXhr = true;
        this.queue       = [];
        this.sendedQueue = null;
        this.activeReq   = null;

        // NOTE: When unloading, we should switch to synchronous XHR to be sure that we won't lose any cookies.
        nativeMethods.windowAddEventListener.call(window, 'beforeunload', () => this._beforeUnloadHandler(), true);
    }

    static _createXMLHttpRequest (isAsync) {
        var xhr = XhrSandbox.createNativeXHR();

        xhr.open('POST', settings.get().cookieSyncUrl, isAsync);
        xhr.setRequestHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

        return xhr;
    }

    static _isNoContentStatus (request) {
        try {
            // NOTE: XMLHTTPRequest implementation in MSXML HTTP does not handle HTTP responses
            // with status code 204 (No Content) properly; the `status' property has the value 1223.
            return request.status === (isIE9 ? 1223 : 204);
        }
        catch (e) {
            return false;
        }
    }

    _beforeUnloadHandler () {
        if (this.useAsyncXhr) {
            this.useAsyncXhr = false;

            if (this.activeReq)
                this.activeReq.abort();
        }

        // NOTE: If the unloading was canceled, switch back to asynchronous XHR.
        nativeMethods.setTimeout.call(window, () => {
            this.useAsyncXhr = true;
        }, SWITCH_BACK_TO_ASYNC_XHR_DELAY);
    }

    _loadHandler (request) {
        if (ServerSync._isNoContentStatus(request)) {
            this.sendedQueue = null;
            this.activeReq   = null;

            if (this.queue.length > 0)
                this._sendQueue();
        }
        else
            this._errorHandler(request);
    }

    _errorHandler (request) {
        if (this.activeReq === request) {
            this.queue = this.sendedQueue.concat(this.queue);

            this._sendQueue();
        }
    }

    _sendQueue () {
        var isAsyncRequest = this.useAsyncXhr;
        var request        = ServerSync._createXMLHttpRequest(isAsyncRequest);

        this.sendedQueue = this.queue;
        this.queue       = [];
        this.activeReq   = request;

        if (isAsyncRequest) {
            if (!isIE9) {
                request.addEventListener('load', () => this._loadHandler(request));
                request.addEventListener('abort', () => this._errorHandler(request));
                request.addEventListener('error', () => this._errorHandler(request));
                request.addEventListener('timeout', () => this._errorHandler(request));
            }
            else {
                // NOTE: Aborting ajax requests in IE9 does not raise the error, abort or timeout events.
                // Getting the status code raises the c00c023f error.
                request.addEventListener('readystatechange', () => {
                    if (request.readyState !== request.DONE)
                        return;

                    this._loadHandler(request);
                });
            }
        }

        try {
            request.send(stringifyJSON({
                sessionId: settings.get().sessionId,
                queue:     this.sendedQueue
            }));
        }
        catch (e) {
            this._errorHandler(request);
            return;
        }

        if (!isAsyncRequest)
            this._loadHandler(request);
    }

    synchronize (msg) {
        this.queue.push(msg);

        if (!this.activeReq)
            this._sendQueue();
    }
}
