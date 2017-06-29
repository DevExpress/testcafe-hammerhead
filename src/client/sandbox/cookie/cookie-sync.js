import nativeMethods from '../../sandbox/native-methods';
import XhrSandbox from '../../sandbox/xhr';
import settings from '../../settings';
import { stringify as stringifyJSON } from '../../json';
import { isIE9 } from '../../utils/browser';

const SWITCH_BACK_TO_ASYNC_XHR_DELAY = 2000;
const FAILED_MESSAGES_LIMIT          = 3;

export default class CookieSync {
    constructor () {
        this.useAsyncXhr = true;
        this.queue       = [];
        this.sendedQueue = null;
        this.activeReq   = null;
        this.failsCount  = 0;

        // NOTE: When unloading, we should switch to synchronous XHR to be sure that we won't lose any cookies.
        nativeMethods.windowAddEventListener.call(window, 'beforeunload', () => this._beforeUnloadHandler(), true);
    }

    static _has204StatusCode (request) {
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

            // NOTE: We abort the current async request and resend message queue to a server using sync request.
            if (this.activeReq)
                this.activeReq.abort();
        }

        // NOTE: If the unloading was canceled, switch back to asynchronous XHR.
        nativeMethods.setTimeout.call(window, () => {
            this.useAsyncXhr = true;
        }, SWITCH_BACK_TO_ASYNC_XHR_DELAY);
    }

    _onRequestLoad (request) {
        if (CookieSync._has204StatusCode(request)) {
            this.sendedQueue = null;
            this.activeReq   = null;
            this.failsCount  = 0;

            if (this.queue.length)
                this._sendQueue();
        }
        else
            this._onRequestError(request);
    }

    _onRequestError (request) {
        if (this.activeReq === request) {
            this.queue = this.sendedQueue.concat(this.queue);

            if (++this.failsCount < FAILED_MESSAGES_LIMIT)
                this._sendQueue();
        }
    }

    _attachRequestHandlers (request) {
        if (isIE9) {
            // NOTE: Aborting ajax requests in IE9 does not raise the error, abort or timeout events.
            // Getting the status code raises the c00c023f error.
            request.addEventListener('readystatechange', () => {
                if (request.readyState === request.DONE)
                    this._onRequestLoad(request);
            });
        }
        else {
            request.addEventListener('load', () => this._onRequestLoad(request));
            request.addEventListener('abort', () => this._onRequestError(request));
            request.addEventListener('error', () => this._onRequestError(request));
            request.addEventListener('timeout', () => this._onRequestError(request));
        }
    }

    _sendQueue () {
        var isAsyncRequest = this.useAsyncXhr;
        var request        = XhrSandbox.createNativeXHR();

        XhrSandbox.openNativeXhr(request, settings.get().cookieSyncUrl, isAsyncRequest);

        this.sendedQueue = this.queue;
        this.queue       = [];
        this.activeReq   = request;

        if (isAsyncRequest)
            this._attachRequestHandlers(request);

        try {
            request.send(stringifyJSON({
                sessionId: settings.get().sessionId,
                queue:     this.sendedQueue
            }));
        }
        catch (e) {
            this._onRequestError(request);
            return;
        }

        if (!isAsyncRequest)
            this._onRequestLoad(request);
    }

    perform (msg) {
        this.queue.push(msg);

        if (!this.activeReq)
            this._sendQueue();
    }
}
