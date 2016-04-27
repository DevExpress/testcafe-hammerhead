import SandboxBase from './base';
import nativeMethods from './native-methods';
import { getProxyUrl } from '../utils/url';
import XHR_HEADERS from '../../request-pipeline/xhr/headers';
import { getOrigin } from '../utils/destination-location';

const IS_OPENED_XHR = 'hammerhead|xhr|is-opened-xhr';

// NOTE: We should avoid using native object prototype methods,
// since they can be overriden by the client code. (GH-245)
var arraySlice = Array.prototype.slice;

export default class XhrSandbox extends SandboxBase {
    constructor (sandbox) {
        super(sandbox);

        this.XHR_COMPLETED_EVENT = 'hammerhead|event|xhr-completed';
        this.XHR_ERROR_EVENT     = 'hammerhead|event|xhr-error';
        this.XHR_SEND_EVENT      = 'hammerhead|event|xhr-send';

        var xhr = new nativeMethods.XMLHttpRequest();

        this.corsSupported = typeof xhr.withCredentials !== 'undefined';
    }

    static isOpenedXhr (obj) {
        return obj[IS_OPENED_XHR];
    }

    static createNativeXHR () {
        var xhr = new window.XMLHttpRequest();

        xhr.open                = nativeMethods.xmlHttpRequestOpen;
        xhr.abort               = nativeMethods.xmlHttpRequestAbort;
        xhr.send                = nativeMethods.xmlHttpRequestSend;
        xhr.addEventListener    = nativeMethods.xmlHttpRequestAddEventListener;
        xhr.removeEventListener = nativeMethods.xmlHttpRequestRemoveEventListener;

        return xhr;
    }

    attach (window) {
        super.attach(window);

        var xhrSandbox          = this;
        var xmlHttpRequestProto = window.XMLHttpRequest.prototype;

        xmlHttpRequestProto.abort = function () {
            nativeMethods.xmlHttpRequestAbort.apply(this, arguments);
            xhrSandbox.emit(xhrSandbox.XHR_ERROR_EVENT, {
                err: new Error('XHR aborted'),
                xhr: this
            });
        };

        // NOTE: Redirect all requests to the Hammerhead proxy and ensure that requests don't
        // violate Same Origin Policy.
        xmlHttpRequestProto.open = function () {
            this[IS_OPENED_XHR] = true;

            // NOTE: Emulate CORS, so that 3rd party libs (e.g. jQuery) allow requests with the proxy host as well as
            // the destination page host.
            if (!xhrSandbox.corsSupported)
                this.withCredentials = false;

            if (typeof arguments[1] === 'string')
                arguments[1] = getProxyUrl(arguments[1]);

            nativeMethods.xmlHttpRequestOpen.apply(this, arguments);
        };

        xmlHttpRequestProto.send = function () {
            var xhr = this;

            xhrSandbox.emit(xhrSandbox.XHR_SEND_EVENT, { xhr });

            var orscHandler = () => {
                if (this.readyState === 4)
                    xhrSandbox.emit(xhrSandbox.XHR_COMPLETED_EVENT, { xhr });
            };

            // NOTE: If we're using the sync mode or if the response is in cache,
            // we need to raise the callback manually.
            if (this.readyState === 4)
                orscHandler();
            else {
                // NOTE: Get out of the current execution tick and then proxy onreadystatechange,
                // because jQuery assigns a handler after the send() method was called.
                nativeMethods.setTimeout.call(xhrSandbox.window, () => {
                    // NOTE: If the state is already changed, we just call the handler without proxying
                    // onreadystatechange.
                    if (this.readyState === 4)
                        orscHandler();

                    else if (typeof this.onreadystatechange === 'function') {
                        var originalHandler = this.onreadystatechange;

                        this.onreadystatechange = progress => {
                            orscHandler();
                            originalHandler.call(this, progress);
                        };
                    }
                    else
                        this.addEventListener('readystatechange', orscHandler, false);
                }, 0);
            }

            // NOTE: Add the XHR request mark, so that a proxy can recognize a request as a XHR request. As all
            // requests are passed to the proxy, we need to perform Same Origin Policy compliance checks on the
            // server side. So, we pass the CORS support flag to inform the proxy that it can analyze the
            // Access-Control_Allow_Origin flag and skip "preflight" requests.
            this.setRequestHeader(XHR_HEADERS.requestMarker, 'true');

            this.setRequestHeader(XHR_HEADERS.origin, getOrigin());

            if (xhrSandbox.corsSupported)
                this.setRequestHeader(XHR_HEADERS.corsSupported, 'true');

            if (this.withCredentials)
                this.setRequestHeader(XHR_HEADERS.withCredentials, 'true');

            nativeMethods.xmlHttpRequestSend.apply(this, arguments);
        };

        xmlHttpRequestProto.addEventListener = function () {
            var xhr  = this;
            var args = arraySlice.call(arguments);

            if (typeof args[1] === 'function') {
                this.eventHandlers = this.eventHandlers || [];

                var eventHandlers  = this.eventHandlers;
                var originHandler  = args[1];
                var wrappedHandler = function () {
                    originHandler.apply(xhr, arguments);
                };

                args[1] = wrappedHandler;

                eventHandlers.push({
                    origin:  originHandler,
                    wrapped: wrappedHandler
                });
            }

            return nativeMethods.xmlHttpRequestAddEventListener.apply(this, args);
        };

        xmlHttpRequestProto.removeEventListener = function () {
            var args = arraySlice.call(arguments);

            if (typeof args[1] === 'function') {
                this.eventHandlers = this.eventHandlers || [];

                var eventHandlers = this.eventHandlers;

                for (var i = 0; i < eventHandlers.length; i++) {
                    if (eventHandlers[i].origin === args[1]) {
                        args[1] = eventHandlers[i].wrapped;
                        eventHandlers.splice(i, 1);

                        break;
                    }
                }
            }

            return nativeMethods.xmlHttpRequestRemoveEventListener.apply(this, args);
        };
    }
}
