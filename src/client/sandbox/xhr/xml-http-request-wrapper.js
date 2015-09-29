// NOTE: We should wrap xhr response (B236741)
export default class XMLHttpRequestWrapper {
    constructor (xhr) {
        const XHR_PROPERTY_ACCESS_ERROR = 'hammerhead|xhr-property-access-error';

        var eventHandlers = [];

        var wrapFunc = (xhr, xhrWrapper, funcName) => {
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
        };

        var wrapProp = (xhr, xhrWrapper, propName) => {
            Object.defineProperty(xhrWrapper, propName, {
                get: () => {
                    if (propName.indexOf('on') === 0)
                        return typeof xhr[propName] === 'function' ? xhr[propName]('get') : xhr[propName];

                    return xhr[propName];
                },
                set: value => {
                    if (propName.indexOf('on') === 0) {
                        xhr[propName] = typeof value !== 'function' ? value : (func => function () {
                            return arguments[0] === 'get' ? func : func.apply(xhrWrapper, arguments);
                        })(value);
                    }
                    else
                        xhr[propName] = value;

                    return xhr[propName];
                }
            });
        };

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
}
