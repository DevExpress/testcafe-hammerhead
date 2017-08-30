import fnBind from './fn-bind';
import nativeMethods from '../sandbox/native-methods';

// NOTE: We cannot redefine 'origin' and 'data' properties of the 'message' event using Object.defineProperty method.
// It does not work in IE and Safari. This is why, we clone event properties and replace some of them.
export default function createEvent (sourceEvent, replacements) {
    const proto            = {};
    const destinationEvent = nativeMethods.objectCreate.call(window.Object, proto);

    for (const key in sourceEvent) {
        let value = null;

        if (typeof sourceEvent[key] === 'function')
            value = fnBind(sourceEvent[key], sourceEvent);
        else if (replacements.hasOwnProperty(key))
            value = replacements[key];
        else
            value = sourceEvent[key];

        if (sourceEvent.hasOwnProperty(key))
            destinationEvent[key] = value;
        else
            proto[key] = value;
    }

    return destinationEvent;
}
