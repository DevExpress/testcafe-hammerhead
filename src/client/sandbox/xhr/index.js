import SandboxBase from '../base';
import XMLHttpRequestWrapper from './xml-http-request-wrapper';
import settings from '../../settings';
import nativeMethods from '../native-methods';
import { getProxyUrl } from '../../utils/url';
import XHR_HEADERS from '../../../request-pipeline/xhr/headers';

const SERVICE_MSG_REQUEST_FLAG = 'hammerhead|service-msg-request-flag';

export default class XhrSandbox extends SandboxBase {
    constructor (sandbox) {
        super(sandbox);

        this.XHR_COMPLETED_EVENT = 'hammerhead|event|xhr-completed';
        this.XHR_ERROR_EVENT     = 'hammerhead|event|xhr-error';
        this.XHR_SEND_EVENT      = 'hammerhead|event|xhr-send';

        this.corsSupported = false;
    }

    //Barrier
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

        //NOTE: redirect all requests to TestCafe proxy and ensure that request don't violate Same Origin Policy
        xhr.open = function (method, url, async, user, password) {
            if (url === settings.get().serviceMsgUrl)
                xhr[SERVICE_MSG_REQUEST_FLAG] = true;
            else {
                try {
                    url = getProxyUrl(url);
                }
                catch (err) {
                    xhrSandbox.emit(xhrSandbox.XHR_ERROR_EVENT, {
                        err: err,
                        xhr: xhr
                    });

                    return;
                }
            }

            //NOTE: the 'async' argument is true by default. But when you send 'undefined' as the 'async' argument
            // a browser (Chrome, FF) casts it to 'false', and request becomes synchronous (B238528).
            if (arguments.length === 2)
                open.call(xhr, method, url);
            else
                open.call(xhr, method, url, async, user, password);
        };

        xhr.send = function () {
            if (!xhr[SERVICE_MSG_REQUEST_FLAG]) {
                xhrSandbox.emit(xhrSandbox.XHR_SEND_EVENT, { xhr: xhr });

                var orscHandler = () => {
                    if (xhr.readyState === 4)
                        xhrSandbox.emit(xhrSandbox.XHR_COMPLETED_EVENT, { xhr: xhr });
                };

                //NOTE: if we're in sync mode or it's in cache and has been retrieved directly (IE6 & IE7)
                //we need to manually fire the callback
                if (xhr.readyState === 4)
                    orscHandler();
                else {
                    //NOTE: get out of current execution tick and when proxy onreadystatechange.
                    //Because e.g. jQuery assigns handler after send() was called.
                    nativeMethods.setTimeout.call(xhrSandbox.window, () => {
                        //NOTE: if state already changed we just call handler without onreadystatechange proxying
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
            }

            //NOTE: add XHR request mark, so proxy can recognize it as XHR request.
            //Due to the fact that all requests are passed to the proxy we need to perform all Same Origin Policy
            //compliance checks on server side. So we pass CORS support flag as well to inform proxy that it can
            //analyze Access-Control_Allow_Origin flag and skip "preflight" requests.
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

            //NOTE: emulate CORS, so 3rd party libs (e.g. jQuery) will allow requests with proxy host and
            //origin page host as well
            if (!this.corsSupported)
                xhr.withCredentials = false;

            XMLHttpRequestWrapper.prototype = xhr;

            return new XMLHttpRequestWrapper(xhr);
        };
    }
}
