import Promise from 'pinkie';
import nativeMethods from '../sandbox/native-methods';


export default function (): Promise<any> {
    return new Promise(resolve => nativeMethods.setTimeout.call(window, resolve, 0));
}
