import SandboxBase from './base';
import nativeMethods from './native-methods';
import XHR_HEADERS from '../../request-pipeline/xhr/headers';
import { getProxyUrl, parseProxyUrl } from '../utils/url';
import { getOrigin, sameOriginCheck, get as getDestLocation } from '../utils/destination-location';
import { isFetchHeaders, isFetchRequest } from '../utils/dom';
import { SAME_ORIGIN_CHECK_FAILED_STATUS_CODE } from '../../request-pipeline/xhr/same-origin-policy';

export default class FetchSandbox extends SandboxBase {
    constructor () {
        super();

        this.FETCH_REQUEST_SEND_EVENT = 'hammerhead|event|fetch-request-send-event';
    }

    static _processRequestInit (init) {
        var defaultRequest     = new nativeMethods.Request('');
        var headers            = init.headers || {};
        var requestCredentials = init.credentials || defaultRequest.credentials;

        if (isFetchHeaders(headers)) {
            headers.append(XHR_HEADERS.origin, getOrigin());
            headers.append(XHR_HEADERS.fetchRequestCredentials, requestCredentials);
        }
        else {
            headers[XHR_HEADERS.origin]                  = getOrigin();
            headers[XHR_HEADERS.fetchRequestCredentials] = requestCredentials;
        }

        init.headers = headers;

        return init;
    }

    static _processArguments (args) {
        var input = args[0];
        var init  = args[1] || {};

        if (typeof input === 'string')
            args[0] = getProxyUrl(input);

        args[1] = FetchSandbox._processRequestInit(init);
    }

    static _isValidRequestArgs (args) {
        return typeof args[0] === 'string' || isFetchRequest(args[0]);
    }

    static _requestIsValid (args) {
        if (!FetchSandbox._isValidRequestArgs(args))
            return false;

        var url         = null;
        var requestMode = null;

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

    static _processFetchPromise (promise) {
        var originalThen = promise.then;

        promise.then = function (...args) {
            var originalThenHandler = args[0];

            args[0] = function (response) {
                if (response.status === 500)
                    throw new TypeError();

                Object.defineProperty(response, 'type', {
                    get:          () => FetchSandbox._getResponseType(response),
                    set:          () => void 0,
                    configurable: true
                });

                var responseStatus = response.status === SAME_ORIGIN_CHECK_FAILED_STATUS_CODE ? 0 : response.status;

                Object.defineProperty(response, 'status', {
                    get:          () => responseStatus,
                    set:          () => void 0,
                    configurable: true
                });

                return originalThenHandler.apply(this, arguments);
            };

            return originalThen.apply(this, args);
        };
    }

    static _getResponseType (response) {
        var parsedResponseUrl = parseProxyUrl(response.url);
        var destUrl           = parsedResponseUrl && parsedResponseUrl.destUrl;
        var isSameOrigin      = sameOriginCheck(getDestLocation(), destUrl, true);

        if (isSameOrigin)
            return 'basic';

        return response.status === 0 ? 'opaque' : 'cors';
    }

    attach (window) {
        super.attach(window, window.document);

        var sandbox = this;

        if (window.fetch) {
            window.Request = function (...args) {
                FetchSandbox._processArguments(args);

                if (args.length === 1)
                    return new nativeMethods.Request(args[0]);

                return new nativeMethods.Request(args[0], args[1]);
            };
            window.Request.prototype = nativeMethods.Request.prototype;

            window.fetch = function (...args) {
                if (!FetchSandbox._requestIsValid(args))
                    return sandbox.window.Promise.reject(new TypeError());

                FetchSandbox._processArguments(args);

                var fetchPromise = nativeMethods.fetch.apply(this, args);

                FetchSandbox._processFetchPromise(fetchPromise);
                sandbox.emit(sandbox.FETCH_REQUEST_SEND_EVENT, fetchPromise);

                return fetchPromise;
            };
        }
    }
}
