import fnBind from './fn-bind';
import nativeMethods from '../sandbox/native-methods';

export default function createEventObjWrapper (eventObj) {
    const proto   = {};
    const wrapper = nativeMethods.objectCreate.call(window.Object, proto);

    for (const key in eventObj) {
        const value = typeof eventObj[key] === 'function' ? fnBind(eventObj[key], eventObj) : eventObj[key];

        if (eventObj.hasOwnProperty(key))
            wrapper[key] = value;
        else
            proto[key] = value;
    }

    return wrapper;
}
