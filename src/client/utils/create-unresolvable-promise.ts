import noop from './noop';
// @ts-ignore
import Promise from 'pinkie';


export default function () {
    return new Promise(noop);
}
