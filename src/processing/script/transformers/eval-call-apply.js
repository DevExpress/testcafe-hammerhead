// -------------------------------------------------------------
// WARNING: this file is used by both the client and the server.
// Do not use any browser or node-specific API!
// -------------------------------------------------------------

import { createProcessScriptMethCall } from '../node-builder';
import { Syntax } from '../tools/esotope';

const EVAL_FUNC_NAME_RE       = /^(eval|setTimeout|setInterval)$/;
const INVOCATION_FUNC_NAME_RE = /^(call|apply)$/;

// Transform:
// eval.call(ctx, script); setTimeout.call(ctx, script); setInterval.call(ctx, script);
// eval.apply(ctx, script); setTimeout.apply(ctx, script); setInterval.apply(ctx, script); -->
// eval.call(ctx, __proc$Script(script)); setTimeout.call(ctx, __proc$Script(script)); setInterval.call(ctx, __proc$Script(script));
// eval.apply(ctx, __proc$Script(script, true)); setTimeout.apply(ctx, __proc$Script(script, true)); setInterval.apply(ctx, __proc$Script(script, true));

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
            // obj.setTimeout.<meth>(), obj[setTimeout].<meth>(),
            // obj.setInterval.<meth>(), obj[setInterval].<meth>()
            if (obj.type === Syntax.MemberExpression && EVAL_FUNC_NAME_RE.test(obj.property.value || obj.property.name))
                return true;

            // eval.<meth>(), setTimeout.<meth>(), setInterval.<meth>()
            if (EVAL_FUNC_NAME_RE.test(obj.name))
                return true;
        }

        return false;
    },

    run: node => {
        var isApply = node.callee.property.name === 'apply';

        node.arguments[1] = createProcessScriptMethCall(node.arguments[1], isApply);

        return null;
    }
};
