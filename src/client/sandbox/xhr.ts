import SandboxBase from './base';
import nativeMethods from './native-methods';
import { getProxyUrl, parseProxyUrl } from '../utils/url';
import BUILTIN_HEADERS from '../../request-pipeline/builtin-header-names';
import INTERNAL_HEADERS from '../../request-pipeline/internal-header-names';
import { transformHeaderNameToInternal } from '../utils/headers';
import { getOriginHeader } from '../utils/destination-location';
import { overrideDescriptor } from '../utils/property-overriding';
import SAME_ORIGIN_CHECK_FAILED_STATUS_CODE from '../../request-pipeline/xhr/same-origin-check-failed-status-code';
import CookieSandbox from './cookie';

const XHR_READY_STATES = ['UNSENT', 'OPENED', 'HEADERS_RECEIVED', 'LOADING', 'DONE'];

export default class XhrSandbox extends SandboxBase {
    XHR_COMPLETED_EVENT: string = 'hammerhead|event|xhr-completed';
    XHR_ERROR_EVENT: string = 'hammerhead|event|xhr-error';
    BEFORE_XHR_SEND_EVENT: string = 'hammerhead|event|before-xhr-send';

    constructor (private readonly _cookieSandbox: CookieSandbox) { //eslint-disable-line no-unused-vars
        super();
    }

    static createNativeXHR () {
        const xhr = new nativeMethods.XMLHttpRequest();

        xhr.open                  = nativeMethods.xhrOpen;
        xhr.abort                 = nativeMethods.xhrAbort;
        xhr.send                  = nativeMethods.xhrSend;
        xhr.addEventListener      = nativeMethods.xhrAddEventListener || nativeMethods.addEventListener;
        xhr.removeEventListener   = nativeMethods.xhrRemoveEventListener || nativeMethods.removeEventListener;
        xhr.setRequestHeader      = nativeMethods.xhrSetRequestHeader;
        xhr.getResponseHeader     = nativeMethods.xhrGetResponseHeader;
        xhr.getAllResponseHeaders = nativeMethods.xhrGetAllResponseHeaders;
        xhr.overrideMimeType      = nativeMethods.xhrOverrideMimeType;
        xhr.dispatchEvent         = nativeMethods.xhrDispatchEvent || nativeMethods.dispatchEvent;

        return xhr;
    }

    static openNativeXhr (xhr, url, isAsync) {
        xhr.open('POST', url, isAsync);
        xhr.setRequestHeader(BUILTIN_HEADERS.cacheControl, 'no-cache, no-store, must-revalidate');
    }

    attach (window) {
        super.attach(window);

        const xhrSandbox             = this;
        const xmlHttpRequestProto    = window.XMLHttpRequest.prototype;
        const xmlHttpRequestToString = nativeMethods.XMLHttpRequest.toString();

        const emitXhrCompletedEvent = function () {
            const nativeRemoveEventListener = nativeMethods.xhrRemoveEventListener || nativeMethods.removeEventListener;

            xhrSandbox.emit(xhrSandbox.XHR_COMPLETED_EVENT, { xhr: this });
            nativeRemoveEventListener.call(this, 'loadend', emitXhrCompletedEvent);
        };

        const syncCookieWithClientIfNecessary = function () {
            if (this.readyState < this.HEADERS_RECEIVED)
                return;

            const nativeRemoveEventListener = nativeMethods.xhrRemoveEventListener || nativeMethods.removeEventListener;

            xhrSandbox._cookieSandbox.syncCookie();

            nativeRemoveEventListener.call(this, 'readystatechange', syncCookieWithClientIfNecessary);
        };

        const xmlHttpRequestWrapper = function () {
            const nativeAddEventListener = nativeMethods.xhrAddEventListener || nativeMethods.addEventListener;

            const xhr = new nativeMethods.XMLHttpRequest();

            nativeAddEventListener.call(xhr, 'loadend', emitXhrCompletedEvent);
            nativeAddEventListener.call(xhr, 'readystatechange', syncCookieWithClientIfNecessary);

            return xhr;
        };

        for (const readyState of XHR_READY_STATES) {
            nativeMethods.objectDefineProperty(xmlHttpRequestWrapper, readyState, {
                value:      XMLHttpRequest[readyState],
                enumerable: true
            });
        }

        window.XMLHttpRequest           = xmlHttpRequestWrapper;
        xmlHttpRequestWrapper.prototype = xmlHttpRequestProto;
        xmlHttpRequestWrapper.toString  = () => xmlHttpRequestToString;

        // NOTE: We cannot just assign constructor property in OS X 10.11 safari 9.0
        nativeMethods.objectDefineProperty(xmlHttpRequestProto, 'constructor', {
            value: xmlHttpRequestWrapper
        });

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
            const url         = arguments[1];
            const urlIsString = typeof url === 'string';

            arguments[1] = getProxyUrl(urlIsString ? url : String(url));

            nativeMethods.xhrOpen.apply(this, arguments);
        };

        xmlHttpRequestProto.send = function () {
            xhrSandbox.emit(xhrSandbox.BEFORE_XHR_SEND_EVENT, { xhr: this });

            // NOTE: As all requests are passed to the proxy, we need to perform Same Origin Policy compliance checks on the
            // server side. So, we pass the CORS support flag to inform the proxy that it can analyze the
            // Access-Control_Allow_Origin flag and skip "preflight" requests.
            // eslint-disable-next-line no-restricted-properties
            nativeMethods.xhrSetRequestHeader.call(this, INTERNAL_HEADERS.origin, getOriginHeader());
            nativeMethods.xhrSetRequestHeader.call(this, INTERNAL_HEADERS.credentials, this.withCredentials.toString());

            nativeMethods.xhrSend.apply(this, arguments);

            // NOTE: For xhr with the sync mode
            if (this.readyState === this.DONE)
                emitXhrCompletedEvent.call(this);

            syncCookieWithClientIfNecessary.call(this);
        };

        xmlHttpRequestProto.setRequestHeader = function (...args) {
            args[0] = transformHeaderNameToInternal(args[0]);

            return nativeMethods.xhrSetRequestHeader.apply(this, args);
        };

        overrideDescriptor(window.XMLHttpRequest.prototype, 'status', {
            getter: function () {
                const status = nativeMethods.xhrStatusGetter.call(this);

                return status === SAME_ORIGIN_CHECK_FAILED_STATUS_CODE ? 0 : status;
            }
        });

        if (nativeMethods.xhrResponseURLGetter) {
            overrideDescriptor(window.XMLHttpRequest.prototype, 'responseURL', {
                getter: function () {
                    const responseUrl    = nativeMethods.xhrResponseURLGetter.call(this);
                    const parsedProxyUrl = responseUrl && parseProxyUrl(responseUrl);

                    return parsedProxyUrl ? parsedProxyUrl.destUrl : responseUrl;
                }
            });
        }

        xmlHttpRequestProto.getResponseHeader = function (...args) {
            args[0] = transformHeaderNameToInternal(args[0]);

            return nativeMethods.xhrGetResponseHeader.apply(this, args);
        };

        xmlHttpRequestProto.getAllResponseHeaders = function () {
            const allHeaders = nativeMethods.xhrGetAllResponseHeaders.apply(this, arguments);

            return allHeaders
                .replace(INTERNAL_HEADERS.wwwAuthenticate, BUILTIN_HEADERS.wwwAuthenticate)
                .replace(INTERNAL_HEADERS.proxyAuthenticate, BUILTIN_HEADERS.proxyAuthenticate);
        };
    }
}
