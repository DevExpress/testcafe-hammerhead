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
    constructor () {
        super();

        this.FETCH_REQUEST_SENT_EVENT = 'hammerhead|event|fetch-request-sent-event';
    }

    static _addSpecialHeadersToRequestInit (init) {
        const headers            = init.headers || {};
        const requestCredentials = init.credentials || DEFAULT_REQUEST_CREDENTIALS;
        const originHeaderValue  = getOriginHeader();

        if (isFetchHeaders(headers)) {
            // eslint-disable-next-line no-restricted-properties
            headers.set(XHR_HEADERS.origin, originHeaderValue);
            headers.set(XHR_HEADERS.fetchRequestCredentials, requestCredentials);
        }
        else {
            // eslint-disable-next-line no-restricted-properties
            headers[XHR_HEADERS.origin]                  = originHeaderValue;
            headers[XHR_HEADERS.fetchRequestCredentials] = requestCredentials;
        }

        init.headers = headers;

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
            url         = parseProxyUrl(args[0]).destUrl;
            requestMode = (args[1] || {}).mode;
        }

        if (requestMode === 'same-origin')
            return sameOriginCheck(getDestLocation(), url, true);

        return true;
    }

    static _getResponseType (response) {
        const responseUrl       = nativeMethods.responseUrlGetter.call(response);
        const parsedResponseUrl = parseProxyUrl(responseUrl);
        const destUrl           = parsedResponseUrl && parsedResponseUrl.destUrl;
        const isSameOrigin      = sameOriginCheck(getDestLocation(), destUrl, true);

        if (isSameOrigin)
            return 'basic';

        return response.status === 0 ? 'opaque' : 'cors';
    }

    attach (window) {
        super.attach(window, window.document);

        if (!nativeMethods.fetch)
            return;

        const sandbox = this;

        window.Request           = function (...args) {
            FetchSandbox._processArguments(args);

            if (args.length === 1)
                return new nativeMethods.Request(args[0]);

            return new nativeMethods.Request(args[0], args[1]);
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
                return sandbox.window.Promise.reject(e);
            }

            if (!FetchSandbox._sameOriginCheck(args))
                return sandbox.window.Promise.reject(new TypeError());

            const fetchPromise = nativeMethods.fetch.apply(this, args);

            sandbox.emit(sandbox.FETCH_REQUEST_SENT_EVENT, fetchPromise);

            return fetchPromise;
        };

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
    }
}
