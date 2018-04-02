import SandboxBase from './base';
import nativeMethods from './native-methods';
import XHR_HEADERS from '../../request-pipeline/xhr/headers';
import { getProxyUrl, parseProxyUrl } from '../utils/url';
import { getOriginHeader, sameOriginCheck, get as getDestLocation } from '../utils/destination-location';
import { isFetchHeaders, isFetchRequest } from '../utils/dom';
import SAME_ORIGIN_CHECK_FAILED_STATUS_CODE from '../../request-pipeline/xhr/same-origin-check-failed-status-code';
import { overrideDescriptor } from '../utils/property-overriding';

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

        /*eslint-disable no-restricted-properties*/
        if (isFetchHeaders(headers)) {
            headers.set(XHR_HEADERS.origin, originHeaderValue);
            headers.set(XHR_HEADERS.fetchRequestCredentials, requestCredentials);
        }
        else {
            headers[XHR_HEADERS.origin]                  = originHeaderValue;
            headers[XHR_HEADERS.fetchRequestCredentials] = requestCredentials;
        }
        /*eslint-enable no-restricted-properties*/

        init.headers = headers;

        return init;
    }

    static _processArguments (args) {
        const input               = args[0];
        const inputIsString       = typeof input === 'string';
        const inputIsFetchRequest = isFetchRequest(input);
        let init                  = args[1];

        if (inputIsString) {
            args[0] = getProxyUrl(input);
            init    = init || {};
            args[1] = FetchSandbox._addSpecialHeadersToRequestInit(init);
        }
        else if (inputIsFetchRequest && init)
            args[1] = FetchSandbox._addSpecialHeadersToRequestInit(init);
    }

    static _isValidRequestArgs (args) {
        return typeof args[0] === 'string' || isFetchRequest(args[0]);
    }

    static _requestIsValid (args) {
        if (!FetchSandbox._isValidRequestArgs(args))
            return false;

        let url         = null;
        let requestMode = null;

        if (isFetchRequest(args[0])) {
            url         = parseProxyUrl(args[0].url).destUrl;
            requestMode = args[0].mode;
        }
        else {
            url         = args[0];
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
            if (!args.length)
                return nativeMethods.fetch.apply(this);

            if (!FetchSandbox._requestIsValid(args))
                return sandbox.window.Promise.reject(new TypeError());

            FetchSandbox._processArguments(args);

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
