import NativeMethods from './native-methods';
import Const from '../../const';
import UrlUtil from '../util/url';
import * as Service from '../util/service';
import Settings from '../settings';

const SERVICE_MSG_REQUEST_FLAG  = 'is_tc_req-c8f5bd4f';
const XHR_PROPERTY_ACCESS_ERROR = 'INVALID_STATE_ERR';

var corsSupported = false;

//Event
export const XHR_COMPLETED = 'xhrCompleted';
export const XHR_ERROR     = 'xhrError';
export const XHR_SEND      = 'xhrSend';

var eventEmitter = new Service.EventEmitter();

export var on = eventEmitter.on.bind(eventEmitter);

// NOTE: We should wrap xhr response (B236741)
function XMLHttpRequestWrapper (xhr) {
    var eventHandlers = [];

    function wrapFunc (xhr, xhrWrapper, funcName) {
        xhrWrapper[funcName] = function () {
            var args   = Array.prototype.slice.call(arguments);
            var isFunc = typeof args[1] === 'function';

            if (funcName === 'addEventListener' && isFunc) {
                var originHandler  = args[1];
                var wrappedHandler = function () {
                    originHandler.apply(xhrWrapper, arguments);
                };

                args[1] = wrappedHandler;

                eventHandlers.push({
                    origin:  originHandler,
                    wrapped: wrappedHandler
                });
            }
            else if (funcName === 'removeEventListener' && isFunc) {
                for (var i = 0; i < eventHandlers.length; i++) {
                    if (eventHandlers[i].origin === args[1]) {
                        args[1] = eventHandlers[i].wrapped;
                        eventHandlers.splice(i, 1);

                        break;
                    }
                }
            }

            return xhr[funcName].apply(xhr, args);
        };
    }

    function wrapProp (xhr, xhrWrapper, propName) {
        Object.defineProperty(xhrWrapper, propName, {
            get: function () {
                if (propName.indexOf('on') === 0)
                    return typeof xhr[propName] === 'function' ? xhr[propName]('get') : xhr[propName];

                return xhr[propName];
            },
            set: function (value) {
                /*eslint-disable indent */
                if (propName.indexOf('on') === 0) {
                    xhr[propName] = typeof value !== 'function' ? value : (function (func) {
                        return function () {
                            return arguments[0] === 'get' ? func : func.apply(xhrWrapper, arguments);
                        };
                    })(value);
                }
                else
                    xhr[propName] = value;
                /*eslint-enable indent */

                return xhr[propName];
            }
        });
    }

    for (var prop in xhr) {
        if (!Object.prototype.hasOwnProperty(prop)) {
            var isFunction = false;

            //in some cases xhr properties reading leads to error throwing (B253550, T177746)
            //if it happens we wrap these properties without reading them
            try {
                isFunction = typeof xhr[prop] === 'function';
            }
            catch (e) {
                if (e.message.indexOf(XHR_PROPERTY_ACCESS_ERROR) < 0)
                    throw e;
            }

            if (isFunction)
                wrapFunc(xhr, this, prop);
            else
                wrapProp(xhr, this, prop);
        }
    }
}

//Barrier
function proxyXhrMethods (xhr) {
    var open  = xhr.open;
    var send  = xhr.send;
    var abort = xhr.abort;

    xhr.abort = function () {
        abort.call(xhr);
        eventEmitter.emit(XHR_ERROR, {
            err: new Error('XHR aborted'),
            xhr: xhr
        });
    };

    //NOTE: redirect all requests to TestCafe proxy and ensure that request don't violate Same Origin Policy
    xhr.open = function (method, url, async, user, password) {
        if (url === Settings.get().SERVICE_MSG_URL)
            xhr[SERVICE_MSG_REQUEST_FLAG] = true;
        else {
            try {
                url = UrlUtil.getProxyUrl(url);
            }
            catch (err) {
                eventEmitter.emit(XHR_ERROR, {
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
            eventEmitter.emit(XHR_SEND, { xhr: xhr });

            var orscHandler = function () {
                if (xhr.readyState === 4)
                    eventEmitter.emit(XHR_COMPLETED, { xhr: xhr });
            };

            //NOTE: if we're in sync mode or it's in cache and has been retrieved directly (IE6 & IE7)
            //we need to manually fire the callback
            if (xhr.readyState === 4)
                orscHandler();
            else {
                //NOTE: get out of current execution tick and when proxy onreadystatechange.
                //Because e.g. jQuery assigns handler after send() was called.
                NativeMethods.setTimeout.call(window, function () {
                    //NOTE: if state already changed we just call handler without onreadystatechange proxying
                    /*eslint-disable indent */
                    if (xhr.readyState === 4)
                        orscHandler();

                    else if (typeof xhr.onreadystatechange === 'function') {
                        var originalHandler = xhr.onreadystatechange;

                        xhr.onreadystatechange = function (progress) {
                            orscHandler();
                            originalHandler.call(xhr, progress);
                        };
                    }
                    else
                        xhr.addEventListener('readystatechange', orscHandler, false);
                    /*eslint-enable indent */
                }, 0);
            }
        }

        /*jshint bitwise: false*/
        //NOTE: add XHR request mark, so proxy can recognize it as XHR request.
        //Due to the fact that all requests are passed to the proxy we need to perform all Same Origin Policy
        //compliance checks on server side. So we pass CORS support flag as well to inform proxy that it can
        //analyze Access-Control_Allow_Origin flag and skip "preflight" requests.
        xhr.setRequestHeader(Const.XHR_REQUEST_MARKER_HEADER,
            (corsSupported ? Const.XHR_CORS_SUPPORTED_FLAG : 0) |
            (xhr.withCredentials ? Const.XHR_WITH_CREDENTIALS_FLAG : 0)
        );
        /*jshint bitwise: true*/

        send.apply(xhr, arguments);
    };
}

export function init (window) {
    window.XMLHttpRequest = function () {
        var xhr = new NativeMethods.XMLHttpRequest();

        proxyXhrMethods(xhr);

        corsSupported = typeof xhr.withCredentials !== 'undefined';

        //NOTE: emulate CORS, so 3rd party libs (e.g. jQuery) will allow requests with proxy host and
        //origin page host as well
        if (!corsSupported)
            xhr.withCredentials = false;

        XMLHttpRequestWrapper.prototype = xhr;

        return new XMLHttpRequestWrapper(xhr);
    };
}
