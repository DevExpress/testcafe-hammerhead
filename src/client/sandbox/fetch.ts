import Promise from 'pinkie';
import SandboxBaseWithDelayedSettings from '../worker/sandbox-base-with-delayed-settings';
import nativeMethods from './native-methods';
import BUILTIN_HEADERS from '../../request-pipeline/builtin-header-names';
import { getAjaxProxyUrl, getDestinationUrl } from '../utils/url';
import { isFetchHeaders, isFetchRequest } from '../utils/dom';

import {
    overrideConstructor,
    overrideDescriptor,
    overrideFunction,
} from '../utils/overriding';

import * as browserUtils from '../utils/browser';
import CookieSandbox from './cookie';
import { Credentials } from '../../utils/url';
import {
    addAuthorizationPrefix, hasAuthorizationPrefix,
    isAuthenticateHeader,
    isAuthorizationHeader, removeAuthenticatePrefix,
    removeAuthorizationPrefix,
} from '../../utils/headers';

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

    private static _removeAuthHeadersPrefix (name: string, value: string) {
        if (isAuthorizationHeader(name))
            return removeAuthorizationPrefix(value);
        else if (isAuthenticateHeader(name))
            return removeAuthenticatePrefix(value);

        return value;
    }

    private static _processInit (init?: RequestInit) {
        let headers = init.headers;

        if (!headers)
            return init;

        if (!isFetchHeaders(headers)) {
            headers      = headers ? new nativeMethods.Headers(headers) : new nativeMethods.Headers();
            init.headers = headers;
        }

        const authorizationValue      = nativeMethods.headersGet.call(headers, BUILTIN_HEADERS.authorization);
        const proxyAuthorizationValue = nativeMethods.headersGet.call(headers, BUILTIN_HEADERS.proxyAuthorization);

        if (authorizationValue !== null && !hasAuthorizationPrefix(authorizationValue))
            nativeMethods.headersSet.call(headers, BUILTIN_HEADERS.authorization, addAuthorizationPrefix(authorizationValue));

        if (proxyAuthorizationValue !== null && !hasAuthorizationPrefix(proxyAuthorizationValue))
            nativeMethods.headersSet.call(headers, BUILTIN_HEADERS.proxyAuthorization, addAuthorizationPrefix(proxyAuthorizationValue));

        return init;
    }

    private static _processArguments (args: Parameters<Window['fetch']>) {
        const [input, init]   = args;
        const inputIsString   = typeof input === 'string';
        const optsCredentials = getCredentialsMode(init && init.credentials);

        if (!isFetchRequest(input)) {
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

    private static _processHeaderEntry (entry: IteratorResult<[string, string]>, isOnlyValue = false) {
        if (entry.done)
            return entry;

        /* eslint-disable no-restricted-properties */
        const processedValue = FetchSandbox._removeAuthHeadersPrefix(entry.value[0], entry.value[1]);

        if (isOnlyValue)
            entry.value = processedValue;
        else
            entry.value[1] = processedValue;
        /* eslint-enable no-restricted-properties */

        return entry;
    }

    private static _entriesWrapper (...args: Parameters<Headers['entries']>) {
        const iterator   = nativeMethods.headersEntries.apply(this, args);
        const nativeNext = iterator.next;

        iterator.next = () => FetchSandbox._processHeaderEntry(nativeNext.call(iterator));

        return iterator;
    }

    private static _valuesWrapper (...args: Parameters<Headers['values']>) {
        const iterator   = nativeMethods.headersEntries.apply(this, args);
        const nativeNext = iterator.next;

        iterator.next = () => FetchSandbox._processHeaderEntry(nativeNext.call(iterator), true);

        return iterator;
    }

    attach (window) {
        super.attach(window, window.document);

        if (!nativeMethods.fetch)
            return;

        const sandbox = this;

        overrideConstructor(window, 'Request', function (...args: ConstructorParameters<typeof Request>) {
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
            },
        });

        overrideDescriptor(window.Request.prototype, 'referrer', {
            getter: function (this: Request) {
                return getDestinationUrl(nativeMethods.requestReferrerGetter.call(this));
            },
        });

        overrideFunction(window, 'fetch', function (this: Window, ...args: Parameters<Window['fetch']>) {
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
            },
        });

        overrideFunction(window.Headers.prototype, 'entries', FetchSandbox._entriesWrapper);
        overrideFunction(window.Headers.prototype, Symbol.iterator, FetchSandbox._entriesWrapper);

        overrideFunction(window.Headers.prototype, 'values', FetchSandbox._valuesWrapper);

        overrideFunction(window.Headers.prototype, 'forEach', function (this: Headers, ...args: Parameters<Headers['forEach']>) {
            const callback = args[0];

            if (typeof callback === 'function') {
                args[0] = function (value, name, headers) {
                    value = FetchSandbox._removeAuthHeadersPrefix(name, value);

                    callback.call(this, value, name, headers);
                };
            }

            return nativeMethods.headersForEach.apply(this, args);
        });

        overrideFunction(window.Headers.prototype, 'get', function (this: Headers, ...args: Parameters<Headers['get']>) {
            const value = nativeMethods.headersGet.apply(this, args);

            return value && FetchSandbox._removeAuthHeadersPrefix(args[0], value);
        });

        overrideFunction(window.Headers.prototype, 'set', function (this: Headers, ...args: Parameters<Headers['set']>) {
            if (isAuthorizationHeader(args[0]))
                args[1] = addAuthorizationPrefix(args[1]);

            return nativeMethods.headersSet.apply(this, args);
        });
    }
}
