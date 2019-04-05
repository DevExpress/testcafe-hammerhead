import Promise from 'pinkie';
import nativeMethods from '../sandbox/native-methods';
/*eslint-disable no-unused-vars*/
import { ICheckByConditionOptions } from '../../typings/client';
/*eslint-enable no-unused-vars*/

const DEFAULT_CHECK_CONDITION_TIMEOUT: number = 100;
const DEFAULT_ABORT_TIMEOUT: number           = 5000;

export default function (predicate: Function, options: ICheckByConditionOptions = {}): Promise<void> {
    const checkConditionEveryMs = options.checkConditionEveryMs || DEFAULT_CHECK_CONDITION_TIMEOUT;
    const abortAfterMs          = options.abortAfterMs || DEFAULT_ABORT_TIMEOUT;
    const win                   = options.win || window;

    return new Promise<void>((resolve: Function, reject: Function) => {
        let checkIntervalId: number = null;
        let abortTimeoutId: number  = null;

        abortTimeoutId = nativeMethods.setTimeout.call(win, () => {
            nativeMethods.clearInterval.call(win, checkIntervalId);
            reject();
        }, abortAfterMs);

        checkIntervalId = nativeMethods.setInterval.call(win, () => {
            const result = predicate();

            if (result) {
                nativeMethods.clearInterval.call(win, checkIntervalId);
                nativeMethods.clearTimeout.call(win, abortTimeoutId);
                resolve();
            }

        }, checkConditionEveryMs);
    });
}
