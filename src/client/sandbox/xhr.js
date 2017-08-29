import SandboxBase from './base';
import nativeMethods from './native-methods';
import { getProxyUrl } from '../utils/url';
import XHR_HEADERS from '../../request-pipeline/xhr/headers';
import AUTHORIZATION from '../../request-pipeline/xhr/authorization';
import { getOriginHeader } from '../utils/destination-location';
import reEscape from '../../utils/regexp-escape';
import * as JSON from '../json';

const IS_OPENED_XHR               = 'hammerhead|xhr|is-opened-xhr';
const REMOVE_SET_COOKIE_HH_HEADER = new RegExp(`${ reEscape(XHR_HEADERS.setCookie) }:[^\n]*\n`, 'gi');

export default class XhrSandbox extends SandboxBase {
    constructor (cookieSandbox) {
        super();

        this.XHR_COMPLETED_EVENT   = 'hammerhead|event|xhr-completed';
        this.XHR_ERROR_EVENT       = 'hammerhead|event|xhr-error';
        this.BEFORE_XHR_SEND_EVENT = 'hammerhead|event|before-xhr-send';

        this.cookieSandbox = cookieSandbox;

        const xhr = new nativeMethods.XMLHttpRequest();

        this.corsSupported = typeof xhr.withCredentials !== 'undefined';
    }

    static isOpenedXhr (obj) {
        return obj[IS_OPENED_XHR];
    }

    static createNativeXHR () {
        const xhr = new nativeMethods.XMLHttpRequest();

        xhr.open                  = nativeMethods.xhrOpen;
        xhr.abort                 = nativeMethods.xhrAbort;
        xhr.send                  = nativeMethods.xhrSend;
        xhr.addEventListener      = nativeMethods.xhrAddEventListener;
        xhr.removeEventListener   = nativeMethods.xhrRemoveEventListener;
        xhr.setRequestHeader      = nativeMethods.xhrSetRequestHeader;
        xhr.getResponseHeader     = nativeMethods.xhrGetResponseHeader;
        xhr.getAllResponseHeaders = nativeMethods.xhrGetAllResponseHeaders;
        xhr.overrideMimeType      = nativeMethods.xhrOverrideMimeType;
        xhr.dispatchEvent         = nativeMethods.xhrDispatchEvent;

        return xhr;
    }

    static openNativeXhr (xhr, url, isAsync) {
        xhr.open('POST', url, isAsync);
        xhr.setRequestHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }

    attach (window) {
        super.attach(window);

        const xhrSandbox           = this;
        const xmlHttpRequestProto  = window.XMLHttpRequest.prototype;
        const xhrConstructorString = nativeMethods.XMLHttpRequest.toString();

        const emitXhrCompletedEvent = function () {
            if (this.readyState === this.DONE) {
                xhrSandbox.emit(xhrSandbox.XHR_COMPLETED_EVENT, { xhr: this });
                nativeMethods.xhrRemoveEventListener.call(this, 'readystatechange', emitXhrCompletedEvent);
            }
        };

        const syncCookieWithClient = function () {
            if (this.readyState < this.HEADERS_RECEIVED)
                return;

            let cookies = nativeMethods.xhrGetResponseHeader.call(this, XHR_HEADERS.setCookie);

            if (cookies) {
                cookies = JSON.parse(cookies);

                for (const cookie of cookies)
                    xhrSandbox.cookieSandbox.setCookie(window.document, cookie);
            }

            nativeMethods.xhrRemoveEventListener.call(this, 'readystatechange', syncCookieWithClient);
        };

        const xhrConstructorWrapper = function () {
            const xhr = new nativeMethods.XMLHttpRequest();

            nativeMethods.xhrAddEventListener.call(xhr, 'readystatechange', emitXhrCompletedEvent);
            nativeMethods.xhrAddEventListener.call(xhr, 'readystatechange', syncCookieWithClient);

            return xhr;
        };

        window.XMLHttpRequest           = xhrConstructorWrapper;
        xhrConstructorWrapper.prototype = xmlHttpRequestProto;
        xhrConstructorWrapper.toString  = () => xhrConstructorString;
        xmlHttpRequestProto.constructor = xhrConstructorWrapper;

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

            nativeMethods.xhrOpen.apply(this, arguments);
        };

        xmlHttpRequestProto.send = function () {
            const xhr = this;

            xhrSandbox.emit(xhrSandbox.BEFORE_XHR_SEND_EVENT, { xhr });

            // NOTE: Add the XHR request mark, so that a proxy can recognize a request as a XHR request. As all
            // requests are passed to the proxy, we need to perform Same Origin Policy compliance checks on the
            // server side. So, we pass the CORS support flag to inform the proxy that it can analyze the
            // Access-Control_Allow_Origin flag and skip "preflight" requests.
            nativeMethods.xhrSetRequestHeader.call(xhr, XHR_HEADERS.requestMarker, 'true');
            nativeMethods.xhrSetRequestHeader.call(xhr, XHR_HEADERS.origin, getOriginHeader());

            if (xhrSandbox.corsSupported)
                nativeMethods.xhrSetRequestHeader.call(xhr, XHR_HEADERS.corsSupported, 'true');

            if (xhr.withCredentials)
                nativeMethods.xhrSetRequestHeader.call(xhr, XHR_HEADERS.withCredentials, 'true');

            nativeMethods.xhrSend.apply(xhr, arguments);

            // NOTE: For xhr with the sync mode
            emitXhrCompletedEvent.call(xhr);
            syncCookieWithClient.call(xhr);
        };

        xmlHttpRequestProto.getResponseHeader = function (name) {
            return name === XHR_HEADERS.setCookie ? null : nativeMethods.xhrGetResponseHeader.call(this, name);
        };

        xmlHttpRequestProto.getAllResponseHeaders = function () {
            const headers = nativeMethods.xhrGetAllResponseHeaders.call(this);

            return headers ? headers.replace(REMOVE_SET_COOKIE_HH_HEADER, '') : headers;
        };

        xmlHttpRequestProto.setRequestHeader = function (header, value) {
            if (typeof header === 'string' && AUTHORIZATION.headers.indexOf(header.toLowerCase()) !== -1)
                value = AUTHORIZATION.valuePrefix + value;

            return nativeMethods.xhrSetRequestHeader.call(this, header, value);
        };
    }
}
