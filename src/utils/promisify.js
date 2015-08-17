import { Promise } from 'es6-promise';

export default function promisify (fn) {
    return function (...args) {
        return new Promise((resolve, reject) => {
            args.push((err, res) => {
                if (err)
                    reject(err);
                else
                    resolve(res);
            });

            var res             = fn.apply(this, args);
            var isPromiseResult = res &&
                                  (typeof res === 'object' || typeof res === 'function') &&
                                  typeof res.then === 'function';

            if (isPromiseResult)
                resolve(res);
        });
    };
}
