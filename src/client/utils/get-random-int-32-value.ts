import nativeMethods from '../sandbox/native-methods';

export default function (): number {
    // @ts-ignore
    const array = new nativeMethods.Uint32Array(1);

    nativeMethods.cryptoGetRandomValues.call(nativeMethods.crypto, array);

    return array[0];
}
