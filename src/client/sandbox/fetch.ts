import Promise from 'pinkie';
import SandboxBaseWithDelayedSettings from '../worker/sandbox-base-with-delayed-settings';
import nativeMethods from './native-methods';
import INTERNAL_HEADERS from '../../request-pipeline/internal-header-names';
import BUILTIN_HEADERS from '../../request-pipeline/builtin-header-names';
import { getAjaxProxyUrl, getDestinationUrl } from '../utils/url';
import { isFetchHeaders, isFetchRequest } from '../utils/dom';
import { overrideConstructor, overrideDescriptor, overrideFunction } from '../utils/overriding';
import * as browserUtils from '../utils/browser';
import { transformHeaderNameToBuiltin, transformHeaderNameToInternal } from '../utils/headers';
import CookieSandbox from './cookie';
import { Credentials } from '../../utils/url';

function getCredentialsMode (credentialsOpt: any) {
    credentialsOpt = String(credentialsOpt).toLowerCase();

    switch (credentialsOpt) {
        case 'omit': return Credentials.omit;
        case 'same-origin': return Credentials.sameOrigin;
        case 'include': return Credentials.include;
        default: return Credentials.unknown;
    }
}

const DEFAULT_REQUEST_CREDENTIALS = getCredentialsMode(nativeMethods.Request && new nativeMethods.Request(location.toString()).credentials);

export default class FetchSandbox extends SandboxBaseWithDelayedSettings {
    readonly FETCH_REQUEST_SENT_EVENT = 'hammerhead|event|fetch-request-sent-event';

    constructor (readonly cookieSandbox: CookieSandbox, waitHammerheadSettings?: Promise<void>) {
        super(waitHammerheadSettings);
    }

    private static _processInit (init) {
        let headers = init.headers;

        if (!headers)
            return init;

        if (!isFetchHeaders(headers)) {
            // @ts-ignore
            headers      = headers ? new nativeMethods.Headers(headers) : new nativeMethods.Headers();
            init.headers = headers;
        }

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
        const optsCredentials     = getCredentialsMode(init && init.credentials);

        if (!inputIsFetchRequest) {
            const url         = inputIsString ? input : String(input);
            const credentials = optsCredentials === Credentials.unknown ? DEFAULT_REQUEST_CREDENTIALS : optsCredentials;

            args[0] = getAjaxProxyUrl(url, credentials);
            args[1] = FetchSandbox._processInit(init || {});
        }
        else {
            if (optsCredentials !== Credentials.unknown)
                args[0] = getAjaxProxyUrl(input.url, optsCredentials);

            if (init && init.headers && input.destination !== 'worker')
                args[1] = FetchSandbox._processInit(init);
        }
    }

    static _entriesFilteredNext (iterator, nativeNext) {
        const entry = nativeNext.apply(iterator);

        if (entry.done)
            return entry;

        const headerName = entry.value[0]; // eslint-disable-line no-restricted-properties

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

            window.Headers.prototype.entries = window.Headers.prototype[Symbol.iterator] = nativeMethods.headersEntries;

            const fetchPromise = nativeMethods.fetch.apply(this, args);

            window.Headers.prototype.entries = window.Headers.prototype[Symbol.iterator] = FetchSandbox._entriesWrapper;

            sandbox.emit(sandbox.FETCH_REQUEST_SENT_EVENT, fetchPromise);

            return nativeMethods.promiseThen.call(fetchPromise, response => {
                sandbox.cookieSandbox.syncCookie();

                return response;
            });
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
