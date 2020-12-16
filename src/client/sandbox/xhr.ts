import Promise from 'pinkie';
import SandboxBaseWithDelayedSettings from '../worker/sandbox-base-with-delayed-settings';
import nativeMethods from './native-methods';
import { getAjaxProxyUrl, getDestinationUrl, getProxyUrl } from '../utils/url';
import BUILTIN_HEADERS from '../../request-pipeline/builtin-header-names';
import INTERNAL_HEADERS from '../../request-pipeline/internal-header-names';
import { transformHeaderNameToInternal } from '../utils/headers';
import { overrideConstructor, overrideDescriptor, overrideFunction } from '../utils/overriding';
import CookieSandbox from './cookie';
import { Credentials } from '../../utils/url';

const XHR_READY_STATES = ['UNSENT', 'OPENED', 'HEADERS_RECEIVED', 'LOADING', 'DONE'];

type XhrOpenArgs = [string, string, boolean, string?, string?];

export default class XhrSandbox extends SandboxBaseWithDelayedSettings {
    readonly XHR_COMPLETED_EVENT = 'hammerhead|event|xhr-completed';
    readonly XHR_ERROR_EVENT = 'hammerhead|event|xhr-error';
    readonly BEFORE_XHR_SEND_EVENT = 'hammerhead|event|before-xhr-send';

    private static readonly REQUESTS_OPTIONS = new WeakMap<XMLHttpRequest, { withCredentials: boolean, args: XhrOpenArgs }>();

    constructor (private readonly _cookieSandbox: CookieSandbox, waitHammerheadSettings?: Promise<void>) {
        super(waitHammerheadSettings);
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

        const xhrSandbox          = this;
        const xmlHttpRequestProto = window.XMLHttpRequest.prototype;

        const emitXhrCompletedEvent = function (this: XMLHttpRequest) {
            const nativeRemoveEventListener = nativeMethods.xhrRemoveEventListener || nativeMethods.removeEventListener;

            xhrSandbox.emit(xhrSandbox.XHR_COMPLETED_EVENT, { xhr: this });
            nativeRemoveEventListener.call(this, 'loadend', emitXhrCompletedEvent);
        };

        const syncCookieWithClientIfNecessary = function (this: XMLHttpRequest) {
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

        // NOTE: We cannot just assign constructor property of the prototype of XMLHttpRequest starts from safari 9.0
        overrideConstructor(window, 'XMLHttpRequest', xmlHttpRequestWrapper);

        nativeMethods.objectDefineProperty(xmlHttpRequestProto, 'constructor', {
            value: xmlHttpRequestWrapper
        });

        overrideFunction(xmlHttpRequestProto, 'abort', function (this: XMLHttpRequest, ...args: []) {
            if (xhrSandbox.gettingSettingInProgress())
                return void xhrSandbox.delayUntilGetSettings(() => this.abort.apply(this, args));

            nativeMethods.xhrAbort.apply(this, args);
            xhrSandbox.emit(xhrSandbox.XHR_ERROR_EVENT, {
                err: new Error('XHR aborted'),
                xhr: this
            });
        });

        // NOTE: Redirect all requests to the Hammerhead proxy and ensure that requests don't
        // violate Same Origin Policy.
        overrideFunction(xmlHttpRequestProto, 'open', function (this: XMLHttpRequest, ...args: XhrOpenArgs) {
            let url = args[1];

            if (getProxyUrl(url) === url)
                return void nativeMethods.xhrOpen.apply(this, args);

            if (xhrSandbox.gettingSettingInProgress())
                return void xhrSandbox.delayUntilGetSettings(() => this.open.apply(this, args));

            url = typeof url === 'string' ? url : String(url);

            args[1] = getAjaxProxyUrl(url, this.withCredentials ? Credentials.include : Credentials.sameOrigin);

            nativeMethods.xhrOpen.apply(this, args);

            args[1] = url;

            XhrSandbox.REQUESTS_OPTIONS.set(this, { withCredentials: this.withCredentials, args });
        });

        overrideFunction(xmlHttpRequestProto, 'send', function (this: XMLHttpRequest, ...args: [any]) {
            if (xhrSandbox.gettingSettingInProgress())
                return void xhrSandbox.delayUntilGetSettings(() => this.send.apply(this, args));

            const reqOpts = XhrSandbox.REQUESTS_OPTIONS.get(this);

            if (reqOpts.withCredentials !== this.withCredentials) {
                reqOpts.args[1] = getAjaxProxyUrl(reqOpts.args[1], this.withCredentials ? Credentials.include : Credentials.sameOrigin);

                nativeMethods.xhrOpen.apply(this, reqOpts.args);
            }

            xhrSandbox.emit(xhrSandbox.BEFORE_XHR_SEND_EVENT, { xhr: this });

            nativeMethods.xhrSend.apply(this, args);

            // NOTE: For xhr with the sync mode
            if (this.readyState === this.DONE)
                emitXhrCompletedEvent.call(this);

            syncCookieWithClientIfNecessary.call(this);
        });

        overrideFunction(xmlHttpRequestProto, 'setRequestHeader', function (this: XMLHttpRequest, ...args) {
            args[0] = transformHeaderNameToInternal(args[0]);

            return nativeMethods.xhrSetRequestHeader.apply(this, args);
        });

        if (nativeMethods.xhrResponseURLGetter) {
            overrideDescriptor(window.XMLHttpRequest.prototype, 'responseURL', {
                getter: function () {
                    return getDestinationUrl(nativeMethods.xhrResponseURLGetter.call(this));
                }
            });
        }

        overrideFunction(xmlHttpRequestProto, 'getResponseHeader', function (this: XMLHttpRequest, ...args) {
            args[0] = transformHeaderNameToInternal(args[0]);

            return nativeMethods.xhrGetResponseHeader.apply(this, args);
        });

        overrideFunction(xmlHttpRequestProto, 'getAllResponseHeaders', function (this: XMLHttpRequest) {
            const allHeaders = nativeMethods.xhrGetAllResponseHeaders.apply(this, arguments);

            return allHeaders
                .replace(INTERNAL_HEADERS.wwwAuthenticate, BUILTIN_HEADERS.wwwAuthenticate)
                .replace(INTERNAL_HEADERS.proxyAuthenticate, BUILTIN_HEADERS.proxyAuthenticate);
        });
    }
}
