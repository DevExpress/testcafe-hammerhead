// @ts-ignore
import pify from 'pify';

export default function (fn: Function) {
    return pify(fn, Promise);
}
