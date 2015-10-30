import SandboxBase from '../base';
import XMLHttpRequestWrapper from './xml-http-request-wrapper';
import nativeMethods from '../native-methods';
import { getProxyUrl } from '../../utils/url';
import XHR_HEADERS from '../../../request-pipeline/xhr/headers';

export default class XhrSandbox extends SandboxBase {
    constructor (sandbox) {
        super(sandbox);

        this.XHR_COMPLETED_EVENT = 'hammerhead|event|xhr-completed';
        this.XHR_ERROR_EVENT     = 'hammerhead|event|xhr-error';
        this.XHR_SEND_EVENT      = 'hammerhead|event|xhr-send';

        this.corsSupported = false;
    }

    // Barrier
    _proxyXhrMethods (xhr) {
        var open       = xhr.open;
        var send       = xhr.send;
        var abort      = xhr.abort;
        var xhrSandbox = this;

        xhr.abort = () => {
            abort.call(xhr);
            this.emit(this.XHR_ERROR_EVENT, {
                err: new Error('XHR aborted'),
                xhr: xhr
            });
        };

        // NOTE: Redirect all requests to the Hammerhead proxy and ensure that requests don't
        // violate Same Origin Policy.
        xhr.open = function (method, url, async, user, password) {
            try {
                url = getProxyUrl(url);
            }
            catch (err) {
                xhrSandbox.emit(xhrSandbox.XHR_ERROR_EVENT, { err, xhr });

                return;
            }

            // NOTE: The 'async' argument is true by default. However, when the 'async' argument is set to â€˜undefinedâ€™,
            // a browser (Chrome, FireFox) sets it to 'false', and a request becomes synchronous (B238528).
            if (arguments.length === 2)
                open.call(xhr, method, url);
            else
                open.call(xhr, method, url, async, user, password);
        };

        xhr.send = function () {
            xhrSandbox.emit(xhrSandbox.XHR_SEND_EVENT, { xhr });

            var orscHandler = () => {
                if (xhr.readyState === 4)
                    xhrSandbox.emit(xhrSandbox.XHR_COMPLETED_EVENT, { xhr });
            };

            // NOTE: If we're using the sync mode or the response is in cache and the object has been retrieved
            // directly (IE6 & IE7), we need to raise the callback manually.
            if (xhr.readyState === 4)
                orscHandler();
            else {
                // NOTE: Get out of the current execution tick and then proxy onreadystatechange,
                // because jQuery assigns a handler after the send() method was called.
                nativeMethods.setTimeout.call(xhrSandbox.window, () => {
                    // NOTE: If the state is already changed, we just call the handler without proxying
                    // onreadystatechange.
                    if (xhr.readyState === 4)
                        orscHandler();

                    else if (typeof xhr.onreadystatechange === 'function') {
                        var originalHandler = xhr.onreadystatechange;

                        xhr.onreadystatechange = progress => {
                            orscHandler();
                            originalHandler.call(xhr, progress);
                        };
                    }
                    else
                        xhr.addEventListener('readystatechange', orscHandler, false);
                }, 0);
            }

            // NOTE: Add the XHR request mark, so that a proxy can recognize a request as a XHR request. As all
            // requests are passed to the proxy, we need to perform Same Origin Policy compliance checks on the
            // server side. So, we pass the CORS support flag to inform the proxy that it can analyze the
            // Access-Control_Allow_Origin flag and skip "preflight" requests.
            xhr.setRequestHeader(XHR_HEADERS.requestMarker, 'true');

            if (xhrSandbox.corsSupported)
                xhr.setRequestHeader(XHR_HEADERS.corsSupported, 'true');

            if (xhr.withCredentials)
                xhr.setRequestHeader(XHR_HEADERS.withCredentials, 'true');

            send.apply(xhr, arguments);
        };
    }

    attach (window) {
        super.attach(window);

        window.XMLHttpRequest = () => {
            var xhr            = new nativeMethods.XMLHttpRequest();

            this._proxyXhrMethods(xhr);
            this.corsSupported = typeof xhr.withCredentials !== 'undefined';

            // NOTE: Emulate CORS, so that 3rd party libs (e.g. jQuery) allow requests with the proxy host as well as
            // the origin page host.
            if (!this.corsSupported)
                xhr.withCredentials = false;

            XMLHttpRequestWrapper.prototype = xhr;

            return new XMLHttpRequestWrapper(xhr);
        };
    }
}
