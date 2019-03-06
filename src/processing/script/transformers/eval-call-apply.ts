// -------------------------------------------------------------
// WARNING: this file is used by both the client and the server.
// Do not use any browser or node-specific API!
// -------------------------------------------------------------

/*eslint-disable no-unused-vars*/
import { CallExpression, Identifier, MemberExpression } from 'estree';
import { Transformer } from './index';
/*eslint-enable no-unused-vars*/
import { createProcessScriptMethCall } from '../node-builder';
import { Syntax } from 'esotope-hammerhead';
import replaceNode from './replace-node';

const INVOCATION_FUNC_NAME_RE = /^(call|apply)$/;

// Transform:
// eval.call(ctx, script);
// eval.apply(ctx, script); -->
// eval.call(ctx, __proc$Script(script));
// eval.apply(ctx, __proc$Script(script, true));

const transformer: Transformer = {
    nodeReplacementRequireTransform: false,

    nodeTypes: Syntax.CallExpression,

    condition: (node: CallExpression): boolean => {
        // eval.<meth>(ctx, script, ...)
        if (node.arguments.length < 2)
            return false;

        if (node.callee.type === Syntax.MemberExpression && node.callee.property.type === Syntax.Identifier &&
            INVOCATION_FUNC_NAME_RE.test(node.callee.property.name)) {
            const obj = node.callee.object;

            // eval.<meth>()
            if (obj.type === Syntax.Identifier && obj.name === 'eval')
                return true;

            // obj.eval.<meth>(), obj[eval].<meth>()
            if (obj.type === Syntax.MemberExpression &&
                (obj.property.type === Syntax.Identifier && obj.property.name ||
                 obj.property.type === Syntax.Literal && obj.property.value) === 'eval')
                return true;
        }

        return false;
    },

    run: (node: CallExpression) => {
        const callee   = <MemberExpression>node.callee;
        const property = <Identifier>callee.property;
        const newArg   = createProcessScriptMethCall(node.arguments[1], property.name === 'apply');

        replaceNode(node.arguments[1], newArg, node, 'arguments');

        return null;
    }
};

export default transformer;
