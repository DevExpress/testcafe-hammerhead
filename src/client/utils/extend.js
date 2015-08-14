export default function extend () {
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
