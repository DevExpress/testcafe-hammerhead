// -------------------------------------------------------------
// WARNING: this file is used by both the client and the server.
// Do not use any browser or node-specific API!
// -------------------------------------------------------------

import { createProcessScriptMethCall } from '../node-builder';
import { Syntax } from '../tools/esotope';
import replaceNode from './replace-node';

const INVOCATION_FUNC_NAME_RE = /^(call|apply)$/;

// Transform:
// eval.call(ctx, script);
// eval.apply(ctx, script); -->
// eval.call(ctx, __proc$Script(script));
// eval.apply(ctx, __proc$Script(script, true));

export default {
    nodeReplacementRequireTransform: false,

    nodeTypes: [Syntax.CallExpression],

    condition: node => {
        // eval.<meth>(ctx, script, ...)
        if (node.arguments.length < 2)
            return false;

        if (node.callee.type === Syntax.MemberExpression && INVOCATION_FUNC_NAME_RE.test(node.callee.property.name)) {
            var obj = node.callee.object;

            // obj.eval.<meth>(), obj[eval].<meth>(),
            if (obj.type === Syntax.MemberExpression && (obj.property.value || obj.property.name) === 'eval')
                return true;

            // eval.<meth>()
            if (obj.name === 'eval')
                return true;
        }

        return false;
    },

    run: node => {
        var isApply = node.callee.property.name === 'apply';
        var newArg  = createProcessScriptMethCall(node.arguments[1], isApply);

        replaceNode(node.arguments[1], newArg, node, 'arguments');

        return null;
    }
};
