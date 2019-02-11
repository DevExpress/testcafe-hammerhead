import SandboxBase from './base';
import nativeMethods from './native-methods';
import XHR_HEADERS from '../../request-pipeline/xhr/headers';
import { getProxyUrl, parseProxyUrl } from '../utils/url';
import { getOriginHeader, sameOriginCheck, get as getDestLocation } from '../utils/destination-location';
import { isFetchHeaders, isFetchRequest } from '../utils/dom';
import SAME_ORIGIN_CHECK_FAILED_STATUS_CODE from '../../request-pipeline/xhr/same-origin-check-failed-status-code';
import { overrideDescriptor } from '../utils/property-overriding';
import * as browserUtils from '../utils/browser';

const DEFAULT_REQUEST_CREDENTIALS = nativeMethods.Request ? new nativeMethods.Request(window.location.toString()).credentials : void 0;

export default class FetchSandbox extends SandboxBase {
    FETCH_REQUEST_SENT_EVENT: string = 'hammerhead|event|fetch-request-sent-event';

    cookieSandbox: any;

    constructor (cookieSandbox) {
        super();

        this.cookieSandbox = cookieSandbox;
    }

    static _addSpecialHeadersToRequestInit (init) {
        const credentials = init.credentials || DEFAULT_REQUEST_CREDENTIALS;
        let headers       = init.headers;

        if (!isFetchHeaders(headers))
            headers = init.headers = new nativeMethods.Headers(headers);

        // eslint-disable-next-line no-restricted-properties
        nativeMethods.headersSet.call(headers, XHR_HEADERS.origin, getOriginHeader());
        nativeMethods.headersSet.call(headers, XHR_HEADERS.fetchRequestCredentials, credentials);

        return init;
    }

    static _processArguments (args) {
        const input               = args[0];
        const inputIsString       = typeof input === 'string';
        const inputIsFetchRequest = isFetchRequest(input);
        let init                  = args[1];

        if (!inputIsFetchRequest) {
            args[0] = getProxyUrl(inputIsString ? input : String(input));
            init    = init || {};
            args[1] = FetchSandbox._addSpecialHeadersToRequestInit(init);
        }
        else if (init)
            args[1] = FetchSandbox._addSpecialHeadersToRequestInit(init);
    }

    static _sameOriginCheck (args) {
        let url         = null;
        let requestMode = null;

        if (isFetchRequest(args[0])) {
            url         = parseProxyUrl(args[0].url).destUrl;
            requestMode = args[0].mode;
        }
        else {
            const parsedProxyUrl = parseProxyUrl(args[0]);

            url         = parsedProxyUrl ? parsedProxyUrl.destUrl : args[0];
            requestMode = (args[1] || {}).mode;
        }

        if (requestMode === 'same-origin')
            return sameOriginCheck(getDestLocation(), url);

        return true;
    }

    static _getResponseType (response) {
        const responseUrl       = nativeMethods.responseUrlGetter.call(response);
        const parsedResponseUrl = parseProxyUrl(responseUrl);
        const destUrl           = parsedResponseUrl && parsedResponseUrl.destUrl;
        const isSameOrigin      = sameOriginCheck(getDestLocation(), destUrl);

        if (isSameOrigin)
            return 'basic';

        return response.status === 0 ? 'opaque' : 'cors';
    }

    static _entriesFilteredNext (iterator, nativeNext) {
        const entry = nativeNext.apply(iterator);

        if (entry.done)
            return entry;

        // eslint-disable-next-line no-restricted-properties
        if (entry.value[0] === XHR_HEADERS.origin || entry.value[0] === XHR_HEADERS.fetchRequestCredentials)
            return FetchSandbox._entriesFilteredNext(iterator, nativeNext);

        return entry;
    }

    static _entriesWrapper (...args) {
        const iterator   = nativeMethods.headersEntries.apply(this, args);
        const nativeNext = iterator.next;

        iterator.next = () => FetchSandbox._entriesFilteredNext(iterator, nativeNext);

        return iterator;
    }

