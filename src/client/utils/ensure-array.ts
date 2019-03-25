import nativeMethods from '../sandbox/native-methods';

export default function (value: any): Array<any> {
    return nativeMethods.arrayIsArray(value) ? value : [value];
}
