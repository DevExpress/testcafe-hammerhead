export default function extend (target, ...args) {
    target = target || {};

    let currentObj = null;
    let copy       = null;

    if (typeof target !== 'object' && target.toString() !== '[object Function]')
        target = {};

    for (let i = 0; i < args.length; i++) {
        currentObj = args[i];

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
