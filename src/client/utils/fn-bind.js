// OPTIMIZATION: http://jsperf.com/bind-apply
export default function fnBind (func, thisObj) {
    return function () {
        return func.apply(thisObj, arguments);
    };
}
