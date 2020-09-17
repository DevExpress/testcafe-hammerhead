import SandboxBase from './base';
import nativeMethods from './native-methods';
import INTERNAL_HEADERS from '../../request-pipeline/internal-header-names';
import BUILTIN_HEADERS from '../../request-pipeline/builtin-header-names';
import { getProxyUrl, getDestinationUrl } from '../utils/url';
import { getOriginHeader, sameOriginCheck, get as getDestLocation } from '../utils/destination-location';
import { isFetchHeaders, isFetchRequest } from '../utils/dom';
import SAME_ORIGIN_CHECK_FAILED_STATUS_CODE from '../../request-pipeline/xhr/same-origin-check-failed-status-code';
import { overrideConstructor, overrideDescriptor, overrideFunction } from '../utils/overriding';
import * as browserUtils from '../utils/browser';
import { transformHeaderNameToBuiltin, transformHeaderNameToInternal } from '../utils/headers';
import CookieSandbox from './cookie';

const DEFAULT_REQUEST_CREDENTIALS = nativeMethods.Request ? new nativeMethods.Request(location.toString()).credentials : void 0;

export default class FetchSandbox extends SandboxBase {
    readonly FETCH_REQUEST_SENT_EVENT = 'hammerhead|event|fetch-request-sent-event';

    constructor (readonly cookieSandbox: CookieSandbox) {
        super();
    }

    private static _addSpecialHeadersToRequestInit (init) {
        const credentials = init.credentials || DEFAULT_REQUEST_CREDENTIALS;
        let headers       = init.headers;

        if (!isFetchHeaders(headers)) {
            // @ts-ignore
            headers      = headers ? new nativeMethods.Headers(headers) : new nativeMethods.Headers();
            init.headers = headers;
        }

        // eslint-disable-next-line no-restricted-properties
        nativeMethods.headersSet.call(headers, INTERNAL_HEADERS.origin, getOriginHeader());
        nativeMethods.headersSet.call(headers, INTERNAL_HEADERS.credentials, credentials);

        const authorizationValue      = nativeMethods.headersGet.call(headers, BUILTIN_HEADERS.authorization);
        const proxyAuthorizationValue = nativeMethods.headersGet.call(headers, BUILTIN_HEADERS.proxyAuthorization);

        if (authorizationValue !== null) {
            nativeMethods.headersSet.call(headers, INTERNAL_HEADERS.authorization, authorizationValue);
            nativeMethods.headersDelete.call(headers, BUILTIN_HEADERS.authorization);
        }

        if (proxyAuthorizationValue !== null) {
            nativeMethods.headersSet.call(headers, INTERNAL_HEADERS.proxyAuthorization, proxyAuthorizationValue);
            nativeMethods.headersDelete.call(headers, BUILTIN_HEADERS.proxyAuthorization);
        }

        return init;
    }

    private static _processArguments (args) {
        const [input, init]       = args;
        const inputIsString       = typeof input === 'string';
        const inputIsFetchRequest = isFetchRequest(input);

        if (!inputIsFetchRequest) {
            args[0] = getProxyUrl(inputIsString ? input : String(input));
            args[1] = FetchSandbox._addSpecialHeadersToRequestInit(init || {});
        }
        else if (init && init.headers && input.destination !== 'worker')
            args[1] = FetchSandbox._addSpecialHeadersToRequestInit(init);
    }

    private static _sameOriginCheck ([input, init]) {
        const isRequest   = isFetchRequest(input);
        const url         = isRequest ? getDestinationUrl(nativeMethods.requestUrlGetter.call(input)) : getDestinationUrl(input);
        const requestMode = isRequest ? input.mode : init && init.mode;

        if (requestMode === 'same-origin')
            return sameOriginCheck(getDestLocation(), url);

        return true;
    }

    private static _createAccessorWrapper(nativeFn: Function) {
        return function (...args) {
            args[0] = transformHeaderNameToInternal(args[0]);

            return nativeFn.apply(this, args);
        }
    }

    static _getResponseType (response) {
        const destUrl      = getDestinationUrl(nativeMethods.responseUrlGetter.call(response));
        const isSameOrigin = sameOriginCheck(getDestLocation(), destUrl);

        if (isSameOrigin)
            return 'basic';

        return response.status === 0 ? 'opaque' : 'cors';
    }

    static _entriesFilteredNext (iterator, nativeNext) {
        const entry = nativeNext.apply(iterator);

        if (entry.done)
            return entry;

        const headerName = entry.value[0]; // eslint-disable-line no-restricted-properties

        // eslint-disable-next-line no-restricted-properties
        if (headerName === INTERNAL_HEADERS.origin || headerName === INTERNAL_HEADERS.credentials)
            return FetchSandbox._entriesFilteredNext(iterator, nativeNext);

        entry.value[0] = transformHeaderNameToBuiltin(headerName); // eslint-disable-line no-restricted-properties

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

        overrideConstructor(window, 'Request', function (...args) {
            FetchSandbox._processArguments(args);

            window.Headers.prototype.entries = window.Headers.prototype[Symbol.iterator] = nativeMethods.headersEntries;

            const request = args.length === 1
                ? new nativeMethods.Request(args[0])
                : new nativeMethods.Request(args[0], args[1]);

            window.Headers.prototype.entries = window.Headers.prototype[Symbol.iterator] = FetchSandbox._entriesWrapper;

            return request;
        });

        overrideDescriptor(window.Request.prototype, 'url', {
            getter: function (this: Request) {
                return getDestinationUrl(nativeMethods.requestUrlGetter.call(this));
            }
        });

        overrideFunction(window, 'fetch', function (...args: [Request | string, any]) {
            // NOTE: Safari processed the empty `fetch()` request without `Promise` rejection (GH-1613)
            if (!args.length && !browserUtils.isSafari)
                return nativeMethods.fetch.apply(this);

            try {
                FetchSandbox._processArguments(args);
            }
            catch (e) {
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
        });

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
                return getDestinationUrl(nativeMethods.responseUrlGetter.call(this));
            }
        });

        const entriesWrapper = FetchSandbox._entriesWrapper;
        
        overrideFunction(window.Headers.prototype, 'entries', entriesWrapper);
        overrideFunction(window.Headers.prototype, Symbol.iterator, entriesWrapper);

        overrideFunction(window.Headers.prototype, 'values', FetchSandbox._valuesWrapper);

        overrideFunction(window.Headers.prototype, 'forEach', function (...args) {
            const callback = args[0];

            if (typeof callback === 'function') {
                args[0] = function (value, name, headers) {
                    // eslint-disable-next-line no-restricted-properties
                    if (name === INTERNAL_HEADERS.origin || name === INTERNAL_HEADERS.credentials)
                        return;

                    name = transformHeaderNameToBuiltin(name);

                    callback.call(this, value, name, headers);
                };
            }

            return nativeMethods.headersForEach.apply(this, args);
        });

        overrideFunction(window.Headers.prototype, 'get', FetchSandbox._createAccessorWrapper(nativeMethods.headersGet));
        overrideFunction(window.Headers.prototype, 'set', FetchSandbox._createAccessorWrapper(nativeMethods.headersSet));
        overrideFunction(window.Headers.prototype, 'has', FetchSandbox._createAccessorWrapper(nativeMethods.headersHas));
    }
}
