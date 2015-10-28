// -------------------------------------------------------------
// WARNING: this file is used by both the client and the server.
// Do not use any browser or node-specific API!
// -------------------------------------------------------------

import { createProcessScriptMethCall } from '../node-builder';
import { Syntax } from '../tools/esotope';

const EVAL_FUNC_NAME_RE = /^(eval|setTimeout|setInterval)$/;

// Transform:
// eval(script); setTimeout(script); setInterval(script);  -->
// eval(__proc$Script(script)); setTimeout(__proc$Script(script)); setInterval(__proc$Script(script));

export default {
    nodeReplacementRequireTransform: false,

    nodeTypes: [Syntax.CallExpression],

    condition: node => {
        if (!node.arguments.length)
            return false;

        // eval(), setTimeout(), setInterval()
        if (node.callee.type === Syntax.Identifier && EVAL_FUNC_NAME_RE.test(node.callee.name))
            return true;

        // obj.eval(), obj['eval'](),
        // obj.setTimeout(), obj['setTimeout'](),
        // obj.setInterval(), obj['setInterval']()
        return node.callee.type === Syntax.MemberExpression &&
               EVAL_FUNC_NAME_RE.test(node.callee.property.name || node.callee.property.value);
    },

    run: node => {
        node.arguments[0] = createProcessScriptMethCall(node.arguments[0]);

        return null;
    }
};