    static _valuesWrapper (...args) {
        const iterator   = nativeMethods.headersEntries.apply(this, args);
        const nativeNext = iterator.next;

        iterator.next = () => {
            const filteredEntry = FetchSandbox._entriesFilteredNext(iterator, nativeNext);

            if (!filteredEntry.done)
                filteredEntry.value = filteredEntry.value[1]; // eslint-disable-line no-restricted-properties

            return filteredEntry;
        };

        return iterator;
    }

    attach (window) {
        super.attach(window, window.document);

        if (!nativeMethods.fetch)
            return;

        const sandbox = this;

        window.Request           = function (...args) {
            FetchSandbox._processArguments(args);

            window.Headers.prototype.entries = window.Headers.prototype[Symbol.iterator] = nativeMethods.headersEntries;

            const request = args.length === 1
                ? new nativeMethods.Request(args[0])
                : new nativeMethods.Request(args[0], args[1]);

            window.Headers.prototype.entries = window.Headers.prototype[Symbol.iterator] = FetchSandbox._entriesWrapper;

            return request;
        };
        window.Request.prototype = nativeMethods.Request.prototype;

        window.fetch = function (...args) {
            // NOTE: Safari processed the empty `fetch()` request without `Promise` rejection (GH-1613)
            if (!args.length && !browserUtils.isSafari)
                return nativeMethods.fetch.apply(this);

            try {
                FetchSandbox._processArguments(args);
            }
            catch (e) {
                // @ts-ignore
                return nativeMethods.promiseReject.call(sandbox.window.Promise, e);
            }

            if (!FetchSandbox._sameOriginCheck(args))
                // @ts-ignore
                return nativeMethods.promiseReject.call(sandbox.window.Promise, new TypeError());

            window.Headers.prototype.entries = window.Headers.prototype[Symbol.iterator] = nativeMethods.headersEntries;

            const fetchPromise = nativeMethods.fetch.apply(this, args);

            window.Headers.prototype.entries = window.Headers.prototype[Symbol.iterator] = FetchSandbox._entriesWrapper;

            sandbox.emit(sandbox.FETCH_REQUEST_SENT_EVENT, fetchPromise);

            return nativeMethods.promiseThen.call(fetchPromise, response => {
                sandbox.cookieSandbox.syncCookie();

                return response;
            });
        };

        const fetchToString = nativeMethods.fetch.toString();

        window.fetch.toString = () => fetchToString;

        overrideDescriptor(window.Response.prototype, 'type', {
            getter: function () {
                return FetchSandbox._getResponseType(this);
            }
        });

        overrideDescriptor(window.Response.prototype, 'status', {
            getter: function () {
                const responseStatus = nativeMethods.responseStatusGetter.call(this);

                return responseStatus === SAME_ORIGIN_CHECK_FAILED_STATUS_CODE ? 0 : responseStatus;
            }
        });

        overrideDescriptor(window.Response.prototype, 'url', {
            getter: function () {
                const responseUrl       = nativeMethods.responseUrlGetter.call(this);
                const parsedResponseUrl = responseUrl && parseProxyUrl(responseUrl);

                return parsedResponseUrl ? parsedResponseUrl.destUrl : responseUrl;
            }
        });

        window.Headers.prototype.entries = window.Headers.prototype[Symbol.iterator] = FetchSandbox._entriesWrapper;

        window.Headers.prototype.values = FetchSandbox._valuesWrapper;

        window.Headers.prototype.forEach = function (...args) {
            const callback = args[0];

            if (typeof callback === 'function') {
                args[0] = function (_value, name) {
                    // eslint-disable-next-line no-restricted-properties
                    if (name !== XHR_HEADERS.origin && name !== XHR_HEADERS.fetchRequestCredentials)
                        callback.apply(this, arguments);
                };
            }

            return nativeMethods.headersForEach.apply(this, args);
        };
    }
}
