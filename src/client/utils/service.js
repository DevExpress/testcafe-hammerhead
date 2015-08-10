// We can't use 'obj instanceof $' check because it depends on instance of the jQuery.
export function isJQueryObj (obj) {
    return obj && !!obj.jquery;
}

export function createPropertyDesc (descBase) {
    descBase.configurable = true;
    descBase.enumerable   = true;

    return descBase;
}

export function extend () {
    var target = arguments[0] || {};

    if (typeof target !== 'object' && target.toString() !== '[object Function]')
        target = {};

    for (var i = 1; i < arguments.length; i++) {
        for (var key in arguments[i]) {
            if (arguments[i].hasOwnProperty(key))
                target[key] = arguments[i][key];
        }
    }

    return target;
}

/*eslint-disable no-loop-func*/

export function asyncForEach (arr, iterator, callback) {
    var completed = 0;

    for (var i = 0; i < arr.length; i++) {
        iterator(arr[i], function (err) {
            if (err) {
                callback(err);
                callback = function () {
                };
            }
            else {
                completed++;

                if (completed === arr.length)
                    callback();
            }
        });
    }
}

/*eslint-disable no-loop-func*/

export function asyncForEachSeries (arr, iterator, callback) {
    callback = callback || function () {};

    if (!arr.length) {
        return callback();
    }

    var completed = 0;
    var iterate = function () {
        iterator(arr[completed], function (err) {
            if (err) {
                callback(err);
                callback = function () {
                };
            }
            else {
                completed += 1;
                if (completed === arr.length) {
                    callback();
                }
                else {
                    iterate();
                }
            }
        });
    };

    iterate();
}

export function asyncSeries (tasks, callback) {
    callback = callback || function () {
        };

    var results = {};

    asyncForEachSeries(Object.keys(tasks), function (k, callback) {
        tasks[k](function (err) {
            var args = Array.prototype.slice.call(arguments, 1);

            if (args.length <= 1) {
                args = args[0];
            }
            results[k] = args;
            callback(err);
        });
    }, function (err) {
        callback(err, results);
    });
}

// Event Emitter
export var EventEmitter = function () {
    this.eventsListeners = [];
};

EventEmitter.prototype.emit = function (evt) {
    var listeners = this.eventsListeners[evt];

    if (listeners) {
        for (var i = 0; i < listeners.length; i++) {
            try {
                if (listeners[i])
                    listeners[i].apply(this, Array.prototype.slice.apply(arguments, [1]));
            }
            catch (e) {
                // Hack for IE: after document.write calling IFrameSandbox event handlers
                // rises 'Can't execute code from a freed script' exception because document has been
                // recreated
                if (e.message && e.message.indexOf('freed script') > -1)
                    listeners[i] = null;
                else
                    throw e;
            }
        }
    }
};

EventEmitter.prototype.off = function (evt, listener) {
    var listeners = this.eventsListeners[evt];

    if (listeners) {
        this.eventsListeners[evt] = listeners.filter(function (item) {
            return item !== listener;
        });
    }
};

EventEmitter.prototype.on = function (evt, listener) {
    if (!this.eventsListeners[evt])
        this.eventsListeners[evt] = [];

    this.eventsListeners[evt].push(listener);
};
