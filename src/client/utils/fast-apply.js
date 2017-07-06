// OPTIMIZATION: http://jsperf.com/call-apply-optimization
export default function fastApply (owner, methName, args) {
    const meth = owner[methName];

    switch (args.length) {
        case 1:
            return meth.call(owner, args[0]);
        case 2:
            return meth.call(owner, args[0], args[1]);
        case 3:
            return meth.call(owner, args[0], args[1], args[2]);
        case 4:
            return meth.call(owner, args[0], args[1], args[2], args[3]);
        case 5:
            return meth.call(owner, args[0], args[1], args[2], args[3], args[4]);
        default:
            return meth.apply(owner, args);
    }
}
