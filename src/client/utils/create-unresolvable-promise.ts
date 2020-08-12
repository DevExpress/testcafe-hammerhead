import noop from './noop';
import Promise from 'pinkie';


export default function () {
    return new Promise(noop);
}
