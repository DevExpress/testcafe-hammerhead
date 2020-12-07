import Promise from 'pinkie';
import SandboxBaseWithDelayedSettings from '../worker/sandbox-base-with-delayed-settings';
import nativeMethods from './native-methods';
import INTERNAL_HEADERS from '../../request-pipeline/internal-header-names';
import BUILTIN_HEADERS from '../../request-pipeline/builtin-header-names';
import { getProxyUrl, getDestinationUrl } from '../utils/url';
import { getOriginHeader, sameOriginCheck, get as getDestLocation } from '../utils/destination-location';
import { isFetchHeaders, isFetchRequest } from '../utils/dom';
import { overrideConstructor, overrideDescriptor, overrideFunction } from '../utils/overriding';
import * as browserUtils from '../utils/browser';
import { transformHeaderNameToBuiltin, transformHeaderNameToInternal } from '../utils/headers';
import CookieSandbox from './cookie';

const DEFAULT_REQUEST_CREDENTIALS = nativeMethods.Request ? new nativeMethods.Request(location.toString()).credentials : void 0;
const ADDITIONAL_CORS_RES_INFO    = 'hammerhead|additional-cors-res-info';

export default class FetchSandbox extends SandboxBaseWithDelayedSettings {
    readonly FETCH_REQUEST_SENT_EVENT = 'hammerhead|event|fetch-request-sent-event';

    constructor (readonly cookieSandbox: CookieSandbox, waitHammerheadSettings?: Promise<void>) {
        super(waitHammerheadSettings);
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

    static _entriesWrapper (...args: []) {
        const iterator   = nativeMethods.headersEntries.apply(this, args);
        const nativeNext = iterator.next;

        iterator.next = () => FetchSandbox._entriesFilteredNext(iterator, nativeNext);

        return iterator;
    }

    static _valuesWrapper (...args: []) {
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

        overrideDescriptor(window.Request.prototype, 'referrer', {
            getter: function (this: Request) {
                return getDestinationUrl(nativeMethods.requestReferrerGetter.call(this));
            }
        });

        overrideFunction(window, 'fetch', function (this: Window, ...args: [RequestInfo, RequestInit]) {
            if (sandbox.gettingSettingInProgress())
                return sandbox.delayUntilGetSettings(() => this.fetch.apply(this, args));

            // NOTE: Safari processed the empty `fetch()` request without `Promise` rejection (GH-1613)
            if (!args.length && !browserUtils.isSafari)
                return nativeMethods.fetch.apply(this, args);

            try {
                FetchSandbox._processArguments(args);
            }
            catch (e) {
                return nativeMethods.promiseReject.call(sandbox.window.Promise, e);
            }

            const [input, init] = args;
            const isRequest     = isFetchRequest(input);
            const url           = getDestinationUrl(isRequest ? nativeMethods.requestUrlGetter.call(input) : input);
            const requestMode   = isRequest ? (input as Request).mode : init && init.mode;
            const isSameOrigin  = sameOriginCheck(getDestLocation(), url);

            if (requestMode === 'same-origin' && !isSameOrigin)
                return nativeMethods.promiseReject.call(sandbox.window.Promise, new TypeError());

            window.Headers.prototype.entries = window.Headers.prototype[Symbol.iterator] = nativeMethods.headersEntries;

            const fetchPromise = nativeMethods.fetch.apply(this, args);

            window.Headers.prototype.entries = window.Headers.prototype[Symbol.iterator] = FetchSandbox._entriesWrapper;

            sandbox.emit(sandbox.FETCH_REQUEST_SENT_EVENT, fetchPromise);

            return nativeMethods.promiseThen.call(fetchPromise, response => {
                sandbox.cookieSandbox.syncCookie();

                if (!isSameOrigin) {
                    const isNoCorsMode = requestMode === 'no-cors';

                    nativeMethods.objectDefineProperty(response, ADDITIONAL_CORS_RES_INFO, {
                        value: {
                            status: isNoCorsMode ? 0 : nativeMethods.responseStatusGetter.call(response),
                            type:   isNoCorsMode ? 'opaque' : 'cors'
                        }
                    });
                }

                return response;
            });
        });

        overrideDescriptor(window.Response.prototype, 'type', {
            getter: function () {
                return this[ADDITIONAL_CORS_RES_INFO] ?
                       this[ADDITIONAL_CORS_RES_INFO].type :
                       nativeMethods.responseTypeGetter.call(this);
            }
        });

        overrideDescriptor(window.Response.prototype, 'status', {
            getter: function (this: Response) {
                return this[ADDITIONAL_CORS_RES_INFO] ?
                       this[ADDITIONAL_CORS_RES_INFO].status :
                       nativeMethods.responseStatusGetter.call(this);
            }
        });

        overrideDescriptor(window.Response.prototype, 'url', {
            getter: function () {
                return getDestinationUrl(nativeMethods.responseUrlGetter.call(this));
            }
        });

        overrideFunction(window.Headers.prototype, 'entries', FetchSandbox._entriesWrapper);
        overrideFunction(window.Headers.prototype, Symbol.iterator, FetchSandbox._entriesWrapper);

        overrideFunction(window.Headers.prototype, 'values', FetchSandbox._valuesWrapper);

        overrideFunction(window.Headers.prototype, 'forEach', function (this: Headers, ...args: [(value: string, key: string, parent: Headers) => void, any?]) {
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

        overrideFunction(window.Headers.prototype, 'get', function (this: Headers, ...args: [string]) {
            const [headerName] = args;

            args[0] = transformHeaderNameToInternal(headerName);

            const result = nativeMethods.headersGet.apply(this, args);

            if (result === null) {
                args[0] = headerName;

                return nativeMethods.headersGet.apply(this, args);
            }

            return result;
        });

        overrideFunction(window.Headers.prototype, 'has', function (this: Headers, ...args: [string]) {
            const [headerName] = args;

            args[0] = transformHeaderNameToInternal(headerName);

            const result = nativeMethods.headersHas.apply(this, args);

            if (!result) {
                args[0] = headerName;

                return nativeMethods.headersHas.apply(this, args);
            }

            return result;
        });

        overrideFunction(window.Headers.prototype, 'set', function (this: Headers, ...args: [string, string]) {
            args[0] = transformHeaderNameToInternal(args[0]);

            return nativeMethods.headersSet.apply(this, args);
        });
    }
}
