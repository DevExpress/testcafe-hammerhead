import SandboxBase from './base';
import nativeMethods from './native-methods';
import { getProxyUrl } from '../utils/url';
import XHR_HEADERS from '../../request-pipeline/xhr/headers';
import AUTHORIZATION from '../../request-pipeline/xhr/authorization';
import { getOriginHeader } from '../utils/destination-location';
import reEscape from '../../utils/regexp-escape';

const IS_OPENED_XHR               = 'hammerhead|xhr|is-opened-xhr';
const REMOVE_SET_COOKIE_HH_HEADER = new RegExp(`${ reEscape(XHR_HEADERS.setCookie) }:[^\n]*\n`, 'g');

export default class XhrSandbox extends SandboxBase {
    constructor (cookieSandbox) {
        super();

        this.XHR_COMPLETED_EVENT = 'hammerhead|event|xhr-completed';
        this.XHR_ERROR_EVENT     = 'hammerhead|event|xhr-error';
        this.XHR_SEND_EVENT      = 'hammerhead|event|xhr-send';

        this.cookieSandbox = cookieSandbox;

        var xhr = new nativeMethods.XMLHttpRequest();

        this.corsSupported = typeof xhr.withCredentials !== 'undefined';
    }

    static isOpenedXhr (obj) {
        return obj[IS_OPENED_XHR];
    }

    static createNativeXHR () {
        var xhr = new nativeMethods.XMLHttpRequest();

        xhr.open                = nativeMethods.xhrOpen;
        xhr.abort               = nativeMethods.xhrAbort;
        xhr.send                = nativeMethods.xhrSend;
        xhr.addEventListener    = nativeMethods.xhrAddEventListener;
        xhr.removeEventListener = nativeMethods.xhrRemoveEventListener;

        return xhr;
    }

    static openNativeXhr (xhr, url, isAsync) {
        xhr.open('POST', url, isAsync);
        xhr.setRequestHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }

    attach (window) {
        super.attach(window);

        var xhrSandbox          = this;
        var xmlHttpRequestProto = window.XMLHttpRequest.prototype;

        var syncCookieWithClient = function () {
            if (this.readyState < this.HEADERS_RECEIVED)
                return;

            var cookies = nativeMethods.xhrGetResponseHeader.call(this, XHR_HEADERS.setCookie);

            if (cookies) {
                cookies = JSON.parse(cookies);

                for (var cookie of cookies)
                    xhrSandbox.cookieSandbox.setCookie(window.document, cookie);
            }

            nativeMethods.xhrRemoveEventListener.call(this, 'readystatechange', syncCookieWithClient);
        };

        xmlHttpRequestProto.abort = function () {
            nativeMethods.xhrAbort.apply(this, arguments);
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

            nativeMethods.xhrAddEventListener.call(this, 'readystatechange', syncCookieWithClient);
            nativeMethods.xhrOpen.apply(this, arguments);
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
            nativeMethods.xhrSetRequestHeader.call(this, XHR_HEADERS.requestMarker, 'true');

            nativeMethods.xhrSetRequestHeader.call(this, XHR_HEADERS.origin, getOriginHeader());

            if (xhrSandbox.corsSupported)
                nativeMethods.xhrSetRequestHeader.call(this, XHR_HEADERS.corsSupported, 'true');

            if (this.withCredentials)
                nativeMethods.xhrSetRequestHeader.call(this, XHR_HEADERS.withCredentials, 'true');

            nativeMethods.xhrSend.apply(this, arguments);

            // NOTE: For xhr with the sync mode
            syncCookieWithClient.call(this);
        };

        xmlHttpRequestProto.getResponseHeader = function (name) {
            return name === XHR_HEADERS.setCookie ? null : nativeMethods.xhrGetResponseHeader.call(this, name);
        };

        xmlHttpRequestProto.getAllResponseHeaders = function () {
            var headers = nativeMethods.xhrGetAllResponseHeaders.call(this);

            return headers ? headers.replace(REMOVE_SET_COOKIE_HH_HEADER, '') : headers;
        };

        xmlHttpRequestProto.setRequestHeader = function (header, value) {
            if (typeof header === 'string' && AUTHORIZATION.headers.indexOf(header.toLowerCase()) !== -1)
                value = AUTHORIZATION.valuePrefix + value;

            return nativeMethods.xhrSetRequestHeader.call(this, header, value);
        };
    }
}
