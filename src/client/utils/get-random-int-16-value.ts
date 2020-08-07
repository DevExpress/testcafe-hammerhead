import nativeMethods from '../sandbox/native-methods';

export default function (): number {
    const array = new nativeMethods.Uint16Array(1);

    nativeMethods.cryptoGetRandomValues.call(nativeMethods.crypto, array);

    return array[0];
}
