import INTERNAL_ATTRS from '../../../processing/dom/internal-attributes';
import SandboxBase from '../base';
import { isNullOrUndefined, inaccessibleTypeToStr } from '../../utils/types';
import INTERNAL_LITERAL from '../../../processing/script/internal-literal';
import INSTRUCTION from '../../../processing/script/instruction';
import { shouldInstrumentMethod } from '../../../processing/script/instrumented';
import { isWindow, isDocument } from '../../utils/dom';
import fastApply from '../../utils/fast-apply';

// NOTE: We should avoid using native object prototype methods,
// since they can be overriden by the client code. (GH-245)
var arraySlice = Array.prototype.slice;

export default class MethodCallInstrumentation extends SandboxBase {
    constructor (messageSandbox) {
        super();

        this.methodWrappers = {
            postMessage: {
                condition: window => isWindow(window),
                method:    (contentWindow, args) => messageSandbox.postMessage(contentWindow, args)
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

    // NOTE: Isolate throw statement into a separate function because JS engine doesn't optimize such functions.
    static _error (msg) {
        throw new Error(msg);
    }

    static _removeOurWriteMethArgs (args) {
        if (args.length) {
            var lastArg = args[args.length - 1];

            if (lastArg === INTERNAL_LITERAL.documentWriteBegin || lastArg === INTERNAL_LITERAL.documentWriteEnd) {
                var result = arraySlice.call(args);

                result.pop();

                return result;
            }
        }

        return args;
    }

    attach (window) {
        super.attach(window);

        window[INSTRUCTION.callMethod] = (owner, methName, args) => {
            if (isNullOrUndefined(owner))
                MethodCallInstrumentation._error(`Cannot call method '${methName}' of ${inaccessibleTypeToStr(owner)}`);

            if (typeof owner[methName] !== 'function')
                MethodCallInstrumentation._error(`'${methName}' is not a function`);

            // OPTIMIZATION: previously we've performed the
            // `this.methodWrappers.hasOwnProperty(methName)`
            // check which is quite slow. Now we use the
            // fast RegExp check instead.
            if (typeof methName === 'string' && shouldInstrumentMethod(methName) &&
                this.methodWrappers[methName].condition(owner))
                return this.methodWrappers[methName].method(owner, args);

            return fastApply(owner, methName, args);
        };
    }

    static _replaceFocusPseudoClass (selector) {
        return selector.replace(/\s*:focus\b/gi, '[' + INTERNAL_ATTRS.focusPseudoClass + ']');
    }
}
