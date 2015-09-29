import SandboxBase from '../base';
import { isNullOrUndefined, inaccessibleTypeToStr, isWindow, isDocument } from '../../utils/types';
import { DOCUMENT_WRITE_BEGIN_PARAM, DOCUMENT_WRITE_END_PARAM, CALL_METHOD_METH_NAME } from '../../../processing/js';

export default class MethodCallInstrumentation extends SandboxBase {
    constructor (sandbox) {
        super(sandbox);

        this.methodWrappers = {
            postMessage: {
                condition: window => isWindow(window),
                method:    (contentWindow, args) => this.sandbox.message.postMessage(contentWindow, args)
            },

            write: {
                condition: document => !isDocument(document),
                method:    (document, args) => document.write.apply(document, MethodCallInstrumentation._removeOurWriteMethArgs(args))
            },

            writeln: {
                condition: document => !isDocument(document),
                method:    (document, args) => document.writeln.apply(document, MethodCallInstrumentation._removeOurWriteMethArgs(args))
            }
        };
    }

    //NOTE: isolate throw statement into separate function because JS engines doesn't optimize such functions.
    static _error (msg) {
        throw new Error(msg);
    }

    static _removeOurWriteMethArgs (args) {
        if (args.length) {
            var lastArg = args[args.length - 1];

            if (lastArg === DOCUMENT_WRITE_BEGIN_PARAM || lastArg === DOCUMENT_WRITE_END_PARAM) {
                var result = Array.prototype.slice.call(args);

                result.pop();

                return result;
            }
        }

        return args;
    }

    attach (window) {
        super.attach(window);

        window[CALL_METHOD_METH_NAME] = (owner, methName, args) => {
            if (isNullOrUndefined(owner)) {
                MethodCallInstrumentation._error('Cannot call method \'' + methName + '\' of ' +
                                                 inaccessibleTypeToStr(owner));
            }

            if (typeof owner[methName] !== 'function')
                MethodCallInstrumentation._error('\'' + methName + '\' is not a function');

            if (typeof methName !== 'string' || !this.methodWrappers.hasOwnProperty(methName))
                return owner[methName].apply(owner, args);

            return this.methodWrappers[methName].condition(owner) ?
                   this.methodWrappers[methName].method(owner, args) : owner[methName].apply(owner, args);
        };
    }
}
