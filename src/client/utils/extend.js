export default function extend () {
    var target     = arguments[0] || {};
    var currentObj = null;
    var copy       = null;

    if (typeof target !== 'object' && target.toString() !== '[object Function]')
        target = {};

    for (var i = 1; i < arguments.length; i++) {
        currentObj = arguments[i];

        if (currentObj !== null) {
            for (var name in currentObj) {
                copy = currentObj[name];

                if (target !== copy && typeof copy !== 'undefined')
                    target[name] = copy;
            }
        }
    }

    return target;
}
