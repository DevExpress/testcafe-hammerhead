import { processScript } from '../../../processing/script';
import nativeMethods from '../native-methods';

export default function (...args) {
    const functionBodyArgIndex = args.length - 1;

    if (typeof args[functionBodyArgIndex] === 'string')
        args[functionBodyArgIndex] = processScript(args[functionBodyArgIndex], false);

    return nativeMethods.Function.apply(this, args);
}
