import nativeMethods from '../sandbox/native-methods';

export default function throttle (func, ms) {
    var isSuspend = false;
    var savedArgs = null;
    var savedThis = null;

    function wrapper () {
        if (isSuspend) {
            savedArgs = arguments;
            savedThis = this;
            return;
        }

        func.apply(this, arguments);

        isSuspend = true;

        nativeMethods.setTimeout.call(window, () => {
            isSuspend = false;

            if (savedArgs) {
                wrapper.apply(savedThis, savedArgs);
                savedArgs = null;
                savedThis = null;
            }
        }, ms);
    }

    return wrapper;
}
