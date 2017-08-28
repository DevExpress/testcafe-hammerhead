import fnBind from './fn-bind';
import nativeMethods from '../sandbox/native-methods';

export default function createEventObjWrapper (eventObj, replacements) {
    const proto   = {};
    const wrapper = nativeMethods.objectCreate.call(window.Object, proto);

    for (const key in eventObj) {
        let value = null;

        if (typeof eventObj[key] === 'function')
            value = fnBind(eventObj[key], eventObj);
        else if (replacements.hasOwnProperty(key))
            value = replacements[key];
        else
            value = eventObj[key];

        if (eventObj.hasOwnProperty(key))
            wrapper[key] = value;
        else
            proto[key] = value;
    }

    return wrapper;
}
