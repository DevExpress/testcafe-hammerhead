import Promise from 'pinkie';
import nativeMethods from '../sandbox/native-methods';
/*eslint-disable no-unused-vars*/
import { ICheckByConditionOptions } from '../../typings/client';
/*eslint-enable no-unused-vars*/

const DEFAULT_CHECK_CONDITION_TIMEOUT: number = 100;
const DEFAULT_ABORT_TIMEOUT: number           = 5000;

export default function (predicate: Function, options: ICheckByConditionOptions | null): Promise<any> {
    options                       = options || {};
    options.checkConditionEveryMs = options.checkConditionEveryMs || DEFAULT_CHECK_CONDITION_TIMEOUT;
    options.abortAfterMs          = options.abortAfterMs || DEFAULT_ABORT_TIMEOUT;
    options.win                   = options.win || window;

    return new Promise<any>((resolve: Function, reject: Function) => {
        let checkIntervalId: number = null;
        let abortTimeoutId: number  = null;

        const clearTimeouts = () => {
            nativeMethods.clearInterval.call(options.win, checkIntervalId);
            nativeMethods.clearTimeout.call(options.win, abortTimeoutId);
        };

        abortTimeoutId = nativeMethods.setTimeout.call(options.win, () => {
            clearTimeouts();
            reject();
        }, options.abortAfterMs);

        checkIntervalId = nativeMethods.setInterval.call(options.win, () => {
            const result = predicate();

            if (result)
                resolve();

        }, options.checkConditionEveryMs);
    });
}
