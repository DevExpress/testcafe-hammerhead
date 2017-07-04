export default function extend () {
    let target     = arguments[0] || {};
    let currentObj = null;
    let copy       = null;

    if (typeof target !== 'object' && target.toString() !== '[object Function]')
        target = {};

    for (let i = 1; i < arguments.length; i++) {
        currentObj = arguments[i];

        if (currentObj !== null) {
            for (const name in currentObj) {
                copy = currentObj[name];

                if (target !== copy && copy !== void 0)
                    target[name] = copy;
            }
        }
    }

    return target;
}
