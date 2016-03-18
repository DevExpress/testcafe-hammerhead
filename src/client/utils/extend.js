import { isObject, isUndefined } from '../../utils/types';

export default function extend () {
    var target     = arguments[0] || {};
    var currentObj = null;
    var copy       = null;

    if (!isObject(target) && target.toString() !== '[object Function]')
        target = {};

    for (var i = 1; i < arguments.length; i++) {
        currentObj = arguments[i];

        if (currentObj !== null) {
            for (var name in currentObj) {
                copy = currentObj[name];

                if (target !== copy && !isUndefined(copy))
                    target[name] = copy;
            }
        }
    }

    return target;
}
